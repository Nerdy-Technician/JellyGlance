version: v1.2.4
title: JellyGlance v1.2.4
---
feat: ship Maintainerr support and refresh 3rd party apps for v1.2.3

Added
- Wizarr invite management inside JellyGlance for creating, copying, opening, and managing invites
- Tdarr transcode support with active, queued, and history views
- Maintainerr integration support with connection testing, status handling, summary fetching, and cleanup action endpoints
- SickChill support as a Sonarr alternative for series automation
- Dedicated Maintainerr dashboard page with collections, scheduled cleanup items, upcoming actions, recent actions, storage details, and service health
- Maintainerr home widgets and operations alerts for health issues, scheduled actions, upcoming actions, failed collections, and reclaimable storage
- Custom kiosk settings for title, density, theme, visible widgets, widget sizes, and widget ordering
- Collapsible Settings sidebar navigation for quicker section browsing
- Profile font weight options for tuning interface weight
- User visibility controls for hiding selected users from stats and activity when needed
- Active Sessions privacy controls for choosing where JellyGlance hides viewer IP addresses in session cards and details

Changed
- Improved Hall of Fame styling and widget order customisation on Home and Kiosk layouts
- Improved Requests with richer media display, newer request features, and more advanced management controls
- Redesigned `/activity` for cleaner browsing and upgraded `/statistics` for clearer summaries and better presentation
- Updated the profile modal and moved logout into the profile modal flow
- Improved list options in Libraries and overhauled Users for a cleaner, more flexible UI
- Added clearer Active Sessions privacy settings so IP visibility can be controlled where needed

Fixed
- Improved dashboard visibility for cleanup activity so Maintainerr signals surface in Home and operations views more consistently
- Tightened integration messaging around 3rd party app setup paths for clearer recovery when a service is not configured correctly
