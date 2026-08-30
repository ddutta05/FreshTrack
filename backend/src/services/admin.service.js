const User = require("../models/User");
const Donation = require("../models/Donation");
const DonationRequest = require("../models/DonationRequest");
const { DONATION_STATUS, REQUEST_STATUS, USER_ROLES } = require("../utils/constants");

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

module.exports = {
  getPlatformStats
};
