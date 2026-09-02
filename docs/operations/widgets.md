---
title: Homepage widgets
description: Use a JellyGlance API key as a Homepage or Homarr data source.
---

# Homepage and Homarr widgets

JellyGlance stays the command center. Homepage and Homarr can show a compact JSON snapshot instead of scraping the UI.

## Auth

Create a key in **Settings → API Key**. Send it as `x-api-token` (same as the rest of `/api`).

Do not put the key in a public iframe URL if the dashboard is on the internet. Prefer a server-side Homepage widget that calls Glance on the LAN.

## Endpoint

`GET /api/widgets/homepage`

Example:

```sh
curl -H "x-api-token: YOUR_KEY" http://jellyglance:3000/api/widgets/homepage
```

Response shape:

```json
{
  "jellyglance": true,
  "sessionsRecent": 2,
  "downloads": 1,
  "digest": 0,
  "storage": "12.4 TB",
  "updatedAt": "2026-09-02T18:00:00.000Z"
}
```

| Field | Meaning |
| --- | --- |
| `sessionsRecent` | Playback rows in the last 15 minutes |
| `downloads` | Incomplete queue items |
| `digest` | Ops items that need attention |
| `storage` | Sum of synced library file sizes |

## Homepage customapi sketch

Point a `customapi` widget at that URL with header `x-api-token`. Map `downloads`, `digest`, and `storage` to fields. Glance does not ship a Homarr plugin; the JSON is the contract.

Related item-level correlation lives on `GET /api/item-glance/:jellyfinId` (session cookie or the same API token).
