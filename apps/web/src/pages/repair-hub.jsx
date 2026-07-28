import { useEffect, useMemo, useState } from "react";
import { Alert, Button, Spinner } from "react-bootstrap";
import { Link } from "react-router-dom";
import AlertLineIcon from "remixicon-react/AlertLineIcon";
import ArrowRightLineIcon from "remixicon-react/ArrowRightLineIcon";
import CheckboxCircleLineIcon from "remixicon-react/CheckboxCircleLineIcon";
import Database2LineIcon from "remixicon-react/Database2LineIcon";
import ErrorWarningLineIcon from "remixicon-react/ErrorWarningLineIcon";
import FileSearchLineIcon from "remixicon-react/FileSearchLineIcon";
import HammerLineIcon from "remixicon-react/HammerLineIcon";
import ImageLineIcon from "remixicon-react/ImageLineIcon";
import RefreshLineIcon from "remixicon-react/RefreshLineIcon";
import TimeLineIcon from "remixicon-react/TimeLineIcon";
import Tv2LineIcon from "remixicon-react/Tv2LineIcon";
import axios from "../lib/axios_instance";
import "./css/repair-hub.css";

const numberFormat = new Intl.NumberFormat();

function authHeaders() {
  return {
    Authorization: `Bearer ${localStorage.getItem("token")}`,
    "Content-Type": "application/json",
  };
}

function formatNumber(value) {
  return numberFormat.format(Number(value || 0));
}

function formatDate(value) {
  if (!value) return "No recent activity";
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function itemMeta(item) {
  return [item.Type, item.ProductionYear].filter(Boolean).join(" · ") || "Library item";
}

function RepairMetric({ icon: Icon, label, value, detail, tone = "neutral" }) {
  return (
    <article className={`repair-metric is-${tone}`}>
      <Icon size={22} />
      <div>
        <span>{label}</span>
        <strong>{formatNumber(value)}</strong>
        <small>{detail}</small>
      </div>
    </article>
  );
}

function SampleList({ title, items, emptyText }) {
  return (
    <section className="repair-panel">
      <div className="repair-panel-title">
        <h2>{title}</h2>
        <span>{formatNumber(items.length)} samples</span>
      </div>
      <div className="repair-sample-list">
        {items.map((item) => (
          <Link to={`/libraries/item/${item.Id}`} key={`${title}-${item.Id}`} className="repair-sample-row">
            <div>
              <strong>{item.Name}</strong>
              <span>{itemMeta(item)}</span>
            </div>
            <ArrowRightLineIcon size={17} />
          </Link>
        ))}
        {!items.length ? <div className="repair-empty">{emptyText}</div> : null}
      </div>
    </section>
  );
}

export default function RepairHub() {
  const [summary, setSummary] = useState(null);
  const [unmatched, setUnmatched] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function loadRepairHub() {
    try {
      setLoading(true);
      setError("");
      const [summaryResponse, unmatchedResponse] = await Promise.all([
        axios.get("/stats/repair-hub", { headers: authHeaders() }),
        axios.get("/tautulli/unmatched", { params: { limit: 6 }, headers: authHeaders() }),
      ]);
      setSummary(summaryResponse.data);
      setUnmatched(unmatchedResponse.data || []);
    } catch (requestError) {
      setError(requestError.response?.data?.error || "Unable to load the repair hub.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadRepairHub();
  }, []);

  const counts = summary?.counts || {};
  const samples = summary?.samples || {};
  const totalIssues = useMemo(
    () =>
      Number(counts.missingPosters || 0) +
      Number(counts.missingLogos || 0) +
      Number(counts.missingRuntime || 0) +
      Number(counts.emptySeries || 0) +
      Number(counts.orphanedActivity || 0) +
      Number(counts.unmatchedImports || 0),
    [counts]
  );

  const queue = [
    {
      key: "unmatched",
      icon: Database2LineIcon,
      title: "Unmatched imported history",
      count: counts.unmatchedImports,
      detail: `Last seen ${formatDate(summary?.activityLinks?.unmatchedLastSeen)}`,
      action: "/settings?tab=tabImports",
      actionLabel: "Open imports",
      tone: "danger",
    },
    {
      key: "posters",
      icon: ImageLineIcon,
      title: "Missing posters",
      count: counts.missingPosters,
      detail: "Items without primary artwork",
      action: "/settings?tab=tabLibraries",
      actionLabel: "Library settings",
      tone: "warning",
    },
    {
      key: "series",
      icon: Tv2LineIcon,
      title: "Empty series",
      count: counts.emptySeries,
      detail: "Shows with no active episodes",
      action: "/settings?tab=tabLibraries",
      actionLabel: "Check sync",
      tone: "warning",
    },
    {
      key: "activity",
      icon: FileSearchLineIcon,
      title: "Orphaned activity",
      count: counts.orphanedActivity,
      detail: `Last seen ${formatDate(summary?.activityLinks?.orphanedLastSeen)}`,
      action: "/activity",
      actionLabel: "Open activity",
      tone: "neutral",
    },
  ];

  return (
    <div className="repair-hub">
      <header className="repair-hero">
        <div>
          <span>Maintenance</span>
          <h1>Repair Hub</h1>
          <p>Artwork gaps, imported-history fixes, empty shows, orphaned activity, and recent task failures in one place.</p>
        </div>
        <Button type="button" onClick={loadRepairHub} disabled={loading}>
          {loading ? <Spinner size="sm" animation="border" /> : <RefreshLineIcon size={17} />}
          Refresh
        </Button>
      </header>

      {error ? <Alert variant="danger">{error}</Alert> : null}

      <section className="repair-overview">
        <RepairMetric
          icon={totalIssues ? ErrorWarningLineIcon : CheckboxCircleLineIcon}
          label="Repair queue"
          value={totalIssues}
          detail={totalIssues ? "Items need attention" : "Nothing obvious to repair"}
          tone={totalIssues ? "danger" : "ok"}
        />
        <RepairMetric icon={ImageLineIcon} label="Artwork issues" value={Number(counts.missingPosters || 0) + Number(counts.missingLogos || 0)} detail="Posters and logos" tone="warning" />
        <RepairMetric icon={TimeLineIcon} label="Runtime gaps" value={counts.missingRuntime} detail="Items with no runtime" tone="neutral" />
        <RepairMetric icon={AlertLineIcon} label="Task failures" value={counts.taskFailures} detail="Recent failed logs" tone={counts.taskFailures ? "danger" : "ok"} />
      </section>

      <section className="repair-queue">
        {queue.map((item) => (
          <article key={item.key} className={`repair-queue-card is-${item.tone}`}>
            <item.icon size={22} />
            <div>
              <span>{item.title}</span>
              <strong>{formatNumber(item.count)}</strong>
              <small>{item.detail}</small>
            </div>
            <Link to={item.action}>
              {item.actionLabel}
              <ArrowRightLineIcon size={16} />
            </Link>
          </article>
        ))}
      </section>

      {unmatched.length ? (
        <section className="repair-panel">
          <div className="repair-panel-title">
            <h2>Tautulli Links To Review</h2>
            <Link to="/settings?tab=tabImports">Open linker</Link>
          </div>
          <div className="repair-unmatched-grid">
            {unmatched.map((item) => (
              <article key={`${item.SeriesName}-${item.NowPlayingItemName}-${item.MediaType}`}>
                <Database2LineIcon size={18} />
                <div>
                  <strong>{item.SeriesName ? `${item.SeriesName} - ${item.NowPlayingItemName}` : item.NowPlayingItemName}</strong>
                  <span>{item.MediaType} · {formatNumber(item.PlayCount)} plays</span>
                  <small>Last watched {formatDate(item.LastActivityDate)}</small>
                </div>
              </article>
            ))}
          </div>
        </section>
      ) : null}

      <div className="repair-sample-grid">
        <SampleList title="Missing Posters" items={samples.missingPosters || []} emptyText="No missing poster samples found." />
        <SampleList title="Missing Logos" items={samples.missingLogos || []} emptyText="No missing logo samples found." />
        <SampleList title="Missing Runtime" items={samples.missingRuntime || []} emptyText="No missing runtime samples found." />
        <SampleList title="Empty Series" items={samples.emptySeries || []} emptyText="No empty series samples found." />
      </div>

      <section className="repair-panel">
        <div className="repair-panel-title">
          <h2>Recent Task Failures</h2>
          <Link to="/settings?tab=tabLogs">Open logs</Link>
        </div>
        <div className="repair-task-list">
          {(samples.taskFailures || []).map((task) => (
            <article key={`${task.Id}-${task.TimeRun}`}>
              <HammerLineIcon size={18} />
              <div>
                <strong>{task.Name || task.Id}</strong>
                <span>{task.Result || "Failed"}</span>
              </div>
              <time>{formatDate(task.TimeRun)}</time>
            </article>
          ))}
          {!(samples.taskFailures || []).length ? <div className="repair-empty">No recent task failures found.</div> : null}
        </div>
      </section>
    </div>
  );
}
