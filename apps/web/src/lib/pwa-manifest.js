const BASE_MANIFEST = {
  short_name: "JellyGlance",
  name: "JellyGlance",
  description: "Jellyfin command center for sessions, requests, downloads, and ops.",
  icons: [
    { src: "favicon.ico", sizes: "64x64 32x32 24x24 16x16", type: "image/x-icon" },
    { src: "icon-b-192.png", type: "image/png", sizes: "192x192", purpose: "any" },
    { src: "icon-b-512.png", type: "image/png", sizes: "512x512", purpose: "any maskable" },
  ],
  scope: "/",
  display: "standalone",
  display_override: ["standalone", "minimal-ui"],
  orientation: "any",
  theme_color: "#0b1117",
  background_color: "#0b1117",
};

let lastManifestUrl = "";

export function isOpsRole(role = "") {
  return ["Owner", "Admin"].includes(String(role || ""));
}

export function pwaStartPath(role = "Viewer", workspaceMode) {
  if (!isOpsRole(role)) return "/me";
  return workspaceMode === "user" ? "/me" : "/";
}

export function applyPwaStartUrl(pathname = "/") {
  if (typeof document === "undefined") return;
  const start = pathname.startsWith("/") ? pathname : `/${pathname}`;
  const manifest = { ...BASE_MANIFEST, start_url: start, id: start };
  const blob = new Blob([JSON.stringify(manifest)], { type: "application/manifest+json" });
  const url = URL.createObjectURL(blob);
  const link = document.querySelector('link[rel="manifest"]');
  if (!link) {
    URL.revokeObjectURL(url);
    return;
  }
  if (lastManifestUrl) URL.revokeObjectURL(lastManifestUrl);
  lastManifestUrl = url;
  link.setAttribute("href", url);
}
