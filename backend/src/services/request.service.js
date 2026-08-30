const mongoose = require("mongoose");
const Donation = require("../models/Donation");
const DonationRequest = require("../models/DonationRequest");
const User = require("../models/User");
const { AppError } = require("../utils/errors");
const {
  ACTIVE_REQUEST_STATUSES,
  DONATION_STATUS,
  REQUEST_STATUS,
  NOTIFICATION_TYPES,
  USER_ROLES
} = require("../utils/constants");
const { createNotification } = require("./notification.service");
const { expireDonationsAndNotify } = require("./donation.service");

function toRequestClient(reqDoc) {
  return {
    id: reqDoc._id.toString(),
    donationId: reqDoc.donationId?._id ? reqDoc.donationId._id.toString() : reqDoc.donationId.toString(),
    ngoId: reqDoc.ngoId?._id ? reqDoc.ngoId._id.toString() : reqDoc.ngoId.toString(),
    ngoName: reqDoc.ngoId?.organizationName || reqDoc.ngoName || reqDoc.ngoId?.name || "NGO",
    message: reqDoc.message,
    status: reqDoc.status,
    createdAt: reqDoc.createdAt,
    updatedAt: reqDoc.updatedAt,
    donation: reqDoc.donationId && reqDoc.donationId.foodName
      ? {
          id: reqDoc.donationId._id.toString(),
          foodName: reqDoc.donationId.foodName,
          category: reqDoc.donationId.category,
          quantity: reqDoc.donationId.quantity,
          description: reqDoc.donationId.description,
          image: reqDoc.donationId.image,
          location: reqDoc.donationId.location,
          availableUntil: reqDoc.donationId.availableUntil,
          donorId: reqDoc.donationId.donorId?._id ? reqDoc.donationId.donorId._id.toString() : reqDoc.donationId.donorId.toString(),
          donorName: reqDoc.donationId.donorId?.name || "Unknown",
          status: reqDoc.donationId.status,
          createdAt: reqDoc.donationId.createdAt
        }
      : undefined
  };
}

async function createRequest({ donationId, message, ngoUserId }) {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    await expireDonationsAndNotify(session);

    const donation = await Donation.findById(donationId).session(session);
    if (!donation) {
      throw new AppError("Donation not found", 404, "DONATION_NOT_FOUND");
    }

    if (donation.donorId.toString() === ngoUserId) {
      throw new AppError("You cannot request your own donation", 400, "OWN_DONATION_REQUEST_FORBIDDEN");
    }

    if (new Date(donation.availableUntil) <= new Date()) {
      donation.status = DONATION_STATUS.EXPIRED;
      await donation.save({ session });
      throw new AppError("Donation has expired", 409, "DONATION_EXPIRED");
    }

    if (![DONATION_STATUS.AVAILABLE, DONATION_STATUS.PENDING].includes(donation.status)) {
      throw new AppError("Donation is not requestable", 409, "DONATION_NOT_REQUESTABLE");
    }

    const existingActive = await DonationRequest.findOne({
      donationId,
      ngoId: ngoUserId,
      status: { $in: ACTIVE_REQUEST_STATUSES }
    }).session(session);

    if (existingActive) {
      throw new AppError("You already have an active request for this donation", 409, "DUPLICATE_ACTIVE_REQUEST");
    }

    const ngo = await User.findById(ngoUserId).session(session);
    if (!ngo || ngo.role !== USER_ROLES.NGO) {
      throw new AppError("Only NGOs can create requests", 403, "FORBIDDEN");
    }

    const [request] = await DonationRequest.create(
      [
        {
          donationId,
          ngoId: ngoUserId,
          message: message || "",
          status: REQUEST_STATUS.PENDING
        }
      ],
      { session }
    );

    if (donation.status === DONATION_STATUS.AVAILABLE) {
      donation.status = DONATION_STATUS.PENDING;
      await donation.save({ session });
    }

    await createNotification(
      {
        userId: donation.donorId,
        type: NOTIFICATION_TYPES.REQUEST_RECEIVED,
        message: `${ngo.organizationName || ngo.name} requested your donation \"${donation.foodName}\".`,
        donationId: donation._id,
        requestId: request._id
      },
      session
    );

    await session.commitTransaction();
    return request;
  } catch (error) {
    await session.abortTransaction();
    throw error;
  } finally {
    session.endSession();
  }
}

async function transitionRequest({ requestId, action, actorId, actorRole }) {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    await expireDonationsAndNotify(session);

    const request = await DonationRequest.findById(requestId)
      .populate("ngoId", "name organizationName role")
      .session(session);

    if (!request) {
      throw new AppError("Request not found", 404, "REQUEST_NOT_FOUND");
    }

    const donation = await Donation.findById(request.donationId).session(session);
    if (!donation) {
      throw new AppError("Donation not found", 404, "DONATION_NOT_FOUND");
    }

    const isDonorOwner = donation.donorId.toString() === actorId;
    const isNgoOwner = request.ngoId._id.toString() === actorId;

    if (action === "accept" || action === "reject") {
      if (!isDonorOwner || actorRole !== USER_ROLES.DONOR) {
        throw new AppError("Only owning donor can perform this action", 403, "FORBIDDEN");
      }
      if (request.status !== REQUEST_STATUS.PENDING) {
        throw new AppError("Only pending requests can be accepted or rejected", 409, "INVALID_REQUEST_STATE");
      }
    }

    if (action === "complete") {
      if (!(isDonorOwner || isNgoOwner)) {
        throw new AppError("Only related donor or NGO can complete", 403, "FORBIDDEN");
      }
      if (request.status !== REQUEST_STATUS.ACCEPTED) {
        throw new AppError("Only accepted requests can be completed", 409, "INVALID_REQUEST_STATE");
      }
    }

    if (action === "accept") {
      request.status = REQUEST_STATUS.ACCEPTED;
      donation.status = DONATION_STATUS.ACCEPTED;

      await request.save({ session });
      await donation.save({ session });

      await DonationRequest.updateMany(
        {
          donationId: donation._id,
          _id: { $ne: request._id },
          status: REQUEST_STATUS.PENDING
        },
        {
          $set: { status: REQUEST_STATUS.REJECTED }
        },
        { session }
      );

      await createNotification(
        {
          userId: request.ngoId._id,
          type: NOTIFICATION_TYPES.REQUEST_ACCEPTED,
          message: `Your request for \"${donation.foodName}\" was accepted.`,
          donationId: donation._id,
          requestId: request._id
        },
        session
      );
    }

    if (action === "reject") {
      request.status = REQUEST_STATUS.REJECTED;
      await request.save({ session });

      const pendingCount = await DonationRequest.countDocuments({
        donationId: donation._id,
        status: REQUEST_STATUS.PENDING
      }).session(session);

      const acceptedCount = await DonationRequest.countDocuments({
        donationId: donation._id,
        status: REQUEST_STATUS.ACCEPTED
      }).session(session);

      if (acceptedCount === 0 && pendingCount === 0 && donation.status !== DONATION_STATUS.EXPIRED) {
        donation.status = DONATION_STATUS.AVAILABLE;
        await donation.save({ session });
      }

      await createNotification(
        {
          userId: request.ngoId._id,
          type: NOTIFICATION_TYPES.REQUEST_REJECTED,
          message: `Your request for \"${donation.foodName}\" was rejected.`,
          donationId: donation._id,
          requestId: request._id
        },
        session
      );
    }

    if (action === "complete") {
      request.status = REQUEST_STATUS.COMPLETED;
      donation.status = DONATION_STATUS.COMPLETED;
      await request.save({ session });
      await donation.save({ session });

      await DonationRequest.updateMany(
        {
          donationId: donation._id,
          _id: { $ne: request._id },
          status: REQUEST_STATUS.PENDING
        },
        { $set: { status: REQUEST_STATUS.REJECTED } },
        { session }
      );

      await createNotification(
        {
          userId: donation.donorId,
          type: NOTIFICATION_TYPES.DONATION_COMPLETED,
          message: `Donation \"${donation.foodName}\" was marked completed.`,
          donationId: donation._id,
          requestId: request._id
        },
        session
      );

      await createNotification(
        {
          userId: request.ngoId._id,
          type: NOTIFICATION_TYPES.DONATION_COMPLETED,
          message: `Pickup for \"${donation.foodName}\" was marked completed.`,
          donationId: donation._id,
          requestId: request._id
        },
        session
      );
    }

    await session.commitTransaction();

    const refreshed = await DonationRequest.findById(request._id)
      .populate("ngoId", "name organizationName")
      .populate({
        path: "donationId",
        populate: { path: "donorId", select: "name" }
      });

    return refreshed;
  } catch (error) {
    await session.abortTransaction();
    throw error;
  } finally {
    session.endSession();
  }
}

module.exports = {
  toRequestClient,
  createRequest,
  transitionRequest
};
