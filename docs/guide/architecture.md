# Architecture

JellyGlance is an npm workspace with a web app, API, documentation site, Docker packaging, and release automation.

## Workspace

```text
apps/web   Vite, React, dashboard routes, setup wizard, charts, settings UI
apps/api   Express, Jellyfin proxy routes, sync tasks, database access, WebSockets
docs       VitePress project documentation
scripts    Local utility scripts
```

## Runtime Shape

The browser talks to JellyGlance through relative API paths. In development, Vite proxies those requests to the Express API. In production, Express serves both the API and the compiled web assets from `apps/web/dist`.

PostgreSQL stores synced Jellyfin metadata, user activity, settings, API keys, webhook state, and dashboard summaries.

## Data Flow

1. JellyGlance validates Jellyfin connection details during first setup.
2. Sync jobs fetch libraries, items, seasons, episodes, users, activity, sessions, and images from Jellyfin.
3. Integration jobs fetch Arr calendar data, download queue state, and integration health.
4. The API stores normalized data in PostgreSQL.
5. Materialized views and API routes feed dashboard pages.
6. The React app renders sessions, users, libraries, activity, calendar, downloads, statistics, settings, and account flows.
7. Webhook jobs send enabled events to each configured destination.

## Frontend

The app uses Vite and React. Page-level styles live under `apps/web/src/pages/css`, while shared navigation and dashboard components live under `apps/web/src/pages/components`.

Important areas:

- Setup wizard and Jellyfin connection
- Login and Jellyfin Quick Connect flow
- Home sessions and recently added media
- Libraries with manual library scan actions
- Users and role management
- Calendar and download queue pages
- Statistics charts
- Settings center with integrations, tasks, API keys, webhooks, backups, and logs

## API

The API is an Express app in `apps/api`. It owns authentication, Jellyfin proxying, sync routes, settings, webhooks, statistics, and database-backed operations.

Important areas:

- `routes/sync.js` for sync and per-library scan routes
- `routes/stats.js` for dashboard/statistics data
- `routes/webhooks.js` for webhook configuration and tests
- `routes/api.js` for configuration, users, integrations, recently added shelves, and app-level API routes
- `classes/integration-store.js` for persisted integration configuration
- `classes/webhook-manager.js` for webhook delivery
- `global/task-list.js` for available background jobs
- `server.js` for route mounting and web asset serving

## Integrations

JellyGlance treats integrations as optional adapters around the core Jellyfin dashboard.

| Adapter | Data It Feeds |
| --- | --- |
| Jellyfin | Setup, users, sessions, libraries, playback activity, artwork |
| Sonarr, Radarr, Lidarr | Calendar releases, health, monitored/import events |
| Bazarr | Subtitle service health and integration status |
| qBittorrent, Transmission, Deluge | Torrent queue state and magnet/torrent submission |
| SABnzbd, NZBGet | Usenet queue state |
| Webhooks | Notifications for task, sync, import, health, download, and calendar events |

## Task System

Tasks are implemented as API classes under `apps/api/tasks` and registered in `apps/api/global/task-list.js`.

Current task categories include:

- Jellyfin full and partial sync
- Playback Reporting Plugin import
- dashboard statistic refreshes
- Arr calendar sync
- download queue sync
- integration health checks
- webhook health checks
- backups and restores
- stale task cleanup

## Automation

GitHub Actions provide:

- CI with install, lint, app build, and docs build
- Docker image publishing to GHCR
- semantic-release tags, changelog updates, and GitHub releases
