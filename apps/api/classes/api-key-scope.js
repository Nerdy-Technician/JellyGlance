function normalizeApiKeyScope(value, { fallback = "full" } = {}) {
  const scope = String(value || "")
    .toLowerCase()
    .replace(/[_]/g, "-");
  if (scope === "widgets-write" || scope === "widgetswrite") return "widgets-write";
  if (scope === "widgets") return "widgets";
  if (scope === "full") return "full";
  return fallback === "widgets" || fallback === "widgets-write" || fallback === "full" ? fallback : "full";
}

function isWidgetWriteScope(scope) {
  return normalizeApiKeyScope(scope, { fallback: "" }) === "widgets-write";
}

module.exports = {
  normalizeApiKeyScope,
  isWidgetWriteScope,
};
