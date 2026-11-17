const { body, param, query } = require("express-validator");
const { structuredQuantityValidator } = require("./quantity.validator");

const createRequestValidator = [
  body("donationId").optional().isMongoId().withMessage("Invalid donationId"),
  body("ngoId").optional().isMongoId().withMessage("Invalid NGO id"),
  body("foodName").optional().trim().isLength({ min: 1, max: 150 }).withMessage("Invalid food name"),
  body("category").optional().trim().isLength({ min: 1, max: 80 }).withMessage("Invalid category"),
  body("message").optional().trim().isLength({ max: 1000 }).withMessage("Message too long"),
  body().custom((_, { req }) => {
    if (!req.body.donationId && !req.body.ngoId) throw new Error("A donation or NGO is required");
    return true;
  }),
  structuredQuantityValidator({ required: true, applies: (req) => Boolean(req.body.ngoId) })
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
