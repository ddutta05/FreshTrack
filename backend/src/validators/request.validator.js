const { body, param, query } = require("express-validator");

const createRequestValidator = [
  body("donationId").isMongoId().withMessage("Valid donationId is required"),
  body("message").optional().trim().isLength({ max: 1000 }).withMessage("Message too long")
];

const requestIdParamValidator = [param("id").isMongoId().withMessage("Invalid request id")];

const requestListValidator = [
  query("page").optional().isInt({ min: 1 }).withMessage("page must be positive"),
  query("limit").optional().isInt({ min: 1, max: 50 }).withMessage("limit must be 1-50"),
  query("donationId").optional().isMongoId().withMessage("Invalid donationId")
];

module.exports = {
  createRequestValidator,
  requestIdParamValidator,
  requestListValidator
};
