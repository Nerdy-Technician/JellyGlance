import { useEffect, useRef, useState } from "react";
import { Alert, Button, Spinner } from "react-bootstrap";
import Database2LineIcon from "remixicon-react/Database2LineIcon";
import FileSearchLineIcon from "remixicon-react/FileSearchLineIcon";
import UploadCloud2LineIcon from "remixicon-react/UploadCloud2LineIcon";
import axios from "../../../lib/axios_instance";

function authHeader() {
  return { Authorization: `Bearer ${localStorage.getItem("token")}` };
}

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function getErrorMessage(error, fallback) {
  const data = error.response?.data;
  if (typeof data === "string") return data;
  return data?.error || data?.errorMessage || fallback;
}

function formatDate(value) {
  if (!value) return "Unknown";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Unknown";
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function formatSize(sizeInBytes = 0) {
  const units = ["B", "KB", "MB", "GB"];
  let size = Number(sizeInBytes) || 0;
  let unitIndex = 0;
  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex += 1;
  }
  return `${size.toFixed(unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`;
}

export default function JellystatImport() {
  const fileInputRef = useRef(null);
  const [uploadedBackup, setUploadedBackup] = useState(null);
  const [preview, setPreview] = useState(null);
  const [result, setResult] = useState(null);
  const [unmatchedUsers, setUnmatchedUsers] = useState([]);
  const [jellyfinUsers, setJellyfinUsers] = useState([]);
  const [selectedUserMatch, setSelectedUserMatch] = useState({});
  const [message, setMessage] = useState(null);
  const [busyAction, setBusyAction] = useState("");

  async function loadUnmatchedUsers() {
    try {
      const response = await axios.get("/jellystat/unmatched-users", { headers: authHeader() });
      setUnmatchedUsers(asArray(response.data?.unmatched));
      setJellyfinUsers(asArray(response.data?.users));
    } catch (error) {
      setMessage({ type: "danger", text: getErrorMessage(error, "Unable to load unmatched Jellystat users.") });
    }
  }

  useEffect(() => {
    loadUnmatchedUsers();
  }, []);

  async function uploadAndPreview(event) {
    const file = event.target.files?.[0];
    if (!file) return;

    const formData = new FormData();
    formData.append("file", file);
    try {
      setBusyAction("upload");
      setMessage(null);
      setResult(null);
      const response = await axios.post("/jellystat/upload-preview", formData, {
        headers: {
          ...authHeader(),
          "Content-Type": "multipart/form-data",
        },
      });
      setUploadedBackup(response.data);
      setPreview(response.data);
      setMessage({ type: "success", text: `${file.name} uploaded and previewed. Review the range, then import when ready.` });
    } catch (error) {
      setUploadedBackup(null);
      setPreview(null);
      setMessage({ type: "danger", text: getErrorMessage(error, "Unable to upload Jellystat backup.") });
    } finally {
      setBusyAction("");
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  async function importBackup() {
    if (!uploadedBackup?.uploadId) return;
    const confirmed = window.confirm("Import this Jellystat watch history? Existing JellyGlance rows will be left alone and matching rows will be skipped.");
    if (!confirmed) return;

    try {
      setBusyAction("import");
      setMessage(null);
      const response = await axios.post(
        "/jellystat/import",
        { uploadId: uploadedBackup.uploadId },
        { headers: { ...authHeader(), "Content-Type": "application/json" } }
      );
      setResult(response.data);
      setPreview(response.data);
      setUploadedBackup(null);
      window.dispatchEvent(new CustomEvent("jellyglance-history-imported", { detail: response.data }));
      setMessage({ type: "success", text: `Imported ${response.data.insertedRows} new Jellystat plays. ${response.data.skippedRows} rows were skipped safely.` });
      await loadUnmatchedUsers();
    } catch (error) {
      setMessage({ type: "danger", text: getErrorMessage(error, "Unable to import Jellystat history.") });
    } finally {
      setBusyAction("");
    }
  }

  async function linkUser(sourceUserId) {
    const targetId = selectedUserMatch[sourceUserId];
    const target = jellyfinUsers.find((user) => user.Id === targetId);
    if (!target) return;

    try {
      setBusyAction(`link-user-${sourceUserId}`);
      const response = await axios.post(
        "/jellystat/link-user",
        { sourceUserId, target },
        { headers: { ...authHeader(), "Content-Type": "application/json" } }
      );
      setMessage({ type: "success", text: `Linked ${response.data.updatedRows} imported plays to ${target.Name}.` });
      window.dispatchEvent(new CustomEvent("jellyglance-history-imported", { detail: response.data }));
      await loadUnmatchedUsers();
    } catch (error) {
      setMessage({ type: "danger", text: getErrorMessage(error, "Unable to link Jellystat user.") });
    } finally {
      setBusyAction("");
    }
  }

  return (
    <div className="legacy-import-page">
      <header className="settings-section-header">
        <div>
          <span>Legacy history</span>
          <h2>Jellystat Import</h2>
          <p>Upload a Jellystat JSON backup and append its watch history into JellyGlance before the first sync runs.</p>
        </div>
      </header>

      {message ? (
        <Alert variant={message.type} onClose={() => setMessage(null)} dismissible>
          {message.text}
        </Alert>
      ) : null}

      <section className="legacy-import-panel">
        <div className="legacy-import-upload">
          <Database2LineIcon />
          <div>
            <span>Jellystat backup file</span>
            <strong>{uploadedBackup?.originalName || (result?.sourceFile ? String(result.sourceFile).split("/").pop() : "") || "No backup uploaded"}</strong>
            <small>{uploadedBackup ? `${formatSize(uploadedBackup.size)} · ready to import` : "Accepted format: Jellystat .json backup"}</small>
          </div>
          <label className="legacy-import-upload-button">
            {busyAction === "upload" ? <Spinner size="sm" animation="border" /> : <FileSearchLineIcon size={18} />}
            Upload and preview
            <input ref={fileInputRef} type="file" accept=".json,application/json" onChange={uploadAndPreview} disabled={Boolean(busyAction)} />
          </label>
        </div>

        <div className="legacy-import-actions">
          <Button type="button" variant="primary" onClick={importBackup} disabled={!uploadedBackup?.uploadId || Boolean(busyAction)}>
            {busyAction === "import" ? <Spinner size="sm" animation="border" /> : <UploadCloud2LineIcon size={18} />}
            Import uploaded history
          </Button>
        </div>
      </section>

      {preview ? (
        <section className="legacy-import-summary">
          <article>
            <span>Playable rows</span>
            <strong>{preview.totalRows ?? 0}</strong>
            <small>Rows found in jf_playback_activity.</small>
          </article>
          <article>
            <span>History range</span>
            <strong>{formatDate(preview.firstActivityDate)}</strong>
            <small>to {formatDate(preview.lastActivityDate)}</small>
          </article>
          <article>
            <span>Already imported</span>
            <strong>{preview.alreadyImportedRows ?? result?.skippedRows ?? 0}</strong>
            <small>Rows with Jellystat IDs currently in JellyGlance.</small>
          </article>
          {result ? (
            <article>
              <span>New rows added</span>
              <strong>{result.insertedRows}</strong>
              <small>{result.skippedRows} skipped safely.</small>
            </article>
          ) : null}
        </section>
      ) : null}

      <section className="legacy-import-review">
        <div className="legacy-import-review-header">
          <div>
            <span>User matching</span>
            <h3>Unmatched Jellystat Users</h3>
            <p>Map legacy Jellystat users to Jellyfin users when the backup user IDs no longer match this server.</p>
          </div>
          <Button type="button" variant="outline-primary" onClick={loadUnmatchedUsers} disabled={Boolean(busyAction)}>
            Refresh
          </Button>
        </div>

        <div className="legacy-import-user-list">
          {unmatchedUsers.length ? unmatchedUsers.map((user) => (
            <article key={user.UserId} className="legacy-import-user-row">
              <div>
                <strong>{user.UserName}</strong>
                <span>{user.PlayCount} plays · last {formatDate(user.LastActivityDate)}</span>
              </div>
              <select
                value={selectedUserMatch[user.UserId] || ""}
                onChange={(event) =>
                  setSelectedUserMatch((current) => ({ ...current, [user.UserId]: event.target.value }))
                }
              >
                <option value="">Choose Jellyfin user...</option>
                {jellyfinUsers.map((jellyfinUser) => (
                  <option value={jellyfinUser.Id} key={jellyfinUser.Id}>
                    {jellyfinUser.Name}
                  </option>
                ))}
              </select>
              <Button
                type="button"
                variant="primary"
                onClick={() => linkUser(user.UserId)}
                disabled={!selectedUserMatch[user.UserId] || Boolean(busyAction)}
              >
                {busyAction === `link-user-${user.UserId}` ? <Spinner size="sm" animation="border" /> : <UploadCloud2LineIcon size={18} />}
                Link user
              </Button>
            </article>
          )) : (
            <div className="legacy-import-empty">No unmatched imported Jellystat users found.</div>
          )}
        </div>
      </section>
    </div>
  );
}
