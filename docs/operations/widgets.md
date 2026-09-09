---
title: Homepage widgets
description: Thirty API key widgets for Homepage and Homarr, including JSON you can import.
---

# Homepage and Homarr widgets

JellyGlance stays the command center. Homepage and Homarr poll compact JSON instead of scraping the UI.

Create a key in **Settings → API Key**. The same page can copy or download thirty Homarr widgets, a Homepage YAML pack, and a curl command. Homarr never puts the key in the export — paste it after import as header `x-api-token`.

Interactive docs live in the Glance app at **Settings → API Key**. Try widget routes with your session, or authorize Swagger with **apiKey** (`x-api-token`) and open the **Widgets** tag. The standalone spec UI is also at `/swagger-ui`. `/swagger` redirects there.

Do not put the key in a public iframe URL if the dashboard is on the internet. Prefer a LAN call from Homepage or Homarr.

<WidgetSnippets />

## Snapshot

`GET /api/widgets/homepage` is the all-in-one board. Dedicated routes below are better when you want one feature per tile.

```sh
curl -H "x-api-token: YOUR_KEY" http://jellyglance:3000/api/widgets/homepage
```

```json
{
  "jellyglance": true,
  "sessionsRecent": 0,
  "sessionsToday": 0,
  "sessionsDay": 0,
  "viewersToday": 0,
  "users": 12,
  "libraries": 4,
  "movies": 820,
  "shows": 140,
  "episodes": 4100,
  "addedWeek": 18,
  "downloads": 0,
  "downloadTotal": 0,
  "stalled": 0,
  "digest": 0,
  "digestOk": true,
  "storage": "5.2 TB",
  "storageBytes": 5717460464435,
  "invites": 0,
  "calendarUpcoming": 0,
  "calendarToday": 0,
  "autobrr": 0,
  "jellyfinOk": true,
  "jellyfinName": "Jellyfin",
  "jellyfinVersion": "10.10.7",
  "backupAt": null,
  "updatedAt": "2026-09-06T22:51:59.140Z"
}
```

| Field | Meaning |
| --- | --- |
| `sessionsRecent` | Playback rows in the last 15 minutes |
| `sessionsToday` | Playback rows since midnight |
| `sessionsDay` | Playback rows in the last 24 hours |
| `viewersToday` | Distinct users who played something today |
| `users` | Synced Jellyfin users |
| `libraries` / `movies` / `shows` / `episodes` | Catalog totals |
| `addedWeek` | Library items created in the last 7 days |
| `downloads` | Incomplete queue items |
| `downloadTotal` | All cached queue items |
| `stalled` | Failed, errored, or stalled downloads |
| `digest` | Ops items that need attention |
| `digestOk` | `true` when the digest is empty |
| `storage` / `storageBytes` | Sum of synced library file sizes |
| `invites` | Cached Wizarr invite rows |
| `calendarUpcoming` / `calendarToday` | Arr releases without a file |
| `autobrr` | Cached autobrr hits |
| `jellyfinOk` / `jellyfinName` / `jellyfinVersion` | Last-seen Jellyfin info |
| `backupAt` | Last backup hint from settings |

`GET /api/widgets` lists every token endpoint below.

## Homarr

1. Create a key in **Settings → API Key**.
2. Download a JSON from that page, or use the files under `/widgets/`.
3. In Homarr: **Management → Custom Widgets → Import**.
4. Edit the URL if Glance is not `http://jellyglance:3000`.
5. Paste the Glance API key. Auth type is already `apiKeyHeader` / `x-api-token`.

The JSON uses Homarr **Custom JSX** so each widget has a Glance header, colored stat cards, tables, or item lists. Homarr still owns the board chrome.

| Widget | File | Source |
| --- | --- | --- |
| Overview | [jellyglance-homarr.json](/widgets/jellyglance-homarr.json) | `/api/widgets/homepage` |
| Catalog | [jellyglance-homarr-catalog.json](/widgets/jellyglance-homarr-catalog.json) | `/api/widgets/catalog` |
| Storage | [jellyglance-homarr-storage.json](/widgets/jellyglance-homarr-storage.json) | `/api/widgets/storage` |
| Sessions | [jellyglance-homarr-sessions.json](/widgets/jellyglance-homarr-sessions.json) | `/api/widgets/sessions` |
| Viewers | [jellyglance-homarr-viewers.json](/widgets/jellyglance-homarr-viewers.json) | `/api/widgets/viewers` |
| Users | [jellyglance-homarr-users.json](/widgets/jellyglance-homarr-users.json) | `/api/widgets/users` |
| Activity | [jellyglance-homarr-activity.json](/widgets/jellyglance-homarr-activity.json) | `/api/widgets/activity` |
| Watch time | [jellyglance-homarr-watch.json](/widgets/jellyglance-homarr-watch.json) | `/api/widgets/watch` |
| Libraries | [jellyglance-homarr-libraries.json](/widgets/jellyglance-homarr-libraries.json) | `/api/widgets/libraries` |
| Recently added | [jellyglance-homarr-recent.json](/widgets/jellyglance-homarr-recent.json) | `/api/widgets/recent` |
| Item glance | [jellyglance-homarr-item.json](/widgets/jellyglance-homarr-item.json) | `/api/item-glance/ITEM_ID` |
| Downloads | [jellyglance-homarr-downloads.json](/widgets/jellyglance-homarr-downloads.json) | `/api/widgets/downloads` |
| Stalled | [jellyglance-homarr-stalled.json](/widgets/jellyglance-homarr-stalled.json) | `/api/widgets/stalled` |
| Queue list | [jellyglance-homarr-queue.json](/widgets/jellyglance-homarr-queue.json) | `/api/widgets/downloads` |
| Stitched queue | [jellyglance-homarr-stitched.json](/widgets/jellyglance-homarr-stitched.json) | `/api/widgets/stitched` |
| Calendar | [jellyglance-homarr-calendar.json](/widgets/jellyglance-homarr-calendar.json) | `/api/widgets/calendar` |
| Releases today | [jellyglance-homarr-today.json](/widgets/jellyglance-homarr-today.json) | `/api/widgets/today` |
| Requests | [jellyglance-homarr-requests.json](/widgets/jellyglance-homarr-requests.json) | `/api/widgets/requests` |
| Invites | [jellyglance-homarr-invites.json](/widgets/jellyglance-homarr-invites.json) | `/api/widgets/invites` |
| autobrr | [jellyglance-homarr-autobrr.json](/widgets/jellyglance-homarr-autobrr.json) | `/api/widgets/autobrr` |
| Transcodes | [jellyglance-homarr-transcodes.json](/widgets/jellyglance-homarr-transcodes.json) | `/api/widgets/transcodes` |
| Maintainerr | [jellyglance-homarr-maintainerr.json](/widgets/jellyglance-homarr-maintainerr.json) | `/api/widgets/maintainerr` |
| Automation | [jellyglance-homarr-automation.json](/widgets/jellyglance-homarr-automation.json) | `/api/widgets/automation` |
| Devices | [jellyglance-homarr-devices.json](/widgets/jellyglance-homarr-devices.json) | `/api/widgets/devices` |
| Health | [jellyglance-homarr-health.json](/widgets/jellyglance-homarr-health.json) | `/api/widgets/health` |
| Ops digest | [jellyglance-homarr-digest.json](/widgets/jellyglance-homarr-digest.json) | `/api/widgets/digest` |
| Jellyfin | [jellyglance-homarr-jellyfin.json](/widgets/jellyglance-homarr-jellyfin.json) | `/api/jellyfin/status` |
| Backup | [jellyglance-homarr-backup.json](/widgets/jellyglance-homarr-backup.json) | `/api/widgets/backup` |
| Webhooks | [jellyglance-homarr-webhooks.json](/widgets/jellyglance-homarr-webhooks.json) | `/api/widgets/webhooks` |
| Jobs | [jellyglance-homarr-jobs.json](/widgets/jellyglance-homarr-jobs.json) | `/api/widgets/jobs` |

After importing **Item glance**, replace `ITEM_ID` in the widget URL with a Jellyfin item id.

Disconnected integrations return zeros or empty lists. `GET /api/widgets/requests` is the only compact widget that calls Seerr live. The homepage snapshot does not.

## Homepage

Point `customapi` widgets at the compact URLs. Ready-made YAML with one service per widget: [jellyglance-homepage.yaml](/widgets/jellyglance-homepage.yaml).

The YAML sets the Glance logo and a `list` layout. Homepage still skins the widget; this is as far as `customapi` can go. Remap only works on the main field — pair a second value with `additionalField`.

```yaml
- JellyGlance:
    icon: https://jellyglance.com/project-logo.png
    href: http://jellyglance:3000
    description: Sessions, downloads, alerts, storage
    widget:
      type: customapi
      url: http://jellyglance:3000/api/widgets/homepage
      refreshInterval: 60000
      display: list
      headers:
        x-api-token: YOUR_JELLYGLANCE_API_KEY
      mappings:
        - field: storage
          label: Storage
          format: text
          additionalField:
            field: sessionsRecent
            format: number
            color: theme
        - field: downloads
          label: Downloads
          format: number
          additionalField:
            field: stalled
            format: number
            color: adaptive
        - field: digestOk
          label: Digest
          format: text
          remap:
            - value: true
              to: Clear
            - any: true
              to: Check Glance
          additionalField:
            field: digest
            format: number
            color: adaptive
```

## Other token endpoints

The same `x-api-token` header works on the rest of `/api`. Compact widget sources:

| Endpoint | Returns |
| --- | --- |
| `GET /settings/api-key` | In-app API explorer and Swagger UI |
| `GET /swagger-ui` | Standalone Swagger UI for the same token-auth routes |
| `GET /api/widgets` | Catalog of widget endpoints |
| `GET /api/widgets/homepage` | Combined dashboard snapshot |
| `GET /api/widgets/catalog` | `{ movies, shows, episodes, libraries, addedWeek }` |
| `GET /api/widgets/storage` | `{ totalLabel, upcomingCount, upcomingEstimate }` |
| `GET /api/widgets/sessions` | `{ recent, today, last24h, viewersToday, users }` |
| `GET /api/widgets/viewers` | `{ viewersToday, users, today }` |
| `GET /api/widgets/users` | `{ users, admins, activeToday, items[] }` |
| `GET /api/widgets/activity` | Latest playback rows |
| `GET /api/widgets/watch` | `{ hoursToday, hoursWeek, hoursAll }` |
| `GET /api/widgets/recent` | Newest library titles |
| `GET /api/widgets/libraries` | `{ totalLabel, libraries[] }` |
| `GET /api/widgets/downloads` | `{ active, stalled, total, items[] }` |
| `GET /api/widgets/stalled` | Stalled queue items |
| `GET /api/widgets/stitched` | Cached queue with client names |
| `GET /api/widgets/calendar` | `{ upcoming, today, estimate, items[] }` |
| `GET /api/widgets/today` | Arr releases due today |
| `GET /api/widgets/requests` | Seerr `{ pending, approved, available, items[] }` |
| `GET /api/widgets/invites` | Cached Wizarr links |
| `GET /api/widgets/autobrr` | Cached autobrr hits |
| `GET /api/widgets/transcodes` | Tdarr connection and last health check |
| `GET /api/widgets/maintainerr` | Maintainerr connection and last health check |
| `GET /api/widgets/automation` | Latest integration health results |
| `GET /api/widgets/devices` | Known Jellyfin clients |
| `GET /api/widgets/health` | Digest plus a live Jellyfin ping |
| `GET /api/widgets/digest` | Ops items that need attention |
| `GET /api/widgets/backup` | Last backup hint |
| `GET /api/widgets/webhooks` | Recent webhook deliveries |
| `GET /api/widgets/jobs` | Latest Glance task runs |
| `GET /api/ops-digest` | `{ ok, count, items[] }` |
| `GET /api/library-storage` | Per-library bytes plus `totalLabel` |
| `GET /api/downloads/stitched` | Queue items matched to Seerr requests |
| `GET /api/jellyfin/status` | Live Jellyfin reachability and version |
| `GET /api/item-glance/:id` | One Jellyfin title correlated with Seerr, Arr, and downloads |

Related item-level correlation lives on `GET /api/item-glance/:jellyfinId` (session cookie or the same API token).
