const DonationRequest = require("../models/DonationRequest");
const DonationOffer = require("../models/DonationOffer");
const Donation = require("../models/Donation");
const asyncHandler = require("../utils/asyncHandler");
const { success, paginated } = require("../utils/apiResponse");
const { AppError } = require("../utils/errors");
const { getPagination, toPagination } = require("../utils/pagination");
const { USER_ROLES } = require("../utils/constants");
const { toRequestClient, createRequest, createDirectOffer, transitionRequest } = require("../services/request.service");
const { toOfferClient, transitionOffer } = require("../services/offer.service");

const listRequests = asyncHandler(async (req, res) => {
  const { page, limit, skip } = getPagination(req.query);
  const filter = {};
  const requestedDonationId = req.query.donationId;

  if (requestedDonationId) {
    filter.donationId = requestedDonationId;
  }

  if (req.user.role === USER_ROLES.DONOR) {
    const ownDonationIds = await Donation.find({ donorId: req.user.id }).select("_id");
    const ownedIds = ownDonationIds.map((d) => d._id.toString());
    filter.$or = requestedDonationId
      ? [{ donationId: ownedIds.includes(requestedDonationId) ? requestedDonationId : null }, { donorId: req.user.id }]
      : [{ donationId: { $in: ownDonationIds.map((d) => d._id) } }, { donorId: req.user.id }];
  }

  if (req.user.role === USER_ROLES.NGO) {
    filter.ngoId = req.user.id;
  }

  const [total, items] = await Promise.all([
    DonationRequest.countDocuments(filter),
    DonationRequest.find(filter)
      .populate("ngoId", "name organizationName location acceptedCategories currentNeedDescription isAcceptingDonations operatingRadiusKm phone email")
      .populate("donorId", "name phone email")
      .populate({
        path: "donationId",
        populate: { path: "donorId", select: "name" }
      })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
  ]);

  const mapped = items.map(toRequestClient);

  if (req.query.page || req.query.limit) {
    return paginated(res, 200, "Requests fetched", mapped, toPagination(page, limit, total));
  }

  return success(res, 200, "Requests fetched", mapped);
});

const getMyRequests = asyncHandler(async (req, res) => {
  if (req.user.role !== USER_ROLES.NGO) {
    throw new AppError("Only NGOs can access this endpoint", 403, "FORBIDDEN");
  }

  const { page, limit, skip } = getPagination(req.query);
  const filter = { ngoId: req.user.id };

  const [total, items] = await Promise.all([
    DonationRequest.countDocuments(filter),
    DonationRequest.find(filter)
      .populate("ngoId", "name organizationName location acceptedCategories currentNeedDescription isAcceptingDonations operatingRadiusKm phone email")
      .populate("donorId", "name phone email")
      .populate({
        path: "donationId",
        populate: { path: "donorId", select: "name" }
      })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
  ]);

  const mapped = items.map(toRequestClient);

  if (req.query.page || req.query.limit) {
    return paginated(res, 200, "My requests fetched", mapped, toPagination(page, limit, total));
  }

  return success(res, 200, "My requests fetched", mapped);
});

const getRequestById = asyncHandler(async (req, res) => {
  const request = await DonationRequest.findById(req.params.id)
    .populate("ngoId", "name organizationName location acceptedCategories currentNeedDescription isAcceptingDonations operatingRadiusKm phone email")
    .populate("donorId", "name phone email")
    .populate({ path: "donationId", populate: { path: "donorId", select: "name" } });

  if (!request) {
    throw new AppError("Request not found", 404, "REQUEST_NOT_FOUND");
  }

  const donorId = request.donationId?.donorId?._id?.toString() || request.donorId?._id?.toString() || request.donorId?.toString();
  const ngoId = request.ngoId._id.toString();
  const isAdmin = req.user.role === USER_ROLES.ADMIN;

  if (!isAdmin && req.user.id !== donorId && req.user.id !== ngoId) {
    throw new AppError("Forbidden", 403, "FORBIDDEN");
  }

  return success(res, 200, "Request fetched", toRequestClient(request));
});

const createDonationRequest = asyncHandler(async (req, res) => {
  if (req.user.role === USER_ROLES.DONOR && req.body.donationId && !req.body.ngoId) {
    throw new AppError("Only NGOs can request an existing donation", 403, "FORBIDDEN");
  }
  if (req.user.role === USER_ROLES.DONOR) {
    if (!req.body.ngoId || !req.body.foodName || !req.body.category || !req.body.quantity) {
      throw new AppError("NGO, food name, category, and quantity are required", 422, "VALIDATION_ERROR");
    }

    const created = await createDirectOffer({
      donorId: req.user.id,
      ngoId: req.body.ngoId,
      foodName: req.body.foodName,
      category: req.body.category,
      quantity: req.body.quantity,
      description: req.body.description,
      location: req.body.location,
      availableUntil: req.body.availableUntil,
      message: req.body.message,
      geoLocation: req.body.geoLocation,
      quantityValue: req.body.quantityValue,
      quantityUnit: req.body.quantityUnit,
      image: req.body.image
    });

    const hydrated = await DonationOffer.findById(created._id)
      .populate("ngoId", "name organizationName location acceptedCategories currentNeedDescription isAcceptingDonations operatingRadiusKm phone email")
      .populate("donorId", "name phone email");

    return success(res, 201, "Donation offer sent successfully", toOfferClient(hydrated, req.user));
  }

  if (req.user.role !== USER_ROLES.NGO) {
    throw new AppError("Only donors or NGOs can create requests", 403, "FORBIDDEN");
  }

  const created = await createRequest({
    donationId: req.body.donationId,
    message: req.body.message,
    ngoUserId: req.user.id
  });

  const hydrated = await DonationRequest.findById(created._id)
    .populate("ngoId", "name organizationName location acceptedCategories currentNeedDescription isAcceptingDonations operatingRadiusKm phone email")
    .populate("donorId", "name phone email")
    .populate({ path: "donationId", populate: { path: "donorId", select: "name" } });

  return success(res, 201, "Request created successfully", toRequestClient(hydrated));
});

const acceptRequest = asyncHandler(async (req, res) => {
  const requestExists = await DonationRequest.findById(req.params.id);
  if (requestExists) {
    const updated = await transitionRequest({
      requestId: req.params.id,
      action: "accept",
      actorId: req.user.id,
      actorRole: req.user.role
    });
    return success(res, 200, "Request accepted", toRequestClient(updated));
  }

  const offer = await require("../models/DonationOffer").findById(req.params.id);
  if (!offer) throw new AppError("Request not found", 404, "REQUEST_NOT_FOUND");

  const updated = await transitionOffer({
    offerId: req.params.id,
    action: "accept",
    actorId: req.user.id,
    actorRole: req.user.role
  });
  return success(res, 200, "Offer accepted", toOfferClient(updated, req.user));
});

const rejectRequest = asyncHandler(async (req, res) => {
  const requestExists = await DonationRequest.findById(req.params.id);
  if (requestExists) {
    const updated = await transitionRequest({
      requestId: req.params.id,
      action: "reject",
      actorId: req.user.id,
      actorRole: req.user.role
    });
    return success(res, 200, "Request rejected", toRequestClient(updated));
  }

  const offer = await require("../models/DonationOffer").findById(req.params.id);
  if (!offer) throw new AppError("Request not found", 404, "REQUEST_NOT_FOUND");

  const updated = await transitionOffer({
    offerId: req.params.id,
    action: "reject",
    actorId: req.user.id,
    actorRole: req.user.role
  });
  return success(res, 200, "Offer rejected", toOfferClient(updated, req.user));
});

const completeRequest = asyncHandler(async (req, res) => {
  const requestExists = await DonationRequest.findById(req.params.id);
  if (requestExists) {
    const updated = await transitionRequest({
      requestId: req.params.id,
      action: "complete",
      actorId: req.user.id,
      actorRole: req.user.role
    });
    return success(res, 200, "Request completed", toRequestClient(updated));
  }

  const offer = await require("../models/DonationOffer").findById(req.params.id);
  if (!offer) throw new AppError("Request not found", 404, "REQUEST_NOT_FOUND");

  const updated = await transitionOffer({
    offerId: req.params.id,
    action: "complete",
    actorId: req.user.id,
    actorRole: req.user.role
  });
  return success(res, 200, "Offer completed", toOfferClient(updated, req.user));
});

module.exports = {
  listRequests,
  createDonationRequest,
  getMyRequests,
  getRequestById,
  acceptRequest,
  rejectRequest,
  completeRequest
};
