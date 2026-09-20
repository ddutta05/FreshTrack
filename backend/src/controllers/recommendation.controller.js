const asyncHandler = require("../utils/asyncHandler");
const { success } = require("../utils/apiResponse");
const {
  findDonationsForNgo,
  findNgosForDonor,
  browseNgosForDonor
} = require("../services/recommendation.service");

const getDonationRecommendations = asyncHandler(async (req, res) => {
  const maxDistanceKm = req.query.maxDistanceKm
    ? Number(req.query.maxDistanceKm)
    : undefined;

  const recommendations = await findDonationsForNgo({
    ngoId: req.user.id,
    maxDistanceKm
  });

  return success(res, 200, "Donation recommendations fetched", recommendations);
});

const getNgoRecommendations = asyncHandler(async (req, res) => {
  const maxDistanceKm = req.query.maxDistanceKm
    ? Number(req.query.maxDistanceKm)
    : undefined;

  const recommendations = await findNgosForDonor({
    donorId: req.user.id,
    category: req.query.category,
    donationId: req.query.donationId,
    maxDistanceKm
  });

  return success(res, 200, "NGO recommendations fetched", recommendations);
});

module.exports = {
  getDonationRecommendations,
  getNgoRecommendations,
  browseNgosForDonor: asyncHandler(async (req, res) => {
    const maxDistanceKm = req.query.maxDistanceKm ? Number(req.query.maxDistanceKm) : undefined;
    const recommendations = await browseNgosForDonor({
      donorId: req.user.id,
      category: req.query.category,
      maxDistanceKm
    });
    return success(res, 200, "NGOs fetched", recommendations);
  })
};
