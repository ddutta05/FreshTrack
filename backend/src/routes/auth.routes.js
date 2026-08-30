const express = require("express");
const { register, login, me } = require("../controllers/auth.controller");
const { requireAuth } = require("../middleware/auth.middleware");
const { validate } = require("../middleware/validation.middleware");
const { registerValidator, loginValidator } = require("../validators/auth.validator");

const router = express.Router();

router.post("/register", registerValidator, validate, register);
router.post("/login", loginValidator, validate, login);
router.get("/me", requireAuth, me);

module.exports = router;
