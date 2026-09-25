import baseUrl from "./baseurl";

let lastManifestUrl = "";

export function isOpsRole(role = "") {
  return ["Owner", "Admin"].includes(String(role || ""));
}

export function pwaStartPath(role = "Viewer", workspaceMode, permissions = {}) {
  if (permissions.home === false) return "/me";
  if (!isOpsRole(role)) return "/me";
  return workspaceMode === "user" ? "/me" : "/";
}

export function applyPwaStartUrl(pathname = "/") {
  if (typeof document === "undefined") return;
  const start = pathname.startsWith("/") ? pathname : `/${pathname}`;
  const url = `${baseUrl}/app.webmanifest?start=${encodeURIComponent(start === "/me" ? "/me" : "/")}`;
  const link = document.querySelector('link[rel="manifest"]');
  if (!link || lastManifestUrl === url) return;
  lastManifestUrl = url;
  link.setAttribute("href", url);
}
