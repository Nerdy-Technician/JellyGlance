version: 1.2.11
title: JellyGlance v1.2.11
---
<div align="center">

# JellyGlance

### v1.2.11

![Version](https://img.shields.io/badge/version-1.2.11-6366f1?style=flat-square)
![Fixes](https://img.shields.io/badge/fixes-3-22c55e?style=flat-square)
![New](https://img.shields.io/badge/new%20features-4-f59e0b?style=flat-square)

**A hardening release: tighter security, easier installs, and docs with a home of their own.**

</div>

<br>

> **Note:** This release is mostly under the hood. The API has been hardened against every medium, high, and critical CodeQL finding, sign-in tokens now expire, and JellyGlance ships ready-made Unraid and Proxmox installs.
> **Before you upgrade:** local accounts still using the old unsalted SHA3 password hash can no longer sign in. Reset those passwords (or re-run setup) so they are saved with scrypt.

<br>

## 🔐 Security

| | |
|---|---|
| **CodeQL clean-up** | Closed the open server-side request forgery, auth bypass, remote property injection, and weak password hash alerts |
| **Safe outbound HTTP** | Integration, download client, proxy, and GeoLite requests all go through one sanitised HTTP helper |
| **Passwords** | scrypt only. The legacy SHA3 verify path has been removed |
| **Sign-in tokens** | JWTs are signed with HS256 and expire (12 hours for sessions, 1 hour for setup) |
| **Rate limiting** | Static file and SPA handlers are now rate limited |
| **Supply chain** | GitHub Actions pinned to commit SHAs, Docker Node bases pinned to digests, and a `SECURITY.md` policy |

## 📦 Install anywhere

| | |
|---|---|
| **Unraid** | Community Apps templates for JellyGlance and its database, plus a Compose file |
| **Proxmox** | Scripts to create an LXC container and install JellyGlance inside it |
| **Nightly image** | A `nightly` GHCR image is built from `main` for anyone who wants the latest changes early |
| **Node 25** | Images run Node 25 on amd64 and arm64. arm/v7 stays on Node 22 |

## 📚 Documentation

The docs now live in their own repository, [JellyGlance/Documentation](https://github.com/JellyGlance/Documentation), and are published at [jellyglance.com](https://jellyglance.com). The main image no longer builds or bundles them.

## 🤖 Maintenance

Dependency updates now come from Renovate running as the JellyGlance Security Bot instead of Dependabot, so update PRs can run the full CI. This release also includes MUI 9, ESLint 10, Vite 8, CodeQL v4, and the latest GitHub Actions.

<br>

<details>
<summary><b>🐛 Fixed</b> (3)</summary>
<br>

- Discord star digests resolve stargazers through GraphQL and use a dedicated token
- The welcome bot uses the correct first-interaction inputs
- `npm ci` works again on npm 10 after the ESLint 10 upgrade

</details>

<details>
<summary><b>🔧 Changed</b> (4)</summary>
<br>

- Legacy SHA3 password hashes are no longer accepted
- Sign-in sessions expire after 12 hours
- Documentation moved to a separate repository
- Dependabot replaced by Renovate

</details>

<br>

## 📝 Changes

### 🔐 Security

- chore(deps): replace Dependabot with Renovate via Security Bot, apply open dependency updates @Nerdy-Technician (#138)
- chore(deps): bump actions/checkout from 4.4.0 to 7.0.1 @dependabot[bot] (#135)
- chore(deps): bump github/codeql-action/upload-sarif from 3.38.1 to 4.38.1 @dependabot[bot] (#125)
- ci: clear Scorecard pinned-deps flood and related hygiene @Nerdy-Technician (#117)
- Harden API against CodeQL medium/high/critical findings @Nerdy-Technician (#116)
- chore(deps): bump actions/upload-artifact from 4 to 7 @dependabot[bot] (#112)
- chore(deps): bump google/osv-scanner-action from 2.0.1 to 2.6.0 @dependabot[bot] (#111)
- ci: Discord digests, security automation, and repo triage bots @Nerdy-Technician (#106)

### 🐳 Docker / Deploy

- ci: clear Scorecard pinned-deps flood and related hygiene @Nerdy-Technician (#117)
- chore(deps): bump node from 22-bookworm-slim to 25-bookworm-slim @dependabot[bot] (#110)

### 🧰 Maintenance

- chore(deps): replace Dependabot with Renovate via Security Bot, apply open dependency updates @Nerdy-Technician (#138)
- chore(deps): bump the production-dependencies group with 3 updates @dependabot[bot] (#136)
- chore(deps): bump actions/checkout from 4.4.0 to 7.0.1 @dependabot[bot] (#135)
- chore(deps): bump @mui/material from 6.5.0 to 9.4.0 in the production-dependencies group @dependabot[bot] (#134)
- chore(deps): bump actions/configure-pages from 5.0.0 to 6.0.0 @dependabot[bot] (#132)
- chore(deps): bump actions/cache/save from 4.3.0 to 6.1.0 @dependabot[bot] (#131)
- chore(deps): bump the production-dependencies group with 2 updates @dependabot[bot] (#129)
- chore(deps): bump the production-dependencies group with 2 updates @dependabot[bot] (#124)
- chore(deps): bump actions/github-script from 7.1.0 to 9.0.0 @dependabot[bot] (#128)
- chore(deps): bump github/codeql-action/upload-sarif from 3.38.1 to 4.38.1 @dependabot[bot] (#125)
- chore(deps): bump actions/cache/restore from 4.3.0 to 6.1.0 @dependabot[bot] (#126)
- chore(deps): bump actions/setup-node from 4.4.0 to 7.0.0 @dependabot[bot] (#127)
- chore(deps): bump docker/setup-qemu-action from 3.7.0 to 4.4.0 @dependabot[bot] (#119)
- chore(deps): bump actions/stale from 9.1.0 to 11.0.0 @dependabot[bot] (#120)
- chore(deps): bump docker/login-action from 3.7.0 to 4.6.0 @dependabot[bot] (#121)
- chore(deps): bump the production-dependencies group with 4 updates @dependabot[bot] (#118)
- chore(deps): bump docker/metadata-action from 5.10.0 to 6.2.0 @dependabot[bot] (#122)
- ci: clear Scorecard pinned-deps flood and related hygiene @Nerdy-Technician (#117)
- Harden API against CodeQL medium/high/critical findings @Nerdy-Technician (#116)
- chore(deps): bump the production-dependencies group with 7 updates @dependabot[bot] (#114)
- chore(deps): bump node from 22-bookworm-slim to 25-bookworm-slim @dependabot[bot] (#110)
- chore(deps): bump release-drafter/release-drafter from 6 to 7 @dependabot[bot] (#113)
- chore(deps): bump actions/upload-artifact from 4 to 7 @dependabot[bot] (#112)
- chore(deps): bump google/osv-scanner-action from 2.0.1 to 2.6.0 @dependabot[bot] (#111)
- chore(deps): bump actions/first-interaction from 1 to 3 @dependabot[bot] (#109)
- chore(deps): bump actions/labeler from 5 to 7 @dependabot[bot] (#108)
- ci: Discord digests, security automation, and repo triage bots @Nerdy-Technician (#106)
- chore(deps): bump the production-dependencies group with 8 updates @dependabot[bot] (#104)

<br>

---

<div align="center">

**Full Changelog**: [`v1.2.10...v1.2.11`](https://github.com/Nerdy-Technician/JellyGlance/compare/v1.2.10...v1.2.11)

</div>
