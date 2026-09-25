import { ImportSourceLogo } from "../../../lib/import-source-logos";
import { useEffect, useRef, useState } from "react";
import { Alert, Button, Form, Spinner } from "react-bootstrap";
import FileSearchLineIcon from "remixicon-react/FileSearchLineIcon";
import LinkIcon from "remixicon-react/LinkIcon";
import LinkUnlinkIcon from "remixicon-react/LinkUnlinkIcon";
import UploadCloud2LineIcon from "remixicon-react/UploadCloud2LineIcon";
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

function Summary({ data, result }) {
  if (!data) return null;
  const by = data.matchedBy || {};
  return (
    <>
      <section className="legacy-import-summary">
        <article>
          <span>Trakt plays</span>
          <strong>{data.totalEntries ?? 0}</strong>
          <small>For {data.jellyfinUserName}{data.username ? ` from ${data.username}` : ""}.</small>
        </article>
        <article>
          <span>Matched to library</span>
          <strong>{data.matched ?? 0}</strong>
          <small>
            IMDb {by.imdb || 0} · TMDb {by.tmdb || 0} · TVDb {by.tvdb || 0} · title {by.title || 0}
          </small>
        </article>
        <article>
          <span>Duplicates</span>
          <strong>{data.duplicates ?? 0}</strong>
          <small>Already recorded within 3 hours.</small>
        </article>
        <article>
          <span>{result ? "Plays added" : "New plays"}</span>
          <strong>{result ? result.insertedRows : data.newPlays ?? 0}</strong>
          <small>{data.includeUnmatched ? "Includes unmatched items." : `${data.unmatched ?? 0} unmatched skipped.`}</small>
        </article>
      </section>
      {data.unmatchedItems?.length ? (
        <section className="legacy-import-review">
          <div className="legacy-import-review-header">
            <div>
              <span>Not in your library</span>
              <h3>Unmatched Trakt Items</h3>
              <p>These couldn&apos;t be matched by provider IDs or title and year. Turn on &ldquo;Import unmatched plays&rdquo; to keep them anyway.</p>
            </div>
          </div>
          <div className="legacy-import-user-list">
            {data.unmatchedItems.slice(0, 20).map((item) => (
              <article key={item.title} className="legacy-import-user-row external-import-user-row">
                <div>
                  <strong>{item.title}</strong>
                  <span>
                    {item.plays} play{item.plays === 1 ? "" : "s"} · {item.reason}
                  </span>
                </div>
              </article>
            ))}
          </div>
        </section>
      ) : null}
    </>
  );
}

export default function TraktImport() {
  const fileInputRef = useRef(null);
  const pollRef = useRef(null);
  const [settings, setSettings] = useState(null);
  const [users, setUsers] = useState([]);
  const [clientId, setClientId] = useState("");
  const [clientSecret, setClientSecret] = useState("");
  const [connectUser, setConnectUser] = useState("");
  const [uploadUser, setUploadUser] = useState("");
  const [device, setDevice] = useState(null);
  const [preview, setPreview] = useState(null);
  const [result, setResult] = useState(null);
  const [uploadFile, setUploadFile] = useState(null);
  const [message, setMessage] = useState(null);
  const [busyAction, setBusyAction] = useState("");
  const { job, running: jobRunning, track } = useImportJob("trakt", (finished) => {
    if (finished.status === "completed" && finished.result) {
      setResult(finished.result);
      setPreview(finished.result);
      setMessage({ type: "success", text: `Added ${finished.result.insertedRows} plays from ${finished.result.username || "Trakt"}.` });
    } else if (finished.status === "failed") {
      setMessage({ type: "danger", text: finished.error || "Trakt import failed." });
    }
    setBusyAction("");
    loadSettings();
  });

  async function loadSettings() {
    try {
      const response = await axios.get("/external-imports/settings", { headers: authHeader() });
      setSettings(response.data?.trakt || null);
      setClientId(response.data?.trakt?.clientId || "");
      setUsers(Array.isArray(response.data?.users) ? response.data.users : []);
    } catch (error) {
      setMessage({ type: "danger", text: getErrorMessage(error, "Unable to load Trakt settings.") });
    }
  }

  useEffect(() => {
    loadSettings();
    return () => clearTimeout(pollRef.current);
  }, []);

  async function saveSettings(patch) {
    try {
      const response = await axios.post("/external-imports/trakt/settings", patch, { headers: authHeader() });
      setSettings(response.data?.trakt || null);
      return true;
    } catch (error) {
      setMessage({ type: "danger", text: getErrorMessage(error, "Unable to save Trakt settings.") });
      return false;
    }
  }

  async function saveCredentials() {
    setBusyAction("credentials");
    const ok = await saveSettings({ clientId, ...(clientSecret ? { clientSecret } : {}) });
    if (ok) {
      setClientSecret("");
      setMessage({ type: "success", text: "Trakt app details saved." });
    }
    setBusyAction("");
  }

  function schedulePoll(session, delaySeconds) {
    clearTimeout(pollRef.current);
    pollRef.current = setTimeout(async () => {
      try {
        const response = await axios.post("/external-imports/trakt/device/poll", { sessionId: session.sessionId }, { headers: authHeader() });
        const status = response.data?.status;
        if (status === "pending") return schedulePoll(session, session.interval);
        if (status === "slow_down") return schedulePoll(session, session.interval + 5);
        setDevice(null);
        if (status === "connected") {
          setSettings(response.data.settings?.trakt || null);
          setMessage({ type: "success", text: "Trakt account connected. Preview it below before importing." });
        } else {
          setMessage({ type: "warning", text: `Trakt sign-in ${status === "denied" ? "was denied" : status === "used" ? "code was already used" : "expired"}. Start again.` });
        }
      } catch (error) {
        setDevice(null);
        setMessage({ type: "danger", text: getErrorMessage(error, "Trakt sign-in failed.") });
      }
      return null;
    }, delaySeconds * 1000);
  }

  async function startConnect() {
    try {
      setBusyAction("connect");
      setMessage(null);
      const response = await axios.post("/external-imports/trakt/device/start", { jellyfinUserId: connectUser }, { headers: authHeader() });
      setDevice(response.data);
      schedulePoll(response.data, response.data.interval || 5);
    } catch (error) {
      setMessage({ type: "danger", text: getErrorMessage(error, "Unable to start Trakt sign-in.") });
    } finally {
      setBusyAction("");
    }
  }

  function cancelConnect() {
    clearTimeout(pollRef.current);
    setDevice(null);
  }

  async function disconnect(account) {
    try {
      setBusyAction(`disconnect-${account.id}`);
      const response = await axios.delete(`/external-imports/trakt/accounts/${account.id}`, { headers: authHeader() });
      setSettings(response.data?.trakt || null);
      setPreview(null);
      setResult(null);
    } catch (error) {
      setMessage({ type: "danger", text: getErrorMessage(error, "Unable to disconnect Trakt account.") });
    } finally {
      setBusyAction("");
    }
  }

  async function accountAction(account, action) {
    try {
      setBusyAction(`${action}-${account.id}`);
      setMessage(null);
      if (action === "preview") setResult(null);
      if (action === "import") {
        setResult(null);
        const response = await axios.post(`/external-imports/trakt/accounts/${account.id}/import`, { full: true, background: true }, { headers: authHeader() });
        track(response.data.job);
        return;
      }
      const response = await axios.post(`/external-imports/trakt/accounts/${account.id}/${action}`, { full: true }, { headers: authHeader() });
      setPreview(response.data);
      setBusyAction("");
    } catch (error) {
      setMessage({ type: "danger", text: getErrorMessage(error, "Trakt request failed.") });
      setBusyAction("");
    }
  }

  async function sendUpload(commit) {
    if (!uploadFile) return;
    const formData = new FormData();
    formData.append("file", uploadFile);
    formData.append("jellyfinUserId", uploadUser);
    formData.append("includeUnmatched", String(Boolean(settings?.includeUnmatched)));
    try {
      setBusyAction(commit ? "upload-import" : "upload-preview");
      setMessage(null);
      if (!commit) setResult(null);
      const response = await axios.post(`/external-imports/trakt/upload/${commit ? "import" : "preview"}`, formData, {
        headers: { ...authHeader(), "Content-Type": "multipart/form-data" },
      });
      setPreview(response.data);
      if (commit) {
        setResult(response.data);
        setMessage({ type: "success", text: `Added ${response.data.insertedRows} plays from ${uploadFile.name}.` });
      }
    } catch (error) {
      setMessage({ type: "danger", text: getErrorMessage(error, "Unable to read that Trakt export.") });
    } finally {
      setBusyAction("");
    }
  }

  const accounts = settings?.accounts || [];
  const hasCredentials = Boolean(settings?.clientId && settings?.hasClientSecret);

  return (
    <div className="legacy-import-page external-import-page">
      <header className="settings-section-header">
        <div>
          <span>Watch history</span>
          <h2>Trakt Import</h2>
          <p>
            Connect Trakt accounts, or upload a Trakt export, and bring their watch history in as plays for a Jellyfin user. Items are matched by IMDb,
            TMDb and TVDb IDs, then by title and year. Re-running is safe because duplicates are skipped.
          </p>
        </div>
      </header>

      {message ? (
        <Alert variant={message.type} onClose={() => setMessage(null)} dismissible>
          {message.text}
        </Alert>
      ) : null}

      <ImportJobProgress job={job} />

      <section className="legacy-import-panel">
        <div className="legacy-import-upload">
          <ImportSourceLogo source="trakt" size={38} className="legacy-import-logo" />
          <div>
            <span>Trakt app</span>
            <strong>{hasCredentials ? "Connected app details saved" : "Add your Trakt API app"}</strong>
            <small>
              Create one at{" "}
              <a href="https://trakt.tv/oauth/applications/new" target="_blank" rel="noreferrer">
                trakt.tv/oauth/applications
              </a>{" "}
              with redirect URI <code>urn:ietf:wg:oauth:2.0:oob</code>.
            </small>
          </div>
        </div>
        <div className="external-import-form">
          <Form.Control placeholder="Client ID" value={clientId} onChange={(event) => setClientId(event.target.value)} autoComplete="off" />
          <Form.Control
            type="password"
            placeholder={settings?.hasClientSecret ? "Client Secret (saved)" : "Client Secret"}
            value={clientSecret}
            onChange={(event) => setClientSecret(event.target.value)}
            autoComplete="new-password"
          />
          <Button type="button" variant="outline-primary" onClick={saveCredentials} disabled={!clientId || Boolean(busyAction)}>
            {busyAction === "credentials" ? <Spinner size="sm" animation="border" /> : null}
            Save
          </Button>
        </div>
      </section>

      <section className="legacy-import-review">
        <div className="legacy-import-review-header">
          <div>
            <span>Accounts</span>
            <h3>Connected Trakt Accounts</h3>
            <p>Each Trakt account is linked to one Jellyfin user. Sign-in uses a short code you enter on trakt.tv.</p>
          </div>
        </div>

        <div className="legacy-import-user-list">
          {accounts.length ? (
            accounts.map((account) => (
              <article key={account.id} className="legacy-import-user-row">
                <div>
                  <strong>
                    {account.username} <span className="external-import-arrow">to</span> {account.jellyfinUserName}
                  </strong>
                  <span>Last imported {formatDate(account.lastSyncAt)}</span>
                </div>
                <div className="external-import-row-actions">
                  <Button type="button" variant="outline-primary" onClick={() => accountAction(account, "preview")} disabled={Boolean(busyAction)}>
                    {busyAction === `preview-${account.id}` ? <Spinner size="sm" animation="border" /> : <FileSearchLineIcon size={18} />}
                    Preview
                  </Button>
                  <Button type="button" variant="primary" onClick={() => accountAction(account, "import")} disabled={Boolean(busyAction) || jobRunning}>
                    {busyAction === `import-${account.id}` ? <Spinner size="sm" animation="border" /> : <UploadCloud2LineIcon size={18} />}
                    Import
                  </Button>
                  <Button type="button" variant="outline-danger" onClick={() => disconnect(account)} disabled={Boolean(busyAction)} title="Disconnect">
                    <LinkUnlinkIcon size={18} />
                  </Button>
                </div>
              </article>
            ))
          ) : (
            <div className="legacy-import-empty">No Trakt accounts connected yet.</div>
          )}
        </div>

        {device ? (
          <div className="external-import-device">
            <span>Go to</span>
            <a href={device.verificationUrl} target="_blank" rel="noreferrer">
              {device.verificationUrl}
            </a>
            <span>and enter</span>
            <strong>{device.userCode}</strong>
            <Spinner size="sm" animation="border" />
            <Button type="button" variant="link" onClick={cancelConnect}>
              Cancel
            </Button>
          </div>
        ) : (
          <div className="external-import-form">
            <Form.Select value={connectUser} onChange={(event) => setConnectUser(event.target.value)} aria-label="Jellyfin user">
              <option value="">Jellyfin user for this Trakt account...</option>
              {users.map((user) => (
                <option key={user.Id} value={user.Id}>
                  {user.Name}
                </option>
              ))}
            </Form.Select>
            <Button type="button" variant="primary" onClick={startConnect} disabled={!hasCredentials || !connectUser || Boolean(busyAction)}>
              {busyAction === "connect" ? <Spinner size="sm" animation="border" /> : <LinkIcon size={18} />}
              Connect Trakt
            </Button>
          </div>
        )}

        <div className="external-import-options">
          <Form.Check
            type="switch"
            id="trakt-auto"
            label="Sync new Trakt plays automatically"
            checked={Boolean(settings?.autoSync)}
            onChange={(event) => saveSettings({ autoSync: event.target.checked })}
            disabled={!settings || !accounts.length}
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
            id="trakt-unmatched"
            label="Import unmatched plays (items not in your library)"
            checked={Boolean(settings?.includeUnmatched)}
            onChange={(event) => {
              saveSettings({ includeUnmatched: event.target.checked });
              setPreview(null);
            }}
            disabled={!settings}
          />
        </div>
      </section>

      <section className="legacy-import-panel">
        <div className="legacy-import-upload">
          <ImportSourceLogo source="trakt" size={38} className="legacy-import-logo" />
          <div>
            <span>Or upload an export</span>
            <strong>{uploadFile?.name || "No file chosen"}</strong>
            <small>Accepted: watched-history.json, watched-movies.json or watched-shows.json from a Trakt export.</small>
          </div>
          <label className="legacy-import-upload-button">
            <FileSearchLineIcon size={18} />
            Choose file
            <input
              ref={fileInputRef}
              type="file"
              accept=".json,application/json"
              onChange={(event) => {
                setUploadFile(event.target.files?.[0] || null);
                setPreview(null);
                setResult(null);
              }}
              disabled={Boolean(busyAction)}
            />
          </label>
        </div>
        <div className="external-import-form">
          <Form.Select value={uploadUser} onChange={(event) => setUploadUser(event.target.value)} aria-label="Jellyfin user for upload">
            <option value="">Jellyfin user for these plays...</option>
            {users.map((user) => (
              <option key={user.Id} value={user.Id}>
                {user.Name}
              </option>
            ))}
          </Form.Select>
          <Button type="button" variant="outline-primary" onClick={() => sendUpload(false)} disabled={!uploadFile || !uploadUser || Boolean(busyAction)}>
            {busyAction === "upload-preview" ? <Spinner size="sm" animation="border" /> : <FileSearchLineIcon size={18} />}
            Preview
          </Button>
          <Button type="button" variant="primary" onClick={() => sendUpload(true)} disabled={!uploadFile || !uploadUser || Boolean(busyAction)}>
            {busyAction === "upload-import" ? <Spinner size="sm" animation="border" /> : <UploadCloud2LineIcon size={18} />}
            Import
          </Button>
        </div>
      </section>

      <Summary data={preview} result={result} />
    </div>
  );
}
