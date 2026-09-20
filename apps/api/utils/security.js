const crypto = require("crypto");
const fs = require("fs");
const os = require("os");
const path = require("path");
const rateLimit = require("express-rate-limit");

const BLOCKED_OBJECT_KEYS = new Set(["__proto__", "constructor", "prototype"]);
const SCRYPT_PREFIX = "scrypt$";
const SCRYPT_KEYLEN = 64;
const LEGACY_SHA3_HEX = /^[a-f0-9]{128}$/i;
const QUICK_CONNECT_SECRET = /^[A-Za-z0-9._-]{8,256}$/;
const SAFE_IDENT = /^[A-Za-z_][A-Za-z0-9_]*$/;
const SAFE_SQL_EXPR =
  /^(COALESCE|SUM|COUNT|MAX|MIN|AVG|DISTINCT|json_agg|CASE|REGEXP_REPLACE|LOWER|CONCAT|ABS|EXTRACT)\b/i;
const BLOCKED_METADATA_HOSTS = new Set(["169.254.169.254", "metadata.google.internal", "metadata.goog"]);

function sanitizeForLog(value, maxLength = 200) {
  return String(value ?? "")
    .replace(/[\r\n\x00-\x1f\x7f\u2028\u2029]/g, "")
    .slice(0, maxLength);
}

function stripTrailingSlashes(value) {
  let result = String(value || "").trim();
  while (result.endsWith("/")) {
    result = result.slice(0, -1);
  }
  return result;
}

function isSafeObjectKey(key) {
  const normalized = String(key ?? "");
  return Boolean(normalized) && !BLOCKED_OBJECT_KEYS.has(normalized) && normalized.length <= 256;
}

function assertSafeObjectKey(key) {
  if (!isSafeObjectKey(key)) {
    throw new Error("Invalid object key");
  }
  return String(key);
}

function safeAssign(target, key, value) {
  if (!isSafeObjectKey(key)) {
    throw new Error("Invalid object key");
  }
  target[key] = value;
  return target;
}

function safeDelete(target, key) {
  if (!isSafeObjectKey(key)) {
    return false;
  }
  return delete target[key];
}

function assertPathInside(baseDir, candidatePath) {
  const root = path.resolve(baseDir);
  const resolved = path.resolve(candidatePath);
  const relative = path.relative(root, resolved);
  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new Error("Path is outside the allowed directory");
  }
  return resolved;
}

function safeJoin(baseDir, ...parts) {
  const safeParts = parts.map((part) => path.basename(String(part ?? "")));
  return assertPathInside(baseDir, path.join(path.resolve(baseDir), ...safeParts));
}

function toSafeHttpUrl(rawUrl, options = {}) {
  const parsed = new URL(String(rawUrl || ""));
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new Error("Only http and https URLs are allowed");
  }
  if (parsed.username || parsed.password) {
    throw new Error("URLs with embedded credentials are not allowed");
  }
  if (BLOCKED_METADATA_HOSTS.has(parsed.hostname.toLowerCase())) {
    throw new Error("Blocked destination host");
  }
  if (options.allowedHostnames?.length) {
    const hostname = parsed.hostname.toLowerCase();
    const allowed = options.allowedHostnames.some((item) => String(item || "").toLowerCase() === hostname);
    if (!allowed) {
      throw new Error("Destination host is not allowed");
    }
  }
  parsed.hash = "";
  return parsed.toString();
}

function joinSafeHttpUrl(baseUrl, relativePath = "") {
  const safeBase = toSafeHttpUrl(baseUrl);
  const parsed = new URL(safeBase);
  const extra = String(relativePath || "");
  if (/^https?:\/\//i.test(extra)) {
    return toSafeHttpUrl(extra, { allowedHostnames: [parsed.hostname] });
  }
  const prefix = parsed.pathname.endsWith("/") ? parsed.pathname.slice(0, -1) : parsed.pathname;
  const suffix = extra.startsWith("/") ? extra : extra ? `/${extra}` : "";
  parsed.pathname = `${prefix}${suffix}`;
  parsed.search = "";
  parsed.hash = "";
  const queryIndex = extra.indexOf("?");
  if (queryIndex >= 0 && extra.startsWith("/")) {
    parsed.pathname = `${prefix}${extra.slice(0, queryIndex)}`;
    parsed.search = extra.slice(queryIndex);
  }
  return toSafeHttpUrl(parsed.toString(), { allowedHostnames: [parsed.hostname] });
}

function hostnameEquals(rawUrl, expectedHost) {
  try {
    return new URL(String(rawUrl)).hostname.toLowerCase() === String(expectedHost).toLowerCase();
  } catch {
    return false;
  }
}

function urlIncludesHost(rawUrl, expectedHost) {
  return hostnameEquals(rawUrl, expectedHost);
}

function isQuickConnectSecret(value) {
  return typeof value === "string" && QUICK_CONNECT_SECRET.test(value);
}

function isValidEmail(value) {
  const email = String(value || "").trim();
  if (email.length < 3 || email.length > 254 || email.includes(" ")) {
    return false;
  }
  const at = email.indexOf("@");
  if (at < 1 || at !== email.lastIndexOf("@")) {
    return false;
  }
  const domain = email.slice(at + 1);
  const dot = domain.lastIndexOf(".");
  return dot > 0 && dot < domain.length - 1;
}

function isHttpTorrentUrl(value) {
  try {
    const parsed = new URL(String(value).trim());
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return false;
    }
    return parsed.pathname.toLowerCase().endsWith(".torrent");
  } catch {
    return false;
  }
}

function hashPassword(password) {
  const salt = crypto.randomBytes(16);
  const derived = crypto.scryptSync(String(password ?? ""), salt, SCRYPT_KEYLEN);
  return `${SCRYPT_PREFIX}${salt.toString("hex")}$${derived.toString("hex")}`;
}

function timingSafeEqualString(left, right) {
  const a = Buffer.from(String(left ?? ""));
  const b = Buffer.from(String(right ?? ""));
  if (a.length !== b.length) {
    return false;
  }
  return crypto.timingSafeEqual(a, b);
}

function verifyScryptPassword(password, stored) {
  const parts = String(stored).split("$");
  if (parts.length !== 3 || parts[0] !== "scrypt") {
    return false;
  }
  const salt = Buffer.from(parts[1], "hex");
  const expected = Buffer.from(parts[2], "hex");
  const actual = crypto.scryptSync(String(password ?? ""), salt, SCRYPT_KEYLEN);
  return actual.length === expected.length && crypto.timingSafeEqual(actual, expected);
}

function sha3Legacy(password) {
  const CryptoJS = require("crypto-js");
  // codeql[js/insufficient-password-hash]: legacy SHA3 compare for existing stored hashes; new passwords use scrypt
  return CryptoJS.SHA3(String(password || "")).toString();
}

function verifyPassword(password, stored) {
  if (password == null || stored == null || stored === "") {
    return false;
  }
  const incoming = String(password);
  const existing = String(stored);
  if (existing.startsWith(SCRYPT_PREFIX)) {
    return verifyScryptPassword(incoming, existing);
  }
  if (LEGACY_SHA3_HEX.test(existing)) {
    if (LEGACY_SHA3_HEX.test(incoming) && timingSafeEqualString(incoming, existing)) {
      return true;
    }
    return timingSafeEqualString(sha3Legacy(incoming), existing);
  }
  return false;
}

function isEmptyPassword(password) {
  return password == null || String(password).trim() === "";
}

function sendSafeError(res, error, { status = 503, message = "Request failed" } = {}) {
  if (error) {
    console.error(message, error);
  }
  if (!res.headersSent) {
    res.status(status).json({ error: message });
  }
}

function publicErrorMessage() {
  return "Request failed";
}

function createSafeTempDir(prefix = "jellyglance-") {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

function isSafeSqlIdentifier(value) {
  return typeof value === "string" && SAFE_IDENT.test(value);
}

function isSafeSqlExpression(value) {
  const field = String(value || "").trim();
  if (!field || /;|--|\/\*|\*\//.test(field)) {
    return false;
  }
  return SAFE_SQL_EXPR.test(field);
}

function toBoundedInt(value, fallback, { min = 1, max = 500 } = {}) {
  const parsed = Number.parseInt(String(value ?? ""), 10);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }
  return Math.min(max, Math.max(min, parsed));
}

function createRouteRateLimiter({ windowMs, max, message }) {
  return rateLimit({
    windowMs,
    max,
    standardHeaders: true,
    legacyHeaders: false,
    message: { message },
  });
}

const authRateLimit = createRouteRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: Number(process.env.AUTH_RATE_LIMIT_MAX || 60),
  message: "Too many authentication requests. Try again later.",
});

const taskRateLimit = createRouteRateLimiter({
  windowMs: 60 * 1000,
  max: Number(process.env.TASK_RATE_LIMIT_MAX || 20),
  message: "Too many task requests. Try again shortly.",
});

const fileRateLimit = createRouteRateLimiter({
  windowMs: 60 * 1000,
  max: Number(process.env.FILE_RATE_LIMIT_MAX || 60),
  message: "Too many file requests. Try again shortly.",
});

const apiRateLimit = createRouteRateLimiter({
  windowMs: 60 * 1000,
  max: Number(process.env.API_RATE_LIMIT_MAX || 240),
  message: "Too many requests. Try again shortly.",
});

const staticRateLimit = createRouteRateLimiter({
  windowMs: 60 * 1000,
  max: Number(process.env.STATIC_RATE_LIMIT_MAX || 400),
  message: "Too many requests. Try again shortly.",
});

function safeIconSlug(value, fallback = "sonarr") {
  const slug = String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, "");
  return /^[a-z0-9][a-z0-9-]{0,63}$/.test(slug) ? slug : fallback;
}

module.exports = {
  SCRYPT_PREFIX,
  sanitizeForLog,
  stripTrailingSlashes,
  isSafeObjectKey,
  assertSafeObjectKey,
  safeAssign,
  safeDelete,
  assertPathInside,
  safeJoin,
  toSafeHttpUrl,
  joinSafeHttpUrl,
  hostnameEquals,
  urlIncludesHost,
  isQuickConnectSecret,
  isValidEmail,
  isHttpTorrentUrl,
  hashPassword,
  verifyPassword,
  isEmptyPassword,
  timingSafeEqualString,
  sendSafeError,
  publicErrorMessage,
  createSafeTempDir,
  isSafeSqlIdentifier,
  isSafeSqlExpression,
  toBoundedInt,
  createRouteRateLimiter,
  authRateLimit,
  taskRateLimit,
  fileRateLimit,
  apiRateLimit,
  staticRateLimit,
  safeIconSlug,
};
