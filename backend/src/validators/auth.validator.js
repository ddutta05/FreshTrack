const { body } = require("express-validator");
const { USER_ROLES } = require("../utils/constants");
const { validateGeoLocation } = require("./geo.validator");

const registerValidator = [
  body("name")
    .if(body("role").equals(USER_ROLES.DONOR))
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage("Name must be 2-100 characters"),
  body("name")
    .optional()
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage("Name must be 2-100 characters"),
  body("email").trim().isEmail().withMessage("Valid email is required").normalizeEmail(),
  body("password")
    .isLength({ min: 6, max: 128 })
    .withMessage("Password must be at least 6 characters")
    .matches(/[A-Za-z]/)
    .withMessage("Password must include at least one letter")
    .matches(/[0-9]/)
    .withMessage("Password must include at least one number"),
  body("role").isIn([USER_ROLES.DONOR, USER_ROLES.NGO]).withMessage("Role must be donor or ngo"),
  body("phone")
    .if(body("role").equals(USER_ROLES.NGO))
    .trim()
    .notEmpty()
    .withMessage("Phone is required for NGO accounts")
    .bail()
    .isLength({ max: 30 })
    .withMessage("Phone is too long"),
  body("phone").optional().trim().isLength({ max: 30 }).withMessage("Phone is too long"),
  body("organizationName")
    .optional()
    .trim()
    .isLength({ min: 2, max: 150 })
    .withMessage("Organization name must be 2-150 characters"),
  body("location")
    .if(body("role").equals(USER_ROLES.NGO))
    .trim()
    .notEmpty()
    .withMessage("Location is required for NGO accounts")
    .bail()
    .isLength({ max: 250 })
    .withMessage("Location must be 250 characters or less"),
  body("geoLocation")
    .if(body("role").equals(USER_ROLES.NGO))
    .custom((value) => {
      validateGeoLocation(value);
      return true;
    })
    .withMessage("A valid base location is required for NGO accounts"),
  body("acceptedCategories")
    .if(body("role").equals(USER_ROLES.NGO))
    .isArray({ min: 1 })
    .withMessage("At least one accepted food category is required for NGO accounts")
    .bail()
    .custom((categories) => categories.every((category) => typeof category === "string" && category.trim()))
    .withMessage("Accepted food categories must contain valid names")
];

const loginValidator = [
  body("email").trim().isEmail().withMessage("Valid email is required").normalizeEmail(),
  body("password").isString().notEmpty().withMessage("Password is required"),
  body("role").optional().isIn(Object.values(USER_ROLES)).withMessage("Invalid role")
];

module.exports = {
  registerValidator,
  loginValidator
};
