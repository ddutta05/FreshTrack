const { body, param, query } = require("express-validator");
const { DONATION_STATUS, QUANTITY_UNITS } = require("../utils/constants");
const { validateGeoLocation } = require("./geo.validator");

const createDonationValidator = [
  body("foodName").trim().notEmpty().withMessage("Food name is required").isLength({ max: 150 }),
  body("category").trim().notEmpty().withMessage("Category is required").isLength({ max: 80 }),
  body("quantity").trim().notEmpty().withMessage("Quantity is required").isLength({ max: 120 }),
  body("description").trim().notEmpty().withMessage("Description is required").isLength({ max: 2000 }),
  body("location").trim().notEmpty().withMessage("Location is required").isLength({ max: 250 }),
  body("availableUntil").isISO8601().withMessage("availableUntil must be a valid date"),
  body("targetNgoId").optional().isMongoId().withMessage("Invalid target NGO id"),
  body("offerMessage").optional().trim().isLength({ max: 1000 }).withMessage("Offer message too long"),
  body("image").optional().isString().isLength({ max: 1000 }).withMessage("Invalid image value"),
  body("geoLocation").optional({ nullable: true }).custom(validateGeoLocation),
  body("quantityValue")
    .optional({ nullable: true })
    .custom((val, { req }) => {
      if (val === undefined || val === null || val === "") {
        if (req.body.quantityUnit !== undefined && req.body.quantityUnit !== null && req.body.quantityUnit !== "") {
          throw new Error("quantityValue is required when quantityUnit is provided");
        }
        return true;
      }
      const num = Number(val);
      if (typeof val === "boolean" || Number.isNaN(num) || !Number.isFinite(num) || num < 0) {
        throw new Error("quantityValue must be a finite non-negative number");
      }
      if (req.body.quantityUnit === undefined || req.body.quantityUnit === null || req.body.quantityUnit === "") {
        throw new Error("quantityUnit is required when quantityValue is provided");
      }
      return true;
    }),
  body("quantityUnit")
    .optional({ nullable: true })
    .custom((val, { req }) => {
      if (val === undefined || val === null || val === "") {
        if (req.body.quantityValue !== undefined && req.body.quantityValue !== null && req.body.quantityValue !== "") {
          throw new Error("quantityUnit is required when quantityValue is provided");
        }
        return true;
      }
      if (!QUANTITY_UNITS.includes(val)) {
        throw new Error(`quantityUnit must be one of: ${QUANTITY_UNITS.join(", ")}`);
      }
      if (req.body.quantityValue === undefined || req.body.quantityValue === null || req.body.quantityValue === "") {
        throw new Error("quantityValue is required when quantityUnit is provided");
      }
      return true;
    })
];

const updateDonationValidator = [
  param("id").isMongoId().withMessage("Invalid donation id"),
  body("foodName").optional().trim().isLength({ min: 1, max: 150 }),
  body("category").optional().trim().isLength({ min: 1, max: 80 }),
  body("quantity").optional().trim().isLength({ min: 1, max: 120 }),
  body("description").optional().trim().isLength({ min: 1, max: 2000 }),
  body("location").optional().trim().isLength({ min: 1, max: 250 }),
  body("availableUntil").optional().isISO8601().withMessage("availableUntil must be valid"),
  body("status").optional().isIn(Object.values(DONATION_STATUS)).withMessage("Invalid donation status"),
  body("image").optional().isString().isLength({ max: 1000 }).withMessage("Invalid image value"),
  body("geoLocation").optional({ nullable: true }).custom(validateGeoLocation),
  body("quantityValue")
    .optional({ nullable: true })
    .custom((val, { req }) => {
      if (val === undefined || val === null || val === "") {
        if (req.body.quantityUnit !== undefined && req.body.quantityUnit !== null && req.body.quantityUnit !== "") {
          throw new Error("quantityValue is required when quantityUnit is provided");
        }
        return true;
      }
      const num = Number(val);
      if (typeof val === "boolean" || Number.isNaN(num) || !Number.isFinite(num) || num < 0) {
        throw new Error("quantityValue must be a finite non-negative number");
      }
      if (req.body.quantityUnit === undefined || req.body.quantityUnit === null || req.body.quantityUnit === "") {
        throw new Error("quantityUnit is required when quantityValue is provided");
      }
      return true;
    }),
  body("quantityUnit")
    .optional({ nullable: true })
    .custom((val, { req }) => {
      if (val === undefined || val === null || val === "") {
        if (req.body.quantityValue !== undefined && req.body.quantityValue !== null && req.body.quantityValue !== "") {
          throw new Error("quantityUnit is required when quantityValue is provided");
        }
        return true;
      }
      if (!QUANTITY_UNITS.includes(val)) {
        throw new Error(`quantityUnit must be one of: ${QUANTITY_UNITS.join(", ")}`);
      }
      if (req.body.quantityValue === undefined || req.body.quantityValue === null || req.body.quantityValue === "") {
        throw new Error("quantityValue is required when quantityUnit is provided");
      }
      return true;
    })
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
