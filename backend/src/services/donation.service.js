const mongoose = require("mongoose");
const Donation = require("../models/Donation");
const DonationRequest = require("../models/DonationRequest");
const { DONATION_STATUS, REQUEST_STATUS, NOTIFICATION_TYPES } = require("../utils/constants");
const { createNotification, emitSessionNotifications } = require("./notification.service");
const { normalizeStoredImagePath } = require("../utils/imagePath");

function toDonationClient(donation) {
  const donorName = donation.donorId?.name || donation.donorName || "Unknown";
  const donorId = donation.donorId?._id ? donation.donorId._id.toString() : donation.donorId.toString();

  return {
    id: donation._id.toString(),
    foodName: donation.foodName,
    category: donation.category,
    quantity: donation.quantity,
    quantityValue: donation.quantityValue,
    quantityUnit: donation.quantityUnit,
    description: donation.description,
    image: normalizeStoredImagePath(donation.image),
    location: donation.location,
    geoLocation: donation.geoLocation && donation.geoLocation.type ? donation.geoLocation : undefined,
    availableUntil: donation.availableUntil,
    donorId,
    donorName,
    targetNgoId: donation.targetNgoId?._id ? donation.targetNgoId._id.toString() : donation.targetNgoId?.toString(),
    targetNgoName: donation.targetNgoId?.organizationName || donation.targetNgoId?.name,
    status: donation.status,
    createdAt: donation.createdAt,
    updatedAt: donation.updatedAt
  };
}

async function expireDonationsAndNotify(session) {
  const now = new Date();
  const expirableStatuses = [DONATION_STATUS.AVAILABLE, DONATION_STATUS.PENDING, DONATION_STATUS.ACCEPTED];
  const filter = {
    status: { $in: expirableStatuses },
    availableUntil: { $lt: now }
  };

  if (session) {
    const expiring = await Donation.find(filter).session(session);
    for (const donation of expiring) {
      await expireDonation(donation, session);
    }
    return expiring.length;
  }

  const candidates = await Donation.find(filter).select("_id").lean();
  let expiredCount = 0;

  for (const candidate of candidates) {
    const expirySession = await mongoose.startSession();
    expirySession.startTransaction();
    try {
      const donation = await Donation.findOne({ ...filter, _id: candidate._id }).session(expirySession);
      if (donation) {
        await expireDonation(donation, expirySession);
      }

      await expirySession.commitTransaction();
      emitSessionNotifications(expirySession);
      if (donation) expiredCount += 1;
    } catch (error) {
      await expirySession.abortTransaction();
      throw error;
    } finally {
      expirySession.endSession();
    }
  }

  return expiredCount;
}

async function expireDonation(donation, session) {
  donation.status = DONATION_STATUS.EXPIRED;
  await donation.save({ session });

  await DonationRequest.updateMany(
    {
      donationId: donation._id,
      status: { $in: [REQUEST_STATUS.PENDING, REQUEST_STATUS.ACCEPTED] }
    },
    { $set: { status: REQUEST_STATUS.REJECTED } },
    { session }
  );

  await createNotification(
    {
      userId: donation.donorId,
      type: NOTIFICATION_TYPES.DONATION_EXPIRED,
      message: `Your donation \"${donation.foodName}\" has expired.`,
      donationId: donation._id
    },
    session
  );
}

module.exports = {
  toDonationClient,
  expireDonationsAndNotify
};
