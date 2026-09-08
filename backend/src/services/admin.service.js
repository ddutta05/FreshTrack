const User = require("../models/User");
const Donation = require("../models/Donation");
const DonationRequest = require("../models/DonationRequest");
const { DONATION_STATUS, REQUEST_STATUS, USER_ROLES } = require("../utils/constants");

function parseMealQuantity(quantity) {
  if (typeof quantity !== "string") {
    return 0;
  }

  const match = quantity.match(/(\d[\d,]*(?:\.\d+)?)\s*(servings?|meals?|portions?)\b/i);
  if (!match) {
    return 0;
  }

  const parsed = Number.parseFloat(match[1].replace(/,/g, ""));
  return Number.isFinite(parsed) ? parsed : 0;
}

async function getPlatformStats() {
  const [
    totalUsers,
    totalDonors,
    totalNgos,
    totalDonations,
    availableDonations,
    pendingDonations,
    acceptedDonations,
    completedDonations,
    expiredDonations,
    totalRequests,
    pendingRequests,
    acceptedRequests,
    rejectedRequests,
    completedRequests
  ] = await Promise.all([
    User.countDocuments(),
    User.countDocuments({ role: USER_ROLES.DONOR }),
    User.countDocuments({ role: USER_ROLES.NGO }),
    Donation.countDocuments(),
    Donation.countDocuments({ status: DONATION_STATUS.AVAILABLE }),
    Donation.countDocuments({ status: DONATION_STATUS.PENDING }),
    Donation.countDocuments({ status: DONATION_STATUS.ACCEPTED }),
    Donation.countDocuments({ status: DONATION_STATUS.COMPLETED }),
    Donation.countDocuments({ status: DONATION_STATUS.EXPIRED }),
    DonationRequest.countDocuments(),
    DonationRequest.countDocuments({ status: REQUEST_STATUS.PENDING }),
    DonationRequest.countDocuments({ status: REQUEST_STATUS.ACCEPTED }),
    DonationRequest.countDocuments({ status: REQUEST_STATUS.REJECTED }),
    DonationRequest.countDocuments({ status: REQUEST_STATUS.COMPLETED })
  ]);

  return {
    totalUsers,
    totalDonors,
    totalNgos,
    totalDonations,
    availableDonations,
    pendingDonations,
    acceptedDonations,
    completedDonations,
    expiredDonations,
    totalRequests,
    pendingRequests,
    acceptedRequests,
    rejectedRequests,
    completedRequests
  };
}

async function getPublicImpactStats() {
  const [foodDonations, ngosConnected, fulfilledDonations] = await Promise.all([
    Donation.countDocuments(),
    User.countDocuments({ role: USER_ROLES.NGO }),
    Donation.find({
      status: { $in: [DONATION_STATUS.ACCEPTED, DONATION_STATUS.COMPLETED] }
    })
      .select("quantity")
      .lean()
  ]);

  const mealsRedistributed = fulfilledDonations.reduce((sum, donation) => {
    return sum + parseMealQuantity(donation.quantity);
  }, 0);

  return {
    foodDonations,
    ngosConnected,
    mealsRedistributed
  };
}

module.exports = {
  getPlatformStats,
  getPublicImpactStats
};
