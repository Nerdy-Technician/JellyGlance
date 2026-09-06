---
title: Unraid and TrueNAS
description: Run JellyGlance on Unraid or TrueNAS using the same Docker Compose stack.
---

# Unraid and TrueNAS

JellyGlance is a Docker Compose app with PostgreSQL. On Unraid or TrueNAS, wrap that stack — do not invent a second install path.

See [Docker](/operations/docker) for the compose file and the [FAQ](/guide/faq) for first-run, API keys, and proxy questions.

This page is documentation only. It does not submit the app to Unraid Community Apps or TrueNAS.

## What a listing should say

- JellyGlance sits **beside** Jellyfin. It is not a Seerr, Sonarr, or Jellyfin admin replacement.
- Requires a Jellyfin URL + API key and a PostgreSQL database.
- Web UI on container port `3000`.
- Persist `/app/config` and `/app/backups`.

## Unraid

Use the official image from GitHub Container Registry (`ghcr.io`) matching the [Docker operations](/operations/docker) compose file. Map:

- `3000` → host web port
- `./config` → `/app/config`
- `./backups` → `/app/backups`

Set `JWT_SECRET`, `POSTGRES_*`, and `TZ`. PostgreSQL can be a second Unraid container on the same Docker network.

## TrueNAS SCALE

Add a custom app from the same compose file, or two apps (API+web is already one Node process serving the built UI) plus PostgreSQL. Keep host path datasets for config and backups.

## Helm / Kubernetes

Not shipped. Reuse the compose environment variables as a Deployment + Service + PVC if you maintain your own chart.
