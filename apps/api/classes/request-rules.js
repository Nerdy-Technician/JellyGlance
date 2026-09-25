const db = require("../db");

// Request quotas and auto-approve rules for requests made through JellyGlance.
// Seerr requests made with the JellyGlance API key count as the Seerr admin, so these rules are
// enforced here, and optionally the request is filed as the matching Seerr user instead.

const DEFAULT_RULES = {
  enabled: false,
  movieLimit: 5,
  movieDays: 7,
  tvLimit: 3,
  tvDays: 7,
  exemptAdmins: true,
  requestAsSeerrUser: false,
  autoApproveAll: false,
  users: {},
};

let tableReady = null;
function ensureTable() {
  if (!tableReady) {
    tableReady = db
      .query(
        `CREATE TABLE IF NOT EXISTS jg_request_log (
           id bigserial PRIMARY KEY,
           user_key text NOT NULL,
           user_name text,
           media_type text NOT NULL,
           media_id text,
           seerr_request_id text,
           status text,
           created_at timestamptz NOT NULL DEFAULT NOW()
         );
         CREATE INDEX IF NOT EXISTS jg_request_log_user_idx ON jg_request_log (user_key, media_type, created_at);`
      )
      .catch((error) => {
        tableReady = null;
        throw error;
      });
  }
  return tableReady;
}

function isAdmin(user) {
  return ["Owner", "Admin"].includes(user?.role);
}

function userKey(user = {}) {
  if (!user || user === "internal") return "";
  const value =
    user.jellyfinUser?.id || user.jellyfinUser?.Id || (user.authMode === "quick-connect" ? user.id : null) || (user.id != null ? `local-${user.id}` : null) || user.username;
  return value == null ? "" : String(value);
}

function userName(user = {}) {
  return user.jellyfinUser?.name || user.jellyfinUser?.Name || user.name || user.username || "Unknown";
}

function clamp(value, fallback, min, max) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, parsed));
}

function normalizeUserRule(rule = {}) {
  const mode = ["default", "unlimited", "custom"].includes(rule.mode) ? rule.mode : "default";
  return {
    mode,
    movieLimit: clamp(rule.movieLimit, DEFAULT_RULES.movieLimit, 0, 999),
    tvLimit: clamp(rule.tvLimit, DEFAULT_RULES.tvLimit, 0, 999),
    autoApprove: ["default", "always", "never"].includes(rule.autoApprove) ? rule.autoApprove : "default",
  };
}

function normalizeRules(input = {}) {
  const users = {};
  Object.entries(input.users || {}).forEach(([key, rule]) => {
    if (key) users[String(key)] = normalizeUserRule(rule);
  });
  return {
    enabled: Boolean(input.enabled ?? DEFAULT_RULES.enabled),
    movieLimit: clamp(input.movieLimit, DEFAULT_RULES.movieLimit, 0, 999),
    movieDays: clamp(input.movieDays, DEFAULT_RULES.movieDays, 1, 365),
    tvLimit: clamp(input.tvLimit, DEFAULT_RULES.tvLimit, 0, 999),
    tvDays: clamp(input.tvDays, DEFAULT_RULES.tvDays, 1, 365),
    exemptAdmins: Boolean(input.exemptAdmins ?? DEFAULT_RULES.exemptAdmins),
    requestAsSeerrUser: Boolean(input.requestAsSeerrUser ?? DEFAULT_RULES.requestAsSeerrUser),
    autoApproveAll: Boolean(input.autoApproveAll ?? DEFAULT_RULES.autoApproveAll),
    users,
  };
}

async function getRules() {
  const { rows } = await db.query('SELECT settings FROM app_config where "ID"=1');
  return normalizeRules({ ...DEFAULT_RULES, ...(rows[0]?.settings?.RequestRules || {}) });
}

async function saveRules(next = {}) {
  const { rows } = await db.query('SELECT settings FROM app_config where "ID"=1');
  const settings = rows[0]?.settings || {};
  settings.RequestRules = normalizeRules({ ...DEFAULT_RULES, ...(settings.RequestRules || {}), ...next });
  await db.query('UPDATE app_config SET settings=$1 where "ID"=1', [settings]);
  return settings.RequestRules;
}

function effectiveLimits(rules, user) {
  const key = userKey(user);
  const rule = normalizeUserRule(rules.users[key]);
  if (!rules.enabled || (rules.exemptAdmins && isAdmin(user)) || rule.mode === "unlimited") return { unlimited: true, rule };
  return {
    unlimited: false,
    rule,
    movie: { limit: rule.mode === "custom" ? rule.movieLimit : rules.movieLimit, days: rules.movieDays },
    tv: { limit: rule.mode === "custom" ? rule.tvLimit : rules.tvLimit, days: rules.tvDays },
  };
}

async function usage(user, rules) {
  await ensureTable();
  const key = userKey(user);
  const limits = effectiveLimits(rules, user);
  const result = { unlimited: limits.unlimited, enabled: rules.enabled };
  for (const type of ["movie", "tv"]) {
    const days = limits[type]?.days || (type === "movie" ? rules.movieDays : rules.tvDays);
    const { rows } = await db.query(
      `SELECT COUNT(*)::int AS used, MIN(created_at) AS oldest FROM jg_request_log
        WHERE user_key = $1 AND media_type = $2 AND created_at > NOW() - ($3 || ' days')::interval AND COALESCE(status,'') <> 'failed'`,
      [key, type, String(days)]
    );
    const oldest = rows[0]?.oldest;
    result[type] = {
      used: rows[0]?.used || 0,
      limit: limits.unlimited ? null : limits[type].limit,
      days,
      nextSlotAt: oldest ? new Date(new Date(oldest).getTime() + days * 86400000).toISOString() : null,
    };
  }
  return result;
}

async function checkQuota(user, mediaType) {
  const rules = await getRules();
  const type = mediaType === "tv" ? "tv" : "movie";
  const current = await usage(user, rules);
  if (current.unlimited) return { allowed: true, rules, usage: current };
  const entry = current[type];
  if (entry.used >= entry.limit) {
    const when = entry.nextSlotAt ? new Date(entry.nextSlotAt).toLocaleDateString("en-GB", { day: "numeric", month: "short" }) : "later";
    return {
      allowed: false,
      rules,
      usage: current,
      message:
        entry.limit === 0
          ? `Your account can't request ${type === "tv" ? "TV shows" : "movies"}. Ask a server admin.`
          : `You've used all ${entry.limit} ${type === "tv" ? "TV" : "movie"} requests for the last ${entry.days} days. Your next one frees up on ${when}.`,
    };
  }
  return { allowed: true, rules, usage: current };
}

function shouldAutoApprove(rules, user) {
  const rule = normalizeUserRule(rules.users[userKey(user)]);
  if (rule.autoApprove === "always") return true;
  if (rule.autoApprove === "never") return false;
  return rules.autoApproveAll || isAdmin(user);
}

async function logRequest(user, mediaType, mediaId, { seerrRequestId = null, status = null } = {}) {
  await ensureTable();
  await db.query(
    `INSERT INTO jg_request_log (user_key, user_name, media_type, media_id, seerr_request_id, status) VALUES ($1,$2,$3,$4,$5,$6)`,
    [userKey(user), userName(user), mediaType === "tv" ? "tv" : "movie", mediaId == null ? null : String(mediaId), seerrRequestId == null ? null : String(seerrRequestId), status]
  );
}

async function allUsage(rules) {
  await ensureTable();
  const { rows } = await db.query(
    `SELECT user_key, MAX(user_name) AS user_name,
            COUNT(*) FILTER (WHERE media_type='movie' AND created_at > NOW() - ($1 || ' days')::interval)::int AS movies,
            COUNT(*) FILTER (WHERE media_type='tv' AND created_at > NOW() - ($2 || ' days')::interval)::int AS tv,
            MAX(created_at) AS last_request
       FROM jg_request_log WHERE COALESCE(status,'') <> 'failed' GROUP BY user_key`,
    [String(rules.movieDays), String(rules.tvDays)]
  );
  return rows;
}

module.exports = { getRules, saveRules, checkQuota, usage, logRequest, shouldAutoApprove, allUsage, userKey, isAdmin };
