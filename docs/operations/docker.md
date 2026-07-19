# Docker

Docker Compose is the recommended way to run JellyGlance for everyday self-hosting.

## Start

```sh
docker compose up -d
```

The stack starts:

- `jellyglance`, the combined API and web app
- `jellyglance-db`, PostgreSQL 16

Open the app at `http://localhost:3000`.

## Configuration

Set these environment values before using JellyGlance outside a private test environment:

```yaml
JWT_SECRET: "replace-me-with-a-long-random-secret"
POSTGRES_PASSWORD: "replace-me"
TZ: Europe/London
```

The included compose file uses the published GHCR image and mounts simple host folders for portable app data:

| Host path | Container path | Purpose |
| --- | --- | --- |
| `./config` | `/app/config` | Runtime config files and future local app settings |
| `./backups` | `/app/backups` | Backup exports and restore uploads |

PostgreSQL data stays in the `postgres-data` volume. Use JellyGlance backups before deleting that volume.

## Updating

```sh
docker compose pull
docker compose up -d
```

If you build locally from source, rebuild the JellyGlance image after pulling code:

```sh
docker build -t ghcr.io/nerdy-technician/jellyglance:local .
docker run --rm -p 3000:3000 ghcr.io/nerdy-technician/jellyglance:local
```

## Resetting Setup Data

For a fresh first-run setup, stop the stack and remove the PostgreSQL volume:

```sh
docker compose down
docker volume rm jellyglance_postgres-data
docker compose up -d
```

This deletes JellyGlance database state. Keep backups before doing this on a real deployment.

## Published Images

The Docker workflow publishes GHCR images from `main` and release tags:

```text
ghcr.io/nerdy-technician/jellyglance
```
