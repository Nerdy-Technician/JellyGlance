import { ImportSourceLogo } from "../../../lib/import-source-logos";
import { useEffect, useState } from "react";
import { Alert, Button, Form, Spinner } from "react-bootstrap";
import FileSearchLineIcon from "remixicon-react/FileSearchLineIcon";
import RefreshLineIcon from "remixicon-react/RefreshLineIcon";
import axios from "../../../lib/axios_instance";
import ImportJobProgress, { useImportJob } from "./ImportJobProgress";

function authHeader() {
  return { Authorization: `Bearer ${localStorage.getItem("token")}` };
}

function getErrorMessage(error, fallback) {
  const data = error.response?.data;
  if (typeof data === "string") return data;
  return data?.error || data?.errorMessage || fallback;
}

function formatDate(value) {
  if (!value) return "Never";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Unknown";
  return new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }).format(date);
}

const INTERVAL_OPTIONS = [
  { value: 6, label: "Every 6 hours" },
  { value: 12, label: "Every 12 hours" },
  { value: 24, label: "Daily" },
  { value: 168, label: "Weekly" },
];

export default function JellyfinSyncImport() {
  const [settings, setSettings] = useState(null);
  const [users, setUsers] = useState([]);
  const [selectedUsers, setSelectedUsers] = useState([]);
  const [preview, setPreview] = useState(null);
  const [result, setResult] = useState(null);
  const [message, setMessage] = useState(null);
  const [busyAction, setBusyAction] = useState("");
  const { job, running: jobRunning, track } = useImportJob("jellyfin", (finished) => {
    if (finished.status === "completed" && finished.result) {
      setResult(finished.result);
      setPreview(finished.result);
      setMessage({ type: "success", text: `Added ${finished.result.insertedRows} plays from Jellyfin watch data.` });
    } else if (finished.status === "failed") {
      setMessage({ type: "danger", text: finished.error || "Jellyfin sync failed." });
    }
    setBusyAction("");
    loadSettings();
  });

  async function loadSettings() {
    try {
      const response = await axios.get("/external-imports/settings", { headers: authHeader() });
      setSettings(response.data?.jellyfin || null);
      setUsers(Array.isArray(response.data?.users) ? response.data.users : []);
    } catch (error) {
      setMessage({ type: "danger", text: getErrorMessage(error, "Unable to load Jellyfin sync settings.") });
    }
  }

  useEffect(() => {
    loadSettings();
  }, []);

  async function saveSettings(patch) {
    setSettings((current) => ({ ...(current || {}), ...patch }));
    try {
      const response = await axios.post("/external-imports/jellyfin/settings", patch, { headers: authHeader() });
      setSettings(response.data?.jellyfin || null);
    } catch (error) {
      setMessage({ type: "danger", text: getErrorMessage(error, "Unable to save Jellyfin sync settings.") });
      loadSettings();
    }
  }

  function toggleUser(userId) {
    setSelectedUsers((current) => (current.includes(userId) ? current.filter((id) => id !== userId) : [...current, userId]));
    setPreview(null);
  }

  async function runPreview() {
    try {
      setBusyAction("preview");
      setMessage(null);
      setResult(null);
      const response = await axios.post("/external-imports/jellyfin/preview", { userIds: selectedUsers }, { headers: authHeader() });
      setPreview(response.data);
    } catch (error) {
      setMessage({ type: "danger", text: getErrorMessage(error, "Unable to read watch data from Jellyfin.") });
    } finally {
      setBusyAction("");
    }
  }

  async function runSync() {
    try {
      setBusyAction("sync");
      setMessage(null);
      setResult(null);
      const response = await axios.post("/external-imports/jellyfin/sync", { userIds: selectedUsers, background: true }, { headers: authHeader() });
      track(response.data.job);
    } catch (error) {
      if (error.response?.status === 409 && error.response.data?.job) {
        track(error.response.data.job);
        return;
      }
      setMessage({ type: "danger", text: getErrorMessage(error, "Jellyfin sync failed.") });
      setBusyAction("");
    }
  }

  return (
    <div className="legacy-import-page external-import-page">
      <header className="settings-section-header">
        <div>
          <span>Watch data</span>
          <h2>Jellyfin Import &amp; Sync</h2>
          <p>
            Read played and in-progress items straight from Jellyfin for every user, with no Playback Reporting plugin needed. Items a user already has
            history for are skipped, so nothing is counted twice.
          </p>
        </div>
      </header>

      {message ? (
        <Alert variant={message.type} onClose={() => setMessage(null)} dismissible>
          {message.text}
        </Alert>
      ) : null}

      <section className="legacy-import-panel">
        <div className="legacy-import-upload">
          <ImportSourceLogo source="jellyfin" size={38} className="legacy-import-logo" />
          <div>
            <span>Last sync</span>
            <strong>{formatDate(settings?.lastSyncAt)}</strong>
            <small>
              {settings?.lastResult ? `${settings.lastResult.insertedRows} plays added · ${settings.lastResult.alreadyTracked} already tracked` : "Run a preview to see what Jellyfin knows."}
            </small>
          </div>
        </div>

        <div className="external-import-options">
          <Form.Check
            type="switch"
            id="jellyfin-sync-auto"
            label="Keep in sync automatically"
            checked={Boolean(settings?.autoSync)}
            onChange={(event) => saveSettings({ autoSync: event.target.checked })}
            disabled={!settings}
          />
          <Form.Select
            size="sm"
            value={settings?.intervalHours || 24}
            onChange={(event) => saveSettings({ intervalHours: Number(event.target.value) })}
            disabled={!settings?.autoSync}
            aria-label="Sync interval"
          >
            {INTERVAL_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </Form.Select>
          <Form.Check
            type="switch"
            id="jellyfin-sync-progress"
            label="Include in-progress items (uses resume position)"
            checked={settings?.includeInProgress !== false}
            onChange={(event) => {
              saveSettings({ includeInProgress: event.target.checked });
              setPreview(null);
            }}
            disabled={!settings}
          />
        </div>

        {users.length ? (
          <div className="external-import-users">
            <span>Users</span>
            <div>
              {users.map((user) => (
                <button
                  type="button"
                  key={user.Id}
                  className={`external-import-chip ${selectedUsers.includes(user.Id) ? "active" : ""}`}
                  onClick={() => toggleUser(user.Id)}
                >
                  {user.Name}
                </button>
              ))}
            </div>
            <small>{selectedUsers.length ? `${selectedUsers.length} selected` : "All users"}</small>
          </div>
        ) : null}

        <div className="legacy-import-actions">
          <Button type="button" variant="outline-primary" onClick={runPreview} disabled={Boolean(busyAction) || jobRunning}>
            {busyAction === "preview" ? <Spinner size="sm" animation="border" /> : <FileSearchLineIcon size={18} />}
            Preview
          </Button>
          <Button type="button" variant="primary" onClick={runSync} disabled={Boolean(busyAction) || jobRunning}>
            {busyAction === "sync" || jobRunning ? <Spinner size="sm" animation="border" /> : <RefreshLineIcon size={18} />}
            Sync now
          </Button>
        </div>
      </section>

      <ImportJobProgress job={job} />

      {preview ? (
        <>
          <section className="legacy-import-summary">
            <article>
              <span>Watched items</span>
              <strong>{preview.candidates ?? 0}</strong>
              <small>{preview.noPlayDate ? `${preview.noPlayDate} marked watched with no date (skipped)` : "Items with a last played date."}</small>
            </article>
            <article>
              <span>Already tracked</span>
              <strong>{preview.alreadyTracked ?? 0}</strong>
              <small>JellyGlance already has a play for these.</small>
            </article>
            <article>
              <span>{result ? "Plays added" : "New plays"}</span>
              <strong>{result ? result.insertedRows : preview.newPlays ?? 0}</strong>
              <small>{preview.firstActivityDate ? `${formatDate(preview.firstActivityDate)} to ${formatDate(preview.lastActivityDate)}` : "Nothing new to add."}</small>
            </article>
          </section>
          {preview.users?.length ? (
            <section className="legacy-import-review">
              <div className="legacy-import-user-list">
                {preview.users.map((user) => (
                  <article key={user.userId} className="legacy-import-user-row external-import-user-row">
                    <div>
                      <strong>{user.userName}</strong>
                      <span>
                        {user.items} watched or in progress · {user.newPlays} new
                      </span>
                    </div>
                  </article>
                ))}
              </div>
            </section>
          ) : null}
        </>
      ) : null}
    </div>
  );
}
