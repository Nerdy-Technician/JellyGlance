version: v1.2.5
title: JellyGlance v1.2.5
---
fix: improve Tdarr queue, history, and refresh reliability

Fixed
- Tdarr queued cards now use the paged client search data used by the Tdarr UI instead of exposing only aggregate queue counts
- Tdarr active, queued, and history response mapping keeps worker progress, queue rows, history rows, and summary counts in the correct views
- Tdarr history cards now retain media names, Jellyfin posters and backdrops, source formats, finished formats, size changes, and saved space
- Tdarr refreshes no longer wait on the slow full database dump or blocking job-report lookups
- Tdarr slow or unavailable optional endpoints no longer prevent active, queued, and history data from rendering
- Active Tdarr transcode posters and backdrops now remain matched during live polling refreshes
