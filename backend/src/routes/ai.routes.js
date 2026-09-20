const express = require("express");
const { testChat, chat } = require("../controllers/ai.controller");
const { requireAuth } = require("../middleware/auth.middleware");
const { validate } = require("../middleware/validation.middleware");
const { chatMessageValidator } = require("../validators/ai.validator");

const router = express.Router();

router.use(requireAuth);

router.post("/test-chat", chatMessageValidator, validate, testChat);
router.post("/chat", chatMessageValidator, validate, chat);

module.exports = router;
