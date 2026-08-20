import { defineConfig } from "vitepress";
import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const siteBase = "/";
const withBase = (path) => `${siteBase}${path.replace(/^\//, "")}`;
const configDir = dirname(fileURLToPath(import.meta.url));
const rootPackage = JSON.parse(readFileSync(resolve(configDir, "../../package.json"), "utf8"));
const packageVersion = rootPackage.version;
const stableReleaseFile = resolve(configDir, "../../.github/RELEASE");
const betaReleaseFile = resolve(configDir, "../../.github/release-beta.md");

function readReleaseMeta(filePath, fallbackVersion, fallbackUrl, fallbackBody) {
  if (!existsSync(filePath)) {
    return {
      version: `v${fallbackVersion}`,
      name: `JellyGlance v${fallbackVersion}`,
      url: fallbackUrl,
      publishedAt: null,
      body: fallbackBody
    };
  }

  const raw = readFileSync(filePath, "utf8").replace(/\r\n/g, "\n");
  const parts = raw.split(/^---\s*$/m);
  const header = parts.shift() || "";
  const body = parts.join("---").trim() || fallbackBody;
  const meta = {};

  for (const line of header.split("\n")) {
    const match = line.match(/^([A-Za-z_][A-Za-z0-9_-]*)\s*:\s*(.+)$/);
    if (match) {
      meta[match[1].toLowerCase()] = match[2].trim();
    }
  }

  const version = String(meta.version || `v${fallbackVersion}`).replace(/^v/i, "");
  return {
    version: `v${version}`,
    name: meta.title || `JellyGlance v${version}`,
    url: fallbackUrl,
    publishedAt: null,
    body
  };
}

const stableReleaseMeta = readReleaseMeta(
  stableReleaseFile,
  packageVersion.replace(/-.+$/, ""),
  "https://github.com/Nerdy-Technician/JellyGlance/releases/latest",
  "Release notes are loaded from the latest GitHub release when the documentation site is built."
);

const betaReleaseMeta = readReleaseMeta(
  betaReleaseFile,
  packageVersion,
  "https://github.com/Nerdy-Technician/JellyGlance/releases",
  "Beta release notes are loaded from GitHub prereleases when the documentation site is built."
);

const fallbackRelease = {
  ...stableReleaseMeta
};

const fallbackBetaRelease = {
  ...betaReleaseMeta
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
    const response = await fetch("https://api.github.com/repos/Nerdy-Technician/JellyGlance/releases", {
      headers: {
        Accept: "application/vnd.github+json",
        "User-Agent": "JellyGlance-docs"
      },
      signal: AbortSignal.timeout(4000)
    });

    if (!response.ok) {
      throw new Error(`GitHub releases request failed: ${response.status}`);
    }

    const releases = await response.json();
    const release = releases.find((entry) => !entry.prerelease) || releases[0];

    if (!release) {
      throw new Error("No stable release found");
    }

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

async function getLatestBetaRelease() {
  try {
    const response = await fetch("https://api.github.com/repos/Nerdy-Technician/JellyGlance/releases", {
      headers: {
        Accept: "application/vnd.github+json",
        "User-Agent": "JellyGlance-docs"
      },
      signal: AbortSignal.timeout(4000)
    });

    if (!response.ok) {
      throw new Error(`GitHub beta releases request failed: ${response.status}`);
    }

    const releases = await response.json();
    const release = releases.find((entry) => entry.prerelease);

    if (!release) {
      throw new Error("No beta release found");
    }

    return {
      version: release.tag_name || fallbackBetaRelease.version,
      name: release.name || release.tag_name || fallbackBetaRelease.name,
      url: release.html_url || fallbackBetaRelease.url,
      publishedAt: release.published_at || release.created_at || null,
      body: release.body || fallbackBetaRelease.body,
      sections: parseReleaseNotes(release.body || fallbackBetaRelease.body)
    };
  } catch (error) {
    console.warn(`[docs] Using package.json beta fallback: ${error.message}`);
    return {
      ...fallbackBetaRelease,
      sections: parseReleaseNotes(fallbackBetaRelease.body)
    };
  }
}

const currentRelease = await getCurrentRelease();
const latestBetaRelease = await getLatestBetaRelease();

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

    const stableReleaseAction = actions.find((action) => action.release === "stable");
    if (stableReleaseAction) {
      stableReleaseAction.text = `Latest Release ${currentRelease.version}`;
      stableReleaseAction.link = currentRelease.url;
    }

    const betaReleaseAction = actions.find((action) => action.release === "beta");
    if (betaReleaseAction) {
      betaReleaseAction.text = `Latest Beta ${latestBetaRelease.version}`;
      betaReleaseAction.link = latestBetaRelease.url;
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
    ["meta", { property: "og:image", content: withBase("/screenshots/home.png") }],
    ["meta", { property: "og:type", content: "website" }],
    ["meta", { name: "twitter:card", content: "summary_large_image" }],
    ["meta", { name: "twitter:title", content: "JellyGlance" }],
    ["meta", { name: "twitter:description", content: "Modern Jellyfin analytics, requests, sessions, users, health, webhooks, and docs." }],
    ["meta", { name: "twitter:image", content: withBase("/screenshots/home.png") }]
  ],
  themeConfig: {
    logo: withBase("/project-logo.png"),
    siteTitle: "JellyGlance",
    nav: [
      { text: "Guide", link: "/guide/getting-started" },
      { text: "Integrations", link: "/intergrations" },
      { text: "Screenshots", link: "/guide/screenshots" },
      { text: "Press", link: "/press" },
      { text: "Operations", link: "/operations/docker" },
      { text: "Releases", link: "/operations/releases" }
    ],
    sidebar: false,
    socialLinks: [
      { icon: "discord", link: "https://discord.gg/dMGhv8j2kx" },
      { icon: "github", link: "https://github.com/Nerdy-Technician/JellyGlance" }
    ],
    search: {
      provider: "local"
    },
    footer: {
      message: 'Built for Jellyfin homeservers.<br><a href="https://buymeacoffee.com/nerdytechnician" target="_blank" rel="noreferrer">Buy me a coffee</a>',
      copyright: "Released under GPL-3.0."
    },
    outline: {
      level: [2, 3]
    },
    currentVersion: currentRelease.version,
    latestReleaseUrl: currentRelease.url,
    latestRelease: currentRelease,
    latestBetaReleaseUrl: latestBetaRelease.url,
    latestBetaRelease
  }
});
