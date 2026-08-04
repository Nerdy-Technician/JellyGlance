# Architecture

JellyGlance runs beside Jellyfin. Jellyfin stays the source of truth for media, users, sessions, artwork, and library metadata. JellyGlance adds dashboard state, admin tools, integrations, task history, and repair signals around it.

## Workspace

```text
apps/web   React + Vite dashboard
apps/api   Express API, sync jobs, integrations, WebSockets
docs       VitePress docs
scripts    Maintenance and translation utilities
```

## Runtime

In development, Vite serves the web app and proxies API calls to Express. In production, Express serves both the API and the built web assets.

The browser talks to JellyGlance. JellyGlance talks to Jellyfin and optional services from the backend, keeping saved credentials server-side.

PostgreSQL stores synced metadata, settings, task logs, integration state, backups, imports, repair summaries, API keys, and newsletter history.

## Flow

1. Setup validates the Jellyfin URL and API key.
2. Sync tasks pull Jellyfin users, libraries, media, sessions, artwork, and activity.
3. Optional adapters pull requests, Arr calendars, downloads, and health state.
4. The API normalizes data into PostgreSQL.
5. React pages render dashboards, jobs, logs, settings, users, activity, and repair views.
6. WebSockets and webhooks report task progress and operational events.

## Frontend

`apps/web` contains the React app, routes, setup flow, dashboards, settings pages, and page CSS.

Main surfaces:

- Home dashboard
- Activity, Libraries, Users, Statistics, Calendar
- Requests and Downloads when configured
- admin-only Jellyfin Jobs
- Settings center, Repair, Logs, Health, Imports, Webhooks, Backups

## API

`apps/api` owns auth, database writes, Jellyfin credentials, integration credentials, sync work, filesystem imports, backups, and webhooks.

| Area | Purpose |
| --- | --- |
| `server.js` | Express startup and web asset serving |
| `routes/auth.js` | Login, Quick Connect, OIDC-ready auth |
| `routes/api.js` | Core config, users, libraries, integrations |
| `routes/sync.js` | Jellyfin sync and library scan routes |
| `routes/stats.js` | Dashboard and statistics data |
| `routes/webhooks.js` | Webhook setup and tests |
| `routes/newsletter.js` | SMTP digest previews and sends |
| `routes/tautulli.js` | Legacy history import and matching |
| `global/task-list.js` | Registered background jobs |

## Integrations

Integrations are optional. If request or download clients are not configured, JellyGlance hides those pages instead of showing empty screens.

| Adapter | Used For |
| --- | --- |
| Jellyfin | users, sessions, libraries, activity, jobs, devices, plugins |
| Jellyseerr / Overseerr | requests, availability, actions |
| Sonarr / Radarr / Lidarr | release calendar and health |
| Bazarr | subtitle service health |
| qBittorrent / Transmission / Deluge | torrent queues |
| SABnzbd / NZBGet | Usenet queues |
| Tautulli | legacy playback imports |
| SMTP | newsletter digest |
| Webhooks | task and health notifications |

## Tasks

JellyGlance tasks run API-side and cover syncs, Playback Reporting imports, stats refreshes, Arr calendar sync, download queue sync, health checks, webhooks, backups, restores, and cleanup.

Jellyfin scheduled jobs are separate. Admins can view and run them from the Jellyfin Jobs page.

## Security

Credentials stay on the backend. Admin-only areas include Settings, API keys, backups, restore actions, integrations, logs, Jellyfin Jobs, devices, plugins, and role management.

## AI Assistance

JellyGlance is AI-assisted in small ways: CSS polish, wording, security suggestions, refactor ideas, and test ideas. Code, UI, docs, screenshots, and security-sensitive behavior are human reviewed before they stay.
