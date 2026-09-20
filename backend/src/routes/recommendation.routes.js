const express = require("express");
const {
  getDonationRecommendations,
  getNgoRecommendations
  , browseNgosForDonor
} = require("../controllers/recommendation.controller");
const { requireAuth } = require("../middleware/auth.middleware");
const { requireRole } = require("../middleware/role.middleware");
const { validate } = require("../middleware/validation.middleware");
const {
  recommendationDonationsValidator,
  recommendationNgosValidator
} = require("../validators/recommendation.validator");
const { USER_ROLES } = require("../utils/constants");

const router = express.Router();

router.use(requireAuth);

router.get(
  "/donations",
  requireRole(USER_ROLES.NGO),
  recommendationDonationsValidator,
  validate,
  getDonationRecommendations
);

router.get(
  "/ngos/browse",
  requireRole(USER_ROLES.DONOR),
  recommendationDonationsValidator,
  validate,
  browseNgosForDonor
);

router.get(
  "/ngos",
  requireRole(USER_ROLES.DONOR),
  recommendationNgosValidator,
  validate,
  getNgoRecommendations
);

module.exports = router;
