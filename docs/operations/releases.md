# Releases

JellyGlance releases are driven by a version file on `main` or `BETA`. The Release Bot pipeline bumps package versions, builds the app, publishes the Docker image to GHCR, creates the git tag, and opens the GitHub release.

<CurrentRelease />

<LatestReleaseNotes />

## How to cut a release

1. Update `.github/release.md` (stable) or `.github/release-beta.md` (beta):

```md
version: v1.2.8
title: JellyGlance v1.2.8
---
feat: short summary for the release

Added
- ...

Fixed
- ...
```

2. Push that file change to `main` (or `BETA`).
3. The **JellyGlance Release Bot** workflow:
   - Reads the version from the release file
   - Bumps root and workspace `package.json` / `package-lock.json`
   - Runs lint and builds (web + docs)
   - Commits `chore(release): vX.Y.Z [skip ci]` back to the branch
   - Builds and pushes multi-arch Docker images
   - Creates the annotated tag and GitHub release
   - Optionally posts to Discord

## Commit message conventions

Release notes in the file can use Conventional Commit style for clarity:

- `fix:` — bug fixes and stability
- `feat:` — new features
- `feat!:` / `BREAKING CHANGE:` — major changes

The file-driven pipeline does **not** auto-increment from commits; the version in `.github/release.md` is the source of truth.

## Manual semantic-release

`Release / Manual` (`npm run release` + `.releaserc.json`) remains available for maintainers who want commit-analyzer driven releases. Prefer the file-driven Release Bot for normal stable/beta ships.

## Local checks

Run these before merging release-bound changes:

```sh
npm run lint
npm run build
npm run build:docs
```

## Repository

Project releases live at:

```text
https://github.com/Nerdy-Technician/JellyGlance/releases
```
