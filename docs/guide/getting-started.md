# Getting Started

JellyGlance runs as a Vite React web app backed by an Express API and PostgreSQL. You can run it locally while developing, or use Docker Compose for the normal self-hosted setup.

## Requirements

- Node.js 22 or newer
- npm 10 or newer
- PostgreSQL 16 or newer for local API development
- Docker and Docker Compose for container deployment
- A Jellyfin server URL and API key

## Docker Start

```sh
docker compose up -d
```

Open JellyGlance at `http://localhost:3000`.

Before exposing it outside your LAN, update these values in `docker-compose.yml`:

- `JWT_SECRET`
- `POSTGRES_PASSWORD`
- `TZ`

Docker mounts `./config` to `/app/config` and `./backups` to `/app/backups`, making backup files easy to copy, archive, and restore.

## Local Development

```sh
npm install
npm run dev
```

The API listens on `http://localhost:3000`.
The Vite app listens on `http://localhost:3001`.

Copy the API environment example before starting local API development:

```sh
cp apps/api/.env.example apps/api/.env
```

Then fill in PostgreSQL connection settings and `JWT_SECRET`.

## First Setup

1. Open JellyGlance.
2. Enter your Jellyfin server URL.
3. Enter a Jellyfin API key so JellyGlance can validate the server and sync library data.
4. Choose your admin access mode.
5. Complete Jellyfin Quick Connect, OIDC/Auth provider details, or local admin creation.
6. Let the first sync finish.

After setup, JellyGlance can use cached artwork from your Jellyfin library for the login background.

## What To Configure Next

Once Jellyfin is connected, the most useful follow-up configuration lives in **Settings**:

| Settings Area | What It Controls |
| --- | --- |
| Integrations | Jellyfin, Arr apps, download clients, and integration event sources |
| Tasks | Manual and scheduled sync jobs for Jellyfin, calendar, downloads, health checks, and backups |
| Webhooks | One or many webhook destinations with event toggles per destination |
| API Key | Scoped JellyGlance access tokens for automation or dashboards |
| Library Settings | Library sync behavior and manual scan options |
| Backup | Backup export options for JellyGlance data |
| Logs | Task and sync execution history |

## Integrations Quick List

JellyGlance can connect to:

- Jellyfin for media, users, sessions, activity, and artwork
- Sonarr, Radarr, Lidarr, and Bazarr for automation status and release calendars
- qBittorrent, Transmission, Deluge, SABnzbd, and NZBGet for download queues and torrent/magnet submission
- Discord-compatible and Gotify-style webhook endpoints for notifications

See [Integrations](./integrations.md) for the complete setup map.

## Common Commands

```sh
npm run lint
npm run build
npm run build:docs
npm run docs:dev
```

## Next Steps

- Review [Architecture](./architecture.md) to understand the workspace.
- Review [Docker](../operations/docker.md) before deploying.
- Review [Releases](../operations/releases.md) before tagging changes.
