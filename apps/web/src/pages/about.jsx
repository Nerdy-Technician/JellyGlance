import { useEffect, useState } from "react";
import axios from "../lib/axios_instance";

import "./css/about.css";
import ArchiveLineIcon from "remixicon-react/ArchiveLineIcon";
import ArrowDownSLineIcon from "remixicon-react/ArrowDownSLineIcon";
import CheckLineIcon from "remixicon-react/CheckLineIcon";
import Database2LineIcon from "remixicon-react/Database2LineIcon";
import DownloadCloud2LineIcon from "remixicon-react/DownloadCloud2LineIcon";
import FilmLineIcon from "remixicon-react/FilmLineIcon";
import GitBranchLineIcon from "remixicon-react/GitBranchLineIcon";
import GithubFillIcon from "remixicon-react/GithubFillIcon";
import HeartPulseLineIcon from "remixicon-react/HeartPulseLineIcon";
import LayoutGridLineIcon from "remixicon-react/LayoutGridLineIcon";
import PulseLineIcon from "remixicon-react/PulseLineIcon";
import PriceTag3LineIcon from "remixicon-react/PriceTag3LineIcon";
import RadarLineIcon from "remixicon-react/RadarLineIcon";
import Settings3LineIcon from "remixicon-react/Settings3LineIcon";
import ShieldCheckLineIcon from "remixicon-react/ShieldCheckLineIcon";
import TaskLineIcon from "remixicon-react/TaskLineIcon";
import TimerFlashLineIcon from "remixicon-react/TimerFlashLineIcon";

function stripMarkdown(value) {
  return String(value || "")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/[`*_~>#]/g, "")
    .trim();
}

function formatReleaseDate(value) {
  if (!value) return "";
  try {
    return new Intl.DateTimeFormat(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
    }).format(new Date(value));
  } catch {
    return "";
  }
}

function parseReleaseBody(body) {
  const sections = [];
  let current = { title: "Changes", items: [] };

  String(body || "")
    .split("\n")
    .map((line) => line.trim())
    .forEach((line) => {
      if (!line || /^<!--/.test(line)) return;

      const heading = line.match(/^#{2,6}\s+(.+)/);
      if (heading) {
        if (current.items.length) sections.push(current);
        current = { title: stripMarkdown(heading[1]), items: [] };
        return;
      }

      const bullet = line.match(/^[-*]\s+(.+)/);
      const numbered = line.match(/^\d+\.\s+(.+)/);
      const text = stripMarkdown(bullet?.[1] || numbered?.[1] || line);

      if (text && !/^full changelog/i.test(text)) {
        current.items.push(text);
      }
    });

  if (current.items.length) sections.push(current);
  return sections.length ? sections : [{ title: "Notes", items: ["No release notes were provided for this version."] }];
}

function isBotContributor(contributor) {
  const login = String(contributor?.login || "").toLowerCase();
  return /\bbot\b/.test(login) || login.includes("[bot]") || login.includes("dependabot") || login.includes("github-actions");
}

const PROJECT_OWNER_LOGIN = "Nerdy-Technician";
const PROJECT_OWNER_FALLBACK = {
  id: "project-owner",
  login: PROJECT_OWNER_LOGIN,
  avatar_url: `https://github.com/${PROJECT_OWNER_LOGIN}.png?size=160`,
  profile_url: `https://github.com/${PROJECT_OWNER_LOGIN}`,
  contributions: 0,
};

export default function SettingsAbout() {
  const token = localStorage.getItem("token");
  const [data, setData] = useState({
    current_version: "0.1.0",
    message: "Version check pending",
    update_available: false,
  });
  const [releaseData, setReleaseData] = useState({ releases: [], releases_url: "" });
  const [releaseMessage, setReleaseMessage] = useState("Loading release notes...");
  const [selectedReleaseId, setSelectedReleaseId] = useState("");
  const [releaseMenuOpen, setReleaseMenuOpen] = useState(false);
  const [contributors, setContributors] = useState([]);
  const [contributorsMessage, setContributorsMessage] = useState("Loading GitHub profiles...");
  const updateMessage = data.message === "JellyGlance is up to date" ? "Up to date" : data.message;
  const selectedRelease = releaseData.releases.find((release) => String(release.id) === selectedReleaseId) || releaseData.releases[0];
  const selectedReleaseSections = parseReleaseBody(selectedRelease?.body);
  const projectOwner = contributors.find((contributor) => contributor.login?.toLowerCase() === PROJECT_OWNER_LOGIN.toLowerCase()) || PROJECT_OWNER_FALLBACK;
  const projectContributors = contributors.filter((contributor) => contributor.login?.toLowerCase() !== PROJECT_OWNER_LOGIN.toLowerCase());

  useEffect(() => {
    const fetchVersion = () => {
      if (!token) return;

      axios
        .get("/api/CheckForUpdates", {
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
        })
        .then((response) => {
          setData(response.data);
        })
        .catch((error) => {
          console.log(error);
          setData((current) => ({
            ...current,
            message: "Unable to check for updates",
          }));
        });
    };

    fetchVersion();

    const intervalId = setInterval(fetchVersion, 60000 * 5);
    return () => clearInterval(intervalId);
  }, [token]);

  useEffect(() => {
    if (!token) return;

    axios
      .get("/api/CheckForUpdates/releases", {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      })
      .then((response) => {
        const releases = response.data?.releases || [];
        setReleaseData({
          releases,
          releases_url: response.data?.releases_url || "https://github.com/Nerdy-Technician/JellyGlance/releases",
          channel: response.data?.channel || "stable",
        });
        setSelectedReleaseId(String(releases[0]?.id || ""));
        setReleaseMessage(releases.length ? "" : "No release notes were returned.");
      })
      .catch((error) => {
        console.log(error);
        setReleaseMessage("Unable to load release notes.");
      });
  }, [token]);

  useEffect(() => {
    if (!token) return;

    axios
      .get("/api/github/contributors", {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      })
      .then((response) => {
        const profiles = (response.data?.contributors || []).filter((contributor) => !isBotContributor(contributor));
        setContributors(profiles);
        setContributorsMessage(profiles.length ? "" : "No GitHub profiles found.");
      })
      .catch((error) => {
        console.log(error);
        setContributorsMessage("Unable to load GitHub profiles.");
      });
  }, [token]);

  return (
    <div className="about-page">
      <header className="about-header">
        <p>About</p>
        <h1>JellyGlance</h1>
        <span>Local Jellyfin visibility for sessions, libraries, requests, downloads, transcodes, automation health, and scheduled jobs.</span>
      </header>

      <main className="about-layout">
        <section className="about-section">
          <div className="about-project-grid">
            <div className="about-project-copy">
              <h2>Project</h2>
              <p>
                JellyGlance is a self-hosted dashboard for people running Jellyfin. It pulls the common admin checks into
                one interface: current playback, recent library changes, watch history, health signals, integrations, and
                background tasks, with customisable navigation and Home widgets for each browser.
              </p>

              <div className="about-feature-grid" aria-label="JellyGlance capabilities">
                <article>
                  <PulseLineIcon />
                  <strong>Live status</strong>
                  <span>See active streams, playback method, viewer, client, internal or remote IP, bitrate, transcode progress, and session history.</span>
                </article>
                <article>
                  <FilmLineIcon />
                  <strong>Library visibility</strong>
                  <span>Track recent additions, library totals, missing artwork, item details, user activity, watch trends, and media quality signals.</span>
                </article>
                <article>
                  <TaskLineIcon />
                  <strong>Operations</strong>
                  <span>Run syncs, backups, imports, health checks, notification tests, repairs, logs, and background maintenance tasks.</span>
                </article>
                <article>
                  <Database2LineIcon />
                  <strong>Integrations</strong>
                  <span>Connect Seerr, download clients, Sonarr/Radarr/Lidarr, Tdarr, Bazarr, Prowlarr, Tautulli, Jellystat, webhooks, and newsletters.</span>
                </article>
                <article>
                  <TaskLineIcon />
                  <strong>Requests</strong>
                  <span>Review pending approvals, per-user queues, availability, issue reports, request trends, and Seerr search results.</span>
                </article>
                <article>
                  <DownloadCloud2LineIcon />
                  <strong>Downloads</strong>
                  <span>Monitor torrent and usenet clients with queue state, progress, speeds, ETA, stalled items, and failed jobs.</span>
                </article>
                <article>
                  <TimerFlashLineIcon />
                  <strong>Active transcodes</strong>
                  <span>Track Tdarr processing, queued items, history, thumbnails, source-to-target conversion, savings, and live percentages.</span>
                </article>
                <article>
                  <RadarLineIcon />
                  <strong>Automation health</strong>
                  <span>Check Bazarr subtitle gaps, subtitle grabs, Prowlarr indexer health, failed indexers, and connected app sync status.</span>
                </article>
                <article>
                  <LayoutGridLineIcon />
                  <strong>Custom layouts</strong>
                  <span>Collapse the sidebar, reorder navigation, hide tabs, resize Home widgets, and save browser-specific dashboard layouts.</span>
                </article>
                <article>
                  <Settings3LineIcon />
                  <strong>Admin tools</strong>
                  <span>Manage settings, devices, integrations, API keys, webhooks, backups, imports, repair tasks, and application logs.</span>
                </article>
              </div>

              <section className="about-note">
                <h2>How it works</h2>
                <p>
                  JellyGlance runs beside your Jellyfin server and talks to the configured APIs with your saved settings. The
                  dashboard keeps local cache and task history so pages can show useful operational context without making
                  every view feel like a raw API browser. Optional GitHub data powers release notes and project profile cards
                  on this page.
                </p>
              </section>

              <section className="about-note">
                <h2>What to configure</h2>
                <ul>
                  <li>Jellyfin connection and authentication mode for the main dashboard.</li>
                  <li>Optional Jellyseerr or Overseerr instances for request management, approvals, user queues, issue reports, and request trends.</li>
                  <li>Optional qBittorrent, Transmission, Deluge, SABnzbd, NZBGet, or similar clients for download monitoring.</li>
                  <li>Optional Tdarr for active transcodes, queue, history, conversion detail, thumbnails, and live progress.</li>
                  <li>Optional Bazarr and Prowlarr for subtitle gaps, subtitle history, indexer health, failed indexers, and app sync status.</li>
                  <li>Optional backups, webhooks, newsletter delivery, imports, health monitoring, custom navbar order, hidden tabs, and Home widgets.</li>
                </ul>
              </section>

              <section className="about-contributors">
                <div className="about-profile-group">
                  <h3>Project Owner</h3>
                  <a className="about-owner-card" href={projectOwner.profile_url} target="_blank" rel="noreferrer">
                    <img src={projectOwner.avatar_url} alt="" loading="lazy" />
                    <span>
                      <strong>{projectOwner.login}</strong>
                      <small>{projectOwner.contributions ? `${projectOwner.contributions} contribution${projectOwner.contributions === 1 ? "" : "s"}` : "Project owner"}</small>
                    </span>
                  </a>
                </div>
                <div className="about-profile-group">
                  <h3>Contributors</h3>
                  {contributorsMessage ? <p>{contributorsMessage}</p> : null}
                  <div className="about-contributor-list">
                    {projectContributors.map((contributor) => (
                      <a key={contributor.id || contributor.login} href={contributor.profile_url} target="_blank" rel="noreferrer">
                        <img src={contributor.avatar_url} alt="" loading="lazy" />
                        <span>
                          <strong>{contributor.login}</strong>
                          <small>{contributor.contributions} contribution{contributor.contributions === 1 ? "" : "s"}</small>
                        </span>
                      </a>
                    ))}
                  </div>
                </div>
              </section>
            </div>

            <section className="about-release-notes">
              <div className="about-release-head">
                <div>
                  <h2>{releaseData.channel === "beta" ? "Beta Notes" : "Release Notes"}</h2>
                  <p>Choose a version to review previous changes.</p>
                </div>
                <div className="about-release-picker">
                  <span>Version</span>
                  <button
                    type="button"
                    onClick={() => setReleaseMenuOpen((isOpen) => !isOpen)}
                    disabled={!releaseData.releases.length}
                    aria-haspopup="listbox"
                    aria-expanded={releaseMenuOpen}
                  >
                    <strong>{selectedRelease?.version || "No releases"}</strong>
                    {selectedRelease?.date ? <em>{formatReleaseDate(selectedRelease.date)}</em> : null}
                    <ArrowDownSLineIcon aria-hidden="true" size={16} />
                  </button>
                  {releaseMenuOpen ? (
                    <div className="about-release-menu" role="listbox" aria-label="Release versions">
                      {releaseData.releases.map((release) => {
                        const releaseId = String(release.id);
                        const selected = releaseId === selectedReleaseId;
                        return (
                          <button
                            key={release.id}
                            type="button"
                            className={selected ? "is-selected" : ""}
                            onClick={() => {
                              setSelectedReleaseId(releaseId);
                              setReleaseMenuOpen(false);
                            }}
                            role="option"
                            aria-selected={selected}
                          >
                            <strong>{release.version}</strong>
                            <em>{formatReleaseDate(release.date)}</em>
                            {selected ? <CheckLineIcon aria-hidden="true" size={16} /> : null}
                          </button>
                        );
                      })}
                    </div>
                  ) : null}
                </div>
              </div>

              {releaseMessage ? <div className="about-release-empty">{releaseMessage}</div> : null}

              {selectedRelease ? (
                <article className="about-release-card">
                  <header>
                    <div>
                      <PriceTag3LineIcon />
                      <strong>{selectedRelease.version}</strong>
                      {selectedRelease.prerelease ? <span>Pre-release</span> : null}
                    </div>
                    <time dateTime={selectedRelease.date || undefined}>{formatReleaseDate(selectedRelease.date)}</time>
                  </header>

                  {selectedReleaseSections.map((section) => (
                    <section key={section.title}>
                      <h3>{section.title}</h3>
                      <ul>
                        {section.items.map((item, index) => (
                          <li key={`${section.title}-${index}`}>{item}</li>
                        ))}
                      </ul>
                    </section>
                  ))}

                  <a href={selectedRelease.url || releaseData.releases_url} target="_blank" rel="noreferrer">
                    View full release on GitHub
                  </a>
                </article>
              ) : null}
            </section>
          </div>
        </section>

        <aside className="about-sidebar">
          <section className="about-install">
            <h2>Install</h2>
            <dl>
              <div>
                <dt>
                  <GitBranchLineIcon />
                  Version
                </dt>
                <dd>{data.current_version}</dd>
              </div>
              <div className={data.update_available ? "is-update" : ""}>
                <dt>
                  <HeartPulseLineIcon />
                  Updates
                </dt>
                <dd>
                  <a href={data.releases_url || "https://github.com/Nerdy-Technician/JellyGlance/releases"} target="_blank" rel="noreferrer">
                    {updateMessage}
                  </a>
                </dd>
              </div>
              <div>
                <dt>
                  <FilmLineIcon />
                  Media source
                </dt>
                <dd>Jellyfin</dd>
              </div>
              <div>
                <dt>
                  <ShieldCheckLineIcon />
                  License
                </dt>
                <dd>GPL-3.0</dd>
              </div>
            </dl>
          </section>

          <section className="about-links">
            <h2>Links</h2>
            <a href="https://github.com/Nerdy-Technician/JellyGlance" target="_blank" rel="noreferrer">
              <GithubFillIcon />
              Source code
            </a>
            <a href="https://github.com/Nerdy-Technician/JellyGlance/pkgs/container/jellyglance" target="_blank" rel="noreferrer">
              <ArchiveLineIcon />
              Container image
            </a>
            <a href="https://github.com/Nerdy-Technician" target="_blank" rel="noreferrer">
              <GithubFillIcon />
              Maintainer profile
            </a>
          </section>
        </aside>
      </main>
    </div>
  );
}
