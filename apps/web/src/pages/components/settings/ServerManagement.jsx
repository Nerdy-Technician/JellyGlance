import { useEffect, useMemo, useState } from "react";
import axios from "../../../lib/axios_instance";
import Button from "react-bootstrap/Button";
import Alert from "react-bootstrap/Alert";
import ServerLineIcon from "remixicon-react/ServerLineIcon";
import PlayCircleLineIcon from "remixicon-react/PlayCircleLineIcon";
import RefreshLineIcon from "remixicon-react/RefreshLineIcon";
import TimeLineIcon from "remixicon-react/TimeLineIcon";

import "../../css/settings/settings.css";

function errorText(error, fallback) {
  const data = error?.response?.data;
  if (typeof data === "string") return data;
  return data?.error || data?.message || fallback;
}

function formatTaskState(task) {
  const result = task.lastExecutionResult;
  if (!result) return task.state || "Idle";
  return result.Status || task.state || "Idle";
}

function formatLastRun(task) {
  const value = task.lastExecutionResult?.EndTimeUtc || task.lastExecutionResult?.StartTimeUtc;
  if (!value) return "Never run";

  try {
    return new Intl.DateTimeFormat(undefined, {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date(value));
  } catch {
    return "Last run unavailable";
  }
}

function taskStatusClass(task) {
  const state = formatTaskState(task).toLowerCase();
  if (state.includes("fail") || state.includes("error")) return "is-error";
  if (state.includes("running")) return "is-running";
  if (state.includes("completed") || state.includes("success")) return "is-success";
  return "";
}

export default function ServerManagement() {
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busyAction, setBusyAction] = useState("");
  const [message, setMessage] = useState(null);
  const [categoryFilter, setCategoryFilter] = useState("All");

  const jellyfinTasks = status?.jellyfinTasks || [];
  const categories = useMemo(() => ["All", ...new Set(jellyfinTasks.map((task) => task.category || "Jellyfin").sort())], [jellyfinTasks]);
  const visibleTasks = useMemo(
    () => (categoryFilter === "All" ? jellyfinTasks : jellyfinTasks.filter((task) => (task.category || "Jellyfin") === categoryFilter)),
    [categoryFilter, jellyfinTasks]
  );
  const runningCount = jellyfinTasks.filter((task) => String(task.state || "").toLowerCase() === "running").length;

  async function loadStatus() {
    setLoading(true);
    try {
      const response = await axios.get("/api/server-management/status");
      setStatus(response.data);
    } catch (error) {
      setMessage({ type: "danger", text: errorText(error, "Unable to load server management status") });
    } finally {
      setLoading(false);
    }
  }

  async function runAction(action, payload = {}) {
    setBusyAction(action + (payload.taskId || ""));
    setMessage(null);
    try {
      await axios.post("/api/server-management/action", {
        action,
        ...payload,
      });
      setMessage({ type: "success", text: "Jellyfin job started." });
      await loadStatus();
    } catch (error) {
      setMessage({ type: "danger", text: errorText(error, "Jellyfin job failed to start") });
    } finally {
      setBusyAction("");
    }
  }

  useEffect(() => {
    loadStatus();
  }, []);

  return (
    <div className="server-management">
      <div className="server-management-header">
        <div>
          <p>Jellyfin admin</p>
          <h1>Jellyfin Jobs</h1>
          <span>Run Jellyfin scheduled jobs such as library scans, metadata refreshes, subtitle jobs, and plugin maintenance.</span>
        </div>
        <Button type="button" variant="outline-light" onClick={loadStatus} disabled={loading}>
          <RefreshLineIcon size={17} />
          Refresh
        </Button>
      </div>

      {message ? (
        <Alert variant={message.type} onClose={() => setMessage(null)} dismissible>
          {message.text}
        </Alert>
      ) : null}

      <section className="server-management-grid">
        <article className="server-management-panel server-status-panel">
          <div className="server-management-panel-heading">
            <ServerLineIcon size={20} />
            <div>
              <h2>{status?.jellyfin?.name || "Jellyfin"}</h2>
              <p>{status?.jellyfin?.ok ? "Connected media server" : status?.jellyfin?.error || "Status unavailable"}</p>
            </div>
          </div>
          <div className="server-management-facts">
            <span>Version</span>
            <strong>{status?.jellyfin?.version || "Unknown"}</strong>
            <span>Jellyfin jobs</span>
            <strong>{status?.jellyfinTasks?.length || 0} available</strong>
            <span>Running</span>
            <strong>{runningCount}</strong>
          </div>
        </article>
      </section>

      <section className="server-management-section">
        <div className="server-management-section-heading">
          <h2>Scheduled Jobs</h2>
          <p>These are Jellyfin jobs returned by the Jellyfin scheduled task API.</p>
        </div>
        {categories.length > 2 ? (
          <div className="server-job-filters" aria-label="Filter Jellyfin jobs">
            {categories.map((category) => (
              <button
                key={category}
                type="button"
                className={categoryFilter === category ? "is-active" : ""}
                onClick={() => setCategoryFilter(category)}
              >
                {category}
              </button>
            ))}
          </div>
        ) : null}
        <div className="server-task-list">
          {loading ? <div className="server-management-empty">Loading Jellyfin jobs...</div> : null}
          {visibleTasks.map((task) => (
            <article key={task.id} className={`server-task-row ${taskStatusClass(task)}`}>
              <div>
                <span>{task.category}</span>
                <strong>{task.name}</strong>
                <p>{task.description || formatTaskState(task)}</p>
                <small>
                  <TimeLineIcon size={15} />
                  {formatLastRun(task)}
                </small>
              </div>
              <div className="server-task-actions">
                <em>{formatTaskState(task)}</em>
                <Button
                  type="button"
                  variant="outline-primary"
                  onClick={() => runAction("runJellyfinTask", { taskId: task.id })}
                  disabled={Boolean(busyAction) || task.state === "Running"}
                >
                  <PlayCircleLineIcon size={17} />
                  Run
                </Button>
              </div>
            </article>
          ))}
          {!loading && !visibleTasks.length ? <div className="server-management-empty">No Jellyfin jobs matched this view.</div> : null}
        </div>
      </section>
    </div>
  );
}
