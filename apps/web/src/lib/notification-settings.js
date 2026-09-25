export const NOTIFICATION_SETTINGS_KEY = "JellyGlanceNotificationSettings";

export const NOTIFICATION_CATEGORIES = [
  { key: "librarySync", title: "Library syncs", text: "Full and partial Jellyfin library syncs.", defaultOn: true },
  { key: "playbackSync", title: "Playback history sync", text: "Playback reporting imports and history syncs.", defaultOn: true },
  { key: "backups", title: "Backups", text: "Scheduled and manual backups.", defaultOn: true },
  { key: "tasks", title: "Tasks and maintenance", text: "Scheduled jobs, Jellyfin tasks, purges and repairs.", defaultOn: true },
  { key: "downloads", title: "Downloads", text: "Items queued to your download clients.", defaultOn: true },
  { key: "errors", title: "Task errors", text: "Failures reported by any background task.", defaultOn: true },
  { key: "playback", title: "Playback started", text: "Someone starts watching something on Jellyfin.", defaultOn: false },
];

export const defaultNotificationSettings = {
  mode: "all",
  manualTaskToasts: true,
  position: "bottom-right",
  durationSeconds: 8,
  inApp: true,
  desktop: false,
  mobile: false,
  systemOnlyWhenHidden: true,
  categories: Object.fromEntries(NOTIFICATION_CATEGORIES.map((category) => [category.key, category.defaultOn])),
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
  settings.inApp = settings.inApp !== false;
  settings.desktop = settings.desktop === true;
  settings.mobile = settings.mobile === true;
  settings.systemOnlyWhenHidden = settings.systemOnlyWhenHidden !== false;
  const categories = value?.categories && typeof value.categories === "object" ? value.categories : {};
  settings.categories = Object.fromEntries(
    NOTIFICATION_CATEGORIES.map((category) => [
      category.key,
      typeof categories[category.key] === "boolean" ? categories[category.key] : category.defaultOn,
    ])
  );
  return settings;
}

export function notificationCategory(task, message) {
  if (task === "FullSyncTask" || task === "PartialSyncTask") return "librarySync";
  if (task === "PlaybackSyncTask") return "playbackSync";
  if (task === "BackupTask" || task === "BackupRestore") return "backups";
  if (task === "TaskError") return "errors";
  const text = String(message?.message || message || "");
  if (/\bqueued for\b/i.test(text)) return "downloads";
  if (/\bbackup|restore\b/i.test(text)) return "backups";
  return "tasks";
}

export function getStoredNotificationSettings() {
  try {
    return normalizeNotificationSettings(JSON.parse(localStorage.getItem(NOTIFICATION_SETTINGS_KEY) || "{}"));
  } catch {
    return normalizeNotificationSettings({});
  }
}

export function storeNotificationSettings(settings) {
  const normalized = normalizeNotificationSettings(settings);
  localStorage.setItem(NOTIFICATION_SETTINGS_KEY, JSON.stringify(normalized));
  window.dispatchEvent(new CustomEvent("jellyglance-notification-settings-updated", { detail: normalized }));
  return normalized;
}
