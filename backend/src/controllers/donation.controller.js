const Donation = require("../models/Donation");
const DonationRequest = require("../models/DonationRequest");
const asyncHandler = require("../utils/asyncHandler");
const { success, paginated } = require("../utils/apiResponse");
const { AppError } = require("../utils/errors");
const { getPagination, toPagination } = require("../utils/pagination");
const { DONATION_STATUS, USER_ROLES, REQUEST_STATUS } = require("../utils/constants");
const { toDonationClient, expireDonationsAndNotify } = require("../services/donation.service");

const listDonations = asyncHandler(async (req, res) => {
  await expireDonationsAndNotify();

  const { page, limit, skip } = getPagination(req.query);
  const filter = {};

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

  const donation = await Donation.findById(req.params.id).populate("donorId", "name");
  if (!donation) {
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
    Donation.find(filter).populate("donorId", "name").sort({ createdAt: -1 }).skip(skip).limit(limit)
  ]);

  const mapped = items.map(toDonationClient);
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

  const imagePath = req.file ? `/uploads/${req.file.filename}` : req.body.image;
  if (!imagePath) {
    throw new AppError("Donation image is required", 422, "IMAGE_REQUIRED");
  }

  const donation = await Donation.create({
    foodName: req.body.foodName,
    category: req.body.category,
    quantity: req.body.quantity,
    description: req.body.description,
    image: imagePath,
    location: req.body.location,
    availableUntil,
    donorId: req.user.id,
    status: DONATION_STATUS.AVAILABLE
  });

  const created = await Donation.findById(donation._id).populate("donorId", "name");
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

  if (donation.status === DONATION_STATUS.COMPLETED) {
    throw new AppError("Completed donations cannot be edited", 409, "DONATION_LOCKED");
  }

  if (req.body.availableUntil) {
    const availableUntil = new Date(req.body.availableUntil);
    if (Number.isNaN(availableUntil.getTime()) || availableUntil <= new Date()) {
      throw new AppError("availableUntil must be a future date", 422, "INVALID_AVAILABLE_UNTIL");
    }
    donation.availableUntil = availableUntil;
  }

  const updatable = ["foodName", "category", "quantity", "description", "location"];
  for (const field of updatable) {
    if (req.body[field] !== undefined) {
      donation[field] = req.body[field];
    }
  }

  if (req.file) {
    donation.image = `/uploads/${req.file.filename}`;
  } else if (req.body.image) {
    donation.image = req.body.image;
  }

  await donation.save();

  const updated = await Donation.findById(donation._id).populate("donorId", "name");
  return success(res, 200, "Donation updated successfully", toDonationClient(updated));
});

const deleteDonation = asyncHandler(async (req, res) => {
  const donation = await Donation.findById(req.params.id);
  if (!donation) {
    throw new AppError("Donation not found", 404, "DONATION_NOT_FOUND");
  }

  if (req.user.role !== USER_ROLES.ADMIN && donation.donorId.toString() !== req.user.id) {
    throw new AppError("Forbidden", 403, "FORBIDDEN");
  }

  await DonationRequest.deleteMany({
    donationId: donation._id,
    status: REQUEST_STATUS.PENDING
  });

  await donation.deleteOne();
  return success(res, 200, "Donation deleted successfully", null);
});

module.exports = {
  listDonations,
  getDonationById,
  getMyDonations,
  createDonation,
  updateDonation,
  deleteDonation
};
