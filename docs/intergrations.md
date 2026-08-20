# Integrations

JellyGlance uses Jellyfin as the source of truth for media, users, artwork, sessions, favourites, watchlists, and watch history. Integrations extend that core into requests, downloads, transcodes, cleanup, imports, notifications, release planning, and admin workflows.

<div class="integration-hero">
  <div>
    <p class="integration-kicker">Media stack control center</p>
    <h2>Connect the tools around Jellyfin.</h2>
    <p>Bring invites, requests, automation, downloads, webhooks, cleanup, imports, and account access into one operational view for your homeserver.</p>
  </div>
  <div class="integration-orbit" aria-label="Supported integration logos">
    <img src="/icons/selfhst/jellyfin.svg" alt="Jellyfin">
    <img src="https://cdn.jsdelivr.net/gh/walkxcode/dashboard-icons/png/wizarr.png" alt="Wizarr">
    <img src="https://cdn.jsdelivr.net/gh/walkxcode/dashboard-icons/png/jellyseerr.png" alt="Jellyseerr">
    <img src="https://cdn.jsdelivr.net/gh/walkxcode/dashboard-icons/png/overseerr.png" alt="Overseerr">
    <img src="https://cdn.jsdelivr.net/gh/walkxcode/dashboard-icons/png/tdarr.png" alt="Tdarr">
    <img src="https://cdn.jsdelivr.net/gh/walkxcode/dashboard-icons/png/maintainerr.png" alt="Maintainerr">
    <img src="https://cdn.jsdelivr.net/gh/walkxcode/dashboard-icons/png/sickchill.png" alt="SickChill">
    <img src="/icons/selfhst/sonarr.svg" alt="Sonarr">
    <img src="/icons/selfhst/radarr.svg" alt="Radarr">
    <img src="https://cdn.jsdelivr.net/gh/walkxcode/dashboard-icons/png/prowlarr.png" alt="Prowlarr">
    <img src="/icons/selfhst/qbittorrent.svg" alt="qBittorrent">
    <img src="/icons/selfhst/transmission.svg" alt="Transmission">
    <img src="/icons/selfhst/deluge.svg" alt="Deluge">
    <img src="/icons/selfhst/sabnzbd.svg" alt="SABnzbd">
    <img src="/icons/selfhst/nzbget.svg" alt="NZBGet">
    <img src="/icons/selfhst/discord.svg" alt="Discord">
    <img src="/icons/selfhst/gotify.svg" alt="Gotify">
  </div>
</div>

<div class="integration-summary-grid">
  <article>
    <strong>Media server</strong>
    <span>Jellyfin powers libraries, users, sessions, artwork, playback history, and account access.</span>
  </article>
  <article>
    <strong>Requests and automation</strong>
    <span>Wizarr, Seerr apps, Arr apps, Tdarr, Maintainerr, and SickChill feed requests, automation, and cleanup surfaces.</span>
  </article>
  <article>
    <strong>Downloads and alerts</strong>
    <span>Queue clients, webhooks, health checks, background jobs, and repair workflows keep daily admin checks in one place.</span>
  </article>
</div>

## Jump To

<div class="integration-jump-grid">
  <a href="#media-server">
    <strong>Media Server</strong>
    <span>Jellyfin setup, sync, and artwork.</span>
  </a>
  <a href="#3rd-party-apps">
    <strong>3rd Party Apps</strong>
    <span>Wizarr, Tdarr, Maintainerr, and SickChill.</span>
  </a>
  <a href="#seerr-apps">
    <strong>Seerr Apps</strong>
    <span>Jellyseerr and Overseerr request flows.</span>
  </a>
  <a href="#arr-apps">
    <strong>Arr Apps</strong>
    <span>Sonarr, Radarr, Lidarr, Bazarr, and Prowlarr.</span>
  </a>
  <a href="#download-clients">
    <strong>Download Clients</strong>
    <span>Torrents, Usenet, and queue syncing.</span>
  </a>
  <a href="#notifications">
    <strong>Notifications</strong>
    <span>Discord and Gotify-style alert delivery.</span>
  </a>
  <a href="#imports-and-digest">
    <strong>Imports And Digest</strong>
    <span>Tautulli history imports and newsletters.</span>
  </a>
  <a href="#access-and-jobs">
    <strong>Access And Jobs</strong>
    <span>Auth surfaces, jobs, and setup order.</span>
  </a>
</div>

## Integration Areas

<div class="integration-area-grid">
  <article>
    <img src="/icons/selfhst/jellyfin.svg" alt="">
    <strong>Media Server</strong>
    <span>Jellyfin libraries, users, sessions, activity, artwork, Quick Connect, and first setup.</span>
  </article>
  <article>
    <img src="https://cdn.jsdelivr.net/gh/walkxcode/dashboard-icons/png/wizarr.png" alt="">
    <strong>3rd Party Apps</strong>
    <span>Wizarr invites, Tdarr transcodes, Maintainerr cleanup, and SickChill as a Sonarr alternative inside one clearer integrations area.</span>
  </article>
  <article>
    <img src="https://cdn.jsdelivr.net/gh/walkxcode/dashboard-icons/png/jellyseerr.png" alt="">
    <strong>Seerr Apps</strong>
    <span>Jellyseerr and Overseerr requests, poster metadata, requester context, availability checks, actions, and request badges.</span>
  </article>
  <article>
    <img src="/icons/selfhst/sonarr.svg" alt="">
    <strong>Arr Apps</strong>
    <span>Sonarr, Radarr, Lidarr, Bazarr, and Prowlarr status, health checks, calendar entries, and event context.</span>
  </article>
  <article>
    <img src="/icons/selfhst/qbittorrent.svg" alt="">
    <strong>Download Clients</strong>
    <span>qBittorrent, Transmission, Deluge, SABnzbd, and NZBGet queues, submissions, and health.</span>
  </article>
  <article>
    <img src="/icons/selfhst/discord.svg" alt="">
    <strong>Notifications</strong>
    <span>Discord-compatible and Gotify-style webhooks for task, sync, import, health, and download events.</span>
  </article>
  <article>
    <span class="integration-text-icon" aria-hidden="true">Db</span>
    <strong>Legacy Imports</strong>
    <span>Tautulli backup upload, preview, safe append, duplicate skipping, and manual matching to Jellyfin media.</span>
  </article>
  <article>
    <span class="integration-text-icon" aria-hidden="true">Em</span>
    <strong>Email Digest</strong>
    <span>SMTP-backed newsletters with previews, test sends, send history, and recent media/watch-stat summaries.</span>
  </article>
</div>

## Media Server {#media-server}

<div class="integration-service-card featured">
  <img src="/icons/selfhst/jellyfin.svg" alt="">
  <div>
    <h3>Jellyfin</h3>
    <p>The required media server connection. Configure it during first setup or later from <strong>Settings &gt; Integrations &gt; Media Server</strong>.</p>
    <ul>
      <li>Validate the Jellyfin URL and API key.</li>
      <li>Sync libraries, users, items, seasons, episodes, and playback data.</li>
      <li>Proxy posters, backdrops, avatars, and login artwork.</li>
      <li>Read active sessions for Activity views and nav badges.</li>
      <li>Support Jellyfin Quick Connect login.</li>
    </ul>
  </div>
</div>

## 3rd Party Apps {#3rd-party-apps}

3rd party apps live under <strong>Settings &gt; Integrations &gt; 3rd Party Apps</strong> and bring invites, transcodes, cleanup, and alternative TV automation into JellyGlance.

<div class="integration-card-grid two-up">
  <article>
    <img src="https://cdn.jsdelivr.net/gh/walkxcode/dashboard-icons/png/wizarr.png" alt="">
    <h3>Wizarr</h3>
    <p>Create, copy, open, sync, and manage invite links directly from JellyGlance.</p>
  </article>
  <article>
    <img src="https://cdn.jsdelivr.net/gh/walkxcode/dashboard-icons/png/tdarr.png" alt="">
    <h3>Tdarr</h3>
    <p>Track active transcodes, queued jobs, history, artwork, conversion details, and live progress.</p>
  </article>
  <article>
    <img src="https://cdn.jsdelivr.net/gh/walkxcode/dashboard-icons/png/maintainerr.png" alt="">
    <h3>Maintainerr</h3>
    <p>Monitor cleanup collections, scheduled actions, recent activity, storage state, health, and reclaimable space.</p>
  </article>
  <article>
    <img src="https://cdn.jsdelivr.net/gh/walkxcode/dashboard-icons/png/sickchill.png" alt="">
    <h3>SickChill</h3>
    <p>Use SickChill as a Sonarr alternative for series automation and TV release workflows.</p>
  </article>
</div>

## Seerr Apps {#seerr-apps}

Seerr apps live under <strong>Settings &gt; Integrations &gt; Seerr Apps</strong>. Enable Jellyseerr, Overseerr, or both, then add the base URL and API key for each service.

<div class="integration-card-grid two-up">
  <article>
    <img src="https://cdn.jsdelivr.net/gh/walkxcode/dashboard-icons/png/jellyseerr.png" alt="">
    <h3>Jellyseerr</h3>
    <p>Bring request cards, poster metadata, requester context, availability checks, and approval actions into JellyGlance.</p>
  </article>
  <article>
    <img src="https://cdn.jsdelivr.net/gh/walkxcode/dashboard-icons/png/overseerr.png" alt="">
    <h3>Overseerr</h3>
    <p>Handle request triage, source badges, status, and per-request actions without leaving the dashboard.</p>
  </article>
</div>

Connected Seerr apps power the dedicated <strong>Requests</strong> page:

- poster-first request cards with requester, status, source, type, and request age
- fast filters for all, approved, available, failed, and partial requests
- search and newest, oldest, or status sorting
- request detail modal with movie, show, season, and episode context when the source provides it
- availability checks against Jellyfin so requests can show Available, Missing, or Partially available
- approve, decline, retry, mark available, and open-in-Seerr actions where the source supports them
- sidebar badge counts for request items that need attention

## Arr Apps {#arr-apps}

Arr apps live under <strong>Settings &gt; Integrations &gt; Arr Apps</strong>. Each service accepts a base URL and API key, and the test action reports the app version when the service responds correctly.

<div class="integration-card-grid">
  <article>
    <img src="/icons/selfhst/sonarr.svg" alt="">
    <h3>Sonarr</h3>
    <p>Series automation for TV releases, monitored episodes, health checks, calendar entries, and import events.</p>
  </article>
  <article>
    <img src="/icons/selfhst/radarr.svg" alt="">
    <h3>Radarr</h3>
    <p>Movie automation for release dates, monitored items, health checks, calendar entries, and import events.</p>
  </article>
  <article>
    <img src="/icons/selfhst/lidarr.svg" alt="">
    <h3>Lidarr</h3>
    <p>Music automation for release status, monitored artists and albums, calendar context, and health checks.</p>
  </article>
  <article>
    <img src="/icons/selfhst/bazarr.svg" alt="">
    <h3>Bazarr</h3>
    <p>Subtitle automation status and health checks alongside the rest of the media stack.</p>
  </article>
  <article>
    <img src="https://cdn.jsdelivr.net/gh/walkxcode/dashboard-icons/png/prowlarr.png" alt="">
    <h3>Prowlarr</h3>
    <p>Indexer health and connected app sync status alongside the rest of the media automation stack.</p>
  </article>
</div>

Run <strong>Arr Calendar Sync</strong> from <strong>Settings &gt; Tasks</strong> when you want to force a fresh pull from Sonarr, Radarr, or Lidarr.

## Download Clients {#download-clients}

Download clients live under <strong>Settings &gt; Integrations &gt; Download Clients</strong> and feed the dedicated <strong>Downloads</strong> page.

<div class="integration-card-grid">
  <article>
    <img src="/icons/selfhst/qbittorrent.svg" alt="">
    <h3>qBittorrent</h3>
    <p>Torrent queue monitoring with URL, username, and password credentials.</p>
  </article>
  <article>
    <img src="/icons/selfhst/transmission.svg" alt="">
    <h3>Transmission</h3>
    <p>Torrent queue monitoring with URL, username, and password credentials.</p>
  </article>
  <article>
    <img src="/icons/selfhst/deluge.svg" alt="">
    <h3>Deluge</h3>
    <p>Torrent queue monitoring with URL and password credentials.</p>
  </article>
  <article>
    <img src="/icons/selfhst/sabnzbd.svg" alt="">
    <h3>SABnzbd</h3>
    <p>Usenet queue monitoring with URL and API key credentials.</p>
  </article>
  <article>
    <img src="/icons/selfhst/nzbget.svg" alt="">
    <h3>NZBGet</h3>
    <p>Usenet queue monitoring with URL and API key credentials.</p>
  </article>
</div>

The Downloads page supports magnet links, torrent URLs, and torrent file uploads. The queue sync task refreshes active, queued, completed, and failed download state.

## Notifications {#notifications}

<div class="integration-card-grid two-up">
  <article>
    <img src="/icons/selfhst/discord.svg" alt="">
    <h3>Discord-Compatible</h3>
    <p>Send JellyGlance events to Discord-style webhook endpoints for task, sync, media, and health updates.</p>
  </article>
  <article>
    <img src="/icons/selfhst/gotify.svg" alt="">
    <h3>Gotify-Style</h3>
    <p>Send operational alerts to Gotify-style webhook targets for self-hosted notification flows.</p>
  </article>
</div>

Common event groups include:

- task started, completed, and failed
- Jellyfin full sync and recently added sync
- playback reporting import completed or failed
- Arr calendar refresh
- download started, completed, or failed
- integration health warning
- library scan completed

## Imports And Digest {#imports-and-digest}

<div class="integration-card-grid two-up">
  <article>
    <span class="integration-text-icon" aria-hidden="true">Db</span>
    <h3>Tautulli Imports</h3>
    <p>Upload backups, preview history, skip duplicates, and manually match unmatched watch history to current Jellyfin media.</p>
  </article>
  <article>
    <span class="integration-text-icon" aria-hidden="true">Em</span>
    <h3>Newsletter Digest</h3>
    <p>Configure SMTP, generate previews, send tests, track send history, and deliver weekly or monthly JellyGlance summaries.</p>
  </article>
</div>

Imported rows that cannot be matched automatically are surfaced in both <strong>Settings &gt; Imports</strong> and the <strong>Repair Hub</strong>.

Newsletter content includes recently added media, weekly watch stats, active viewers, and repair status.

## Access And Jobs {#access-and-jobs}

<div class="integration-access-grid">
  <article>
    <strong>Jellyfin Quick Connect</strong>
    <span>Users approve login from Jellyfin and inherit the JellyGlance role assigned on the Users page.</span>
  </article>
  <article>
    <strong>Local JellyGlance Users</strong>
    <span>Local accounts can be created for admin, manager, viewer, and custom role workflows.</span>
  </article>
  <article>
    <strong>OIDC-Ready Auth</strong>
    <span>OIDC settings are stored for environments that use an external identity provider.</span>
  </article>
</div>

### Background Jobs

| Task | Purpose |
| --- | --- |
| Recently Added Items Sync | Refreshes fresh Jellyfin media shelves |
| Complete Jellyfin Sync | Syncs users, libraries, items, seasons, episodes, and metadata |
| Playback Reporting Import | Imports Jellyfin Playback Reporting Plugin rows |
| Integration Sync | Refreshes connected integration status |
| Arr Calendar Sync | Pulls release calendar data from Arr apps |
| Download Queue Sync | Pulls active download queues from connected clients |
| Integration Health Check | Tests connected integration health and updates health history |
| Webhook Health Check | Sends a test event through enabled task webhooks and records delivery status |
| Backup JellyGlance | Creates a JellyGlance backup |
| Refresh Dashboard Stats | Refreshes cached dashboard and statistics views |
| Clear Stale Task Logs | Marks interrupted task logs as stale |
