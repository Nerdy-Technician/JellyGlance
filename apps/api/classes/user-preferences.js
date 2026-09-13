const { getSettings, mergeSettings } = require("./admin-history");

const HEX_COLOR_PATTERN = /^#[0-9a-f]{6}$/i;
const DEFAULT_THEME = {
  primary: "#9b6ac8",
  secondary: "#4aa8bc",
  background: "#0b0d12",
  surface: "#131820",
};

function preferenceUserKey(user) {
  if (!user) return "";
  const jellyfinId = user.jellyfinUser?.id || user.jellyfinUser?.Id;
  if (jellyfinId) return `jf:${jellyfinId}`;
  if (user.authMode === "oidc" && (user.oidcUser?.sub || user.oidcUser?.id)) {
    return `oidc:${user.oidcUser.sub || user.oidcUser.id}`;
  }
  if (user.id != null && user.id !== "") return `${user.authMode || "user"}:${user.id}`;
  if (user.username) return `${user.authMode || "user"}:${String(user.username).toLowerCase()}`;
  return "";
}

function normalizeHexColor(value, fallback) {
  return HEX_COLOR_PATTERN.test(String(value || "").trim()) ? String(value).trim() : fallback;
}

function normalizeTheme(theme = {}) {
  return {
    primary: normalizeHexColor(theme.primary, DEFAULT_THEME.primary),
    secondary: normalizeHexColor(theme.secondary, DEFAULT_THEME.secondary),
    background: normalizeHexColor(theme.background, DEFAULT_THEME.background),
    surface: normalizeHexColor(theme.surface, DEFAULT_THEME.surface),
  };
}

async function getUserPreferenceRecord(user) {
  const key = preferenceUserKey(user);
  if (!key) return { key: "", preferences: {} };
  const settings = await getSettings();
  const map = settings.UserPreferences && typeof settings.UserPreferences === "object" ? settings.UserPreferences : {};
  return { key, preferences: map[key] && typeof map[key] === "object" ? map[key] : {} };
}

async function getUserPreferences(user) {
  const { preferences } = await getUserPreferenceRecord(user);
  return {
    theme: preferences.theme ? normalizeTheme(preferences.theme) : null,
  };
}

async function saveUserTheme(user, theme) {
  const { key, preferences } = await getUserPreferenceRecord(user);
  if (!key) {
    const error = new Error("Unable to identify the current user");
    error.statusCode = 401;
    throw error;
  }
  const nextTheme = normalizeTheme(theme);
  const settings = await getSettings();
  const map = { ...(settings.UserPreferences && typeof settings.UserPreferences === "object" ? settings.UserPreferences : {}) };
  map[key] = {
    ...preferences,
    theme: nextTheme,
    updatedAt: new Date().toISOString(),
  };
  await mergeSettings({ UserPreferences: map });
  return nextTheme;
}

function preferenceMap(settings) {
  return settings.UserPreferences && typeof settings.UserPreferences === "object" ? settings.UserPreferences : {};
}

function themeFromPreference(preference) {
  return preference?.theme ? normalizeTheme(preference.theme) : null;
}

function newerPreference(current, next) {
  if (!next) return current;
  if (!current) return next;
  return String(next.updatedAt || "") > String(current.updatedAt || "") ? next : current;
}

async function resolveCardUiTheme({ jellyfinUserId, user } = {}) {
  const settings = await getSettings().catch(() => ({}));
  const map = preferenceMap(settings);

  if (jellyfinUserId) {
    const watching = themeFromPreference(map[`jf:${jellyfinUserId}`]);
    if (watching) return watching;
  }

  if (user) {
    const current = await getUserPreferences(user).catch(() => ({ theme: null }));
    if (current.theme) return current.theme;
  }

  const roles = settings.userRoles && typeof settings.userRoles === "object" ? settings.userRoles : {};
  const adminRoles = new Set(["Owner", "Admin"]);
  let latestAdmin = null;
  for (const [id, role] of Object.entries(roles)) {
    if (!adminRoles.has(role)) continue;
    const preference = map[`jf:${id}`];
    if (!preference?.theme) continue;
    latestAdmin = newerPreference(latestAdmin, preference);
  }
  const adminTheme = themeFromPreference(latestAdmin);
  if (adminTheme) return adminTheme;

  let latest = null;
  for (const preference of Object.values(map)) {
    if (!preference?.theme) continue;
    latest = newerPreference(latest, preference);
  }
  return themeFromPreference(latest) || DEFAULT_THEME;
}

module.exports = {
  DEFAULT_THEME,
  preferenceUserKey,
  normalizeTheme,
  getUserPreferences,
  saveUserTheme,
  resolveCardUiTheme,
};
