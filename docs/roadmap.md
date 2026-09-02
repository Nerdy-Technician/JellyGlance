---
title: Roadmap
description: Product direction for JellyGlance after v1.2.8.
---

# Roadmap

JellyGlance stays a **Jellyfin command center**. It does not become a second Seerr, a second Sonarr, or a second Jellyfin admin console. New work should combine Jellyfin + Seerr + Arr + downloads + health, or make daily ops faster.

Ideas still belong on [Discord](https://discord.gg/dMGhv8j2kx). This page is the durable public list so they do not vanish.

**Current release theme (v1.2.9): Finish the stack you already show.** Implementation notes live in [v1.2.9 implementation](/operations/v1.2.9).

## Principles

- Prefer finishing advertised integrations over adding new logos.
- Hide nav and calendar until the matching integration is connected (same pattern as Requests and Downloads).
- Viewers get watch/request surfaces. Admins get stop, pause, and health actions.
- Skip Plex, Whisparr, full Arr editors, and multi-server Jellyfin farms until the single-server session and download story is complete.

## v1.2.9 — Finish the stack you already show

Next tagged release after 1.2.8:

1. **Download clients that actually queue** — Transmission, Deluge, NZBGet, and rTorrent poll, add, pause, and remove. qBittorrent and SABnzbd already did this.
2. **Session command** — stop playback, send a Jellyfin display message, and show why a stream is transcoding.
3. **Home stream-capacity widget** — concurrent streams vs a configured cap, transcode vs direct-play split, alert when over limit.
4. **Nav honesty** — Activity Timeline in nav; Calendar hidden until Sonarr, Radarr, or Lidarr is connected; SickChill is connect/health only, not an Arr calendar source.
5. **ntfy and Telegram** — extra webhook targets beside Discord and Gotify.
6. **Installable PWA** — standalone display, install prompt, kiosk-friendly home screen.
7. **Command-center correlation** — item glance, download↔request stitch, ops digest, library storage estimates, My Glance, Bazarr on Home, live Jellyfin jobs, new-client alerts, audit export, WebDAV/HTTP backup copies.
8. **More stack logos that stay Glance-shaped** — Pushover, Unpackerr, Kometa, Readarr calendar, Homepage/Homarr JSON widgets, Unraid/TrueNAS catalog notes.

## Later — still out of identity

The command-center leftovers from after v1.2.8 are in the working tree as part of the **v1.2.9** theme (item glance, My Glance, ops digest, storage, Pushover, Readarr, Unpackerr, Kometa, Homepage widgets, audit export, backup destinations). Still later, if needed:

- Notifiarr / Recyclarr as Arr config status
- Autobrr filter hits feeding Downloads
- Helm chart beyond the Unraid/TrueNAS catalog notes

## Out of scope

- Full Jellyfin metadata editor or plugin store clone
- Full Arr quality-profile / indexer editors
- Recommendation engines that compete with Jellyfin plugins
- Multi-server Jellyfin farms before 1.2.9 is done
