const mongoose = require("mongoose");
const Donation = require("../models/Donation");
const DonationRequest = require("../models/DonationRequest");
const DonationOffer = require("../models/DonationOffer");
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
const { normalizeStoredImagePath } = require("../utils/imagePath");

function toRequestClient(reqDoc) {
  const donation = reqDoc.donationId && reqDoc.donationId.foodName ? reqDoc.donationId : null;
  const donor = reqDoc.donorId?._id ? reqDoc.donorId : null;
  const ngo = reqDoc.ngoId?._id ? reqDoc.ngoId : null;
  return {
    id: reqDoc._id.toString(),
    donationId: donation?._id ? donation._id.toString() : reqDoc.donationId ? reqDoc.donationId.toString() : undefined,
    donorId: donor?._id ? donor._id.toString() : reqDoc.donorId ? reqDoc.donorId.toString() : donation?.donorId?._id?.toString(),
    donorName: donor?.name || donation?.donorId?.name,
    ngoId: ngo?._id ? ngo._id.toString() : reqDoc.ngoId.toString(),
    ngoName: ngo?.organizationName || reqDoc.ngoName || ngo?.name || "NGO",
    ngo: ngo ? {
      id: ngo._id.toString(),
      name: ngo.name,
      organizationName: ngo.organizationName,
      location: ngo.location || "",
      acceptedCategories: ngo.acceptedCategories || [],
      currentNeedDescription: ngo.currentNeedDescription || "",
      isAcceptingDonations: ngo.isAcceptingDonations !== false,
      operatingRadiusKm: ngo.operatingRadiusKm
    } : undefined,
    contact: ["accepted", "completed"].includes(reqDoc.status) ? {
      donor: donor ? { name: donor.name, phone: donor.phone, email: donor.email } : undefined,
      ngo: ngo ? { name: ngo.organizationName || ngo.name, phone: ngo.phone, email: ngo.email, location: ngo.location || "" } : undefined,
      handoffMessage: "Contact the other party to arrange pickup or drop-off. After the food is handed over, both sides should confirm completion."
    } : undefined,
    direction: reqDoc.direction || "ngo_request",
    message: reqDoc.message,
    status: reqDoc.status,
    donorCompletedAt: reqDoc.donorCompletedAt,
    ngoCompletedAt: reqDoc.ngoCompletedAt,
    createdAt: reqDoc.createdAt,
    updatedAt: reqDoc.updatedAt,
    donation: donation
      ? {
          id: donation._id.toString(),
          foodName: donation.foodName,
          category: donation.category,
          quantity: donation.quantity,
          quantityValue: donation.quantityValue,
          quantityUnit: donation.quantityUnit,
          description: donation.description,
          image: normalizeStoredImagePath(donation.image),
          location: donation.location,
          availableUntil: donation.availableUntil,
          donorId: donation.donorId?._id ? donation.donorId._id.toString() : donation.donorId.toString(),
          donorName: donation.donorId?.name || "Unknown",
          status: donation.status,
          createdAt: donation.createdAt
        }
      : undefined
  };
}

async function createDirectOffer({ donorId, ngoId, foodName, category, quantity, description, location, availableUntil, message }) {
  const ngo = await User.findById(ngoId).select("role status");
  if (!ngo || ngo.role !== USER_ROLES.NGO || ngo.status === "disabled") {
    throw new AppError("NGO not found", 404, "NGO_NOT_FOUND");
  }

  const offer = await DonationOffer.create({
    donorId,
    ngoId,
    foodName,
    category,
    quantity,
    description: description || message || `Direct offer of ${foodName}`,
    location: location || "To arrange with the NGO",
    availableUntil: availableUntil ? new Date(availableUntil) : new Date(Date.now() + 24 * 60 * 60 * 1000),
    message: message || "",
    status: REQUEST_STATUS.PENDING
  });

  await createNotification({
    userId: ngoId,
    type: NOTIFICATION_TYPES.REQUEST_RECEIVED,
    message: `A donor offered ${quantity} of ${foodName}.`,
    requestId: offer._id
  });
  return offer;
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
          donorId: donation.donorId,
          direction: "ngo_request",
          ngoId: ngoUserId,
          message: message || "",
          status: REQUEST_STATUS.PENDING
        }
      ],
      { session }
    );

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
      .populate("ngoId", "name organizationName location acceptedCategories currentNeedDescription isAcceptingDonations operatingRadiusKm role")
      .session(session);

    if (!request) {
      throw new AppError("Request not found", 404, "REQUEST_NOT_FOUND");
    }

    const donation = request.donationId ? await Donation.findById(request.donationId).session(session) : null;
    if (request.donationId && !donation) throw new AppError("Donation not found", 404, "DONATION_NOT_FOUND");

    const donorId = donation?.donorId?.toString() || request.donorId?.toString();
    const isDonorOwner = donorId === actorId;
    const isNgoOwner = request.ngoId._id.toString() === actorId;

    if (action === "accept" || action === "reject") {
      const authorized = request.direction === "donor_offer"
        ? isNgoOwner && actorRole === USER_ROLES.NGO
        : isDonorOwner && actorRole === USER_ROLES.DONOR;
      if (!authorized) {
        throw new AppError("Only the related party can perform this action", 403, "FORBIDDEN");
      }
      if (request.status !== REQUEST_STATUS.PENDING) {
        throw new AppError("Only pending requests can be accepted or rejected", 409, "INVALID_REQUEST_STATE");
      }
    }

    if (action === "complete") {
      if (!(isDonorOwner || isNgoOwner)) {
        throw new AppError("Only related donor or NGO can complete", 403, "FORBIDDEN");
      }
      if (request.status === REQUEST_STATUS.COMPLETED) {
        await session.commitTransaction();
        return request;
      }
      if (request.status !== REQUEST_STATUS.ACCEPTED) {
        throw new AppError("Only accepted requests can be completed", 409, "INVALID_REQUEST_STATE");
      }
    }

    if (action === "accept") {
      request.status = REQUEST_STATUS.ACCEPTED;
      await request.save({ session });
      if (donation) {
        donation.status = DONATION_STATUS.ACCEPTED;
        await donation.save({ session });
      }

      if (donation) {
        await DonationRequest.updateMany(
          { donationId: donation._id, _id: { $ne: request._id }, status: REQUEST_STATUS.PENDING },
          { $set: { status: REQUEST_STATUS.REJECTED } },
          { session }
        );
      }

      await createNotification(
        {
          userId: request.ngoId._id,
          type: NOTIFICATION_TYPES.REQUEST_ACCEPTED,
          message: request.direction === "donor_offer"
            ? "Your donation offer was accepted."
            : `Your request for \"${donation.foodName}\" was accepted.`,
          ...(donation ? { donationId: donation._id } : {}),
          requestId: request._id
        },
        session
      );
    }

    if (action === "reject") {
      request.status = REQUEST_STATUS.REJECTED;
      await request.save({ session });

      if (donation) {
        const pendingCount = await DonationRequest.countDocuments({ donationId: donation._id, status: REQUEST_STATUS.PENDING }).session(session);
        const acceptedCount = await DonationRequest.countDocuments({ donationId: donation._id, status: REQUEST_STATUS.ACCEPTED }).session(session);
        if (acceptedCount === 0 && pendingCount === 0 && donation.status !== DONATION_STATUS.EXPIRED) {
          donation.status = DONATION_STATUS.AVAILABLE;
          await donation.save({ session });
        }
      }

      await createNotification(
        {
          userId: request.ngoId._id,
          type: NOTIFICATION_TYPES.REQUEST_REJECTED,
          message: request.direction === "donor_offer" ? "Your donation offer was declined." : `Your request for \"${donation.foodName}\" was rejected.`,
          ...(donation ? { donationId: donation._id } : {}),
          requestId: request._id
        },
        session
      );
    }

    if (action === "complete") {
      if (actorRole === USER_ROLES.DONOR) request.donorCompletedAt = request.donorCompletedAt || new Date();
      if (actorRole === USER_ROLES.NGO) request.ngoCompletedAt = request.ngoCompletedAt || new Date();
      const fullyConfirmed = request.donorCompletedAt && request.ngoCompletedAt;
      if (fullyConfirmed) request.status = REQUEST_STATUS.COMPLETED;
      await request.save({ session });
      if (fullyConfirmed && donation) {
        donation.status = DONATION_STATUS.COMPLETED;
        await donation.save({ session });
        await DonationRequest.updateMany(
          { donationId: donation._id, _id: { $ne: request._id }, status: REQUEST_STATUS.PENDING },
          { $set: { status: REQUEST_STATUS.REJECTED } },
          { session }
        );
      }

      if (fullyConfirmed) {
        const completionMessage = donation ? `Donation \"${donation.foodName}\" was completed by both parties.` : "Donation offer was completed by both parties.";
        await createNotification({ userId: donorId, type: NOTIFICATION_TYPES.DONATION_COMPLETED, message: completionMessage, ...(donation ? { donationId: donation._id } : {}), requestId: request._id }, session);
        await createNotification({ userId: request.ngoId._id, type: NOTIFICATION_TYPES.DONATION_COMPLETED, message: completionMessage, ...(donation ? { donationId: donation._id } : {}), requestId: request._id }, session);
      }
    }

    await session.commitTransaction();

    const refreshed = await DonationRequest.findById(request._id)
      .populate("ngoId", "name organizationName location acceptedCategories currentNeedDescription isAcceptingDonations operatingRadiusKm phone email")
      .populate("donorId", "name phone email")
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
  createDirectOffer,
  transitionRequest
};
