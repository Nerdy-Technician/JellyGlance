import { defineConfig } from "vitepress";

const siteBase = "/";
const withBase = (path) => `${siteBase}${path.replace(/^\//, "")}`;

export default defineConfig({
  title: "JellyGlance",
  description: "Modern Jellyfin analytics and media control.",
  base: siteBase,
  sitemap: {
    hostname: "https://jellyglance.com"
  },
  cleanUrls: true,
  head: [
    ["link", { rel: "icon", href: withBase("/favicon.ico") }],
    ["link", { rel: "apple-touch-icon", sizes: "180x180", href: withBase("/apple-touch-icon.png") }],
    ["link", { rel: "icon", type: "image/png", sizes: "192x192", href: withBase("/icon-b-192.png") }],
    ["link", { rel: "icon", type: "image/png", sizes: "512x512", href: withBase("/icon-b-512.png") }],
    ["meta", { name: "theme-color", content: "#aa5cc3" }],
    ["meta", { name: "keywords", content: "JellyGlance,Jellyfin,dashboard,analytics,self-hosted,media server,Quick Connect,Sonarr,Radarr,Lidarr,Bazarr,qBittorrent,Docker,PostgreSQL,React" }],
    ["meta", { property: "og:title", content: "JellyGlance" }],
    ["meta", { property: "og:description", content: "Modern Jellyfin analytics, sessions, users, webhooks, and docs." }],
    ["meta", { property: "og:image", content: withBase("/screenshots/Home.png") }],
    ["meta", { property: "og:type", content: "website" }],
    ["meta", { name: "twitter:card", content: "summary_large_image" }],
    ["meta", { name: "twitter:title", content: "JellyGlance" }],
    ["meta", { name: "twitter:description", content: "Modern Jellyfin analytics, sessions, users, webhooks, and docs." }],
    ["meta", { name: "twitter:image", content: withBase("/screenshots/Home.png") }]
  ],
  themeConfig: {
    logo: withBase("/project-logo.png"),
    siteTitle: "JellyGlance",
    nav: [
      { text: "Guide", link: "/guide/getting-started" },
      { text: "Integrations", link: "/guide/integrations" },
      { text: "Screenshots", link: "/guide/screenshots" },
      { text: "Operations", link: "/operations/docker" },
      { text: "Releases", link: "/operations/releases" },
      { text: "GitHub", link: "https://github.com/Nerdy-Technician/JellyGlance" }
    ],
    sidebar: [
      {
        text: "Project Guide",
        items: [
          { text: "Getting Started", link: "/guide/getting-started" },
          { text: "Integrations", link: "/guide/integrations" },
          { text: "Screenshots", link: "/guide/screenshots" },
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
    }
  }
});
