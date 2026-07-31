# Integrations

JellyGlance uses Jellyfin as the source of truth for media, users, artwork, sessions, favourites, watchlists, and watch history. Integrations extend that core into request management, release planning, download monitoring, legacy history imports, digest email, automation, notifications, and access control.

<div class="integration-hero">
  <div>
    <p class="integration-kicker">Media stack control center</p>
    <h2>Connect the tools around Jellyfin.</h2>
    <p>Bring Jellyfin, Seerr apps, Arr apps, download clients, imports, newsletters, webhooks, and account access into one operational view for your homeserver.</p>
  </div>
  <div class="integration-orbit" aria-label="Supported integration logos">
    <img src="/icons/selfhst/jellyfin.svg" alt="Jellyfin">
    <img src="/icons/selfhst/sonarr.svg" alt="Sonarr">
    <img src="/icons/selfhst/radarr.svg" alt="Radarr">
    <img src="/icons/selfhst/qbittorrent.svg" alt="qBittorrent">
    <img src="/icons/selfhst/sabnzbd.svg" alt="SABnzbd">
  </div>
</div>

## Integration Areas

<div class="integration-area-grid">
  <article>
    <img src="/icons/selfhst/jellyfin.svg" alt="">
    <strong>Media Server</strong>
    <span>Jellyfin libraries, users, sessions, activity, artwork, Quick Connect, and first setup.</span>
  </article>
  <article>
    <img src="/icons/selfhst/sonarr.svg" alt="">
    <strong>Arr Apps</strong>
    <span>Sonarr, Radarr, Lidarr, and Bazarr status, health checks, calendar entries, and event context.</span>
  </article>
  <article>
    <span class="integration-text-icon" aria-hidden="true">Rq</span>
    <strong>Seerr Apps</strong>
    <span>Jellyseerr and Overseerr requests, poster metadata, requester context, availability checks, actions, and request badges.</span>
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

## Seerr Apps

Seerr apps live under **Settings > Integrations > Seerr Apps** before the Download Clients tab. Enable Jellyseerr, Overseerr, or both, then add the base URL and API key for each service.

Connected Seerr apps power the dedicated **Requests** page:

- poster-first request cards with requester, status, source, type, and request age
- fast filters for all, approved, available, failed, and partial requests
- search and newest/oldest/status sorting
- request detail modal with movie, show, season, and episode context when the source provides it
- availability checks against Jellyfin so requests can show Available, Missing, or Partially available
- approve, decline, retry, mark available, and open-in-Seerr actions where the source supports them
- sidebar badge counts for request items that need attention

The Requests page caches expensive request and metadata lookups so large Seerr histories stay responsive while still allowing a manual refresh.

## Jellyfin

<div class="integration-service-card featured">
  <img src="/icons/selfhst/jellyfin.svg" alt="">
  <div>
    <h3>Jellyfin</h3>
    <p>The required media server connection. Configure it during first setup or later from <strong>Settings > Integrations > Media Server</strong>.</p>
    <ul>
      <li>Validate the Jellyfin URL and API key.</li>
      <li>Sync libraries, users, items, seasons, episodes, and playback data.</li>
      <li>Proxy posters, backdrops, avatars, and login artwork.</li>
      <li>Read active sessions for Activity views and nav badges.</li>
      <li>Support Jellyfin Quick Connect login.</li>
    </ul>
  </div>
</div>

## Arr Apps

Arr apps live under **Settings > Integrations > Arr Apps**. Each service accepts a base URL and API key; the test action reports the app version when the service responds correctly.

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
</div>

## Download Clients

Download clients live under **Settings > Integrations > Download Clients** and feed the dedicated **Downloads** page.

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

## Tautulli Imports

Tautulli imports live under **Settings > Imports**. They are designed for JellyGlance installs that want to keep older Plex/Tautulli watch history without overwriting current Jellyfin playback data.

- upload `.db`, `.db.zip`, or `.zip` Tautulli backups
- preview playable rows and history date range before importing
- append new rows while skipping previously imported rows
- match imported history to Jellyfin media where possible
- manually link unmatched groups to current Jellyfin movies or episodes
- refresh Activity and Repair Hub views after import/link actions

Imported rows that cannot be matched automatically are surfaced in both **Settings > Imports** and the **Repair Hub**.

## Newsletter Digest

Newsletter settings live under **Settings > Newsletter**. Configure SMTP once, then generate and send a JellyGlance digest manually or prepare it for weekly/monthly workflows.

- sender name and sender email settings
- SMTP host, port, username, password, implicit TLS, and TLS verification options
- recipient list with newline, comma, or semicolon separation
- preview generation with an open-in-tab action
- test sends to a single recipient
- manual sends to the configured recipient list
- send history for successful and failed newsletter attempts

Newsletter content includes recently added media, weekly watch stats, active viewers, and repair status.

## Repair Hub

The **Repair** page brings the maintenance state of the media stack into one triage surface.

- missing posters and logos
- missing runtime metadata
- empty series with no active episodes
- orphaned playback activity
- unmatched Tautulli imports
- recent task failures
- links back to imports, library settings, activity, and logs

## Calendar

The **Calendar** page is powered by Arr app calendar data. It is designed to behave like a real release calendar:

- month navigation
- refresh action
- source status
- upcoming release cards
- poster/backdrop preview where artwork is available
- click-through release details

Run **Arr Calendar Sync** from **Settings > Tasks** when you want to force a fresh pull from Sonarr, Radarr, or Lidarr.

## Webhooks

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

You can add one or many webhook destinations, then choose which JellyGlance events should trigger each destination. Common event groups include:

- task started, completed, and failed
- Jellyfin full sync and recently added sync
- playback reporting import completed or failed
- Arr calendar refresh
- download started, completed, or failed
- integration health warning
- library scan completed

## Access

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

## Background Jobs

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
| Refresh Dashboard Stats | Refreshes cached dashboard/statistics views |
| Clear Stale Task Logs | Marks interrupted task logs as stale |

## Recommended Setup Order

1. Connect Jellyfin and complete the first JellyGlance setup.
2. Run a full Jellyfin sync.
3. Add Jellyseerr or Overseerr under Seerr Apps if you want the Requests page.
4. Add Sonarr, Radarr, Lidarr, or Bazarr under Arr Apps.
5. Run Arr Calendar Sync.
6. Add one or more download clients.
7. Run Download Queue Sync.
8. Add webhook destinations and tick the events each destination should receive.
9. Import legacy Tautulli history if you want older watch activity in JellyGlance.
10. Configure the newsletter digest if you want email summaries.
11. Use Tasks to schedule the sync jobs you care about.
