import { useCallback, useEffect, useMemo, useState } from "react";
import ArrowRightLineIcon from "remixicon-react/ArrowRightLineIcon";
import CpuLineIcon from "remixicon-react/CpuLineIcon";
import HistoryLineIcon from "remixicon-react/HistoryLineIcon";
import ListCheck2Icon from "remixicon-react/ListCheck2Icon";
import RefreshLineIcon from "remixicon-react/RefreshLineIcon";
import axios from "../lib/axios_instance";
import "./css/active-transcodes.css";

const tabs = [
  { key: "active", label: "Active", Icon: CpuLineIcon },
  { key: "queued", label: "Queued", Icon: ListCheck2Icon },
  { key: "history", label: "History", Icon: HistoryLineIcon },
];
const TRANSCODES_CACHE_KEY = "jellyglance_tdarr_transcodes_cache_v2";
const TRANSCODES_CACHE_MAX_AGE_MS = 2 * 60 * 1000;
const emptyBundle = { active: [], queued: [], history: [], stats: {} };

function readTranscodesCache() {
  try {
    const cached = JSON.parse(localStorage.getItem(TRANSCODES_CACHE_KEY) || "null");
    if (!cached?.data || Date.now() - Number(cached.cachedAt || 0) > TRANSCODES_CACHE_MAX_AGE_MS) return null;
    return cached;
  } catch {
    return null;
  }
}

function saveTranscodesCache(data) {
  try {
    localStorage.setItem(TRANSCODES_CACHE_KEY, JSON.stringify({ cachedAt: Date.now(), data }));
  } catch {
    // Rendering fresh data matters more than persisting this small cache.
  }
}

function formatDate(value) {
  if (!value) return "Unknown";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function formatBytes(value) {
  const number = Number(value);
  if (!Number.isFinite(number) || number <= 0) return value || "";
  const units = ["B", "KB", "MB", "GB", "TB"];
  const index = Math.min(Math.floor(Math.log(number) / Math.log(1024)), units.length - 1);
  return `${(number / 1024 ** index).toFixed(index ? 1 : 0)} ${units[index]}`;
}

function formatNumber(value) {
  return new Intl.NumberFormat("en-GB").format(Number(value || 0));
}

function formatSaved(job) {
  const saved = formatBytes(job.savedBytes);
  if (!saved) return "";
  return job.savedPercent ? `${saved} saved (${job.savedPercent}%)` : `${saved} saved`;
}

function JobCard({ job, kind }) {
  const bannerStyle = job.bannerUrl
    ? {
        backgroundImage: `linear-gradient(90deg, rgba(7, 10, 16, 0.96), rgba(7, 10, 16, 0.72), rgba(7, 10, 16, 0.32)), url(${job.bannerUrl})`,
      }
    : {};
  const progress = Number(job.progress || 0);
  const showProgress = kind === "active";
  const progressLabel = progress > 0 ? `${Math.round(progress)}% complete` : "In progress";
  const historySizes = [formatBytes(job.sizeBefore), formatBytes(job.sizeAfter)].filter(Boolean);
  const savedLabel = formatSaved(job);

  return (
    <article className={`transcode-job-card is-${kind}`} style={bannerStyle}>
      <div className="transcode-job-thumbnail">
        {job.thumbnailUrl ? <img src={job.thumbnailUrl} alt="" loading="lazy" decoding="async" /> : <span>{job.title.slice(0, 2)}</span>}
      </div>
      <div className="transcode-job-main">
        <span className="transcode-job-kicker">{job.library || job.worker || "Tdarr"}</span>
        <h2>{job.title}</h2>
        <div className="transcode-route">
          <strong>{job.from || "Source"}</strong>
          {job.to ? (
            <>
              <ArrowRightLineIcon size={18} />
              <strong>{job.to}</strong>
            </>
          ) : null}
        </div>
      </div>
      <div className="transcode-job-meta">
        <span>{job.worker || "Worker pending"}</span>
        <span>{job.status || kind}</span>
        {kind !== "history" && (job.sizeBefore || job.sizeAfter) ? <span>{[formatBytes(job.sizeBefore), formatBytes(job.sizeAfter)].filter(Boolean).join(" -> ")}</span> : null}
        {kind !== "active" ? <span>{formatDate(job.updatedAt)}</span> : null}
      </div>
      {kind === "history" && (historySizes.length || savedLabel) ? (
        <div className="transcode-history-details">
          {historySizes.length ? (
            <span>
              <b>Size</b>
              {historySizes.join(" -> ")}
            </span>
          ) : null}
          {savedLabel ? (
            <span>
              <b>Saved</b>
              {savedLabel}
            </span>
          ) : null}
        </div>
      ) : null}
      {showProgress ? (
        <div className={`transcode-progress${progress > 0 ? "" : " is-indeterminate"}`} aria-label={progressLabel}>
          <span style={progress > 0 ? { width: `${progress}%` } : undefined} />
          <em>{progressLabel}</em>
        </div>
      ) : null}
      {job.reason ? <p className="transcode-reason">{job.reason}</p> : null}
    </article>
  );
}

export default function ActiveTranscodes() {
  const cachedTranscodes = useMemo(() => readTranscodesCache(), []);
  const [activeTab, setActiveTab] = useState("active");
  const [bundle, setBundle] = useState(() => cachedTranscodes?.data || emptyBundle);
  const [loading, setLoading] = useState(() => !cachedTranscodes);
  const [error, setError] = useState("");
  const [lastUpdated, setLastUpdated] = useState(() => cachedTranscodes?.cachedAt || null);

  const jobs = useMemo(() => bundle[activeTab] || [], [activeTab, bundle]);
  const activeCount = Number(bundle.stats?.active || bundle.active?.length || 0);
  const queueCount = Number(bundle.stats?.queue ?? bundle.stats?.queued ?? bundle.queued?.length ?? 0);
  const processedCount = Number(bundle.stats?.processed || 0);
  const erroredCount = Number(bundle.stats?.errored || 0);
  const savedSize = formatBytes(bundle.stats?.saved || 0);

  const loadTranscodes = useCallback(async ({ silent = false, force = false } = {}) => {
    try {
      if (!silent) setLoading(true);
      setError("");
      const response = await axios.get("/api/tdarr/transcodes", { params: force ? { force: "true" } : undefined });
      const nextBundle = response.data || emptyBundle;
      setBundle(nextBundle);
      saveTranscodesCache(nextBundle);
      setLastUpdated(Date.now());
      const nextActiveCount = Number(nextBundle.stats?.active || nextBundle.active?.length || 0);
      const nextQueueCount = Number(nextBundle.stats?.queue ?? nextBundle.stats?.queued ?? nextBundle.queued?.length ?? 0);
      localStorage.setItem("jellyglance_active_transcode_count", String(nextActiveCount));
      window.dispatchEvent(new CustomEvent("jellyglance-transcode-count", { detail: nextActiveCount }));
      return { active: nextActiveCount, queued: nextQueueCount };
    } catch (requestError) {
      setError(requestError?.response?.data?.error || "Unable to load Tdarr transcodes.");
      return { active: 0, queued: 0 };
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let stopped = false;
    let timeoutId;

    async function poll(silent = false) {
      const counts = await loadTranscodes({ silent });
      if (stopped) return;
      const delay = counts.active > 0 ? 5000 : counts.queued > 0 ? 15000 : 60000;
      timeoutId = window.setTimeout(() => poll(true), delay);
    }

    poll(Boolean(cachedTranscodes));
    return () => {
      stopped = true;
      window.clearTimeout(timeoutId);
    };
  }, [cachedTranscodes, loadTranscodes]);

  return (
    <div className="transcodes-page">
      <header className="transcodes-header">
        <div>
          <p>Active Transcodes</p>
          <h1>Tdarr</h1>
          <span>{lastUpdated ? `Last updated ${new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", second: "2-digit" }).format(new Date(lastUpdated))}` : "Monitor active workers, queued files, and finished transcode history."}</span>
        </div>
        <button type="button" onClick={() => loadTranscodes({ force: true })} disabled={loading}>
          <RefreshLineIcon size={18} />
          {loading ? "Refreshing" : "Refresh"}
        </button>
      </header>

      {error ? <div className="transcodes-error">{error}</div> : null}

      <section className="transcode-summary-grid">
        <article>
          <CpuLineIcon />
          <strong>{formatNumber(activeCount)}</strong>
          <span>Active</span>
        </article>
        <article>
          <ListCheck2Icon />
          <strong>{formatNumber(queueCount)}</strong>
          <span>Queue</span>
        </article>
        <article>
          <HistoryLineIcon />
          <strong>{formatNumber(processedCount)}</strong>
          <span>Processed</span>
        </article>
        <article>
          <HistoryLineIcon />
          <strong>{formatNumber(erroredCount)}</strong>
          <span>Errored</span>
        </article>
        <article>
          <CpuLineIcon />
          <strong>{savedSize || "0 B"}</strong>
          <span>Saved</span>
        </article>
      </section>

      <nav className="transcode-tabs" aria-label="Transcode lists">
        {tabs.map(({ key, label, Icon }) => (
          <button type="button" className={activeTab === key ? "is-active" : ""} onClick={() => setActiveTab(key)} key={key}>
            <Icon size={17} />
            {label}
          </button>
        ))}
      </nav>

      <section className="transcode-list">
        {jobs.map((job, index) => (
          <JobCard job={job} kind={activeTab} key={`${job.id}-${index}`} />
        ))}
        {!jobs.length ? (
          <div className="transcode-empty">
            <strong>{loading ? "Loading Tdarr jobs" : `No ${activeTab} transcodes`}</strong>
            <span>
              {loading
                ? "Checking the Tdarr server now."
                : activeTab === "queued" && queueCount > 0
                  ? `Tdarr reports ${formatNumber(queueCount)} queued item${queueCount === 1 ? "" : "s"}, but this API response only exposed counts.`
                  : activeTab === "active" && activeCount > 0
                    ? `Tdarr reports ${formatNumber(activeCount)} active worker${activeCount === 1 ? "" : "s"}, but this API response did not expose file rows.`
                    : "This list will fill when Tdarr exposes jobs in this state."}
            </span>
          </div>
        ) : null}
      </section>
    </div>
  );
}
