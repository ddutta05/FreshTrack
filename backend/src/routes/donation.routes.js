const express = require("express");
const {
  listDonations,
  getDonationById,
  getMyDonations,
  createDonation,
  updateDonation,
  deleteDonation
} = require("../controllers/donation.controller");
const { requireAuth } = require("../middleware/auth.middleware");
const { requireRole } = require("../middleware/role.middleware");
const { validate } = require("../middleware/validation.middleware");
const { upload } = require("../middleware/upload.middleware");
const {
  donationIdParamValidator,
  donationListValidator,
  createDonationValidator,
  updateDonationValidator
} = require("../validators/donation.validator");
const { USER_ROLES } = require("../utils/constants");

const router = express.Router();

router.get("/", donationListValidator, validate, listDonations);
router.get("/mine", requireAuth, requireRole(USER_ROLES.DONOR), donationListValidator, validate, getMyDonations);
router.get("/:id", donationIdParamValidator, validate, getDonationById);
router.post("/", requireAuth, requireRole(USER_ROLES.DONOR), upload.single("image"), createDonationValidator, validate, createDonation);
router.put("/:id", requireAuth, upload.single("image"), updateDonationValidator, validate, updateDonation);
router.delete("/:id", requireAuth, donationIdParamValidator, validate, deleteDonation);

module.exports = router;
