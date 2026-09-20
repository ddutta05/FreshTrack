const { query } = require("express-validator");

const recommendationDonationsValidator = [
  query("maxDistanceKm")
    .optional()
    .isFloat({ min: 0.1, max: 50 })
    .withMessage("maxDistanceKm must be a number between 0.1 and 50")
];

const recommendationNgosValidator = [
  query("category")
    .optional()
    .trim()
    .notEmpty()
    .withMessage("Category cannot be empty"),
  query("donationId")
    .optional()
    .isMongoId()
    .withMessage("Invalid donationId"),
  query("maxDistanceKm")
    .optional()
    .isFloat({ min: 0.1, max: 50 })
    .withMessage("maxDistanceKm must be a number between 0.1 and 50"),
  query().custom((_, { req }) => {
    if (!req.query.category && !req.query.donationId) {
      throw new Error("Either category or donationId is required");
    }
    return true;
  })
];

module.exports = {
  recommendationDonationsValidator,
  recommendationNgosValidator
};
