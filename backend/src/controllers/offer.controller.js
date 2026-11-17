const DonationOffer = require("../models/DonationOffer");
const asyncHandler = require("../utils/asyncHandler");
const { success, paginated } = require("../utils/apiResponse");
const { AppError } = require("../utils/errors");
const { getPagination, toPagination } = require("../utils/pagination");
const { USER_ROLES } = require("../utils/constants");
const { toOfferClient, createOffer, transitionOffer } = require("../services/offer.service");

const listOffers = asyncHandler(async (req, res) => {
  const { page, limit, skip } = getPagination(req.query);
  let filter = {};

  if (req.user.role === USER_ROLES.DONOR) {
    filter.donorId = req.user.id;
  }

  if (req.user.role === USER_ROLES.NGO) {
    filter.ngoId = req.user.id;
  }

  const [total, items] = await Promise.all([
    DonationOffer.countDocuments(filter),
    DonationOffer.find(filter)
      .populate("donorId", "name phone email")
      .populate("ngoId", "name organizationName location acceptedCategories currentNeedDescription isAcceptingDonations operatingRadiusKm phone email")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
  ]);

  const mapped = items.map((offer) => toOfferClient(offer, req.user));

  if (req.query.page || req.query.limit) {
    return paginated(res, 200, "Offers fetched", mapped, toPagination(page, limit, total));
  }

  return success(res, 200, "Offers fetched", mapped);
});

const getMyOffers = asyncHandler(async (req, res) => {
  if (req.user.role !== USER_ROLES.DONOR) {
    throw new AppError("Only donors can access this endpoint", 403, "FORBIDDEN");
  }

  const { page, limit, skip } = getPagination(req.query);
  const filter = { donorId: req.user.id };

  const [total, items] = await Promise.all([
    DonationOffer.countDocuments(filter),
    DonationOffer.find(filter)
      .populate("donorId", "name phone email")
      .populate("ngoId", "name organizationName location acceptedCategories currentNeedDescription isAcceptingDonations operatingRadiusKm phone email")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
  ]);

  const mapped = items.map((offer) => toOfferClient(offer, req.user));
  if (req.query.page || req.query.limit) {
    return paginated(res, 200, "My offers fetched", mapped, toPagination(page, limit, total));
  }

  return success(res, 200, "My offers fetched", mapped);
});

const getReceivedOffers = asyncHandler(async (req, res) => {
  if (req.user.role !== USER_ROLES.NGO) {
    throw new AppError("Only NGOs can access this endpoint", 403, "FORBIDDEN");
  }

  const { page, limit, skip } = getPagination(req.query);
  const filter = { ngoId: req.user.id };

  const [total, items] = await Promise.all([
    DonationOffer.countDocuments(filter),
    DonationOffer.find(filter)
      .populate("donorId", "name phone email")
      .populate("ngoId", "name organizationName location acceptedCategories currentNeedDescription isAcceptingDonations operatingRadiusKm phone email")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
  ]);

  const mapped = items.map((offer) => toOfferClient(offer, req.user));
  if (req.query.page || req.query.limit) {
    return paginated(res, 200, "Received offers fetched", mapped, toPagination(page, limit, total));
  }

  return success(res, 200, "Received offers fetched", mapped);
});

const getOfferById = asyncHandler(async (req, res) => {
  const offer = await DonationOffer.findById(req.params.id)
    .populate("donorId", "name phone email")
    .populate("ngoId", "name organizationName location acceptedCategories currentNeedDescription isAcceptingDonations operatingRadiusKm phone email");

  if (!offer) {
    throw new AppError("Offer not found", 404, "OFFER_NOT_FOUND");
  }

  const isAdmin = req.user.role === USER_ROLES.ADMIN;
  if (!isAdmin && req.user.id !== offer.donorId?._id?.toString() && req.user.id !== offer.ngoId?._id?.toString()) {
    throw new AppError("Forbidden", 403, "FORBIDDEN");
  }

  return success(res, 200, "Offer fetched", toOfferClient(offer, req.user));
});

const createDonationOffer = asyncHandler(async (req, res) => {
  if (req.user.role !== USER_ROLES.DONOR) {
    throw new AppError("Only donors can create offers", 403, "FORBIDDEN");
  }

  if (!req.body.ngoId || !req.body.foodName || !req.body.category) {
    throw new AppError("NGO, food name, and category are required", 422, "VALIDATION_ERROR");
  }

  if (req.body.availableUntil !== undefined && req.body.availableUntil !== null && req.body.availableUntil !== "") {
    const availableUntil = new Date(req.body.availableUntil);
    if (Number.isNaN(availableUntil.getTime()) || availableUntil <= new Date()) {
      throw new AppError("availableUntil must be a future date", 422, "INVALID_AVAILABLE_UNTIL");
    }
  }

  const created = await createOffer({
    donorId: req.user.id,
    ngoId: req.body.ngoId,
    foodName: req.body.foodName,
    category: req.body.category,
    quantityValue: req.body.quantityValue,
    quantityUnit: req.body.quantityUnit,
    description: req.body.description,
    image: req.body.image,
    location: req.body.location,
    geoLocation: req.body.geoLocation,
    availableUntil: req.body.availableUntil,
    message: req.body.message
  });

  const hydrated = await DonationOffer.findById(created._id)
    .populate("donorId", "name phone email")
    .populate("ngoId", "name organizationName location acceptedCategories currentNeedDescription isAcceptingDonations operatingRadiusKm phone email");

  return success(res, 201, "Donation offer created successfully", toOfferClient(hydrated, req.user));
});

const acceptOffer = asyncHandler(async (req, res) => {
  const updated = await transitionOffer({
    offerId: req.params.id,
    action: "accept",
    actorId: req.user.id,
    actorRole: req.user.role
  });
  return success(res, 200, "Offer accepted", toOfferClient(updated, req.user));
});

const rejectOffer = asyncHandler(async (req, res) => {
  const updated = await transitionOffer({
    offerId: req.params.id,
    action: "reject",
    actorId: req.user.id,
    actorRole: req.user.role
  });
  return success(res, 200, "Offer rejected", toOfferClient(updated, req.user));
});

const completeOffer = asyncHandler(async (req, res) => {
  const updated = await transitionOffer({
    offerId: req.params.id,
    action: "complete",
    actorId: req.user.id,
    actorRole: req.user.role
  });
  return success(res, 200, "Offer completed", toOfferClient(updated, req.user));
});

module.exports = {
  listOffers,
  getMyOffers,
  getReceivedOffers,
  getOfferById,
  createDonationOffer,
  acceptOffer,
  rejectOffer,
  completeOffer
};
