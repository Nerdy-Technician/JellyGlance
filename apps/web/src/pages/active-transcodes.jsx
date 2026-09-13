import { useCallback, useEffect, useMemo, useState } from "react";
import ArrowRightLineIcon from "remixicon-react/ArrowRightLineIcon";
import CloseCircleLineIcon from "remixicon-react/CloseCircleLineIcon";
import CpuLineIcon from "remixicon-react/CpuLineIcon";
import HistoryLineIcon from "remixicon-react/HistoryLineIcon";
import ListCheck2Icon from "remixicon-react/ListCheck2Icon";
import PauseCircleLineIcon from "remixicon-react/PauseCircleLineIcon";
import PlayCircleLineIcon from "remixicon-react/PlayCircleLineIcon";
import RefreshLineIcon from "remixicon-react/RefreshLineIcon";
import axios from "../lib/axios_instance";
import Config from "../lib/config";
import "./css/active-transcodes.css";

const tabs = [
  { key: "active", label: "Active", Icon: CpuLineIcon },
  { key: "queued", label: "Queued", Icon: ListCheck2Icon },
  { key: "history", label: "History", Icon: HistoryLineIcon },
];
const TRANSCODES_CACHE_KEY = "jellyglance_tdarr_transcodes_cache_v6";
const TRANSCODES_CACHE_MAX_AGE_MS = 2 * 60 * 1000;
const emptyBundle = { active: [], queued: [], history: [], stats: {}, nodes: [], pauseAll: false, connected: false };

function canManageTdarr(config) {
  if (config?.settings?.auth?.permissions?.settings) return true;
  const role = String(config?.settings?.auth?.role || "").toLowerCase();
  return role === "owner" || role === "admin";
}

function canSkipTdarrJob(job, kind) {
  if (kind === "history" || !job) return false;
  if (job.nodeId && job.workerId) return true;
  const fileId = String(job.fileId || "").trim();
  return Boolean(fileId) && !/^(active|queued|history)-\d+$/i.test(fileId);
}

function readTranscodesCache() {
  try {
    const cached = JSON.parse(localStorage.getItem(TRANSCODES_CACHE_KEY) || "null");
    if (!cached?.data || Date.now() - Number(cached.cachedAt || 0) > TRANSCODES_CACHE_MAX_AGE_MS * 15) return null;
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

function displayText(value) {
  if (value == null || value === "") return "";
  if (typeof value === "object") {
    return displayText(value.Name || value.name || value.message || value.reason || value.text || "");
  }
  const text = String(value).trim();
  return !text || text === "[object Object]" ? "" : text;
}

function workKindLabel(job) {
  if (job.workKind === "healthcheck") return "Health check";
  if (job.workKind === "transcode") return "Transcode";
  return "";
}

function hardwareLabel(job) {
  if (job.hardware === "gpu") return "GPU";
  if (job.hardware === "cpu") return "CPU";
  return "";
}

function JobCard({ job, kind, canManage, busy, onSkip }) {
  const artUrl = job.bannerUrl || job.thumbnailUrl;
  const bannerStyle = artUrl
    ? {
        backgroundImage: `linear-gradient(90deg, rgba(7, 10, 16, 0.96), rgba(7, 10, 16, 0.72), rgba(7, 10, 16, 0.32)), url(${artUrl})`,
      }
    : {};
  const progress = Number(job.progress || 0);
  const showProgress = kind === "active";
  const kindLabel = workKindLabel(job);
  const hwLabel = hardwareLabel(job);
  const progressLabel = progress > 0
    ? `${Math.round(progress)}% ${job.workKind === "healthcheck" ? "checked" : "complete"}`
    : job.workKind === "healthcheck"
      ? "Health checking..."
      : "Transcoding...";
  const historySizes = [formatBytes(job.sizeBefore), formatBytes(job.sizeAfter)].filter(Boolean);
  const savedLabel = formatSaved(job);
  const kicker = job.nodeName ? `Node · ${job.nodeName}` : job.library || job.worker || "Tdarr";

  return (
    <article className={`transcode-job-card is-${kind}${job.workKind ? ` is-${job.workKind}` : ""}`} style={bannerStyle}>
      <div className="transcode-job-thumbnail">
        {job.thumbnailUrl ? <img src={job.thumbnailUrl} alt="" loading="lazy" decoding="async" /> : <span>{job.title.slice(0, 2)}</span>}
      </div>
      <div className="transcode-job-main">
        <span className="transcode-job-kicker">{kicker}</span>
        <h2>{job.title}</h2>
        <div className="transcode-route">
          <strong>{displayText(job.from) || "Source"}</strong>
          {displayText(job.to) ? (
            <>
              <ArrowRightLineIcon size={18} />
              <strong>{displayText(job.to)}</strong>
            </>
          ) : null}
        </div>
      </div>
      <div className="transcode-job-meta">
        {job.nodeName ? <span className="is-node">{job.nodeName}</span> : null}
        {hwLabel ? <span className={`is-${job.hardware}`}>{hwLabel}</span> : null}
        {kindLabel ? <span className={`is-${job.workKind}`}>{kindLabel}</span> : null}
        {!job.nodeName && job.worker ? <span>{job.worker}</span> : null}
        <span>{displayText(job.status) || kind}</span>
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
      {displayText(job.reason) ? <p className="transcode-reason">{displayText(job.reason)}</p> : null}
      {canManage && canSkipTdarrJob(job, kind) ? (
        <div className="transcode-job-actions">
          <button type="button" className="is-skip" disabled={busy} onClick={() => onSkip(job)}>
            <CloseCircleLineIcon size={16} />
            {busy ? "Skipping" : "Skip"}
          </button>
        </div>
      ) : null}
    </article>
  );
}

export default function ActiveTranscodes() {
  const cachedTranscodes = useMemo(() => readTranscodesCache(), []);
  const [activeTab, setActiveTab] = useState("active");
  const [bundle, setBundle] = useState(() => cachedTranscodes?.data || emptyBundle);
  const [loading, setLoading] = useState(() => !cachedTranscodes);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [lastUpdated, setLastUpdated] = useState(() => cachedTranscodes?.cachedAt || null);
  const [config, setConfig] = useState(null);
  const [busyAction, setBusyAction] = useState("");

  const jobs = useMemo(() => bundle[activeTab] || [], [activeTab, bundle]);
  const nodes = useMemo(() => (Array.isArray(bundle.nodes) ? bundle.nodes.filter((node) => node?.id) : []), [bundle.nodes]);
  const activeCount = Number(bundle.stats?.active || bundle.active?.length || 0);
  const queueCount = Number(bundle.stats?.queue ?? bundle.stats?.queued ?? bundle.queued?.length ?? 0);
  const processedCount = Number(bundle.stats?.processed || 0);
  const erroredCount = Number(bundle.stats?.errored || 0);
  const savedSize = formatBytes(bundle.stats?.saved || 0);
  const disconnected = /connect tdarr/i.test(error);
  const canManage = canManageTdarr(config) && !disconnected && (bundle.connected || Boolean(bundle.source?.url));
  const allPaused = nodes.length ? nodes.every((node) => node.paused) : Boolean(bundle.pauseAll);

  const loadTranscodes = useCallback(async ({ silent = false, force = false, activeOnly = false } = {}) => {
    try {
      if (!silent) setLoading(true);
      if (!silent) setError("");
      const response = await axios.get("/api/tdarr/transcodes", {
        timeout: 20000,
        params: { ...(force ? { force: "true" } : {}), ...(activeOnly ? { activeOnly: "true" } : {}) },
      });
      const nextBundle = response.data || emptyBundle;
      setBundle((current) => {
        if (activeOnly) {
          return {
            ...current,
            ...nextBundle,
            queued: current.queued?.length && !nextBundle.queued?.length ? current.queued : nextBundle.queued,
            history: current.history?.length && !nextBundle.history?.length ? current.history : nextBundle.history,
            stats: { ...current.stats, ...nextBundle.stats },
          };
        }
        return nextBundle;
      });
      saveTranscodesCache(nextBundle);
      setLastUpdated(Date.now());
      setError("");
      const nextActiveCount = Number(nextBundle.stats?.active || nextBundle.active?.length || 0);
      const nextQueueCount = Number(nextBundle.stats?.queue ?? nextBundle.stats?.queued ?? nextBundle.queued?.length ?? 0);
      localStorage.setItem("jellyglance_active_transcode_count", String(nextActiveCount));
      window.dispatchEvent(new CustomEvent("jellyglance-transcode-count", { detail: nextActiveCount }));
      return { active: nextActiveCount, queued: nextQueueCount };
    } catch (requestError) {
      if (!silent) {
        setError(requestError?.response?.data?.error || "Unable to load Tdarr transcodes.");
      }
      if (requestError?.response?.status === 404) {
        setBundle((current) => ({ ...current, connected: false, nodes: [] }));
      }
      return { active: 0, queued: 0 };
    } finally {
      setLoading(false);
    }
  }, []);

  const runTdarrAction = useCallback(
    async (action, payload = {}, { confirmText } = {}) => {
      if (!canManage || busyAction) return;
      if (confirmText && !window.confirm(confirmText)) return;
      const key = `${action}:${payload.nodeId || payload.fileId || payload.id || "all"}`;
      try {
        setBusyAction(key);
        setNotice("");
        const response = await axios.post("/api/tdarr/actions", { action, ...payload });
        setNotice(response.data?.message || `Tdarr ${action} sent.`);
        if (action === "skip" && (payload.fileId || payload.id)) {
          const jobId = payload.id || payload.fileId;
          setBundle((current) => ({
            ...current,
            active: (current.active || []).filter((job) => job.id !== jobId && job.fileId !== jobId),
            queued: (current.queued || []).filter((job) => job.id !== jobId && job.fileId !== jobId),
          }));
        }
        await loadTranscodes({ silent: true, force: true, activeOnly: false });
      } catch (actionError) {
        setNotice(actionError?.response?.data?.error || actionError?.response?.data?.message || `Unable to ${action} Tdarr job.`);
      } finally {
        setBusyAction("");
      }
    },
    [busyAction, canManage, loadTranscodes]
  );

  useEffect(() => {
    Config.getConfig()
      .then((next) => setConfig(next))
      .catch(() => setConfig({}));
  }, []);

  useEffect(() => {
    let stopped = false;
    loadTranscodes({ silent: Boolean(cachedTranscodes), force: false, activeOnly: activeTab === "active" });
    const intervalId = window.setInterval(() => {
      if (!stopped) loadTranscodes({ silent: true, force: false, activeOnly: activeTab === "active" });
    }, 20000);

    return () => {
      stopped = true;
      window.clearInterval(intervalId);
    };
  }, [activeTab, cachedTranscodes, loadTranscodes]);

  return (
    <div className="transcodes-page">
      <header className="transcodes-header">
        <div>
          <p>Active Transcodes</p>
          <h1>Tdarr</h1>
          <span>{lastUpdated ? `Last updated ${new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", second: "2-digit" }).format(new Date(lastUpdated))}` : "Monitor active workers, queued files, and finished transcode history."}</span>
        </div>
        <div className="transcodes-header-actions">
          {canManage && nodes.map((node) => (
            <button
              type="button"
              key={node.id}
              disabled={Boolean(busyAction)}
              onClick={() => runTdarrAction(node.paused ? "resume" : "pause", { nodeId: node.id })}
            >
              {node.paused ? <PlayCircleLineIcon size={18} /> : <PauseCircleLineIcon size={18} />}
              {node.paused ? "Resume" : "Pause"} {node.name}
            </button>
          ))}
          {canManage && (nodes.length > 1 || (!nodes.length && (bundle.pauseAll || bundle.connected))) ? (
            <button type="button" disabled={Boolean(busyAction)} onClick={() => runTdarrAction(allPaused ? "resume" : "pause")}>
              {allPaused ? <PlayCircleLineIcon size={18} /> : <PauseCircleLineIcon size={18} />}
              {allPaused ? "Resume all" : "Pause all"}
            </button>
          ) : null}
          <button type="button" onClick={() => loadTranscodes({ force: true })} disabled={loading}>
            <RefreshLineIcon size={18} />
            {loading ? "Refreshing" : "Refresh"}
          </button>
        </div>
      </header>

      {notice ? <div className={`transcodes-notice${/unable|fail|error/i.test(notice) ? " is-error" : ""}`}>{notice}</div> : null}
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
          <JobCard
            job={job}
            kind={activeTab}
            canManage={canManage}
            busy={busyAction === `skip:${job.fileId || job.id}`}
            onSkip={(nextJob) =>
              runTdarrAction(
                "skip",
                {
                  id: nextJob.id,
                  fileId: nextJob.fileId || nextJob.id,
                  nodeId: nextJob.nodeId,
                  workerId: nextJob.workerId,
                  workKind: nextJob.workKind,
                },
                { confirmText: `Skip ${nextJob.title || "this Tdarr job"}?` }
              )
            }
            key={`${job.id}-${index}`}
          />
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
