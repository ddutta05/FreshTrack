const { param, query } = require("express-validator");

const notificationListValidator = [
  query("page").optional().isInt({ min: 1 }).withMessage("page must be positive"),
  query("limit").optional().isInt({ min: 1, max: 50 }).withMessage("limit must be 1-50")
];

const notificationIdValidator = [param("id").isMongoId().withMessage("Invalid notification id")];

module.exports = {
  notificationListValidator,
  notificationIdValidator
};
