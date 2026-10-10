version: 1.3.2
title: JellyGlance v1.3.2
---
<div align="center">

# JellyGlance

### v1.3.2

![Version](https://img.shields.io/badge/version-1.3.2-6366f1?style=flat-square)
![Fixes](https://img.shields.io/badge/fixes-2-22c55e?style=flat-square)
![New](https://img.shields.io/badge/new%20features-1-f59e0b?style=flat-square)

**JellyGlance is moving to a new Docker image. Please switch to `ghcr.io/jellyglance/server` as soon as you can.**

</div>

<br>

> [!IMPORTANT]
> **After v1.3.2, new releases will only be published to the JellyGlance/Server image.** The current `ghcr.io/nerdy-technician/jellyglance` image will stop getting updates, so switch now to keep receiving fixes and security patches. Your settings, database and history are untouched; only the image name changes.

<br>

## 🐳 Switch to the new image

**docker-compose:** change the `image:` line of the `jellyglance` service:

```yaml
    image: ghcr.io/jellyglance/server:latest
```

Then pull and restart:

```bash
docker compose pull jellyglance && docker compose up -d jellyglance
```

**docker run:** stop and remove the old container, then start it again with the new image and the same options you use today, for example:

```bash
docker pull ghcr.io/jellyglance/server:latest
docker stop jellyglance && docker rm jellyglance
docker run -d --name jellyglance --restart unless-stopped \
  -p 3000:3000 \
  -v ./config:/app/config \
  -v ./backups:/app/backups \
  -e POSTGRES_IP=jellyglance-db -e POSTGRES_PORT=5432 \
  -e POSTGRES_USER=postgres -e POSTGRES_PASSWORD=mypassword -e POSTGRES_DB=jellyglance \
  -e JWT_SECRET=your-existing-jwt-secret \
  ghcr.io/jellyglance/server:latest
```

**Building your own image?** Pass `--build-arg JG_IMAGE_REPO=<your image repo>` so Settings knows which image it is running. To hide the reminder entirely, set `JG_HIDE_IMAGE_NOTICE=true` on the container.

Keep your existing `JWT_SECRET` and database settings so you stay signed in and keep your data. Until you switch, **Settings** shows a reminder banner. You can dismiss it, but it comes back with each new version.

## 🔧 Fixed

| | |
|---|---|
| **Issue forms** | The bug report, feature, docs and integration request forms show up again on GitHub |
| **Fork pull requests** | Labels, assignments and bot comments now work on pull requests from forks |

<br>

## 📝 Changes

### 🚀 Features

- feat: notice and Settings banner for the move to the JellyGlance/Server image @Nerdy-Technician

### 🐛 Bug Fixes

- fix(templates): restore issue forms by quoting backtick labels @Nerdy-Technician (#206)
- ci: make PR metadata jobs work on fork pull requests @Nerdy-Technician (#207)

<br>

---

<div align="center">

**Full Changelog**: [`v1.3.1...v1.3.2`](https://github.com/Nerdy-Technician/JellyGlance/compare/v1.3.1...v1.3.2)

</div>
