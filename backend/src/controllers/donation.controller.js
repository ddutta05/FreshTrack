const mongoose = require("mongoose");
const Donation = require("../models/Donation");
const DonationRequest = require("../models/DonationRequest");
const Notification = require("../models/Notification");
const User = require("../models/User");
const asyncHandler = require("../utils/asyncHandler");
const { success, paginated } = require("../utils/apiResponse");
const { AppError } = require("../utils/errors");
const { getPagination, toPagination } = require("../utils/pagination");
const { DONATION_STATUS, USER_ROLES, REQUEST_STATUS } = require("../utils/constants");
const { toDonationClient, expireDonationsAndNotify } = require("../services/donation.service");
const { createOffer, toOfferClient } = require("../services/offer.service");
const { getPublicImpactStats } = require("../services/admin.service");
const { normalizeStoredImagePath } = require("../utils/imagePath");
const { processImageBuffer, isAllowedImageMimeType } = require("../utils/imageStorage");
const { parseGeoLocation } = require("../validators/geo.validator");
const { createNotification } = require("../services/notification.service");

async function resolveIncomingImage(req) {
  if (req.file) {
    if (!isAllowedImageMimeType(req.file.mimetype)) {
      throw new AppError("Unsupported image type", 422, "INVALID_IMAGE_MIME_TYPE");
    }

    return processImageBuffer(req.file.buffer, req.file.mimetype, req.file.originalname);
  }

  if (req.body.image === undefined) {
    return undefined;
  }

  const normalized = normalizeStoredImagePath(req.body.image);
  if (!normalized && req.body.image) {
    throw new AppError("Invalid image value", 422, "INVALID_IMAGE_VALUE");
  }

  return normalized;
}

const listDonations = asyncHandler(async (req, res) => {
  await expireDonationsAndNotify();

  const { page, limit, skip } = getPagination(req.query);
  const filter = {};

  if (!req.user) {
    filter.targetNgoId = { $exists: false };
  }

  if (req.query.category) {
    filter.category = req.query.category;
  }
  if (req.query.location) {
    filter.location = { $regex: req.query.location, $options: "i" };
  }
  if (req.query.status) {
    filter.status = req.query.status;
  }
  if (req.query.search) {
    filter.foodName = { $regex: req.query.search, $options: "i" };
  }

  if (req.user?.role === USER_ROLES.NGO && !req.query.status) {
    filter.status = { $in: [DONATION_STATUS.AVAILABLE, DONATION_STATUS.PENDING] };
    filter.$or = [{ targetNgoId: { $exists: false } }, { targetNgoId: req.user.id }];
  }

  if (req.user?.role === USER_ROLES.DONOR) {
    filter.targetNgoId = { $exists: false };
  }

  if (req.query.availability === "requestable") {
    filter.status = { $in: [DONATION_STATUS.AVAILABLE, DONATION_STATUS.PENDING] };
  }

  const allowedSortFields = ["createdAt", "availableUntil", "foodName", "category", "status"];
  const sortBy = allowedSortFields.includes(req.query.sortBy) ? req.query.sortBy : "createdAt";
  const sortOrder = req.query.sortOrder === "asc" ? 1 : -1;

  const [total, items] = await Promise.all([
    Donation.countDocuments(filter),
    Donation.find(filter)
      .populate("donorId", "name")
      .sort({ [sortBy]: sortOrder })
      .skip(skip)
      .limit(limit)
  ]);

  const mapped = items.map(toDonationClient);
  const pagination = toPagination(page, limit, total);

  if (req.query.page || req.query.limit) {
    return paginated(res, 200, "Donations fetched", mapped, pagination);
  }

  return success(res, 200, "Donations fetched", mapped);
});

const getDonationById = asyncHandler(async (req, res) => {
  await expireDonationsAndNotify();

  const donation = await Donation.findById(req.params.id).populate("donorId", "name phone email").populate("targetNgoId", "name organizationName");
  if (!donation) {
    throw new AppError("Donation not found", 404, "DONATION_NOT_FOUND");
  }
  const isParticipant = req.user && (donation.donorId._id?.toString() === req.user.id || donation.targetNgoId?._id?.toString() === req.user.id);
  if (donation.targetNgoId && !isParticipant && req.user?.role !== USER_ROLES.ADMIN) {
    throw new AppError("Donation not found", 404, "DONATION_NOT_FOUND");
  }

  return success(res, 200, "Donation fetched", toDonationClient(donation));
});

const getMyDonations = asyncHandler(async (req, res) => {
  await expireDonationsAndNotify();

  const { page, limit, skip } = getPagination(req.query);
  const filter = { donorId: req.user.id };
  if (req.query.status) {
    filter.status = req.query.status;
  }

  const [total, items] = await Promise.all([
    Donation.countDocuments(filter),
    Donation.find(filter).populate("donorId", "name").populate("targetNgoId", "name organizationName").sort({ createdAt: -1 }).skip(skip).limit(limit)
  ]);

  const mapped = items.map(toDonationClient);
  const offerRequests = await DonationRequest.find({ donationId: { $in: items.map((item) => item._id) }, direction: "donor_offer" }).select("donationId status");
  const offerStatus = new Map(offerRequests.map((request) => [request.donationId.toString(), request.status]));
  mapped.forEach((item) => { if (item.targetNgoId) item.offerStatus = offerStatus.get(item.id) || "pending"; });
  const pagination = toPagination(page, limit, total);

  if (req.query.page || req.query.limit) {
    return paginated(res, 200, "My donations fetched", mapped, pagination);
  }

  return success(res, 200, "My donations fetched", mapped);
});

const createDonation = asyncHandler(async (req, res) => {
  const availableUntil = new Date(req.body.availableUntil);
  if (Number.isNaN(availableUntil.getTime()) || availableUntil <= new Date()) {
    throw new AppError("availableUntil must be a future date", 422, "INVALID_AVAILABLE_UNTIL");
  }

  const imagePath = await resolveIncomingImage(req);

  const geoLocation = parseGeoLocation(req.body.geoLocation);

  const quantityValue =
    req.body.quantityValue !== undefined && req.body.quantityValue !== null && req.body.quantityValue !== ""
      ? Number(req.body.quantityValue)
      : undefined;
  const quantityUnit = req.body.quantityUnit || undefined;

  const quantity = `${quantityValue} ${quantityUnit}`;
  const donationData = {
    foodName: req.body.foodName,
    category: req.body.category,
    quantity,
    description: req.body.description,
    ...(imagePath ? { image: imagePath } : {}),
    location: req.body.location,
    availableUntil,
    donorId: req.user.id,
    status: DONATION_STATUS.AVAILABLE
  };

  if (geoLocation) {
    donationData.geoLocation = geoLocation;
  }
  if (quantityValue !== undefined && !Number.isNaN(quantityValue)) {
    donationData.quantityValue = quantityValue;
  }
  if (quantityUnit) {
    donationData.quantityUnit = quantityUnit;
  }

  if (req.body.targetNgoId) {
    const offer = await createOffer({
      donorId: req.user.id,
      ngoId: req.body.targetNgoId,
      foodName: req.body.foodName,
      category: req.body.category,
      quantityValue: req.body.quantityValue,
      quantityUnit: req.body.quantityUnit,
      description: req.body.description,
      image: imagePath,
      location: req.body.location,
      geoLocation: geoLocation || undefined,
      availableUntil: req.body.availableUntil,
      message: req.body.offerMessage || req.body.message || "Direct donation offer"
    });

    const hydrated = await require("../models/DonationOffer").findById(offer._id)
      .populate("donorId", "name phone email")
      .populate("ngoId", "name organizationName location acceptedCategories currentNeedDescription isAcceptingDonations operatingRadiusKm phone email");

    return success(res, 201, "Donation offer created successfully", toOfferClient(hydrated, req.user));
  }

  const donation = await Donation.create(donationData);

  const created = await Donation.findById(donation._id).populate("donorId", "name").populate("targetNgoId", "name organizationName");
  return success(res, 201, "Donation created successfully", toDonationClient(created));
});

const updateDonation = asyncHandler(async (req, res) => {
  await expireDonationsAndNotify();

  const donation = await Donation.findById(req.params.id);
  if (!donation) {
    throw new AppError("Donation not found", 404, "DONATION_NOT_FOUND");
  }

  if (req.user.role !== USER_ROLES.ADMIN && donation.donorId.toString() !== req.user.id) {
    throw new AppError("Forbidden", 403, "FORBIDDEN");
  }

  if (donation.status === DONATION_STATUS.EXPIRED) {
    throw new AppError("Expired donations cannot be edited. Create a new donation instead.", 409, "DONATION_LOCKED");
  }

  if (donation.status === DONATION_STATUS.COMPLETED) {
    throw new AppError("Completed donations cannot be edited", 409, "DONATION_LOCKED");
  }

  const hasProtectedRequest = await DonationRequest.exists({
    donationId: donation._id,
    status: { $in: [REQUEST_STATUS.ACCEPTED, REQUEST_STATUS.COMPLETED] }
  });
  if (donation.status === DONATION_STATUS.ACCEPTED || hasProtectedRequest) {
    throw new AppError("Donations with accepted requests cannot be edited.", 409, "DONATION_LOCKED");
  }

  if (req.body.availableUntil) {
    const availableUntil = new Date(req.body.availableUntil);
    if (Number.isNaN(availableUntil.getTime()) || availableUntil <= new Date()) {
      throw new AppError("availableUntil must be a future date", 422, "INVALID_AVAILABLE_UNTIL");
    }
    donation.availableUntil = availableUntil;
  }

  const updatable = ["foodName", "category", "description", "location"];
  for (const field of updatable) {
    if (req.body[field] !== undefined) {
      donation[field] = req.body[field];
    }
  }

  if (req.body.geoLocation !== undefined) {
    const parsedGeo = parseGeoLocation(req.body.geoLocation);
    donation.geoLocation = parsedGeo || undefined;
  }

  if (req.body.quantityValue !== undefined && req.body.quantityUnit !== undefined) {
    donation.quantityValue = Number(req.body.quantityValue);
    donation.quantityUnit = req.body.quantityUnit;
    donation.quantity = `${donation.quantityValue} ${donation.quantityUnit}`;
  }

  const imagePath = await resolveIncomingImage(req);
  if (imagePath !== undefined) {
    donation.image = imagePath;
  }

  await donation.save();

  const updated = await Donation.findById(donation._id).populate("donorId", "name");
  return success(res, 200, "Donation updated successfully", toDonationClient(updated));
});

const deleteDonation = asyncHandler(async (req, res) => {
  await Promise.all([Donation.init(), DonationRequest.init(), Notification.init()]);
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const donation = await Donation.findById(req.params.id).session(session);
    if (!donation) {
      throw new AppError("Donation not found", 404, "DONATION_NOT_FOUND");
    }

    if (req.user.role !== USER_ROLES.ADMIN && donation.donorId.toString() !== req.user.id) {
      throw new AppError("Forbidden", 403, "FORBIDDEN");
    }

    const relatedRequests = await DonationRequest.find({ donationId: donation._id })
      .select("_id status")
      .session(session);
    const hasProtectedRequest = relatedRequests.some((request) =>
      [REQUEST_STATUS.ACCEPTED, REQUEST_STATUS.COMPLETED].includes(request.status)
    );
    if (hasProtectedRequest) {
      throw new AppError("Donations with accepted or completed requests cannot be deleted.", 409, "DONATION_HAS_PROTECTED_REQUEST");
    }

    const requestIds = relatedRequests.map((request) => request._id);
    await Notification.updateMany(
      { $or: [{ donationId: donation._id }, { requestId: { $in: requestIds } }] },
      { $unset: { donationId: "", requestId: "" } },
      { session }
    );
    await DonationRequest.deleteMany({ donationId: donation._id }, { session });
    await Donation.deleteOne({ _id: donation._id }, { session });

    await session.commitTransaction();
    return success(res, 200, "Donation deleted successfully", null);
  } catch (error) {
    await session.abortTransaction();
    throw error;
  } finally {
    session.endSession();
  }
});

const getImpactStats = asyncHandler(async (_req, res) => {
  const stats = await getPublicImpactStats();
  return success(res, 200, "Impact stats fetched", stats);
});

module.exports = {
  listDonations,
  getDonationById,
  getMyDonations,
  createDonation,
  updateDonation,
  deleteDonation,
  getImpactStats
};
