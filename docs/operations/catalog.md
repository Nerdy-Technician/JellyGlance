---
title: Unraid, Proxmox, and TrueNAS
description: Run JellyGlance on Unraid, Proxmox LXC, or TrueNAS using the packaging templates and Docker Compose stack.
---

# Unraid, Proxmox, and TrueNAS

JellyGlance is a Docker Compose app with PostgreSQL. On Unraid, Proxmox, or TrueNAS, wrap that stack — do not invent a second install path.

Ready-made templates and install scripts live in the repo under [`packaging/`](https://github.com/Nerdy-Technician/JellyGlance/tree/main/packaging). See that folder’s README for Unraid Community Apps XMLs, Compose Manager files, and Proxmox LXC helpers.

Also see [Docker](/operations/docker) for the compose file and the [FAQ](/guide/faq) for first-run, API keys, and proxy questions.

This page is documentation only. It does not submit the app to Unraid Community Apps or TrueNAS.

## What a listing should say

- JellyGlance sits **beside** Jellyfin. It is not a Seerr, Sonarr, or Jellyfin admin replacement.
- Requires a Jellyfin URL + API key and a PostgreSQL database.
- Web UI on container port `3000`.
- Persist `/app/config` and `/app/backups`.

## Unraid

Prefer the XML templates in `packaging/unraid/templates/` (app + `jellyglance-db`), or Compose Manager with `packaging/unraid/docker-compose.yml`.

Map:

- `3000` → host web port
- config → `/app/config`
- backups → `/app/backups`

Set `JWT_SECRET`, `POSTGRES_*`, and `TZ`. Put both containers on the same custom Docker network and set `POSTGRES_IP=jellyglance-db`.

## Proxmox LXC

From the Proxmox host:

```bash
cd packaging/proxmox
bash create-lxc.sh
```

Or inside an existing Debian/Ubuntu LXC:

```bash
bash packaging/proxmox/install-in-lxc.sh
```

Both paths install Docker and deploy the compose stack to `/opt/jellyglance`. Details: [`packaging/README.md`](https://github.com/Nerdy-Technician/JellyGlance/blob/main/packaging/README.md).

## TrueNAS SCALE

Add a custom app from the same compose file (`packaging/unraid/docker-compose.yml` works), or two apps (API+web is already one Node process serving the built UI) plus PostgreSQL. Keep host path datasets for config and backups.

## Helm / Kubernetes

Not shipped. Reuse the compose environment variables as a Deployment + Service + PVC if you maintain your own chart.

## Dist tarball

```bash
bash packaging/build.sh
# → packaging/dist/jellyglance-packaging-<version>-<date>.tar.gz
```
