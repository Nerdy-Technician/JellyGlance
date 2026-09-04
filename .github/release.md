version: 1.2.9
title: JellyGlance v1.2.9
---
<div align="center">

# JellyGlance

### v1.2.9

![Version](https://img.shields.io/badge/version-1.2.9-6366f1?style=flat-square)
![Fixes](https://img.shields.io/badge/fixes-6-22c55e?style=flat-square)
![New](https://img.shields.io/badge/new%20features-22-f59e0b?style=flat-square)

**Finishing the stack you already show — queues, sessions, glance, ops, and themes.**

</div>

<br>

> **Note:** This release focuses on enhancing the core functionality and user experience across downloads, sessions, home, and themes.
> **The big four this release:** every download client now has full queue control, sessions get a real command bar, Home shows live stream capacity, and themes sync to your account across devices.

<br>

## ⬇️ Downloads

| | |
|---|---|
| **Full queue parity** | Transmission, Deluge, NZBGet, and rTorrent join qBittorrent/SABnzbd — add, pause, remove |
| **"Why stalled?"** | No peers, client error, or stalled time — shown on the queue and Home ops |
| **autobrr hits** | Filter matches now surface on the Downloads page |
| **One-click retry** | Retry a failed webhook delivery from Health, or a failed Arr/Seerr grab from Item Glance, Requests, or Downloads |

## ▶️ Sessions & Playback

| | |
|---|---|
| **Session command bar** | Stop playback, push a Jellyfin on-screen message, and see *why* a stream is transcoding |
| **Repair Hub** | New playback-quality repair flow for clients stuck transcoding and titles that won't start |
| **Item pages** | Watching-now chip, refresh item / scan libraries, and Open in Jellyfin |

## 🏠 Home & Glance

| | |
|---|---|
| **Stream capacity widget** | Concurrent vs. cap, transcode vs. direct play, over-limit alerts — right on Home |
| **Ops digest** | Live Jellyfin jobs, library storage size, Arr upcoming-size estimate |
| **Item Glance / My Glance** | One view pulling Jellyfin + Seerr + Arr + downloads + Tdarr + Maintainerr; a lighter cut for viewers |
| **Activity Timeline** | Now in the main nav — Calendar stays hidden until Sonarr, Radarr, or Lidarr is connected |
| **Offline banner** | Persistent nav banner when Jellyfin's unreachable, with last-seen version |

## 🔌 Integrations

`Readarr` on the Arr calendar · `Homepage`/`Homarr` JSON widgets · `Unpackerr` + `Kometa` health pings · `Notifiarr` + `Recyclarr` health-only · `SickChill` stays connect/health only

## 🔔 Notifications

- **ntfy, Telegram, Pushover** join Discord and Gotify as webhook targets
- **Quiet hours** for webhooks, with an optional morning playback digest
- **Discord cards** wrap long titles on a tighter canvas instead of clipping

## ⚙️ Settings

| | |
|---|---|
| **Jellyfin job schedules** | Set daily, weekly, interval, or startup times for Jellyfin library scans, metadata, and other scheduled jobs. The Jellyfin Jobs page shows those times and still lets you run a job now |
| **Quick Connect** | Login starts the Jellyfin approval flow as soon as the page is ready |

## 🎨 Themes & App

- **Searchable theme picker**, grouped palettes — preview freely, hit **Apply** to sync it to your account across devices
- **Installable PWA** for phone and kiosk home screens

## ☁️ Backup

- **S3-compatible backup copy (SigV4)**, alongside WebDAV/HTTP

<br>

<details>
<summary><b>🐛 Fixed</b> (6)</summary>
<br>

- Changing language no longer posts External URL and fails with *"Error Updating Configuration: undefined"*
- Requests status filters no longer break the Vite build
- Downloads no longer black-screens from a missing integrations import
- Settings and navbar no longer crash on missing remixicon imports after the theme picker work
- Users no longer drops Jellyfin server administrators from the activity list
- Tdarr Active Transcodes no longer shows `[object Object]` for format, status, or reason

</details>

<details>
<summary><b>🔧 Changed</b> (4)</summary>
<br>

- Theme choice is preview-only in Settings and the account menu until Apply; Apply writes locally and syncs to the signed-in user
- i18n catch-up for Requests, Repair Hub, My Glance, Command Center, newsletter, and newer ops copy
- Discord playback and status images use a smaller wrapped card
- Desktop pages no longer look zoomed or soft; type, spacing, and the sidebar stay sharp and a bit denser

</details>

<br>

---

<div align="center">

**Full Changelog**: [`v1.2.8...v1.2.9`](https://github.com/Nerdy-Technician/JellyGlance/compare/v1.2.8...v1.2.9)

</div>