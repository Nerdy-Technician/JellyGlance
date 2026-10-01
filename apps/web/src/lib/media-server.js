// Which media server this install talks to, from the cached /api/getconfig payload.
// Use for user-facing wording; Jellyfin-only features should check isEmby() instead.
export function mediaServerType() {
  try {
    const config = JSON.parse(localStorage.getItem("config") || "{}");
    return config.SERVER_TYPE || (config.IS_JELLYFIN === false ? "emby" : "jellyfin");
  } catch {
    return "jellyfin";
  }
}

export function isEmby() {
  return mediaServerType() === "emby";
}

export function mediaServerName() {
  return isEmby() ? "Emby" : "Jellyfin";
}
