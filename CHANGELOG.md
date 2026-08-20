# Changelog

Releases are generated automatically from Conventional Commits.

## 1.2.3

- Added Maintainerr as a supported 3rd party app integration with connection testing, status handling, summary fetching, and action endpoints.
- Added a dedicated Maintainerr page for viewing collections, scheduled cleanup items, upcoming actions, recent actions, storage, and service health.
- Added Maintainerr to home operations and home widgets with cleanup alerts, reclaimable-space visibility, and dashboard quick access.
- Added Maintainerr to navigation and routing for direct access from the main app shell.
- Renamed the Invites/Transcodes integrations area to `3rd party apps` to group Wizarr, Tdarr, and Maintainerr together more clearly.
- Improved integrations copy so Wizarr and Maintainerr errors now point users to the `3rd party apps` settings area.
- Added a test Maintainerr stack definition under `/srv/MAintaineer` for local integration testing on port `6246`.
