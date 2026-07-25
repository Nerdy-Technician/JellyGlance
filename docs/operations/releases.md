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

## Discord Release And Star Posts

JellyGlance can post project updates to different Discord channels by using separate Discord webhook secrets:

| Secret | Used For |
| --- | --- |
| `DISCORD_RELEASES_WEBHOOK` | Posts new JellyGlance release announcements. |
| `DISCORD_STARS_WEBHOOK` | Posts GitHub star growth updates. |

Create one Discord webhook per channel, then add the webhook URLs under **GitHub repository settings > Secrets and variables > Actions > Repository secrets**.

Release announcements are sent by the release workflow after a GitHub release is created. A separate `Discord Release Notifications` workflow also supports manual re-posting for a specific tag.

Star updates run every 5 minutes through `Discord Star Notifications`. The workflow stores the last posted count in the GitHub Actions cache, then posts only when the current GitHub star count increases. When GitHub exposes the newest stargazer data, the Discord post includes the user who starred the project.

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
