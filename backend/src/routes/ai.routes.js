const express = require("express");
const { testChat, chat } = require("../controllers/ai.controller");
const { requireAuth } = require("../middleware/auth.middleware");
const { requireRole } = require("../middleware/role.middleware");
const { validate } = require("../middleware/validation.middleware");
const { chatMessageValidator } = require("../validators/ai.validator");
const { USER_ROLES } = require("../utils/constants");

const router = express.Router();

router.use(requireAuth);
router.use(requireRole(USER_ROLES.DONOR, USER_ROLES.NGO));

router.post("/test-chat", chatMessageValidator, validate, testChat);
router.post("/chat", chatMessageValidator, validate, chat);

module.exports = router;
