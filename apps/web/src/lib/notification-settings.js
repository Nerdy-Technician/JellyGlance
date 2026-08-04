export const NOTIFICATION_SETTINGS_KEY = "JellyGlanceNotificationSettings";

export const defaultNotificationSettings = {
  mode: "all",
  manualTaskToasts: true,
  position: "bottom-right",
  durationSeconds: 8,
};

export function normalizeNotificationSettings(value) {
  const settings = {
    ...defaultNotificationSettings,
    ...(value || {}),
  };
  if (!["all", "important", "errors", "off"].includes(settings.mode)) {
    settings.mode = defaultNotificationSettings.mode;
  }
  if (!["top-right", "top-center", "bottom-right", "bottom-center"].includes(settings.position)) {
    settings.position = defaultNotificationSettings.position;
  }
  const durationSeconds = Number(settings.durationSeconds);
  settings.durationSeconds = Number.isFinite(durationSeconds) ? Math.min(Math.max(durationSeconds, 3), 30) : defaultNotificationSettings.durationSeconds;
  settings.manualTaskToasts = settings.manualTaskToasts !== false;
  return settings;
}

export function getStoredNotificationSettings() {
  try {
    return normalizeNotificationSettings(JSON.parse(localStorage.getItem(NOTIFICATION_SETTINGS_KEY) || "{}"));
  } catch {
    return defaultNotificationSettings;
  }
}

export function storeNotificationSettings(settings) {
  const normalized = normalizeNotificationSettings(settings);
  localStorage.setItem(NOTIFICATION_SETTINGS_KEY, JSON.stringify(normalized));
  window.dispatchEvent(new CustomEvent("jellyglance-notification-settings-updated", { detail: normalized }));
  return normalized;
}
