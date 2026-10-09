version: 1.3.1
title: JellyGlance v1.3.1
---
<div align="center">

# JellyGlance

### v1.3.1

![Version](https://img.shields.io/badge/version-1.3.1-6366f1?style=flat-square)
![Fixes](https://img.shields.io/badge/fixes-4-22c55e?style=flat-square)
![New](https://img.shields.io/badge/new%20features-0-f59e0b?style=flat-square)

**A small security and maintenance release: patched dependencies, a fresh Node base image, and tidier project automation.**

</div>

<br>

> **Note:** There are no new features or database changes in this release. Pull the new image and restart as usual. Your settings and history are untouched.

<br>

## 🔐 Security

| | |
|---|---|
| **proxy-addr and sharp** | proxy-addr updated to 2.0.8 and sharp to 0.35.5, fixing a reported CVE |
| **source-map-js** | Updated to 1.2.2 |
| **shell-quote** | Pinned to 1.12.0 through an override |
| **Security alerts** | Every open security alert now gets its own tracking issue, so none get missed |

## 🐳 Docker

| | |
|---|---|
| **Node base image** | The Node 24 base image has been updated to the latest digest |

## 🤖 Maintenance

The JellyGlance Bot now has its own branding and sends more Discord notifications, and greets new PRs and issues with a branded welcome. Renovate now runs as soon as a Dependency Dashboard box is ticked. This release also includes @mui/icons-material 9.5.0, ESLint 10.12.0, js-yaml 5.4.3, CodeQL v4.38.3, setup-node v7.1.0 and the latest development dependencies.

<br>

<details>
<summary><b>🐛 Fixed</b> (4)</summary>
<br>

- proxy-addr and sharp updated to patched versions (#186)
- source-map-js updated to 1.2.2 (#187)
- A stale nested copy of Vite 8.3.0 was removed from the lockfile (#194)
- The lockfile is back in sync after the ESLint 10.12.0 update

</details>

<br>

## 📝 Changes

### 🔐 Security

- fix(deps): bump proxy-addr to 2.0.8 and sharp to 0.35.5 @Nerdy-Technician (#186)
- fix(deps): bump source-map-js to 1.2.2 @Nerdy-Technician (#187)
- feat(security): open an issue for each open security alert @Nerdy-Technician (#192)
- chore(deps): update github/codeql-action action to v4.38.3 @jellyglance-security-bot[bot] (#200)
- chore(deps): update actions/upload-artifact digest to cf430e0 @jellyglance-security-bot[bot] (#196)

### 🐳 Docker / Deploy

- chore(deps): update node.js to d6aa754 @jellyglance-security-bot[bot] (#183)
- chore(deps): update node.js to c3de60b @jellyglance-security-bot[bot] (#182)

### 🧰 Maintenance

- chore(deps): update dependency @mui/icons-material to v9.5.0 @jellyglance-security-bot[bot] (#202)
- chore(deps-dev): update development-dependencies @jellyglance-security-bot[bot] (#198)
- chore(deps): update actions/setup-node action to v7.1.0 @jellyglance-security-bot[bot] (#201)
- chore(deps): update release-drafter/release-drafter digest to 978bb0b @jellyglance-security-bot[bot] (#197)
- fix(deps): drop stale nested vite 8.3.0 from the lockfile @Nerdy-Technician (#194)
- feat(discord): JellyGlance Bot branding and more notifications @Nerdy-Technician (#195)
- feat(welcome): branded JellyGlance Bot welcome for new PRs and issues @Nerdy-Technician (#193)
- fix(renovate): run when a Dependency Dashboard checkbox is ticked @Nerdy-Technician (#191)
- chore(deps): update dependency eslint to v10.12.0 @jellyglance-security-bot[bot] (#180)
- chore(deps): update dependency js-yaml to v5.4.3 @jellyglance-security-bot[bot] (#184)
- chore(deps-dev): update development-dependencies @jellyglance-security-bot[bot] (#188)
- chore(deps): update renovatebot/github-action action to v46.3.7 @jellyglance-security-bot[bot] (#181)

<br>

---

<div align="center">

**Full Changelog**: [`v1.3.0...v1.3.1`](https://github.com/Nerdy-Technician/JellyGlance/compare/v1.3.0...v1.3.1)

</div>
