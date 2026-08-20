# Screenshots

These screenshots show the current JellyGlance 1.2.3 interface: first-run setup, the daily dashboard, media activity, requests, downloads, transcodes, invites, users, statistics, Jellyfin jobs, and the redesigned Settings areas.

## First Run

The first-run wizard walks through Jellyfin connection, authentication, optional integrations, legacy history import, and the first sync. The integrations step is intentionally lighter than the full Settings page: choose an app, add it to setup, then fill in only the services you want ready before JellyGlance builds its first dashboard cache.

<div class="screenshot-grid">
  <figure>
    <img src="/screenshots/first-run-jellyfin-server.png" alt="First-run Jellyfin server connection">
    <figcaption>Connect Jellyfin with URL and API key validation.</figcaption>
  </figure>
  <figure>
    <img src="/screenshots/first-run-auth.png" alt="First-run authentication choice">
    <figcaption>Choose Quick Connect, OIDC, or local JellyGlance admin access.</figcaption>
  </figure>
  <figure>
    <img src="/screenshots/first-run-integrations.png" alt="First-run integrations picker">
    <figcaption>Add only the integrations you want ready for the first sync.</figcaption>
  </figure>
  <figure>
    <img src="/screenshots/first-run-history-import.png" alt="First-run history import">
    <figcaption>Optionally import older Tautulli or Jellystat watch history.</figcaption>
  </figure>
  <figure>
    <img src="/screenshots/first-run-sync.png" alt="First-run sync">
    <figcaption>Start the initial Jellyfin sync and dashboard build.</figcaption>
  </figure>
</div>

## Home Dashboard

<img src="/screenshots/home.png" alt="JellyGlance home dashboard">

Home is the daily command center. It brings together active sessions, recently added media, library health, activity signals, request/download status, automation health, Tdarr transcodes, Wizarr invites, Maintainerr cleanup, Hall of Fame, and operational alerts. The layout can be reordered, resized, hidden, and tuned for kiosk mode.

## Media And Activity

<div class="screenshot-grid">
  <figure>
    <img src="/screenshots/recently-added.png" alt="Recently added media">
    <figcaption>Recently Added highlights fresh Jellyfin content with poster-first browsing.</figcaption>
  </figure>
  <figure>
    <img src="/screenshots/activity.png" alt="Playback activity table">
    <figcaption>Activity gives searchable playback history with users, clients, methods, durations, and media context.</figcaption>
  </figure>
  <figure>
    <img src="/screenshots/libraries-grid.png" alt="Libraries grid view">
    <figcaption>Libraries grid view focuses on artwork, counts, and quick scan actions.</figcaption>
  </figure>
  <figure>
    <img src="/screenshots/libraries-list.png" alt="Libraries list view">
    <figcaption>Libraries list view is denser for admin review and bulk checking.</figcaption>
  </figure>
  <figure>
    <img src="/screenshots/calendar.png" alt="Release calendar">
    <figcaption>Calendar collects upcoming Sonarr, Radarr, and Lidarr releases.</figcaption>
  </figure>
  <figure>
    <img src="/screenshots/statistics.png" alt="Statistics dashboard">
    <figcaption>Statistics summarizes watch time, top users, playback methods, libraries, and trends.</figcaption>
  </figure>
</div>

## Requests, Downloads, And Transcodes

<div class="screenshot-grid">
  <figure>
    <img src="/screenshots/requests.png" alt="Requests page">
    <figcaption>Requests brings Jellyseerr and Overseerr items into JellyGlance with posters, requester context, status filters, and admin actions.</figcaption>
  </figure>
  <figure>
    <img src="/screenshots/downloads.png" alt="Downloads page">
    <figcaption>Downloads shows torrent and Usenet queues, progress, stalled items, and integration health.</figcaption>
  </figure>
  <figure>
    <img src="/screenshots/active-transcodes.png" alt="Tdarr active transcodes page">
    <figcaption>Active Transcodes tracks Tdarr active jobs, queued files, history, conversion details, artwork, and live progress.</figcaption>
  </figure>
  <figure>
    <img src="/screenshots/invites.png" alt="Wizarr invites page">
    <figcaption>Invites lets you create, copy, open, and manage Wizarr invite links from JellyGlance.</figcaption>
  </figure>
</div>

Requests, Downloads, Active Transcodes, Invites, Maintainerr, and Automation Health stay hidden from navigation until their matching integrations are configured, so clean installs do not show empty pages.

## Users And Admin

<div class="screenshot-grid">
  <figure>
    <img src="/screenshots/users.png" alt="Users and access management">
    <figcaption>Users combines Jellyfin role metadata, local JellyGlance accounts, tracking visibility, and profile links.</figcaption>
  </figure>
  <figure>
    <img src="/screenshots/jellyfin-jobs.png" alt="Jellyfin jobs page">
    <figcaption>Jellyfin Jobs gives admins scheduled task status, categories, last run state, and manual run controls.</figcaption>
  </figure>
</div>

User visibility controls can hide selected Jellyfin users from stats and activity when needed. Profile pages continue from here with personal watch history, media rails, favourites, watchlists, and recommendations.

## Settings

Settings is organized into category-based sections with a collapsible sidebar. The full integrations page remains more powerful than the first-run version, with import/export, health history, service testing, and detailed app cards.

<div class="screenshot-grid">
  <figure>
    <img src="/screenshots/settings-general.png" alt="General settings">
    <figcaption>General settings for core app behavior and dashboard defaults.</figcaption>
  </figure>
  <figure>
    <img src="/screenshots/settings-integrations.png" alt="Integrations settings">
    <figcaption>Integrations groups Media Server, Arr Apps, Seerr Apps, Download Clients, and 3rd party apps.</figcaption>
  </figure>
  <figure>
    <img src="/screenshots/settings-security.png" alt="Security settings">
    <figcaption>Security covers auth mode, Active Sessions IP privacy, roles, and access behavior.</figcaption>
  </figure>
  <figure>
    <img src="/screenshots/settings-tasks.png" alt="Task settings">
    <figcaption>Tasks controls manual and scheduled sync jobs for Jellyfin, downloads, health, and backups.</figcaption>
  </figure>
  <figure>
    <img src="/screenshots/settings-kiosk.png" alt="Kiosk settings">
    <figcaption>Kiosk settings tune title, density, theme, visible widgets, widget sizes, and widget order.</figcaption>
  </figure>
  <figure>
    <img src="/screenshots/settings-library.png" alt="Library settings">
    <figcaption>Library settings control scan behavior and library display options.</figcaption>
  </figure>
  <figure>
    <img src="/screenshots/settings-newsletter.png" alt="Newsletter settings">
    <figcaption>Newsletter settings configure SMTP, recipients, previews, test sends, and digest history.</figcaption>
  </figure>
  <figure>
    <img src="/screenshots/settings-webhooks.png" alt="Webhook settings">
    <figcaption>Webhooks define destinations, event toggles, test delivery, and delivery history.</figcaption>
  </figure>
</div>

## Operations Notes

JellyGlance is designed to keep routine checks close together: active sessions, playback history, library changes, requests, downloads, transcodes, invites, cleanup signals, scheduled jobs, imports, webhooks, newsletters, backups, and health checks. The newer 1.2.3 surfaces focus on reducing empty navigation, improving first-run setup, and making integrations visible only when they are useful.
