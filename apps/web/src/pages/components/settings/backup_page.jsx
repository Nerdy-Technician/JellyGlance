import { useEffect, useMemo, useRef, useState } from "react";
import axios from "../../../lib/axios_instance";
import { Alert, Button, Spinner } from "react-bootstrap";
import ArchiveDrawerFillIcon from "remixicon-react/ArchiveDrawerFillIcon";
import Database2LineIcon from "remixicon-react/Database2LineIcon";
import DownloadCloud2LineIcon from "remixicon-react/DownloadCloud2LineIcon";
import UploadCloud2LineIcon from "remixicon-react/UploadCloud2LineIcon";
import DeleteBinLineIcon from "remixicon-react/DeleteBinLineIcon";
import RefreshLineIcon from "remixicon-react/RefreshLineIcon";
import CheckboxCircleLineIcon from "remixicon-react/CheckboxCircleLineIcon";
import ErrorWarningLineIcon from "remixicon-react/ErrorWarningLineIcon";
import "../../css/settings/backups.css";

function getHeaders(contentType = "application/json") {
  const token = localStorage.getItem("token");
  return {
    Authorization: `Bearer ${token}`,
    "Content-Type": contentType,
  };
}

function formatFileSize(sizeInBytes = 0) {
  const units = ["B", "KB", "MB", "GB", "TB"];
  let size = Number(sizeInBytes) || 0;
  let unitIndex = 0;
  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex += 1;
  }
  return `${size.toFixed(unitIndex === 0 ? 0 : 2)} ${units[unitIndex]}`;
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

function BackupPage() {
  const fileInputRef = useRef(null);
  const [tables, setTables] = useState([]);
  const [files, setFiles] = useState([]);
  const [message, setMessage] = useState(null);
  const [busyAction, setBusyAction] = useState("");
  const [uploadProgress, setUploadProgress] = useState(0);

  const sortedFiles = useMemo(() => [...files].sort((a, b) => new Date(b.datecreated) - new Date(a.datecreated)), [files]);
  const includedTables = tables.filter((table) => !table.Excluded);
  const excludedTables = tables.filter((table) => table.Excluded);
  const totalSize = sortedFiles.reduce((sum, file) => sum + Number(file.size || 0), 0);
  const latestBackup = sortedFiles[0];

  async function fetchData() {
    try {
      const [tableResponse, fileResponse] = await Promise.all([
        axios.get("/api/getBackupTables", { headers: getHeaders() }),
        axios.get("/backup/files", { headers: getHeaders() }),
      ]);
      setTables(tableResponse.data || []);
      setFiles(fileResponse.data || []);
    } catch (error) {
      setMessage({ type: "danger", text: error.response?.data || "Unable to load backup data" });
    }
  }

  useEffect(() => {
    fetchData();
    const intervalId = setInterval(fetchData, 60000 * 5);
    return () => clearInterval(intervalId);
  }, []);

  async function toggleTable(table) {
    try {
      const response = await axios.post("/api/setExcludedBackupTable", { table }, { headers: getHeaders() });
      setTables(response.data || []);
    } catch (error) {
      setMessage({ type: "danger", text: error.response?.data || "Unable to update backup tables" });
    }
  }

  async function createBackup() {
    try {
      setBusyAction("create");
      setMessage(null);
      await axios.get("/backup/beginBackup", { headers: getHeaders() });
      await fetchData();
      setMessage({ type: "success", text: "Backup created successfully." });
    } catch (error) {
      setMessage({ type: "danger", text: error.response?.data || "Backup failed" });
    } finally {
      setBusyAction("");
    }
  }

  async function downloadBackup(filename) {
    try {
      setBusyAction(`download-${filename}`);
      const response = await axios.get(`/backup/files/${encodeURIComponent(filename)}/ticket`, { headers: getHeaders() });
      const link = document.createElement("a");
      link.href = response.data.url;
      link.setAttribute("download", filename);
      document.body.appendChild(link);
      link.click();
      link.parentNode.removeChild(link);
    } catch (error) {
      setMessage({ type: "danger", text: error.response?.data || "Unable to download backup" });
    } finally {
      setBusyAction("");
    }
  }

  async function restoreBackup(filename) {
    const confirmed = window.confirm(`Restore ${filename}? This imports backup rows into the database.`);
    if (!confirmed) return;

    try {
      setBusyAction(`restore-${filename}`);
      const response = await axios.get(`/backup/restore/${encodeURIComponent(filename)}`, { headers: getHeaders() });
      localStorage.removeItem("config");
      localStorage.removeItem("PREF_ACTIVITY_libraryFilters");
      window.dispatchEvent(new Event("jellyglance-config-updated"));
      window.dispatchEvent(new CustomEvent("jellyglance-backup-restored", { detail: response.data }));
      setMessage({ type: "success", text: response.data?.message || "Restore completed successfully." });
      await fetchData();
    } catch (error) {
      setMessage({ type: "danger", text: error.response?.data || "Restore failed" });
    } finally {
      setBusyAction("");
    }
  }

  async function deleteBackup(filename) {
    const confirmed = window.confirm(`Delete ${filename}?`);
    if (!confirmed) return;

    try {
      setBusyAction(`delete-${filename}`);
      await axios.delete(`/backup/files/${encodeURIComponent(filename)}`, { headers: getHeaders() });
      setMessage({ type: "success", text: `${filename} deleted.` });
      await fetchData();
    } catch (error) {
      setMessage({ type: "danger", text: error.response?.data || "Unable to delete backup" });
    } finally {
      setBusyAction("");
    }
  }

  async function uploadBackup(event) {
    const file = event.target.files?.[0];
    if (!file) return;

    const formData = new FormData();
    formData.append("file", file);
    try {
      setBusyAction("upload");
      setUploadProgress(0);
      await axios.post("/backup/upload", formData, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem("token")}`,
          "Content-Type": "multipart/form-data",
        },
        onUploadProgress: (progressEvent) => {
          setUploadProgress(Math.round((progressEvent.loaded / progressEvent.total) * 100));
        },
      });
      setMessage({ type: "success", text: `${file.name} uploaded.` });
      await fetchData();
    } catch (error) {
      setMessage({ type: "danger", text: error.response?.data || "Upload failed" });
    } finally {
      setBusyAction("");
      setUploadProgress(0);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  return (
    <div className="backup-page">
      <header className="backup-hero">
        <div>
          <span>Recovery Center</span>
          <h1>Backups</h1>
          <p>Create portable JSON backups, choose what data is included, and restore uploaded backup files.</p>
        </div>
        <div className="backup-hero-actions">
          <Button type="button" variant="primary" onClick={createBackup} disabled={Boolean(busyAction)}>
            {busyAction === "create" ? <Spinner size="sm" animation="border" /> : <ArchiveDrawerFillIcon size={18} />}
            Create Backup
          </Button>
          <label className="backup-upload-button">
            {busyAction === "upload" ? <Spinner size="sm" animation="border" /> : <UploadCloud2LineIcon size={18} />}
            Upload Backup
            <input ref={fileInputRef} type="file" accept=".json,application/json" onChange={uploadBackup} />
          </label>
        </div>
      </header>

      {message ? (
        <Alert variant={message.type} onClose={() => setMessage(null)} dismissible>
          {message.text}
        </Alert>
      ) : null}

      <section className="backup-summary-grid">
        <article>
          <Database2LineIcon />
          <div>
            <span>Included tables</span>
            <strong>{includedTables.length}</strong>
            <small>{excludedTables.length} excluded</small>
          </div>
        </article>
        <article>
          <ArchiveDrawerFillIcon />
          <div>
            <span>Backup files</span>
            <strong>{files.length}</strong>
            <small>{formatFileSize(totalSize)} stored</small>
          </div>
        </article>
        <article>
          <RefreshLineIcon />
          <div>
            <span>Latest backup</span>
            <strong>{latestBackup ? formatDate(latestBackup.datecreated) : "None yet"}</strong>
            <small>{latestBackup?.name || "Create a backup to start"}</small>
          </div>
        </article>
      </section>

      <section className="backup-panel">
        <div className="backup-panel-heading">
          <div>
            <Database2LineIcon size={22} />
            <h2>Backup Coverage</h2>
          </div>
          <span>{includedTables.length} of {tables.length} tables included</span>
        </div>
        <div className="backup-table-chip-grid">
          {tables.map((table) => (
            <button
              type="button"
              key={table.value}
              className={`backup-table-chip ${table.Excluded ? "is-excluded" : "is-included"}`}
              onClick={() => toggleTable(table.value)}
            >
              {table.Excluded ? <ErrorWarningLineIcon size={16} /> : <CheckboxCircleLineIcon size={16} />}
              <span>{table.name}</span>
              <small>{table.Excluded ? "Excluded" : "Included"}</small>
            </button>
          ))}
        </div>
      </section>

      <section className="backup-panel">
        <div className="backup-panel-heading">
          <div>
            <ArchiveDrawerFillIcon size={22} />
            <h2>Backup Files</h2>
          </div>
          {busyAction === "upload" ? <span>Uploading {uploadProgress}%</span> : <span>{files.length} available</span>}
        </div>

        <div className="backup-file-grid">
          {sortedFiles.map((file) => (
            <article className="backup-file-card" key={file.name}>
              <div className="backup-file-icon">
                <ArchiveDrawerFillIcon size={26} />
              </div>
              <div className="backup-file-main">
                <h3>{file.name}</h3>
                <div className="backup-file-meta">
                  <span>{formatDate(file.datecreated)}</span>
                  <span>{formatFileSize(file.size)}</span>
                </div>
              </div>
              <div className="backup-file-actions">
                <Button type="button" variant="outline-primary" onClick={() => downloadBackup(file.name)} disabled={Boolean(busyAction)}>
                  {busyAction === `download-${file.name}` ? <Spinner size="sm" animation="border" /> : <DownloadCloud2LineIcon size={16} />}
                  Download
                </Button>
                <Button type="button" variant="outline-secondary" onClick={() => restoreBackup(file.name)} disabled={Boolean(busyAction)}>
                  {busyAction === `restore-${file.name}` ? <Spinner size="sm" animation="border" /> : <RefreshLineIcon size={16} />}
                  Restore
                </Button>
                <Button type="button" variant="outline-danger" onClick={() => deleteBackup(file.name)} disabled={Boolean(busyAction)}>
                  {busyAction === `delete-${file.name}` ? <Spinner size="sm" animation="border" /> : <DeleteBinLineIcon size={16} />}
                  Delete
                </Button>
              </div>
            </article>
          ))}
          {sortedFiles.length === 0 ? (
            <div className="backup-empty-state">
              <ArchiveDrawerFillIcon size={30} />
              <strong>No backups yet</strong>
              <span>Create a backup or upload an existing JellyGlance JSON backup.</span>
            </div>
          ) : null}
        </div>
      </section>
    </div>
  );
}

export default BackupPage;
