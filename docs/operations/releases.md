# Releases

JellyGlance uses Conventional Commits and semantic-release to keep versions, tags, changelog entries, and GitHub releases consistent.

## Commit Types

- `fix:` creates a patch release.
- `feat:` creates a minor release.
- `feat!:` creates a major release.
- `BREAKING CHANGE:` in the commit body also creates a major release.

## Release Flow

When changes land on `main`, the release workflow:

1. Installs dependencies with Node.js 22.
2. Runs semantic-release.
3. Creates or updates the GitHub release.
4. Creates the version tag.
5. Updates `CHANGELOG.md` when release notes change.

The Docker workflow publishes images for `main`, release tags, and commit SHAs.

## Local Checks

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
