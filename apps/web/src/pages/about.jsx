import { useEffect, useState } from "react";
import axios from "../lib/axios_instance";

import "./css/about.css";
import logo from "./images/icon-b-512.png";
import projectText from "./images/project-text.png";
import ArchiveLineIcon from "remixicon-react/ArchiveLineIcon";
import FilmLineIcon from "remixicon-react/FilmLineIcon";
import GitBranchLineIcon from "remixicon-react/GitBranchLineIcon";
import GithubFillIcon from "remixicon-react/GithubFillIcon";
import HeartPulseLineIcon from "remixicon-react/HeartPulseLineIcon";
import PulseLineIcon from "remixicon-react/PulseLineIcon";
import Settings3LineIcon from "remixicon-react/Settings3LineIcon";
import ShieldUserLineIcon from "remixicon-react/ShieldUserLineIcon";

const projectHighlights = [
  {
    title: "Jellyfin Analytics",
    description: "Live sessions, recently added media, user watch history, libraries, playback trends, and server activity.",
    icon: PulseLineIcon,
  },
  {
    title: "Media Control Center",
    description: "Integrations for Jellyfin, automation apps, download clients, calendar views, webhooks, tasks, backups, and logs.",
    icon: Settings3LineIcon,
  },
  {
    title: "Flexible Accounts",
    description: "Built for Jellyfin Quick Connect users, local JellyGlance accounts, admin roles, and OIDC-ready authentication.",
    icon: ShieldUserLineIcon,
  },
];

export default function SettingsAbout() {
  const token = localStorage.getItem("token");
  const [data, setData] = useState({
    current_version: "0.1.0",
    message: "Version check pending",
    update_available: false,
  });

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

  return (
    <div className="about-page">
      <section className="about-hero">
        <div className="about-brand">
          <img src={logo} alt="" className="about-logo" />
          <img src={projectText} alt="JellyGlance" className="about-wordmark" />
        </div>
        <div className="about-hero-copy">
          <p className="about-eyebrow">Project dashboard</p>
          <h1>JellyGlance</h1>
          <p>
            JellyGlance is a modern Jellyfin dashboard for live sessions, recently added media, library health, users,
            downloads, release planning, webhooks, backups, and playback statistics. It gives self-hosted Jellyfin admins
            a fast, polished control center without digging through server logs.
          </p>
          <div className="about-actions">
            <a href="https://github.com/Nerdy-Technician/JellyGlance" target="_blank" rel="noreferrer">
              <GithubFillIcon size={18} />
              GitHub project
            </a>
            <a href="https://github.com/Nerdy-Technician/JellyGlance/pkgs/container/jellyglance" target="_blank" rel="noreferrer">
              <ArchiveLineIcon size={18} />
              Container image
            </a>
          </div>
        </div>
      </section>

      <section className="about-status-grid">
        <article>
          <GitBranchLineIcon />
          <span>Version</span>
          <strong>{data.current_version}</strong>
        </article>
        <article className={data.update_available ? "is-update" : ""}>
          <HeartPulseLineIcon />
          <span>Update status</span>
          <a href={data.releases_url || "https://github.com/Nerdy-Technician/JellyGlance/releases"} target="_blank" rel="noreferrer">
            {data.message}
          </a>
        </article>
        <article>
          <GithubFillIcon />
          <span>Repository</span>
          <a href="https://github.com/Nerdy-Technician/JellyGlance" target="_blank" rel="noreferrer">
            Nerdy-Technician/JellyGlance
          </a>
        </article>
      </section>

      <section className="about-content-grid">
        <div className="about-panel about-story">
          <p className="about-eyebrow">Product description</p>
          <h2>Jellyfin insight at a glance.</h2>
          <p>
            JellyGlance focuses on fast answers: who is watching, what changed in the library, which users are active,
            how libraries are performing, and what automation jobs or integrations need attention.
          </p>
          <p>
            The project is designed for self-hosted setups, with local-first configuration, Docker Compose support,
            cached artwork, role management, webhooks, task scheduling, and a UI tuned for repeated admin use.
          </p>
        </div>

        <div className="about-panel about-maker">
          <p className="about-eyebrow">Creator</p>
          <a href="https://github.com/Nerdy-Technician" target="_blank" rel="noreferrer">
            <GithubFillIcon />
            <div>
              <span>Made by</span>
              <strong>Nerdy-Technician</strong>
              <small>github.com/Nerdy-Technician</small>
            </div>
          </a>
        </div>
      </section>

      <section className="about-feature-grid">
        {projectHighlights.map((highlight) => {
          const Icon = highlight.icon;
          return (
            <article key={highlight.title}>
              <Icon />
              <div>
                <h2>{highlight.title}</h2>
                <p>{highlight.description}</p>
              </div>
            </article>
          );
        })}
      </section>

      <section className="about-footer-panel">
        <FilmLineIcon />
        <div>
          <h2>Made for Jellyfin libraries.</h2>
          <p>
            JellyGlance uses your configured Jellyfin server as the source of truth for artwork, users, sessions, and
            library metadata, then presents that data in a cleaner admin dashboard.
          </p>
        </div>
      </section>
    </div>
  );
}
