import { defineConfig } from "vitepress";
import { getRoadmapProject } from "./roadmap.mjs";
import { getDocsReleases } from "./releases.mjs";
import { getRepoStats } from "./stats.mjs";

const siteBase = "/";
const withBase = (path) => `${siteBase}${path.replace(/^\//, "")}`;

const { latestRelease: currentRelease, latestBetaRelease } = await getDocsReleases();
const repoStats = await getRepoStats();
const roadmap = await getRoadmapProject();

export default defineConfig({
  title: "JellyGlance",
  description: "Modern Jellyfin command center for analytics, requests, health, and media control.",
  base: siteBase,
  sitemap: {
    hostname: "https://jellyglance.com"
  },
  
  cleanUrls: true,
  srcExclude: ["README.md"],
  head: [
    ["link", { rel: "icon", href: withBase("/favicon.ico") }],
    ["link", { rel: "apple-touch-icon", sizes: "180x180", href: withBase("/apple-touch-icon.png") }],
    ["link", { rel: "icon", type: "image/png", sizes: "192x192", href: withBase("/icon-b-192.png") }],
    ["link", { rel: "icon", type: "image/png", sizes: "512x512", href: withBase("/icon-b-512.png") }],
    ["meta", { name: "theme-color", content: "#aa5cc3" }],
    ["meta", { name: "keywords", content: "JellyGlance,Jellyfin,dashboard,analytics,requests,Jellyseerr,Overseerr,self-hosted,media server,Quick Connect,Sonarr,Radarr,Lidarr,Bazarr,qBittorrent,Docker,PostgreSQL,React" }],
    ["meta", { property: "og:title", content: "JellyGlance" }],
    ["meta", { property: "og:description", content: "Modern Jellyfin analytics, requests, sessions, users, health, and webhooks." }],
    ["meta", { property: "og:image", content: withBase("/screenshots/home.png") }],
    ["meta", { property: "og:type", content: "website" }],
    ["meta", { name: "twitter:card", content: "summary_large_image" }],
    ["meta", { name: "twitter:title", content: "JellyGlance" }],
    ["meta", { name: "twitter:description", content: "Modern Jellyfin analytics, requests, sessions, users, health, and webhooks." }],
    ["meta", { name: "twitter:image", content: withBase("/screenshots/home.png") }]
  ],
  themeConfig: {
    logo: withBase("/project-logo.png"),
    siteTitle: "JellyGlance",
    nav: [
      { text: "Features", link: "/features" },
      { text: "Screenshots", link: "/screenshots" },
      { text: "Integrations", link: "/integrations" },
      { text: "Roadmap", link: "/roadmap" },
      { text: "Releases", link: "/releases" },
      { text: "Press", link: "/press" },
      { text: "Docs", link: "https://docs.jellyglance.com/" }
    ],
    sidebar: false,
    socialLinks: [
      { icon: "discord", link: "https://discord.gg/dMGhv8j2kx" },
      { icon: "github", link: "https://github.com/Nerdy-Technician/JellyGlance" }
    ],
    search: {
      provider: "local",
      options: {
        miniSearch: {
          searchOptions: {
            boost: { title: 6, text: 2, titles: 4 },
            boostDocument(documentId) {
              const [path = "", hash = ""] = documentId.split("#");
              const slug = path.split("/").filter(Boolean).pop();
              const page = !hash || hash === slug ? 2.5 : 1;
              if (path.endsWith("/features")) return 3 * page;
              if (path.endsWith("/integrations")) return 2 * page;
              return 1;
            }
          }
        },
        async _render(src, env, md) {
          const html = md.render(src, env);
          if (env.frontmatter?.search === false) return "";

          const aliases = {
            "features.md": "compare comparison jellystat jellydash vs alternative features table",
            "integrations.md": "sonarr radarr lidarr bazarr jellyseerr overseerr qbittorrent sabnzbd nzbget wizarr tdarr maintainerr discord gotify",
            "screenshots.md": "screenshots gallery dashboard pictures ui"
          };

          const extra = aliases[env.relativePath];
          if (!extra) return html;
          return html.replace(/(<h1\b[^>]*>[\s\S]*?<\/h1>)/i, `$1<p>${extra}</p>`);
        }
      }
    },
    footer: {
      message: 'Built for Jellyfin homeservers.<nav class="site-footer-links"><a href="https://docs.jellyglance.com/" target="_blank" rel="noreferrer">Docs</a><a href="/releases">Releases</a><a href="/press">Press</a><a href="https://discord.gg/dMGhv8j2kx" target="_blank" rel="noreferrer">Discord</a></nav><a href="https://buymeacoffee.com/nerdytechnician" target="_blank" rel="noreferrer">Buy me a coffee</a>',
      copyright: "Released under GPL-3.0."
    },
    outline: {
      level: [2, 3]
    },
    currentVersion: currentRelease.version,
    latestReleaseUrl: currentRelease.url,
    latestRelease: currentRelease,
    latestBetaReleaseUrl: latestBetaRelease.url,
    latestBetaRelease,
    repoStats,
    roadmap
  },
  transformPageData(pageData) {
    if (pageData.relativePath !== "index.md") return;
    const actions = pageData.frontmatter?.hero?.actions;
    if (!Array.isArray(actions)) return;

    const pushAlt = (text, link) => {
      if (!text || !link || actions.some((action) => action.text === text || action.link === link)) return;
      actions.push({ theme: "alt", text, link });
    };

    if (currentRelease.version) {
      pushAlt(currentRelease.version, currentRelease.url || "https://github.com/Nerdy-Technician/JellyGlance/releases/latest");
    }
    if (latestBetaRelease.version && latestBetaRelease.version !== currentRelease.version) {
      pushAlt(`Beta ${latestBetaRelease.version}`, latestBetaRelease.url);
    }
    pushAlt(repoStats.downloadsLabel, repoStats.downloadsUrl);
    pushAlt(repoStats.starsLabel, repoStats.starsUrl);
  }
});
