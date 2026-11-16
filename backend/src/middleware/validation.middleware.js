const { validationResult } = require("express-validator");

function validate(req, _res, next) {
  const errors = validationResult(req);
  if (errors.isEmpty()) {
    return next();
  }

  const details = errors.array().map((e) => ({
    field: e.path,
    message: e.msg
  }));

  const hasInvalidResourceId = details.some(({ field, message }) =>
    field === "id" || /(?:^|\s)(?:invalid|not found)\s.*id/i.test(message) || /id/i.test(message)
  );

  return next({
    statusCode: 422,
    code: "VALIDATION_ERROR",
    message: hasInvalidResourceId ? "We couldn't find that item." : "Please review your input and try again.",
    details
  });
}

module.exports = {
  validate
};
