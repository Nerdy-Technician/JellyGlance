import { useEffect, useRef, useState } from "react";
import { Alert, Button, Spinner } from "react-bootstrap";
import Database2LineIcon from "remixicon-react/Database2LineIcon";
import FileSearchLineIcon from "remixicon-react/FileSearchLineIcon";
import UploadCloud2LineIcon from "remixicon-react/UploadCloud2LineIcon";
import axios from "../../../lib/axios_instance";

function authHeader() {
  return { Authorization: `Bearer ${localStorage.getItem("token")}` };
}

function formatDate(value) {
  if (!value) return "Unknown";
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
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

export default function TautulliImport() {
  const fileInputRef = useRef(null);
  const [uploadedBackup, setUploadedBackup] = useState(null);
  const [preview, setPreview] = useState(null);
  const [result, setResult] = useState(null);
  const [unmatched, setUnmatched] = useState([]);
  const [selectedGroup, setSelectedGroup] = useState(null);
  const [mediaSearch, setMediaSearch] = useState("");
  const [mediaResults, setMediaResults] = useState([]);
  const [selectedTarget, setSelectedTarget] = useState(null);
  const [message, setMessage] = useState(null);
  const [busyAction, setBusyAction] = useState("");

  async function loadUnmatched() {
    try {
      const response = await axios.get("/tautulli/unmatched", { headers: authHeader() });
      setUnmatched(response.data || []);
    } catch (error) {
      setMessage({ type: "danger", text: error.response?.data?.error || "Unable to load unmatched Tautulli rows." });
    }
  }

  useEffect(() => {
    loadUnmatched();
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
      const response = await axios.post("/tautulli/upload-preview", formData, {
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
      setMessage({ type: "danger", text: error.response?.data?.error || "Unable to upload Tautulli backup." });
    } finally {
      setBusyAction("");
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  async function importBackup() {
    if (!uploadedBackup?.uploadId) return;
    const confirmed = window.confirm("Import this Tautulli watch history? Existing JellyGlance rows will be left alone and matching rows will be skipped.");
    if (!confirmed) return;

    try {
      setBusyAction("import");
      setMessage(null);
      const response = await axios.post(
        "/tautulli/import",
        { uploadId: uploadedBackup.uploadId },
        { headers: { ...authHeader(), "Content-Type": "application/json" } }
      );
      setResult(response.data);
      setPreview(response.data);
      setUploadedBackup(null);
      window.dispatchEvent(new CustomEvent("jellyglance-history-imported", { detail: response.data }));
      setMessage({
        type: "success",
        text: `Imported ${response.data.insertedRows} new Tautulli plays. Matched ${response.data.matchedJellyfinRows} rows to Jellyfin media and repaired ${response.data.repairedRows} existing imported rows.`,
      });
      await loadUnmatched();
    } catch (error) {
      setMessage({ type: "danger", text: error.response?.data?.error || "Unable to import Tautulli history." });
    } finally {
      setBusyAction("");
    }
  }

  async function searchJellyfinMedia(event) {
    event?.preventDefault();
    if (mediaSearch.trim().length < 2) return;
    try {
      setBusyAction("search");
      setSelectedTarget(null);
      const response = await axios.get("/tautulli/search-media", {
        params: { search: mediaSearch.trim() },
        headers: authHeader(),
      });
      setMediaResults(response.data || []);
    } catch (error) {
      setMessage({ type: "danger", text: error.response?.data?.error || "Unable to search Jellyfin media." });
    } finally {
      setBusyAction("");
    }
  }

  async function linkSelectedGroup() {
    if (!selectedGroup?.Ids?.length || !selectedTarget) return;
    try {
      setBusyAction("link");
      const response = await axios.post(
        "/tautulli/link-media",
        { ids: selectedGroup.Ids, target: selectedTarget },
        { headers: { ...authHeader(), "Content-Type": "application/json" } }
      );
      setMessage({ type: "success", text: `Linked ${response.data.updatedRows} imported plays to ${selectedTarget.Name}.` });
      setSelectedGroup(null);
      setSelectedTarget(null);
      setMediaResults([]);
      setMediaSearch("");
      window.dispatchEvent(new CustomEvent("jellyglance-history-imported", { detail: response.data }));
      await loadUnmatched();
    } catch (error) {
      setMessage({ type: "danger", text: error.response?.data?.error || "Unable to link imported rows." });
    } finally {
      setBusyAction("");
    }
  }

  function describeMediaResult(item) {
    if (item.Type === "Episode") {
      return `${item.SeriesName} · S${item.SeasonNumber ?? "?"} E${item.EpisodeNumber ?? "?"}`;
    }
    return [item.Type, item.ProductionYear].filter(Boolean).join(" · ");
  }

  return (
    <div className="legacy-import-page">
      <header className="settings-section-header">
        <div>
          <span>Legacy history</span>
          <h2>Tautulli Import</h2>
          <p>Upload an old Tautulli backup and append its Plex watch history into JellyGlance without overwriting current playback data.</p>
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
            <span>Tautulli backup file</span>
            <strong>{uploadedBackup?.originalName || result?.sourceFile?.split("/").pop() || "No backup uploaded"}</strong>
            <small>
              {uploadedBackup
                ? `${formatSize(uploadedBackup.size)} · ready to import`
                : "Accepted formats: .db, .db.zip, or .zip"}
            </small>
          </div>
          <label className="legacy-import-upload-button">
            {busyAction === "upload" ? <Spinner size="sm" animation="border" /> : <FileSearchLineIcon size={18} />}
            Upload and preview
            <input ref={fileInputRef} type="file" accept=".db,.zip,.db.zip,application/zip" onChange={uploadAndPreview} disabled={Boolean(busyAction)} />
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
            <small>Music tracks are ignored for now.</small>
          </article>
          <article>
            <span>History range</span>
            <strong>{formatDate(preview.firstActivityDate)}</strong>
            <small>to {formatDate(preview.lastActivityDate)}</small>
          </article>
          <article>
            <span>Already imported</span>
            <strong>{preview.alreadyImportedRows ?? result?.skippedRows ?? 0}</strong>
            <small>Rows with Tautulli IDs currently in JellyGlance.</small>
          </article>
          {result ? (
            <article>
              <span>New rows added</span>
              <strong>{result.insertedRows}</strong>
              <small>{result.skippedRows} skipped safely.</small>
            </article>
          ) : null}
          {result ? (
            <article>
              <span>Jellyfin matches</span>
              <strong>{result.matchedJellyfinRows}</strong>
              <small>{result.repairedRows} old imported rows repaired.</small>
            </article>
          ) : null}
        </section>
      ) : null}

      <section className="legacy-import-review">
        <div className="legacy-import-review-header">
          <div>
            <span>Manual linking</span>
            <h3>Unmatched Tautulli Media</h3>
            <p>Link imported rows that still point at legacy Tautulli IDs to the matching Jellyfin media.</p>
          </div>
          <Button type="button" variant="outline-primary" onClick={loadUnmatched} disabled={Boolean(busyAction)}>
            Refresh
          </Button>
        </div>

        <div className="legacy-import-review-layout">
          <div className="legacy-import-unmatched-list">
            {unmatched.length ? unmatched.map((group) => (
              <button
                type="button"
                key={`${group.SeriesName}-${group.NowPlayingItemName}-${group.MediaType}`}
                className={selectedGroup === group ? "is-selected" : ""}
                onClick={() => {
                  setSelectedGroup(group);
                  setMediaSearch(group.SeriesName ? `${group.SeriesName} ${group.NowPlayingItemName}` : group.NowPlayingItemName);
                  setMediaResults([]);
                  setSelectedTarget(null);
                }}
              >
                <strong>{group.SeriesName ? `${group.SeriesName} - ${group.NowPlayingItemName}` : group.NowPlayingItemName}</strong>
                <span>{group.MediaType} · {group.PlayCount} plays · last {formatDate(group.LastActivityDate)}</span>
              </button>
            )) : (
              <div className="legacy-import-empty">No unmatched imported media found.</div>
            )}
          </div>

          <div className="legacy-import-linker">
            <form className="legacy-import-search" onSubmit={searchJellyfinMedia}>
              <input
                type="search"
                value={mediaSearch}
                onChange={(event) => setMediaSearch(event.target.value)}
                placeholder="Search Jellyfin media..."
                disabled={!selectedGroup}
              />
              <Button type="submit" variant="outline-primary" disabled={!selectedGroup || mediaSearch.trim().length < 2 || Boolean(busyAction)}>
                {busyAction === "search" ? <Spinner size="sm" animation="border" /> : <FileSearchLineIcon size={18} />}
                Search
              </Button>
            </form>

            <div className="legacy-import-results">
              {mediaResults.map((item) => (
                <button
                  type="button"
                  key={`${item.Type}-${item.Id}-${item.EpisodeId || ""}`}
                  className={selectedTarget === item ? "is-selected" : ""}
                  onClick={() => setSelectedTarget(item)}
                >
                  <strong>{item.Type === "Episode" ? item.Name : item.Name}</strong>
                  <span>{describeMediaResult(item)}</span>
                </button>
              ))}
              {selectedGroup && !mediaResults.length ? <div className="legacy-import-empty">Search for the Jellyfin item to link this group.</div> : null}
            </div>

            <Button type="button" variant="primary" onClick={linkSelectedGroup} disabled={!selectedGroup || !selectedTarget || Boolean(busyAction)}>
              {busyAction === "link" ? <Spinner size="sm" animation="border" /> : <UploadCloud2LineIcon size={18} />}
              Link selected media
            </Button>
          </div>
        </div>
      </section>
    </div>
  );
}
