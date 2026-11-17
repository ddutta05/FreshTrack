const { body, param, query } = require("express-validator");
const { DONATION_STATUS } = require("../utils/constants");
const { validateGeoLocation } = require("./geo.validator");
const { structuredQuantityValidator } = require("./quantity.validator");

const createDonationValidator = [
  body("foodName").trim().notEmpty().withMessage("Food name is required").isLength({ max: 150 }),
  body("category").trim().notEmpty().withMessage("Category is required").isLength({ max: 80 }),
  body("description").trim().notEmpty().withMessage("Description is required").isLength({ max: 2000 }),
  body("location").trim().notEmpty().withMessage("Location is required").isLength({ max: 250 }),
  body("availableUntil").isISO8601().withMessage("availableUntil must be a valid date"),
  body("targetNgoId").optional().isMongoId().withMessage("Invalid target NGO id"),
  body("offerMessage").optional().trim().isLength({ max: 1000 }).withMessage("Offer message too long"),
  body("image").optional().isString().isLength({ max: 1000 }).withMessage("Invalid image value"),
  body("geoLocation")
    .custom((value) => {
      if (value === undefined || value === null || value === "" || value === "null") {
        throw new Error("Pickup coordinates are required");
      }
      return validateGeoLocation(value);
    }),
  structuredQuantityValidator({ required: true })
];

const updateDonationValidator = [
  param("id").isMongoId().withMessage("Invalid donation id"),
  body("foodName").optional().trim().isLength({ min: 1, max: 150 }),
  body("category").optional().trim().isLength({ min: 1, max: 80 }),
  body("description").optional().trim().isLength({ min: 1, max: 2000 }),
  body("location").optional().trim().isLength({ min: 1, max: 250 }),
  body("availableUntil").optional().isISO8601().withMessage("availableUntil must be valid"),
  body("status").optional().isIn(Object.values(DONATION_STATUS)).withMessage("Invalid donation status"),
  body("image").optional().isString().isLength({ max: 1000 }).withMessage("Invalid image value"),
  body("geoLocation").custom((value, { req }) => {
    const editedFields = [
      "foodName",
      "category",
      "quantity",
      "quantityValue",
      "quantityUnit",
      "description",
      "location",
      "availableUntil",
      "image"
    ];
    const isDonationEdit = editedFields.some((field) => req.body[field] !== undefined);
    const hasGeoLocation = Object.prototype.hasOwnProperty.call(req.body, "geoLocation");
    if (!isDonationEdit && !hasGeoLocation) {
      return true;
    }
    if (value === undefined || value === null || value === "" || value === "null") {
      throw new Error("Pickup coordinates are required when editing a donation");
    }
    return validateGeoLocation(value);
  }),
  structuredQuantityValidator()
];

const donationIdParamValidator = [param("id").isMongoId().withMessage("Invalid donation id")];

const donationListValidator = [
  query("page").optional().isInt({ min: 1 }).withMessage("page must be positive"),
  query("limit").optional().isInt({ min: 1, max: 50 }).withMessage("limit must be 1-50"),
  query("status").optional().isIn(Object.values(DONATION_STATUS)).withMessage("Invalid status")
];

module.exports = {
  createDonationValidator,
  updateDonationValidator,
  donationIdParamValidator,
  donationListValidator
};
