const { body, param, query } = require("express-validator");
const { USER_STATUS, USER_ROLES } = require("../utils/constants");

const profileUpdateValidator = [
  body("name").optional().trim().isLength({ min: 2, max: 100 }).withMessage("Invalid name"),
  body("phone").optional().trim().isLength({ max: 30 }).withMessage("Invalid phone"),
  body("organizationName").optional().trim().isLength({ min: 2, max: 150 }).withMessage("Invalid organization name")
];

const adminUserUpdateValidator = [
  param("id").isMongoId().withMessage("Invalid user id"),
  body("name").optional().trim().isLength({ min: 2, max: 100 }).withMessage("Invalid name"),
  body("phone").optional().trim().isLength({ max: 30 }).withMessage("Invalid phone"),
  body("organizationName").optional().trim().isLength({ min: 2, max: 150 }).withMessage("Invalid organization name"),
  body("status").optional().isIn(Object.values(USER_STATUS)).withMessage("Invalid status"),
  body("role").optional().isIn(Object.values(USER_ROLES)).withMessage("Invalid role")
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
