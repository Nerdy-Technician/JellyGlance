import { defineConfig } from "vitepress";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const siteBase = "/";
const withBase = (path) => `${siteBase}${path.replace(/^\//, "")}`;
const configDir = dirname(fileURLToPath(import.meta.url));
const rootPackage = JSON.parse(readFileSync(resolve(configDir, "../../package.json"), "utf8"));
const packageVersion = rootPackage.version;
const fallbackRelease = {
  version: `v${packageVersion}`,
  name: `JellyGlance v${packageVersion}`,
  url: "https://github.com/Nerdy-Technician/JellyGlance/releases/latest",
  publishedAt: null,
  body: "Release notes are loaded from the latest GitHub release when the documentation site is built."
};

function parseReleaseNotes(body = "") {
  const sections = [];
  let current = { title: "Notes", items: [] };

  body
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .forEach((line) => {
      const heading = line.match(/^#{1,4}\s+(.+)/);
      if (heading) {
        if (current.items.length) sections.push(current);
        current = { title: heading[1].replace(/[*_`]/g, ""), items: [] };
        return;
      }

      const item = line.replace(/^[-*]\s+/, "").replace(/^`([^`]+)`$/, "$1");
      current.items.push(item);
    });

  if (current.items.length) sections.push(current);
  return sections.slice(0, 8).map((section) => ({
    title: section.title,
    items: section.items.slice(0, 12)
  }));
}

async function getCurrentRelease() {
  try {
    const response = await fetch("https://api.github.com/repos/Nerdy-Technician/JellyGlance/releases/latest", {
      headers: {
        Accept: "application/vnd.github+json",
        "User-Agent": "JellyGlance-docs"
      },
      signal: AbortSignal.timeout(4000)
    });

    if (!response.ok) {
      throw new Error(`GitHub latest release request failed: ${response.status}`);
    }

    const release = await response.json();

    return {
      version: release.tag_name || fallbackRelease.version,
      name: release.name || release.tag_name || fallbackRelease.name,
      url: release.html_url || fallbackRelease.url,
      publishedAt: release.published_at || release.created_at || null,
      body: release.body || fallbackRelease.body,
      sections: parseReleaseNotes(release.body || fallbackRelease.body)
    };
  } catch (error) {
    console.warn(`[docs] Using package.json release fallback: ${error.message}`);
    return {
      ...fallbackRelease,
      sections: parseReleaseNotes(fallbackRelease.body)
    };
  }
}

const currentRelease = await getCurrentRelease();

export default defineConfig({
  title: "JellyGlance",
  description: "Modern Jellyfin command center for analytics, requests, health, and media control.",
  base: siteBase,
  sitemap: {
    hostname: "https://jellyglance.com"
  },
  transformPageData(pageData) {
    if (pageData.relativePath !== "index.md") return;

    const actions = pageData.frontmatter?.hero?.actions;
    if (!Array.isArray(actions)) return;

    const releaseAction = actions.find((action) => action.release === true);
    if (releaseAction) {
      releaseAction.text = `Current Release ${currentRelease.version}`;
      releaseAction.link = currentRelease.url;
    }
  },
  cleanUrls: true,
  head: [
    ["link", { rel: "icon", href: withBase("/favicon.ico") }],
    ["link", { rel: "apple-touch-icon", sizes: "180x180", href: withBase("/apple-touch-icon.png") }],
    ["link", { rel: "icon", type: "image/png", sizes: "192x192", href: withBase("/icon-b-192.png") }],
    ["link", { rel: "icon", type: "image/png", sizes: "512x512", href: withBase("/icon-b-512.png") }],
    ["meta", { name: "theme-color", content: "#aa5cc3" }],
    ["meta", { name: "keywords", content: "JellyGlance,Jellyfin,dashboard,analytics,requests,Jellyseerr,Overseerr,self-hosted,media server,Quick Connect,Sonarr,Radarr,Lidarr,Bazarr,qBittorrent,Docker,PostgreSQL,React" }],
    ["meta", { property: "og:title", content: "JellyGlance" }],
    ["meta", { property: "og:description", content: "Modern Jellyfin analytics, requests, sessions, users, health, webhooks, and docs." }],
    ["meta", { property: "og:image", content: withBase("/screenshots/Home.png") }],
    ["meta", { property: "og:type", content: "website" }],
    ["meta", { name: "twitter:card", content: "summary_large_image" }],
    ["meta", { name: "twitter:title", content: "JellyGlance" }],
    ["meta", { name: "twitter:description", content: "Modern Jellyfin analytics, requests, sessions, users, health, webhooks, and docs." }],
    ["meta", { name: "twitter:image", content: withBase("/screenshots/Home.png") }]
  ],
  themeConfig: {
    logo: withBase("/project-logo.png"),
    siteTitle: "JellyGlance",
    nav: [
      { text: "Guide", link: "/guide/getting-started" },
      { text: "Integrations", link: "/guide/integrations" },
      { text: "Screenshots", link: "/guide/screenshots" },
      { text: "Press", link: "/press" },
      { text: "Operations", link: "/operations/docker" },
      { text: "Releases", link: "/operations/releases" }
    ],
    sidebar: [
      {
        text: "Project Guide",
        items: [
          { text: "Getting Started", link: "/guide/getting-started" },
          { text: "Integrations", link: "/guide/integrations" },
          { text: "Screenshots", link: "/guide/screenshots" },
          { text: "Press", link: "/press" },
          { text: "Architecture", link: "/guide/architecture" }
        ]
      },
      {
        text: "Operations",
        items: [
          { text: "Docker", link: "/operations/docker" },
          { text: "Releases", link: "/operations/releases" }
        ]
      }
    ],
    socialLinks: [
      { icon: "discord", link: "https://discord.gg/dMGhv8j2kx" },
      { icon: "github", link: "https://github.com/Nerdy-Technician/JellyGlance" }
    ],
    search: {
      provider: "local"
    },
    footer: {
      message: "Built for Jellyfin homeservers.",
      copyright: "Released under GPL-3.0."
    },
    outline: {
      level: [2, 3]
    },
    currentVersion: currentRelease.version,
    latestReleaseUrl: currentRelease.url,
    latestRelease: currentRelease
  }
});
