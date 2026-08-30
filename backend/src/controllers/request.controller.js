const DonationRequest = require("../models/DonationRequest");
const Donation = require("../models/Donation");
const asyncHandler = require("../utils/asyncHandler");
const { success, paginated } = require("../utils/apiResponse");
const { AppError } = require("../utils/errors");
const { getPagination, toPagination } = require("../utils/pagination");
const { USER_ROLES } = require("../utils/constants");
const { toRequestClient, createRequest, transitionRequest } = require("../services/request.service");

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
    if (requestedDonationId) {
      filter.donationId = ownedIds.includes(requestedDonationId) ? requestedDonationId : null;
    } else {
      filter.donationId = { $in: ownDonationIds.map((d) => d._id) };
    }
  }

  if (req.user.role === USER_ROLES.NGO) {
    filter.ngoId = req.user.id;
  }

  const [total, items] = await Promise.all([
    DonationRequest.countDocuments(filter),
    DonationRequest.find(filter)
      .populate("ngoId", "name organizationName")
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
      .populate("ngoId", "name organizationName")
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
    .populate("ngoId", "name organizationName")
    .populate({ path: "donationId", populate: { path: "donorId", select: "name" } });

  if (!request) {
    throw new AppError("Request not found", 404, "REQUEST_NOT_FOUND");
  }

  const donorId = request.donationId.donorId._id.toString();
  const ngoId = request.ngoId._id.toString();
  const isAdmin = req.user.role === USER_ROLES.ADMIN;

  if (!isAdmin && req.user.id !== donorId && req.user.id !== ngoId) {
    throw new AppError("Forbidden", 403, "FORBIDDEN");
  }

  return success(res, 200, "Request fetched", toRequestClient(request));
});

const createDonationRequest = asyncHandler(async (req, res) => {
  if (req.user.role !== USER_ROLES.NGO) {
    throw new AppError("Only NGOs can create requests", 403, "FORBIDDEN");
  }

  const created = await createRequest({
    donationId: req.body.donationId,
    message: req.body.message,
    ngoUserId: req.user.id
  });

  const hydrated = await DonationRequest.findById(created._id)
    .populate("ngoId", "name organizationName")
    .populate({ path: "donationId", populate: { path: "donorId", select: "name" } });

  return success(res, 201, "Request created successfully", toRequestClient(hydrated));
});

const acceptRequest = asyncHandler(async (req, res) => {
  const updated = await transitionRequest({
    requestId: req.params.id,
    action: "accept",
    actorId: req.user.id,
    actorRole: req.user.role
  });
  return success(res, 200, "Request accepted", toRequestClient(updated));
});

const rejectRequest = asyncHandler(async (req, res) => {
  const updated = await transitionRequest({
    requestId: req.params.id,
    action: "reject",
    actorId: req.user.id,
    actorRole: req.user.role
  });
  return success(res, 200, "Request rejected", toRequestClient(updated));
});

const completeRequest = asyncHandler(async (req, res) => {
  const updated = await transitionRequest({
    requestId: req.params.id,
    action: "complete",
    actorId: req.user.id,
    actorRole: req.user.role
  });
  return success(res, 200, "Request completed", toRequestClient(updated));
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
