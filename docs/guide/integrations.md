# Integrations

JellyGlance uses Jellyfin as the source of truth for media, users, artwork, sessions, and watch history. Extra integrations extend that view into release planning, download monitoring, automation, and notifications.

## Integration Areas

| Area | Integrations | Used For |
| --- | --- | --- |
| Media server | Jellyfin | Libraries, users, sessions, playback activity, artwork, Quick Connect, and first setup |
| Arr apps | Sonarr, Radarr, Lidarr, Bazarr | Calendar releases, monitored status, health checks, and release/import events |
| Download clients | qBittorrent, Transmission, Deluge, SABnzbd, NZBGet | Active downloads, queue state, torrent or magnet submission, and client health |
| Notifications | Discord-compatible webhooks, Gotify-style webhooks | Task, sync, import, health, download, and calendar event alerts |
| Access | Jellyfin Quick Connect, local JellyGlance users, OIDC-ready auth | Admin setup, account dashboards, roles, and future identity-provider flows |

## Jellyfin

The Jellyfin connection is configured during first setup and can later be managed from **Settings > Integrations > Media Server**.

JellyGlance uses the Jellyfin URL and API key to:

- validate the server connection
- sync libraries, users, items, seasons, episodes, and playback data
- proxy images for posters, backdrops, avatars, and login artwork
- read active sessions for the Activity page and nav badges
- support Jellyfin Quick Connect login

## Arr Apps

Arr apps live under **Settings > Integrations > Arr Apps**.

| App | Category | Notes |
| --- | --- | --- |
| Sonarr | Series automation | TV releases, monitored episodes, health checks, calendar entries |
| Radarr | Movie automation | Movie releases, monitored items, health checks, calendar entries |
| Lidarr | Music automation | Music releases and health checks |
| Bazarr | Subtitle automation | Subtitle service status and health checks |

Each Arr app accepts a base URL and API key. The test action should report the app version when the service responds correctly.

## Download Clients

Download clients live under **Settings > Integrations > Download Clients** and feed the dedicated **Downloads** page.

| Client | Type | Credentials |
| --- | --- | --- |
| qBittorrent | Torrent | URL, username, password |
| Transmission | Torrent | URL, username, password |
| Deluge | Torrent | URL, password |
| SABnzbd | Usenet | URL, API key |
| NZBGet | Usenet | URL, API key |

The Downloads page supports magnet links, torrent URLs, and torrent file uploads. The queue sync task refreshes active, queued, completed, and failed download state.

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

Webhooks are managed from **Settings > Webhooks**.

You can add one or many webhook destinations, then choose which JellyGlance events should trigger each destination. Common event groups include:

- task started, completed, and failed
- Jellyfin full sync and recently added sync
- playback reporting import completed or failed
- Arr calendar refresh
- download started, completed, or failed
- integration health warning
- library scan completed

When webhook events are enabled, task and integration jobs send notifications through the configured destinations.

## Background Jobs

| Task | Purpose |
| --- | --- |
| Recently Added Items Sync | Refreshes fresh Jellyfin media shelves |
| Complete Jellyfin Sync | Syncs users, libraries, items, seasons, episodes, and metadata |
| Playback Reporting Import | Imports Jellyfin Playback Reporting Plugin rows |
| Integration Sync | Refreshes connected integration status |
| Arr Calendar Sync | Pulls release calendar data from Arr apps |
| Download Queue Sync | Pulls active download queues from connected clients |
| Integration Health Check | Tests connected integration health |
| Webhook Health Check | Sends a test event through enabled task webhooks |
| Backup JellyGlance | Creates a JellyGlance backup |
| Refresh Dashboard Stats | Refreshes cached dashboard/statistics views |
| Clear Stale Task Logs | Marks interrupted task logs as stale |

## Recommended Setup Order

1. Connect Jellyfin and complete the first JellyGlance setup.
2. Run a full Jellyfin sync.
3. Add Sonarr, Radarr, Lidarr, or Bazarr under Integrations.
4. Run Arr Calendar Sync.
5. Add one or more download clients.
6. Run Download Queue Sync.
7. Add webhook destinations and tick the events each destination should receive.
8. Use Tasks to schedule the sync jobs you care about.
