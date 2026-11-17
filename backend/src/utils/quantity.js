function formatQuantity(quantity, quantityValue, quantityUnit) {
  if (quantityValue !== undefined && quantityValue !== null && quantityUnit) {
    return `${quantityValue} ${quantityUnit}`;
  }
  return quantity;
}

module.exports = { formatQuantity };
