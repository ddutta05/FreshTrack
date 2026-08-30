const Donation = require("../models/Donation");
const DonationRequest = require("../models/DonationRequest");
const { DONATION_STATUS, REQUEST_STATUS, NOTIFICATION_TYPES } = require("../utils/constants");
const { createNotification } = require("./notification.service");

function toDonationClient(donation) {
  const donorName = donation.donorId?.name || donation.donorName || "Unknown";
  const donorId = donation.donorId?._id ? donation.donorId._id.toString() : donation.donorId.toString();

  return {
    id: donation._id.toString(),
    foodName: donation.foodName,
    category: donation.category,
    quantity: donation.quantity,
    description: donation.description,
    image: donation.image,
    location: donation.location,
    availableUntil: donation.availableUntil,
    donorId,
    donorName,
    status: donation.status,
    createdAt: donation.createdAt,
    updatedAt: donation.updatedAt
  };
}

async function expireDonationsAndNotify(session) {
  const now = new Date();
  const expirableStatuses = [DONATION_STATUS.AVAILABLE, DONATION_STATUS.PENDING, DONATION_STATUS.ACCEPTED];

  let expiringQuery = Donation.find({
    status: { $in: expirableStatuses },
    availableUntil: { $lt: now }
  });

  if (session) {
    expiringQuery = expiringQuery.session(session);
  }

  const expiring = await expiringQuery;

  if (!expiring.length) {
    return 0;
  }

  for (const donation of expiring) {
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

  return expiring.length;
}

module.exports = {
  toDonationClient,
  expireDonationsAndNotify
};
