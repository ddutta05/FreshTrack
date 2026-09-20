const { body, param, query } = require("express-validator");
const { USER_STATUS, USER_ROLES } = require("../utils/constants");
const { validateGeoLocation } = require("./geo.validator");

const profileUpdateValidator = [
  body("name").optional().trim().isLength({ min: 2, max: 100 }).withMessage("Invalid name"),
  body("phone").optional().trim().isLength({ max: 30 }).withMessage("Invalid phone"),
  body("organizationName").optional().trim().isLength({ min: 2, max: 150 }).withMessage("Invalid organization name"),
  body("location").optional().trim().isLength({ max: 250 }).withMessage("Invalid location"),
  body("geoLocation").optional({ nullable: true }).custom(validateGeoLocation),
  body("acceptedCategories")
    .optional()
    .isArray()
    .withMessage("acceptedCategories must be an array")
    .custom((arr) => {
      if (!arr.every((item) => typeof item === "string")) {
        throw new Error("acceptedCategories must contain only strings");
      }
      return true;
    }),
  body("operatingRadiusKm")
    .optional({ nullable: true })
    .custom((val) => {
      if (val === undefined || val === null || val === "") return true;
      const num = Number(val);
      if (typeof val === "boolean" || Number.isNaN(num) || !Number.isFinite(num) || num < 0) {
        throw new Error("operatingRadiusKm must be a finite non-negative number");
      }
      return true;
    }),
  body("isAcceptingDonations")
    .optional()
    .isBoolean()
    .withMessage("isAcceptingDonations must be a boolean"),
  body("currentNeedDescription")
    .optional()
    .isString()
    .withMessage("currentNeedDescription must be a string")
    .trim()
    .isLength({ max: 500 })
    .withMessage("currentNeedDescription must be 500 characters or less")
];

const adminUserUpdateValidator = [
  param("id").isMongoId().withMessage("Invalid user id"),
  body("name").optional().trim().isLength({ min: 2, max: 100 }).withMessage("Invalid name"),
  body("phone").optional().trim().isLength({ max: 30 }).withMessage("Invalid phone"),
  body("organizationName").optional().trim().isLength({ min: 2, max: 150 }).withMessage("Invalid organization name"),
  body("location").optional().trim().isLength({ max: 250 }).withMessage("Invalid location"),
  body("status").optional().isIn(Object.values(USER_STATUS)).withMessage("Invalid status"),
  body("role").optional().isIn(Object.values(USER_ROLES)).withMessage("Invalid role"),
  body("geoLocation").optional({ nullable: true }).custom(validateGeoLocation),
  body("acceptedCategories")
    .optional()
    .isArray()
    .withMessage("acceptedCategories must be an array")
    .custom((arr) => {
      if (!arr.every((item) => typeof item === "string")) {
        throw new Error("acceptedCategories must contain only strings");
      }
      return true;
    }),
  body("operatingRadiusKm")
    .optional({ nullable: true })
    .custom((val) => {
      if (val === undefined || val === null || val === "") return true;
      const num = Number(val);
      if (typeof val === "boolean" || Number.isNaN(num) || !Number.isFinite(num) || num < 0) {
        throw new Error("operatingRadiusKm must be a finite non-negative number");
      }
      return true;
    }),
  body("isAcceptingDonations")
    .optional()
    .isBoolean()
    .withMessage("isAcceptingDonations must be a boolean"),
  body("currentNeedDescription")
    .optional()
    .isString()
    .withMessage("currentNeedDescription must be a string")
    .trim()
    .isLength({ max: 500 })
    .withMessage("currentNeedDescription must be 500 characters or less")
];

const userIdParamValidator = [param("id").isMongoId().withMessage("Invalid user id")];

const userListValidator = [
  query("page").optional().isInt({ min: 1 }).withMessage("page must be positive"),
  query("limit").optional().isInt({ min: 1, max: 50 }).withMessage("limit must be 1-50")
];

module.exports = {
  profileUpdateValidator,
  adminUserUpdateValidator,
  userIdParamValidator,
  userListValidator
};
