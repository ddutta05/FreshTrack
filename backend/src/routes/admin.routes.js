const express = require("express");
const { getAdminDonations, getAdminStats } = require("../controllers/admin.controller");
const { requireAuth } = require("../middleware/auth.middleware");
const { requireRole } = require("../middleware/role.middleware");
const { USER_ROLES } = require("../utils/constants");

const router = express.Router();

router.use(requireAuth);
router.use(requireRole(USER_ROLES.ADMIN));

router.get("/donations", getAdminDonations);
router.get("/stats", getAdminStats);

module.exports = router;
