const mongoose = require("mongoose");
const DonationOffer = require("../models/DonationOffer");
const User = require("../models/User");
const { AppError } = require("../utils/errors");
const { REQUEST_STATUS, USER_ROLES, NOTIFICATION_TYPES } = require("../utils/constants");
const { createNotification, emitSessionNotifications } = require("./notification.service");
const { normalizeStoredImagePath } = require("../utils/imagePath");

function toOfferClient(offerDoc, viewer) {
  const donor = offerDoc.donorId && offerDoc.donorId._id ? offerDoc.donorId : null;
  const ngo = offerDoc.ngoId && offerDoc.ngoId._id ? offerDoc.ngoId : null;
  const viewerId = viewer?.id?.toString();
  const canViewContact = viewerId && (
    (viewer.role === USER_ROLES.DONOR && viewerId === (donor?._id || offerDoc.donorId)?.toString()) ||
    (viewer.role === USER_ROLES.NGO && viewerId === (ngo?._id || offerDoc.ngoId)?.toString())
  );

  const legacyDonation = {
    id: offerDoc._id.toString(),
    foodName: offerDoc.foodName,
    category: offerDoc.category,
    quantity: offerDoc.quantity,
    quantityValue: offerDoc.quantityValue,
    quantityUnit: offerDoc.quantityUnit,
    description: offerDoc.description,
    image: normalizeStoredImagePath(offerDoc.image),
    location: offerDoc.location,
    availableUntil: offerDoc.availableUntil,
    donorId: donor ? donor._id.toString() : offerDoc.donorId?.toString(),
    donorName: donor?.name || "Unknown",
    status: offerDoc.status,
    createdAt: offerDoc.createdAt,
    updatedAt: offerDoc.updatedAt
  };

  return {
    id: offerDoc._id.toString(),
    donorId: donor ? donor._id.toString() : offerDoc.donorId?.toString(),
    donorName: donor?.name || "Unknown",
    ngoId: ngo ? ngo._id.toString() : offerDoc.ngoId?.toString(),
    targetNgoId: ngo ? ngo._id.toString() : offerDoc.targetNgoId?.toString() || offerDoc.ngoId?.toString(),
    ngoName: ngo?.organizationName || ngo?.name || "NGO",
    targetNgoName: ngo?.organizationName || ngo?.name || "NGO",
    foodName: offerDoc.foodName,
    category: offerDoc.category,
    quantity: offerDoc.quantity,
    quantityValue: offerDoc.quantityValue,
    quantityUnit: offerDoc.quantityUnit,
    description: offerDoc.description,
    image: normalizeStoredImagePath(offerDoc.image),
    location: offerDoc.location,
    geoLocation: offerDoc.geoLocation && offerDoc.geoLocation.type ? offerDoc.geoLocation : undefined,
    availableUntil: offerDoc.availableUntil,
    message: offerDoc.message,
    status: offerDoc.status,
    donorCompletedAt: offerDoc.donorCompletedAt,
    ngoCompletedAt: offerDoc.ngoCompletedAt,
    createdAt: offerDoc.createdAt,
    updatedAt: offerDoc.updatedAt,
    direction: "donor_offer",
    donation: legacyDonation,
    contact: canViewContact && [REQUEST_STATUS.ACCEPTED, REQUEST_STATUS.COMPLETED].includes(offerDoc.status) ? {
      donor: donor ? { name: donor.name, phone: donor.phone, email: donor.email } : undefined,
      ngo: ngo ? { name: ngo.organizationName || ngo.name, phone: ngo.phone, email: ngo.email, location: ngo.location || "" } : undefined,
      handoffMessage: "Contact the other party to arrange pickup or drop-off. After the food is handed over, both sides should confirm completion."
    } : undefined
  };
}

async function createOffer({ donorId, ngoId, foodName, category, quantity, quantityValue, quantityUnit, description, image, location, geoLocation, availableUntil, message }) {
  const ngo = await User.findById(ngoId).select("role status organizationName name location acceptedCategories currentNeedDescription isAcceptingDonations operatingRadiusKm phone email");
  if (!ngo || ngo.role !== USER_ROLES.NGO || ngo.status === "disabled") {
    throw new AppError("NGO not found", 404, "NGO_NOT_FOUND");
  }

  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const [offer] = await DonationOffer.create([{
      donorId,
      ngoId,
      targetNgoId: ngoId,
      foodName,
      category,
      quantity,
      quantityValue: quantityValue !== undefined && quantityValue !== null && quantityValue !== "" ? Number(quantityValue) : undefined,
      quantityUnit: quantityUnit || undefined,
      description: description || message || `Direct offer of ${foodName}`,
      image: image || undefined,
      location: location || "To arrange with the NGO",
      geoLocation: geoLocation || undefined,
      availableUntil: availableUntil ? new Date(availableUntil) : new Date(Date.now() + 24 * 60 * 60 * 1000),
      message: message || "",
      status: REQUEST_STATUS.PENDING
    }], { session });

    await createNotification({
      userId: ngoId,
      type: NOTIFICATION_TYPES.REQUEST_RECEIVED,
      message: `A donor offered ${quantity} of ${foodName}.`,
      requestId: offer._id,
      donationId: offer._id
    }, session);

    await session.commitTransaction();
    emitSessionNotifications(session);
    return offer;
  } catch (error) {
    await session.abortTransaction();
    throw error;
  } finally {
    session.endSession();
  }
}

async function transitionOffer({ offerId, action, actorId, actorRole }) {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const offer = await DonationOffer.findById(offerId)
      .populate("donorId", "name phone email")
      .populate("ngoId", "name organizationName location acceptedCategories currentNeedDescription isAcceptingDonations operatingRadiusKm phone email")
      .session(session);

    if (!offer) {
      throw new AppError("Offer not found", 404, "OFFER_NOT_FOUND");
    }

    const isDonorOwner = offer.donorId?._id?.toString() === actorId;
    const isNgoOwner = offer.ngoId?._id?.toString() === actorId;

    if (action === "accept" || action === "reject") {
      if (!(isNgoOwner && actorRole === USER_ROLES.NGO)) {
        throw new AppError("Only the target NGO can accept or reject this offer", 403, "FORBIDDEN");
      }
      if (offer.status !== REQUEST_STATUS.PENDING) {
        throw new AppError("Only pending offers can be accepted or rejected", 409, "INVALID_OFFER_STATE");
      }
    }

    if (action === "complete") {
      if (!(isDonorOwner || isNgoOwner)) {
        throw new AppError("Only related donor or NGO can complete this offer", 403, "FORBIDDEN");
      }
      if (offer.status === REQUEST_STATUS.COMPLETED) {
        await session.commitTransaction();
        return offer;
      }
      if (offer.status !== REQUEST_STATUS.ACCEPTED) {
        throw new AppError("Only accepted offers can be completed", 409, "INVALID_OFFER_STATE");
      }
    }

    if (action === "accept") {
      offer.status = REQUEST_STATUS.ACCEPTED;
      await offer.save({ session });
      await createNotification({
        userId: offer.donorId._id,
        type: NOTIFICATION_TYPES.REQUEST_ACCEPTED,
        message: `${offer.ngoId.organizationName || offer.ngoId.name} accepted your donation offer for ${offer.foodName}.`,
        requestId: offer._id
      }, session);
    }

    if (action === "reject") {
      offer.status = REQUEST_STATUS.REJECTED;
      await offer.save({ session });
      await createNotification({
        userId: offer.donorId._id,
        type: NOTIFICATION_TYPES.REQUEST_REJECTED,
        message: `${offer.ngoId.organizationName || offer.ngoId.name} rejected your donation offer for ${offer.foodName}.`,
        requestId: offer._id
      }, session);
    }

    if (action === "complete") {
      if (actorRole === USER_ROLES.DONOR) offer.donorCompletedAt = offer.donorCompletedAt || new Date();
      if (actorRole === USER_ROLES.NGO) offer.ngoCompletedAt = offer.ngoCompletedAt || new Date();
      if (offer.donorCompletedAt && offer.ngoCompletedAt) offer.status = REQUEST_STATUS.COMPLETED;
      await offer.save({ session });

      if (offer.donorCompletedAt && offer.ngoCompletedAt) {
        const completionMessage = `Donation offer for "${offer.foodName}" was completed by both parties.`;
        await createNotification({ userId: offer.donorId._id, type: NOTIFICATION_TYPES.DONATION_COMPLETED, message: completionMessage, requestId: offer._id }, session);
        await createNotification({ userId: offer.ngoId._id, type: NOTIFICATION_TYPES.DONATION_COMPLETED, message: completionMessage, requestId: offer._id }, session);
      }
    }

    await session.commitTransaction();
    emitSessionNotifications(session);

    const refreshed = await DonationOffer.findById(offer._id)
      .populate("donorId", "name phone email")
      .populate("ngoId", "name organizationName location acceptedCategories currentNeedDescription isAcceptingDonations operatingRadiusKm phone email");

    return refreshed;
  } catch (error) {
    await session.abortTransaction();
    throw error;
  } finally {
    session.endSession();
  }
}

module.exports = {
  toOfferClient,
  createOffer,
  transitionOffer
};
