import { useEffect, useMemo, useState } from "react";
import Alert from "react-bootstrap/Alert";
import Button from "react-bootstrap/Button";
import axios from "../../../lib/axios_instance";
import CalendarLineIcon from "remixicon-react/CalendarLineIcon";
import PlayCircleLineIcon from "remixicon-react/PlayCircleLineIcon";
import RefreshLineIcon from "remixicon-react/RefreshLineIcon";
import TimeLineIcon from "remixicon-react/TimeLineIcon";
import {
  JELLYFIN_TRIGGER_TYPES,
  JELLYFIN_WEEKDAYS,
  createEditorTrigger,
  editorToApiTriggers,
  editorTriggersEqual,
  formatJellyfinSchedule,
  triggersToEditor,
} from "../../../lib/jellyfin-job-triggers";

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

function TriggerFields({ trigger, onChange }) {
  if (trigger.Type === "StartupTrigger") {
    return <p className="jellyfin-job-trigger-hint">Runs when Jellyfin starts.</p>;
  }

  if (trigger.Type === "IntervalTrigger") {
    return (
      <div className="jellyfin-job-trigger-fields">
        <label>
          Repeat
          <input
            type="number"
            min="1"
            max={trigger.intervalUnit === "hours" ? 168 : 10080}
            value={trigger.intervalValue}
            onChange={(event) => onChange({ intervalValue: Number(event.target.value) || 1 })}
          />
        </label>
        <label>
          Unit
          <select value={trigger.intervalUnit} onChange={(event) => onChange({ intervalUnit: event.target.value })}>
            <option value="minutes">Minutes</option>
            <option value="hours">Hours</option>
          </select>
        </label>
      </div>
    );
  }

  return (
    <div className="jellyfin-job-trigger-fields">
      {trigger.Type === "WeeklyTrigger" ? (
        <label>
          Day
          <select value={trigger.day} onChange={(event) => onChange({ day: event.target.value })}>
            {JELLYFIN_WEEKDAYS.map((day) => (
              <option key={day} value={day}>
                {day}
              </option>
            ))}
          </select>
        </label>
      ) : null}
      <label>
        Time
        <input type="time" value={trigger.time} onChange={(event) => onChange({ time: event.target.value || "00:00" })} />
      </label>
    </div>
  );
}

export default function JellyfinJobSchedules() {
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busyAction, setBusyAction] = useState("");
  const [message, setMessage] = useState(null);
  const [categoryFilter, setCategoryFilter] = useState("All");
  const [query, setQuery] = useState("");
  const [editingId, setEditingId] = useState("");
  const [draftTriggers, setDraftTriggers] = useState([]);

  const jellyfinTasks = status?.jellyfinTasks || [];
  const categories = useMemo(() => ["All", ...new Set(jellyfinTasks.map((task) => task.category || "Jellyfin").sort())], [jellyfinTasks]);
  const visibleTasks = useMemo(() => {
    const search = query.trim().toLowerCase();
    return jellyfinTasks.filter((task) => {
      const category = task.category || "Jellyfin";
      if (categoryFilter !== "All" && category !== categoryFilter) return false;
      if (!search) return true;
      return [task.name, task.description, category].some((value) => String(value || "").toLowerCase().includes(search));
    });
  }, [categoryFilter, jellyfinTasks, query]);

  const editingTask = jellyfinTasks.find((task) => task.id === editingId);
  const draftDirty = editingTask ? !editorTriggersEqual(draftTriggers, triggersToEditor(editingTask.triggers)) : false;

  async function loadStatus({ silent = false } = {}) {
    if (!silent) setLoading(true);
    try {
      const response = await axios.get("/api/server-management/status");
      setStatus(response.data);
    } catch (error) {
      setMessage({ type: "danger", text: errorText(error, "Unable to load Jellyfin jobs") });
    } finally {
      if (!silent) setLoading(false);
    }
  }

  function startEditing(task) {
    setEditingId(task.id);
    setDraftTriggers(triggersToEditor(task.triggers));
    setMessage(null);
  }

  function stopEditing() {
    setEditingId("");
    setDraftTriggers([]);
  }

  function updateDraft(triggerId, patch) {
    setDraftTriggers((current) => current.map((trigger) => (trigger.id === triggerId ? { ...trigger, ...patch } : trigger)));
  }

  async function runTask(task) {
    setBusyAction(`run:${task.id}`);
    setMessage(null);
    try {
      await axios.post("/api/server-management/action", {
        action: "runJellyfinTask",
        taskId: task.id,
      });
      setMessage({ type: "success", text: `${task.name} started.` });
      await loadStatus({ silent: true });
    } catch (error) {
      setMessage({ type: "danger", text: errorText(error, "Jellyfin job failed to start") });
    } finally {
      setBusyAction("");
    }
  }

  async function saveSchedule(task) {
    setBusyAction(`save:${task.id}`);
    setMessage(null);
    try {
      await axios.post("/api/server-management/action", {
        action: "updateJellyfinTaskTriggers",
        taskId: task.id,
        triggers: editorToApiTriggers(draftTriggers),
      });
      setMessage({ type: "success", text: `Schedule saved for ${task.name}.` });
      stopEditing();
      await loadStatus({ silent: true });
    } catch (error) {
      setMessage({ type: "danger", text: errorText(error, "Jellyfin job schedule failed to save") });
    } finally {
      setBusyAction("");
    }
  }

  useEffect(() => {
    loadStatus();
  }, []);

  return (
    <div className="jellyfin-admin-settings jellyfin-job-schedules">
      <div className="jellyfin-admin-header">
        <div>
          <p>Jellyfin jobs</p>
          <h1>Jellyfin Jobs</h1>
          <span>Set the times Jellyfin runs library scans, metadata refreshes, subtitle jobs, and other scheduled tasks. These are Jellyfin server jobs, not JellyGlance sync tasks.</span>
        </div>
        <Button type="button" variant="outline-light" onClick={() => loadStatus()} disabled={loading}>
          <RefreshLineIcon size={17} />
          Refresh
        </Button>
      </div>

      {message ? (
        <Alert variant={message.type} onClose={() => setMessage(null)} dismissible>
          {message.text}
        </Alert>
      ) : null}

      <section className="jellyfin-admin-section">
        <div className="jellyfin-admin-section-heading">
          <div>
            <CalendarLineIcon size={20} />
            <div>
              <h2>Job schedules</h2>
              <p>
                {status?.jellyfin?.ok
                  ? `${jellyfinTasks.length} jobs on ${status.jellyfin.name}${status.jellyfin.version ? ` ${status.jellyfin.version}` : ""}.`
                  : status?.jellyfin?.error || "Jellyfin status unavailable."}
              </p>
            </div>
          </div>
        </div>

        <div className="jellyfin-job-toolbar">
          <label className="jellyfin-job-search">
            Search jobs
            <input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Scan, metadata, subtitles..." />
          </label>
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
        </div>

        <div className="jellyfin-job-list">
          {loading ? <div className="jellyfin-admin-empty">Loading Jellyfin jobs...</div> : null}
          {!loading && !visibleTasks.length ? <div className="jellyfin-admin-empty">No Jellyfin jobs matched this view.</div> : null}
          {visibleTasks.map((task) => {
            const editing = editingId === task.id;
            return (
              <article key={task.id} className={`jellyfin-job-card ${taskStatusClass(task)} ${editing ? "is-editing" : ""}`.trim()}>
                <div className="jellyfin-job-card-main">
                  <div>
                    <span>{task.category}</span>
                    <strong>{task.name}</strong>
                    <p>{task.description || formatTaskState(task)}</p>
                    <small>
                      <TimeLineIcon size={15} />
                      {formatLastRun(task)} · {formatJellyfinSchedule(task.triggers)}
                    </small>
                  </div>
                  <div className="jellyfin-job-card-actions">
                    <em>{formatTaskState(task)}</em>
                    {editing ? (
                      <>
                        <Button type="button" variant="outline-light" onClick={stopEditing} disabled={Boolean(busyAction)}>
                          Cancel
                        </Button>
                        <Button type="button" variant="primary" onClick={() => saveSchedule(task)} disabled={Boolean(busyAction) || !draftDirty}>
                          Save schedule
                        </Button>
                      </>
                    ) : (
                      <Button type="button" variant="outline-light" onClick={() => startEditing(task)} disabled={Boolean(busyAction)}>
                        Edit schedule
                      </Button>
                    )}
                    <Button
                      type="button"
                      variant="outline-primary"
                      onClick={() => runTask(task)}
                      disabled={Boolean(busyAction) || task.state === "Running"}
                    >
                      <PlayCircleLineIcon size={17} />
                      Run
                    </Button>
                  </div>
                </div>

                {editing ? (
                  <div className="jellyfin-job-editor">
                    {draftTriggers.length ? (
                      draftTriggers.map((trigger) => (
                        <div key={trigger.id} className="jellyfin-job-trigger-row">
                          <label>
                            When
                            <select value={trigger.Type} onChange={(event) => updateDraft(trigger.id, { Type: event.target.value })}>
                              {JELLYFIN_TRIGGER_TYPES.map((option) => (
                                <option key={option.value} value={option.value}>
                                  {option.label}
                                </option>
                              ))}
                            </select>
                          </label>
                          <TriggerFields trigger={trigger} onChange={(patch) => updateDraft(trigger.id, patch)} />
                          <Button type="button" variant="outline-danger" onClick={() => setDraftTriggers((current) => current.filter((item) => item.id !== trigger.id))}>
                            Remove
                          </Button>
                        </div>
                      ))
                    ) : (
                      <p className="jellyfin-job-trigger-hint">No automatic times. This job only runs when you start it.</p>
                    )}
                    <div className="jellyfin-job-editor-actions">
                      <Button
                        type="button"
                        variant="outline-light"
                        onClick={() => setDraftTriggers((current) => (current.length >= 8 ? current : [...current, createEditorTrigger()]))}
                        disabled={draftTriggers.length >= 8}
                      >
                        Add time
                      </Button>
                    </div>
                  </div>
                ) : null}
              </article>
            );
          })}
        </div>
      </section>
    </div>
  );
}
