const { body } = require("express-validator");
const { QUANTITY_UNITS } = require("../utils/constants");

function structuredQuantityValidator({ required = false, applies = () => true } = {}) {
  return body().custom((_, { req }) => {
    if (!applies(req)) {
      return true;
    }

    const hasValue = Object.prototype.hasOwnProperty.call(req.body, "quantityValue");
    const hasUnit = Object.prototype.hasOwnProperty.call(req.body, "quantityUnit");
    if (!required && !hasValue && !hasUnit) {
      return true;
    }

    const value = req.body.quantityValue;
    const unit = req.body.quantityUnit;
    if (
      value === undefined
      || value === null
      || (typeof value !== "number" && typeof value !== "string")
      || value === ""
    ) {
      throw new Error("quantityValue is required and must be a finite non-negative number");
    }

    const numericValue = Number(value);
    if (!Number.isFinite(numericValue) || numericValue < 0) {
      throw new Error("quantityValue must be a finite non-negative number");
    }
    if (typeof value === "string" && !value.trim()) {
      throw new Error("quantityValue must be a finite non-negative number");
    }
    if (!QUANTITY_UNITS.includes(unit)) {
      throw new Error(`quantityUnit must be one of: ${QUANTITY_UNITS.join(", ")}`);
    }

    return true;
  });
}

module.exports = { structuredQuantityValidator };
