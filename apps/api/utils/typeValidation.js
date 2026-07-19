function isNumber(value) {
  return typeof value === "number" && !Number.isNaN(value);
}

module.exports = { isNumber };
