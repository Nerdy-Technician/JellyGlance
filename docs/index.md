---
layout: home

hero:
  name: JellyGlance
  text: Jellyfin admin, without the tab juggling.
  tagline: A self-hosted dashboard for live sessions, libraries, users, requests, downloads, Jellyfin jobs, health checks, backups, imports, newsletters, and webhooks.
  image:
    src: /full-logo-transparent.png
    alt: JellyGlance
  actions:
    - theme: brand
      text: Get Started
      link: /guide/getting-started
    - theme: alt
      text: Docker Deploy
      link: /operations/docker
    - theme: alt
      text: Screenshots
      link: /guide/screenshots
    - theme: alt
      text: Current Release
      link: https://github.com/Nerdy-Technician/JellyGlance/releases/latest
      release: true
    - theme: alt
      text: GitHub
      link: https://github.com/Nerdy-Technician/JellyGlance

features:
  - title: Live Playback
    details: See who is watching, from where, on which client, with direct play, stream, transcode, bitrate, subtitle, audio, and progress details.
  - title: Library Insight
    details: Review library totals, recent additions, search and switch library views, scan individual libraries, and spot metadata gaps.
  - title: Request Management
    details: Bring Jellyseerr and Overseerr requests into JellyGlance with poster cards, filters, source badges, request status, and quick actions.
  - title: Download Awareness
    details: Connect torrent and Usenet clients for queue visibility, progress, stalled items, and integration health without showing empty download pages.
  - title: Jellyfin Jobs
    details: Admins can view Jellyfin scheduled jobs, check last run state, filter by category, and start jobs manually from JellyGlance.
  - title: Operations Tools
    details: Manage tasks, logs, backups, API keys, webhooks, imports, newsletters, health checks, authorised devices, plugins, and repair workflows.
---

## Built For Daily Server Checks

JellyGlance is not trying to replace Jellyfin. It sits beside it and gathers the routine admin checks into one interface: active sessions, recent library changes, playback history, request queues, download queues, sync jobs, health signals, and operational logs.

<div class="home-surface-grid">
  <section>
    <span>Now</span>
    <h2>Playback that is easy to scan.</h2>
    <p>Open JellyGlance and immediately see current viewers, playback method, device, client, title, runtime progress, and transcode state.</p>
  </section>
  <section>
    <span>Next</span>
    <h2>Requests and downloads only when useful.</h2>
    <p>Requests and Downloads disappear from navigation until Jellyseerr, Overseerr, or a download client is configured, keeping clean installs calm.</p>
  </section>
  <section>
    <span>Admin</span>
    <h2>Jellyfin jobs have their own place.</h2>
    <p>Admins get a dedicated Jellyfin Jobs page for scheduled task status and manual task runs, separate from general JellyGlance settings.</p>
  </section>
  <section>
    <span>History</span>
    <h2>Activity, logs, imports, and release notes.</h2>
    <p>Review watch history, job logs, imported legacy history, About-page release notes, and the operational context behind the dashboard.</p>
  </section>
</div>

## What You Can Connect

<div class="home-integration-strip">
  <img src="/icons/selfhst/jellyfin.svg" alt="Jellyfin" />
  <img src="/icons/selfhst/sonarr.svg" alt="Sonarr" />
  <img src="/icons/selfhst/radarr.svg" alt="Radarr" />
  <img src="/icons/selfhst/lidarr.svg" alt="Lidarr" />
  <img src="/icons/selfhst/bazarr.svg" alt="Bazarr" />
  <img src="/icons/selfhst/qbittorrent.svg" alt="qBittorrent" />
  <img src="/icons/selfhst/transmission.svg" alt="Transmission" />
  <img src="/icons/selfhst/deluge.svg" alt="Deluge" />
  <img src="/icons/selfhst/sabnzbd.svg" alt="SABnzbd" />
  <img src="/icons/selfhst/nzbget.svg" alt="NZBGet" />
</div>

JellyGlance supports Jellyfin, Jellyseerr, Overseerr, Sonarr, Radarr, Lidarr, Bazarr, qBittorrent, Transmission, Deluge, SABnzbd, NZBGet, Gotify, Discord webhooks, Tautulli imports, and Jellystat imports.

## Admin Surfaces

| Area | What It Helps With |
| --- | --- |
| Home | Reorder dashboard sections, pin important panels, tune density, use kiosk mode, and surface attention counts. |
| Activity | Search, filter, and review Jellyfin playback history with readable stream method, client, duration, and play counts. |
| Libraries | Search libraries, choose grid/list view, scan a library, and optionally hide names when artwork already carries them. |
| Jellyfin Jobs | View Jellyfin scheduled jobs, filter by category, inspect last run state, and manually start jobs as an admin. |
| Settings | Configure security, integrations, tasks, libraries, API keys, webhooks, notifications, backups, imports, health, repair, logs, devices, and plugins. |
| About | Check the installed version, update state, project links, and release notes with beta/stable filtering. |

## Current Focus

<div class="home-release-panel">
  <div>
    <span>Latest work</span>
    <h2>Cleaner admin control surfaces after 1.2.0.</h2>
    <p>The current branch focuses on Jellyfin Jobs, authorised devices, installed plugins, release-note visibility, reduced notification noise, smarter navigation, better dark-mode tables, and backend security hardening.</p>
  </div>
  <ul>
    <li>Admin-only Jellyfin Jobs page and API actions.</li>
    <li>Settings tabs for Authorised Devices and Plugins.</li>
    <li>Hidden Requests/Downloads nav until integrations exist.</li>
    <li>Better Activity and Logs readability.</li>
    <li>Translation sync tooling and Dependabot coverage.</li>
  </ul>
</div>

## Screens At A Glance

<div class="home-screenshot-strip">
  <a href="/guide/screenshots">
    <img src="/screenshots/Home.png" alt="JellyGlance home dashboard screenshot" />
    <span>Home dashboard</span>
  </a>
  <a href="/guide/screenshots">
    <img src="/screenshots/Activity.png" alt="JellyGlance activity screenshot" />
    <span>Activity history</span>
  </a>
  <a href="/guide/screenshots">
    <img src="/screenshots/Settings.png" alt="JellyGlance settings screenshot" />
    <span>Settings center</span>
  </a>
</div>

See the full interface tour in the [screenshots gallery](/guide/screenshots), or jump straight into [Docker deployment](/operations/docker).
