<script setup>
const products = [
  { id: "jellyglance", name: "JellyGlance", logo: "/project-logo.png", href: "/" },
  { id: "jellystat", name: "Jellystat", logo: "/icons/compare/jellystat.png", href: "https://github.com/CyferShepard/Jellystat" },
  { id: "jellydash", name: "Jellydash", logo: "/icons/compare/jellydash.png", href: "https://jellydash.madebymartz.com" }
];

const rows = [
  { name: "Live playback sessions", why: "See who is watching, on which client, and how the stream is delivered.", values: { jellyglance: true, jellystat: true, jellydash: true } },
  { name: "Stop session / on-screen message", why: "Kick a stuck stream or send a note to the TV without opening Jellyfin.", values: { jellyglance: true, jellystat: false, jellydash: false } },
  { name: "Watch history", why: "What people finished, not only what is playing right now.", values: { jellyglance: true, jellystat: true, jellydash: true } },
  { name: "User and watch statistics", why: "Who uses the server and which titles they actually watch.", values: { jellyglance: true, jellystat: true, jellydash: true } },
  { name: "Library insight and metadata gaps", why: "Spot missing posters and thin libraries before users do.", values: { jellyglance: true, jellystat: false, jellydash: false } },
  { name: "Seerr request management", why: "Approve or reject Jellyseerr and Overseerr asks in Glance.", values: { jellyglance: true, jellystat: false, jellydash: true } },
  { name: "Download queues", why: "Torrent and Usenet progress next to the request that started them.", values: { jellyglance: true, jellystat: false, jellydash: false } },
  { name: "Arr release calendar", why: "Upcoming Sonarr, Radarr, and Lidarr dates in one place.", values: { jellyglance: true, jellystat: false, jellydash: false } },
  { name: "Tdarr / transcode ops", why: "Watch encode jobs without opening Tdarr itself.", values: { jellyglance: true, jellystat: false, jellydash: false } },
  { name: "Wizarr invites", why: "Hand out Jellyfin access without a second admin tab.", values: { jellyglance: true, jellystat: false, jellydash: false } },
  { name: "Maintainerr cleanup", why: "See what is marked for deletion before space runs out.", values: { jellyglance: true, jellystat: false, jellydash: false } },
  { name: "Webhooks and notifications", why: "Discord, ntfy, Telegram, and similar pings when something happens.", values: { jellyglance: true, jellystat: false, jellydash: true } },
  { name: "Email newsletters", why: "A weekly digest of new media and activity.", values: { jellyglance: true, jellystat: false, jellydash: false } },
  { name: "Backups and restore", why: "Snapshot Glance data and bring it back after a rebuild.", values: { jellyglance: true, jellystat: true, jellydash: false } },
  { name: "Import Jellystat / Tautulli history", why: "Keep old watch stats when you switch dashboards.", values: { jellyglance: true, jellystat: false, jellydash: false } },
  { name: "Custom home / kiosk layout", why: "Family TV or admin desk, same app, different widgets.", values: { jellyglance: true, jellystat: false, jellydash: false } },
  { name: "Installable PWA", why: "Home-screen app instead of another browser tab.", values: { jellyglance: true, jellystat: false, jellydash: true } },
  { name: "Jellyfin jobs and tasks", why: "Library scans and scheduled work from Glance.", values: { jellyglance: true, jellystat: false, jellydash: false } },
  { name: "Integration health checks", why: "Know which Arr or download client is down.", values: { jellyglance: true, jellystat: false, jellydash: false } },
  { name: "Docker self-host", why: "One Compose file for everyday installs.", values: { jellyglance: true, jellystat: true, jellydash: true } }
];
</script>

<template>
  <div class="features-compare" role="table" aria-label="Feature comparison">
    <div class="features-compare-row features-compare-head" role="row">
      <div class="features-compare-feature" role="columnheader">Feature</div>
      <a
        v-for="product in products"
        :key="product.id"
        class="features-compare-product"
        :href="product.href"
        :target="product.href.startsWith('http') ? '_blank' : undefined"
        :rel="product.href.startsWith('http') ? 'noreferrer' : undefined"
        role="columnheader"
      >
        <img :src="product.logo" :alt="product.name">
        <strong>{{ product.name }}</strong>
      </a>
    </div>

    <div v-for="row in rows" :key="row.name" class="features-compare-row" role="row">
      <div class="features-compare-feature" role="rowheader" :title="row.why">
        <strong>{{ row.name }}</strong>
        <small>{{ row.why }}</small>
      </div>
      <div
        v-for="product in products"
        :key="`${row.name}-${product.id}`"
        class="features-compare-mark"
        :class="row.values[product.id] ? 'is-yes' : 'is-no'"
        role="cell"
      >
        <span :aria-label="row.values[product.id] ? 'Yes' : 'No'">
          {{ row.values[product.id] ? "✓" : "✕" }}
        </span>
      </div>
    </div>
  </div>
</template>
