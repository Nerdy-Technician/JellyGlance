version: 1.2.10
title: JellyGlance v1.2.10
---
<div align="center">

# JellyGlance

### v1.2.10

![Version](https://img.shields.io/badge/version-1.2.10-6366f1?style=flat-square)
![Fixes](https://img.shields.io/badge/fixes-3-22c55e?style=flat-square)
![New](https://img.shields.io/badge/new%20features-8-f59e0b?style=flat-square)

**Dashboards poll Glance for real data — scoped keys, compact widgets, and a kit you can copy.**

</div>

<br>

> **Note:** This release turns the token widget API into something Homarr and Homepage can actually display.
> **The big four this release:** compact GET payloads, widgets-only keys by default, a copy/download kit in Settings and docs, and Swagger for the Widgets tag.

<br>

## 🔑 API keys

| | |
|---|---|
| **Widgets-only by default** | New keys may GET widget routes only. Full keys keep the previous `/api` behaviour |
| **Existing keys stay full** | Older keys keep working until you change their scope |
| **Last used** | Each key shows when it last authenticated |

## 📡 Widget API

Compact JSON for Homarr, Homepage, and curl — sessions, now playing, catalog, storage, downloads, stalled items, calendar, requests, issues, Tdarr, Maintainerr, digest, Jellyfin jobs, newsletter, and more.

`GET /api/widgets/homepage` is the all-in-one snapshot. Dedicated `/api/widgets/...` routes are better one tile at a time. Live Seerr stays on `/api/widgets/requests` and `/api/widgets/issues` only.

Send the key as header `x-api-token`. Do not put it in a public iframe URL.

## 🧩 Homarr & Homepage kit

| | |
|---|---|
| **36 Homarr widgets** | Custom JSON you copy or download. After import, paste the Glance key as `x-api-token` — it is never stored in the file |
| **Homepage YAML** | 35 `customapi` services (item glance is Homarr-only) |
| **New tiles** | Now playing, repair, statistics, Seerr issues, newsletter, Jellyfin jobs |

## ⚙️ Settings & docs

| | |
|---|---|
| **Settings → API Key** | Grouped widget rows, filter, copy/download, last-used, and scope |
| **Swagger** | Open `/swagger-ui`, authorize with **apiKey** (`x-api-token`), and use the **Widgets** tag. `/swagger` still lands you in Settings |

<br>

<details>
<summary><b>🐛 Fixed</b> (3)</summary>
<br>

- Tdarr Homarr tiles read Online / Offline / Down as a status string instead of a boolean
- Failed Tdarr status fetches no longer render as an empty object
- Maintainerr widgets handle nested collection items

</details>

<details>
<summary><b>🔧 Changed</b> (4)</summary>
<br>

- New API keys default to widgets-only; existing keys remain full
- Homepage snapshot no longer calls live Seerr
- Settings no longer embeds Swagger in an iframe
- Widget kit layout in Settings and docs uses grouped icon rows instead of large cards

</details>

<br>

---

<div align="center">

**Full Changelog**: [`v1.2.9...v1.2.10`](https://github.com/Nerdy-Technician/JellyGlance/compare/v1.2.9...v1.2.10)

</div>
