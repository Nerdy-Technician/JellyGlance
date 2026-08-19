version: 1.2.3-beta.3
title: JellyGlance v1.2.3 Beta 3
---
# JellyGlance v1.2.3 Beta 3

## Release Summary

This beta introduces practical improvements around integrations and activity reporting.

### User-Facing Changes

- Added clearer webhook templating for events by showing placeholder hints for the selected event types.
- Added media automation and defaults support:
  - introduced SickChill as a TV automation option,
  - added a Media Server tab section to pick preferred default agents for TV, movies, and audio workflows,
  - improved how existing integrations are grouped and kept in the UI.
- Improved user avatar handling in the top navigation when user identity comes from JWT-backed sessions.
- Improved the Active Transcodes page behaviour by loading active jobs more consistently with cleaner live updates.
- Added richer playback and download webhook notifications when playback starts/ends and downloads are added/completed/failed.

Closes: #64, #50, #31
