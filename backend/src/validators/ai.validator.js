const { body } = require("express-validator");

const MAX_HISTORY_MESSAGES = 10;
const MAX_HISTORY_CONTENT_LENGTH = 2000;
const MAX_HISTORY_TOTAL_LENGTH = 10000;

const chatMessageValidator = [
  body("message")
    .exists({ checkFalsy: false })
    .withMessage("Message is required")
    .isString()
    .withMessage("Message must be a string")
    .trim()
    .notEmpty()
    .withMessage("Message cannot be empty")
    .isLength({ max: 4000 })
    .withMessage("Message cannot exceed 4000 characters"),
  body("history")
    .optional()
    .isArray({ max: MAX_HISTORY_MESSAGES })
    .withMessage(`History cannot contain more than ${MAX_HISTORY_MESSAGES} messages`)
    .bail()
    .custom((history) => {
      let totalLength = 0;

      for (const item of history) {
        if (!item || !["user", "assistant"].includes(item.role)) {
          throw new Error("History roles must be user or assistant");
        }
        if (typeof item.content !== "string" || !item.content.trim()) {
          throw new Error("History content must be a non-empty string");
        }
        if (item.content.length > MAX_HISTORY_CONTENT_LENGTH) {
          throw new Error("History messages cannot exceed 2000 characters");
        }
        totalLength += item.content.length;
      }

      if (totalLength > MAX_HISTORY_TOTAL_LENGTH) {
        throw new Error("History is too large");
      }
      return true;
    })
];

module.exports = {
  chatMessageValidator
};
