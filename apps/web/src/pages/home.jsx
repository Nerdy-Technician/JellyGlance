import { useEffect, useMemo, useState } from "react";
import axios from "../lib/axios_instance";
import Config from "../lib/config";

import BarChartGroupedLineIcon from "remixicon-react/BarChartGroupedLineIcon";
import Database2LineIcon from "remixicon-react/Database2LineIcon";
import FilmLineIcon from "remixicon-react/FilmLineIcon";
import GroupLineIcon from "remixicon-react/GroupLineIcon";
import Music2LineIcon from "remixicon-react/Music2LineIcon";
import PlayCircleLineIcon from "remixicon-react/PlayCircleLineIcon";
import TimeLineIcon from "remixicon-react/TimeLineIcon";
import TrophyLineIcon from "remixicon-react/TrophyLineIcon";
import Tv2LineIcon from "remixicon-react/Tv2LineIcon";
import User3LineIcon from "remixicon-react/User3LineIcon";

import Sessions from "./components/sessions/sessions";
import "./css/home.css";

const numberFormat = new Intl.NumberFormat();

function formatNumber(value) {
  return numberFormat.format(Number(value || 0));
}

function formatBytes(bytes) {
  const size = Number(bytes || 0);
  if (!size) return "0 B";

  const units = ["B", "KB", "MB", "GB", "TB", "PB"];
  const index = Math.min(Math.floor(Math.log(size) / Math.log(1024)), units.length - 1);
  const value = size / 1024 ** index;

  return `${value >= 10 || index === 0 ? value.toFixed(0) : value.toFixed(1)} ${units[index]}`;
}

function formatDuration(seconds) {
  const total = Number(seconds || 0);
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);

  if (hours >= 1000) return `${formatNumber(hours)} hours`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

function hourLabel(hour) {
  if (hour === 0) return "12am";
  if (hour === 12) return "12pm";
  if (hour === 23) return "11pm";
  return hour < 12 ? `${hour}am` : `${hour - 12}pm`;
}

function HomeAvatar({ user, size = 58 }) {
  const [failed, setFailed] = useState(!user?.primaryImageTag);

  if (failed) {
    return (
      <span className="home-avatar home-avatar-fallback" style={{ width: size, height: size }}>
        <User3LineIcon size={Math.round(size * 0.52)} />
      </span>
    );
  }

  return (
    <img
      className="home-avatar"
      src={`/proxy/Users/Images/Primary?id=${user.userId}&fillWidth=${Math.max(size * 2, 120)}&quality=80`}
      alt=""
      width={size}
      height={size}
      loading="lazy"
      onError={() => setFailed(true)}
    />
  );
}

function MetricCard({ icon: Icon, label, value, detail, accent = "cyan" }) {
  const isLoading = value === undefined || value === null;

  return (
    <article className={`home-glass-card home-metric-card home-accent-${accent}`}>
      <span className="home-icon-bubble">
        <Icon size={24} />
      </span>
      <div>
        <p>{label}</p>
        <strong className={isLoading ? "home-value-skeleton" : ""}>{isLoading ? "" : value}</strong>
        {detail ? <small>{detail}</small> : <small className="home-detail-skeleton" />}
      </div>
    </article>
  );
}

function CatalogCard({ icon: Icon, label, value, detail }) {
  const isLoading = value === undefined || value === null;

  return (
    <article className="home-glass-card home-catalog-card">
      <Icon size={24} />
      <div>
        <p>{label}</p>
        <strong className={isLoading ? "home-value-skeleton" : ""}>{isLoading ? "" : value}</strong>
        {detail ? <small>{detail}</small> : <small className="home-detail-skeleton" />}
      </div>
    </article>
  );
}

export default function Home() {
  const [dashboard, setDashboard] = useState(null);
  const [, setError] = useState("");

  useEffect(() => {
    let active = true;

    async function fetchDashboard() {
      try {
        const cachedToken = localStorage.getItem("token");
        const config = cachedToken ? { token: cachedToken } : await Config.getConfig();
        const response = await axios.get("/stats/getHomeDashboard", {
          headers: { Authorization: `Bearer ${config.token}` },
        });
        if (active) {
          setDashboard(response.data);
          setError("");
        }
      } catch (err) {
        console.log(err);
        if (active) setError("Home dashboard data is unavailable.");
      }
    }

    fetchDashboard();
    const interval = setInterval(fetchDashboard, 60000 * 2);

    return () => {
      active = false;
      clearInterval(interval);
    };
  }, []);

  const peakHours = dashboard?.peakHours || [];
  const maxPeak = useMemo(() => Math.max(...peakHours.map((hour) => Number(hour.count || 0)), 1), [peakHours]);
  const hallOfFame = dashboard?.hallOfFame || [];
  const podium = hallOfFame.slice(0, 3);
  const runners = hallOfFame.slice(3, 5);
  const concentration = Number(dashboard?.libraryBalance?.concentration || 0);

  return (
    <div className="Home home-dashboard">
      <div className="home-dashboard-backdrop" aria-hidden="true" />

      <section className="home-active-sessions home-glass-card">
        <Sessions />
      </section>

      <section className="home-hero-grid" aria-label="JellyGlance overview">
        <MetricCard
          icon={PlayCircleLineIcon}
          label="Total playbacks"
          value={dashboard ? formatNumber(dashboard?.totals?.totalPlaybacks) : undefined}
          detail={dashboard ? `${formatDuration(dashboard?.totals?.totalWatchSeconds)} watched` : ""}
        />
        <MetricCard
          icon={GroupLineIcon}
          label="Unique viewers"
          value={dashboard ? formatNumber(dashboard?.totals?.uniqueViewers) : undefined}
          detail={dashboard ? "people with synced activity" : ""}
          accent="purple"
        />
        <article className="home-glass-card home-peak-card">
          <div className="home-card-label">
            <TimeLineIcon size={17} />
            <span>Peak viewing hours</span>
          </div>
          <div className="home-hour-bars" aria-label="Playback count by hour">
            {peakHours.map((hour) => (
              <span key={hour.hour} className="home-hour">
                <span style={{ height: `${Math.max(12, (Number(hour.count || 0) / maxPeak) * 100)}%` }} />
              </span>
            ))}
            {!dashboard
              ? Array.from({ length: 24 }, (_, index) => (
                  <span key={`loading-${index}`} className="home-hour is-loading">
                    <span style={{ height: `${18 + (index % 6) * 10}%` }} />
                  </span>
                ))
              : null}
          </div>
          <div className="home-hour-labels">
            <span>{hourLabel(0)}</span>
            <span>{hourLabel(6)}</span>
            <span>{hourLabel(12)}</span>
            <span>{hourLabel(18)}</span>
            <span>{hourLabel(23)}</span>
          </div>
        </article>
      </section>

      <section className="home-secondary-grid" aria-label="Library health">
        <article className="home-glass-card home-balance-card">
          <p>Library balance</p>
          <strong className={!dashboard ? "home-value-skeleton" : ""}>{dashboard?.libraryBalance?.label || ""}</strong>
          {dashboard ? <small>Top library represents {concentration.toFixed(1)}% of tracked plays.</small> : <small className="home-detail-skeleton" />}
        </article>
        <MetricCard
          icon={BarChartGroupedLineIcon}
          label="Active libraries"
          value={dashboard ? formatNumber(dashboard?.catalog?.activeLibraries) : undefined}
          accent="purple"
        />
        <MetricCard
          icon={Database2LineIcon}
          label="Catalog size"
          value={dashboard ? formatNumber(dashboard?.catalog?.movies + dashboard?.catalog?.shows) : undefined}
          detail={dashboard ? formatBytes(dashboard?.catalog?.size) : ""}
        />
        <article className="home-glass-card home-balance-card">
          <p>Usage concentration</p>
          <strong className={!dashboard ? "home-value-skeleton" : ""}>{dashboard ? `${concentration.toFixed(1)}%` : ""}</strong>
          {dashboard ? <small>Watched share in the busiest library.</small> : <small className="home-detail-skeleton" />}
        </article>
      </section>

      <section className="home-catalog-grid" aria-label="Catalog totals">
        <CatalogCard
          icon={FilmLineIcon}
          label="Movies catalog"
          value={dashboard ? formatNumber(dashboard?.catalog?.movies) : undefined}
          detail={dashboard ? "Total movies in library" : ""}
        />
        <CatalogCard
          icon={Tv2LineIcon}
          label="TV shows catalog"
          value={dashboard ? formatNumber(dashboard?.catalog?.shows) : undefined}
          detail={dashboard ? `${formatNumber(dashboard?.catalog?.episodes)} episodes` : ""}
        />
        <CatalogCard
          icon={Music2LineIcon}
          label="Music catalog"
          value={dashboard ? formatNumber(dashboard?.catalog?.artists) : undefined}
          detail={dashboard ? "Artists tracked" : ""}
        />
      </section>

      <section className="home-hall-section">
        <div className="home-section-title">
          <TrophyLineIcon size={20} />
          <h2>Hall of Fame</h2>
        </div>

        <div className="home-hall-grid">
          <div className="home-podium">
            {(dashboard ? podium : [0, 1, 2]).map((user, index) => (
              <article key={dashboard ? user.userId || user.userName : `loading-${index}`} className={`home-podium-card rank-${index + 1}`}>
                <span className="home-rank-medal">#{index + 1}</span>
                {dashboard ? <HomeAvatar user={user} size={index === 0 ? 74 : 58} /> : <span className="home-avatar home-avatar-skeleton" style={{ width: index === 0 ? 74 : 58, height: index === 0 ? 74 : 58 }} />}
                <strong className={!dashboard ? "home-name-skeleton" : ""}>{dashboard ? user.userName || "Unknown" : ""}</strong>
                {dashboard ? <small>{formatNumber(user.plays)} plays</small> : <small className="home-detail-skeleton" />}
              </article>
            ))}
          </div>

          <div className="home-runner-list">
            {runners.length > 0 ? (
              runners.map((user, index) => (
                <article key={user.userId || user.userName} className="home-runner-row">
                  <span>#{index + 4}</span>
                  <HomeAvatar user={user} size={38} />
                  <strong>{user.userName || "Unknown"}</strong>
                  <small>{formatNumber(user.plays)} plays</small>
                </article>
              ))
            ) : (
              <article className="home-runner-empty">More playback history will appear here as JellyGlance syncs.</article>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
