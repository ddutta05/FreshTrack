const { validationResult } = require("express-validator");

function validate(req, _res, next) {
  const errors = validationResult(req);
  if (errors.isEmpty()) {
    return next();
  }

  return next({
    statusCode: 422,
    code: "VALIDATION_ERROR",
    message: "Validation failed",
    details: errors.array().map((e) => ({
      field: e.path,
      message: e.msg
    }))
  });
}

module.exports = {
  validate
};
