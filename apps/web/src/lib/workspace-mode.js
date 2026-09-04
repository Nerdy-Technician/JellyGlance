export const WORKSPACE_MODE_STORAGE_KEY = "jellyglance_workspace_mode";
export const WORKSPACE_MODE_UPDATED_EVENT = "jellyglance-workspace-mode-updated";

export const USER_WORKSPACE_NAV_LINKS = new Set([
  "me",
  "recently-added",
  "libraries",
  "calendar",
  "requests",
  "downloads",
  "settings",
  "about",
]);

export function getStoredWorkspaceMode(isOpsRole = false) {
  if (!isOpsRole) return "user";
  try {
    const stored = localStorage.getItem(WORKSPACE_MODE_STORAGE_KEY);
    if (stored === "user" || stored === "admin") return stored;
  } catch {
    /* ignore */
  }
  return "admin";
}

export function saveWorkspaceMode(mode = "admin") {
  const next = mode === "user" ? "user" : "admin";
  localStorage.setItem(WORKSPACE_MODE_STORAGE_KEY, next);
  window.dispatchEvent(new CustomEvent(WORKSPACE_MODE_UPDATED_EVENT, { detail: next }));
  return next;
}

export function workspaceHomePath(isOpsRole, mode = getStoredWorkspaceMode(isOpsRole)) {
  if (!isOpsRole) return "/";
  return mode === "user" ? "/me" : "/";
}
