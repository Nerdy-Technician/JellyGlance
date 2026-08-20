export const HOME_SETTINGS_STORAGE_PREFIX = "jellyglance_home_settings";
export const LEGACY_HOME_ORDER_STORAGE_KEY = "jellyglance_home_section_order";
export const HOME_LAYOUT_VERSION = 3;

const DEFAULT_HIDDEN_SECTION_IDS = ["seasonGaps", "tdarr", "wizarr", "maintainerr", "bazarr", "prowlarr"];
const INTEGRATION_WIDGET_SECTION_IDS = ["tdarr", "wizarr", "maintainerr", "bazarr", "prowlarr"];

export const HOME_SECTION_DEFINITIONS = [
  { id: "sessions", label: "Active sessions" },
  { id: "overview", label: "Overview" },
  { id: "hall", label: "Hall of Fame" },
  { id: "library", label: "Library health" },
  { id: "catalog", label: "Catalog totals" },
  { id: "milestones", label: "Milestones" },
  { id: "week", label: "This week" },
  { id: "attention", label: "Needs attention" },
  { id: "trends", label: "Today vs last week" },
  { id: "issues", label: "Library issues" },
  { id: "watchParty", label: "Watch party" },
  { id: "seasonGaps", label: "Season gaps" },
  { id: "tdarr", label: "Tdarr transcodes" },
  { id: "wizarr", label: "Wizarr invites" },
  { id: "maintainerr", label: "Maintainerr cleanup" },
  { id: "bazarr", label: "Bazarr subtitles" },
  { id: "prowlarr", label: "Prowlarr indexers" },
  { id: "automation", label: "Automation feed" },
  { id: "quickActions", label: "Quick actions" },
  { id: "operations", label: "Operations" },
];

export const DEFAULT_HOME_ORDER = HOME_SECTION_DEFINITIONS.map((section) => section.id);
const KIOSK_DEFAULT_HIDDEN = DEFAULT_HOME_ORDER.filter((sectionId) => sectionId !== "sessions");
export const CURATED_DEFAULT_HOME_ORDER = [
  "sessions",
  "attention",
  "overview",
  "operations",
  "milestones",
  "week",
  "hall",
  "trends",
  "watchParty",
  "quickActions",
  "library",
  "catalog",
  "issues",
  "seasonGaps",
  "tdarr",
  "wizarr",
  "maintainerr",
  "bazarr",
  "prowlarr",
  "automation",
];

export const DEFAULT_HOME_SETTINGS = {
  order: CURATED_DEFAULT_HOME_ORDER,
  hidden: DEFAULT_HIDDEN_SECTION_IDS,
  pinned: "",
  density: "comfortable",
  autoRotate: false,
  preset: "default",
  title: "",
  theme: "default",
  alertRules: { backupDays: 7, requestThreshold: 1, missingPosterThreshold: 1 },
  dismissedAlerts: {},
  sizes: {
    sessions: "large",
    overview: "large",
    hall: "large",
    operations: "large",
    catalog: "large",
    library: "large",
    milestones: "large",
    week: "large",
    tdarr: "small",
    wizarr: "small",
    maintainerr: "small",
    bazarr: "small",
    prowlarr: "small",
  },
  version: HOME_LAYOUT_VERSION,
};

export const HOME_PRESETS = {
  default: {
    label: "Default",
    order: CURATED_DEFAULT_HOME_ORDER,
    hidden: DEFAULT_HIDDEN_SECTION_IDS,
    density: "comfortable",
    sizes: {
      sessions: "large",
      overview: "large",
      attention: "small",
      quickActions: "small",
    },
  },
  admin: {
    label: "Admin",
    order: ["attention", "operations", "quickActions", "automation", "tdarr", "maintainerr", "bazarr", "prowlarr", "wizarr", "sessions", "overview", "milestones", "trends", "issues", "week", "hall", "library", "catalog", "seasonGaps", "watchParty"],
    hidden: ["watchParty", ...INTEGRATION_WIDGET_SECTION_IDS],
    density: "compact",
    sizes: {
      attention: "small",
      operations: "large",
      quickActions: "small",
      automation: "small",
      tdarr: "small",
      maintainerr: "small",
      bazarr: "small",
      prowlarr: "small",
      wizarr: "small",
    },
  },
  family: {
    label: "Family",
    order: ["sessions", "watchParty", "week", "milestones", "hall", "overview", "trends", "catalog", "operations", "quickActions", "library", "attention", "issues", "seasonGaps", "automation", "tdarr", "wizarr", "maintainerr", "bazarr", "prowlarr"],
    hidden: ["issues", "seasonGaps", "automation", ...INTEGRATION_WIDGET_SECTION_IDS],
    density: "comfortable",
    sizes: {
      sessions: "large",
      watchParty: "large",
      week: "medium",
      hall: "large",
    },
  },
  media: {
    label: "Media Stats",
    order: ["overview", "milestones", "trends", "catalog", "library", "issues", "seasonGaps", "week", "watchParty", "hall", "sessions", "operations", "quickActions", "attention", "automation", "tdarr", "wizarr", "maintainerr", "bazarr", "prowlarr"],
    hidden: ["automation", ...INTEGRATION_WIDGET_SECTION_IDS],
    density: "comfortable",
    sizes: {
      overview: "large",
      trends: "large",
      catalog: "medium",
      issues: "medium",
    },
  },
  requests: {
    label: "Requests First",
    order: ["attention", "operations", "quickActions", "automation", "wizarr", "maintainerr", "sessions", "week", "milestones", "overview", "hall", "trends", "library", "catalog", "issues", "seasonGaps", "watchParty", "tdarr", "bazarr", "prowlarr"],
    hidden: DEFAULT_HIDDEN_SECTION_IDS,
    density: "compact",
    sizes: {
      attention: "small",
      operations: "large",
      quickActions: "small",
      maintainerr: "small",
    },
  },
  kiosk: {
    label: "Kiosk",
    order: ["sessions", "overview", "hall", "week", "trends", "watchParty", "catalog", "library", "milestones", "operations", "attention", "issues", "seasonGaps", "tdarr", "wizarr", "maintainerr", "bazarr", "prowlarr", "automation", "quickActions"],
    hidden: KIOSK_DEFAULT_HIDDEN,
    density: "comfortable",
    sizes: {
      sessions: "large",
      overview: "large",
      hall: "large",
      week: "large",
      trends: "large",
      maintainerr: "small",
    },
  },
};

export const HOME_WIDGET_SIZE_LABELS = {
  small: "Compact",
  medium: "Half width",
  large: "Full width",
};

export function normalizeHomeOrder(order) {
  const knownSections = new Set(DEFAULT_HOME_ORDER);
  const savedOrder = Array.isArray(order) ? order.filter((sectionId) => knownSections.has(sectionId)) : [];
  const missingSections = DEFAULT_HOME_ORDER.filter((sectionId) => !savedOrder.includes(sectionId));
  return [...savedOrder, ...missingSections];
}

export function getHomeTokenPayload() {
  const token = localStorage.getItem("token");
  if (!token) return null;
  try {
    return JSON.parse(window.atob(token.split(".")[1]?.replace(/-/g, "+").replace(/_/g, "/") || ""));
  } catch {
    return null;
  }
}

export function getHomeSettingsStorageKey(scope = "user") {
  if (scope === "kiosk") return `${HOME_SETTINGS_STORAGE_PREFIX}:kiosk`;
  const payload = getHomeTokenPayload();
  if (!payload) return `${HOME_SETTINGS_STORAGE_PREFIX}:browser`;
  return `${HOME_SETTINGS_STORAGE_PREFIX}:${payload.sub || payload.userid || payload.username || payload.name || "user"}`;
}

export function normalizeHomeSettings(settings) {
  const normalized = { ...DEFAULT_HOME_SETTINGS, ...(settings || {}) };
  const knownSections = new Set(DEFAULT_HOME_ORDER);
  normalized.order = normalizeHomeOrder(normalized.order);
  normalized.hidden = Array.isArray(normalized.hidden) ? [...new Set(normalized.hidden.filter((sectionId) => knownSections.has(sectionId)))] : [];
  if (Number(normalized.version || 0) < HOME_LAYOUT_VERSION) {
    normalized.hidden = [...new Set([...normalized.hidden, ...DEFAULT_HIDDEN_SECTION_IDS])];
  }
  normalized.pinned = knownSections.has(normalized.pinned) ? normalized.pinned : "";
  normalized.density = normalized.density === "compact" ? "compact" : "comfortable";
  normalized.autoRotate = Boolean(normalized.autoRotate);
  normalized.preset = normalized.preset || "custom";
  normalized.title = typeof normalized.title === "string" ? normalized.title : "";
  normalized.theme = ["default", "darker", "neon", "highContrast", "wall"].includes(normalized.theme) ? normalized.theme : "default";
  normalized.alertRules = {
    ...DEFAULT_HOME_SETTINGS.alertRules,
    ...(normalized.alertRules || {}),
  };
  normalized.dismissedAlerts = normalized.dismissedAlerts && typeof normalized.dismissedAlerts === "object" ? normalized.dismissedAlerts : {};
  normalized.sizes = normalized.sizes && typeof normalized.sizes === "object" ? { ...DEFAULT_HOME_SETTINGS.sizes, ...normalized.sizes } : DEFAULT_HOME_SETTINGS.sizes;
  normalized.version = Number(normalized.version || 0);
  return normalized;
}

export function getRoleDefaultHomeSettings() {
  const payload = getHomeTokenPayload();
  const role = String(payload?.role || payload?.Role || payload?.roles?.[0] || "").toLowerCase();
  if (role.includes("admin") || role.includes("owner") || role.includes("manager")) {
    return normalizeHomeSettings({ ...DEFAULT_HOME_SETTINGS, ...HOME_PRESETS.admin, sizes: HOME_PRESETS.admin.sizes, preset: "admin" });
  }
  return normalizeHomeSettings({ ...DEFAULT_HOME_SETTINGS, ...HOME_PRESETS.family, sizes: HOME_PRESETS.family.sizes, preset: "family" });
}

export function loadHomeSettings(scope = "user") {
  const storageKey = getHomeSettingsStorageKey(scope);
  try {
    const saved = localStorage.getItem(storageKey);
    if (saved) {
      const parsed = JSON.parse(saved);
      const normalized = normalizeHomeSettings(parsed);
      if (scope === "kiosk" && normalized.preset === "kiosk") {
        return normalizeHomeSettings({ ...DEFAULT_HOME_SETTINGS, ...HOME_PRESETS.kiosk, sizes: HOME_PRESETS.kiosk.sizes, preset: "kiosk", autoRotate: false, title: normalized.title || "JellyGlance Kiosk", theme: normalized.theme });
      }
      const stillOldDefault = normalized.version < HOME_LAYOUT_VERSION && (!parsed.preset || parsed.preset === "custom") && JSON.stringify(normalizeHomeOrder(parsed.order)) === JSON.stringify(DEFAULT_HOME_ORDER);
      return stillOldDefault ? normalizeHomeSettings(DEFAULT_HOME_SETTINGS) : normalized;
    }

    if (scope !== "kiosk") {
      const legacyOrder = localStorage.getItem(LEGACY_HOME_ORDER_STORAGE_KEY);
      if (legacyOrder) return normalizeHomeSettings({ order: JSON.parse(legacyOrder) });
      return getRoleDefaultHomeSettings();
    }
  } catch {
    return normalizeHomeSettings(DEFAULT_HOME_SETTINGS);
  }

  return normalizeHomeSettings({ ...DEFAULT_HOME_SETTINGS, ...HOME_PRESETS.kiosk, sizes: HOME_PRESETS.kiosk.sizes, preset: "kiosk", autoRotate: false, title: "JellyGlance Kiosk" });
}

export function saveHomeSettings(settings, scope = "user") {
  const normalized = normalizeHomeSettings(settings);
  localStorage.setItem(getHomeSettingsStorageKey(scope), JSON.stringify(normalized));
  window.dispatchEvent(new CustomEvent("jellyglance-home-settings-updated", { detail: { scope, settings: normalized } }));
  return normalized;
}
