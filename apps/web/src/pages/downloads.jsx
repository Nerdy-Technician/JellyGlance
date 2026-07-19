import { useEffect, useMemo, useRef, useState } from "react";
import AddLineIcon from "remixicon-react/AddLineIcon";
import CloseLineIcon from "remixicon-react/CloseLineIcon";
import DownloadCloud2FillIcon from "remixicon-react/DownloadCloud2FillIcon";
import FileUploadLineIcon from "remixicon-react/FileUploadLineIcon";
import PauseLineIcon from "remixicon-react/PauseLineIcon";
import PlayLineIcon from "remixicon-react/PlayLineIcon";
import TimerFlashLineIcon from "remixicon-react/TimerFlashLineIcon";
import axios from "../lib/axios_instance";
import { loadSavedIntegrations } from "../lib/integrations-storage";
import "./css/integrations.css";

const iconUrl = (slug) => `https://cdn.jsdelivr.net/gh/selfhst/icons/svg/${slug}.svg`;

function clientIcon(client) {
  if (!client.slug) return null;
  return <img src={iconUrl(client.slug)} alt="" loading="lazy" decoding="async" />;
}

function normalizeName(value = "") {
  return value.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function friendlyTorrentName(value, file) {
  if (file?.name) return file.name;
  const trimmed = value.trim();
  if (!trimmed) return "New torrent";
  if (trimmed.startsWith("magnet:")) {
    const match = trimmed.match(/[?&]dn=([^&]+)/);
    return match ? decodeURIComponent(match[1].replace(/\+/g, " ")) : "Magnet download";
  }
  return trimmed.split("/").pop() || "Torrent download";
}

export default function Downloads() {
  const fileInputRef = useRef(null);
  const [integrations, setIntegrations] = useState(loadSavedIntegrations({ clients: [] }));
  const savedClients = integrations.clients || [];
  const usableClients = savedClients.filter((client) => client.protocol === "Torrent" || client.protocol === "Usenet");
  const [selectedClientId, setSelectedClientId] = useState(usableClients[0]?.instanceId || "");
  const [torrentValue, setTorrentValue] = useState("");
  const [torrentFile, setTorrentFile] = useState(null);
  const [downloads, setDownloads] = useState([]);
  const [message, setMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const selectedClient = usableClients.find((client) => client.instanceId === selectedClientId) || usableClients[0];
  const clientByName = useMemo(() => {
    return usableClients.reduce((map, client) => {
      map.set(normalizeName(client.name), client);
      return map;
    }, new Map());
  }, [usableClients]);
  const activeCount = downloads.filter((download) => download.progress < 100).length;

  async function loadDownloadData() {
    try {
      const [integrationResponse, downloadResponse] = await Promise.all([
        axios.get("/api/integrations", {
          headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
        }),
        axios.get("/api/integrations/downloads", {
          headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
        }),
      ]);
      setIntegrations(integrationResponse.data || { clients: [] });
      if (Array.isArray(downloadResponse.data?.items)) {
        setDownloads(downloadResponse.data.items);
      }
    } catch (error) {
      console.log("Unable to load download sync data", error);
    }
  }

  async function runDownloadSync() {
    try {
      await axios.get("/api/startTask?task=DownloadQueueSync", {
        headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
      });
      window.setTimeout(loadDownloadData, 2000);
    } catch (error) {
      console.log("Unable to start download sync", error);
    }
  }

  useEffect(() => {
    localStorage.setItem("jellyglance_active_download_count", String(activeCount));
    window.dispatchEvent(new CustomEvent("jellyglance-download-count", { detail: activeCount }));
  }, [activeCount]);

  useEffect(() => {
    loadDownloadData();
  }, []);

  useEffect(() => {
    if (!selectedClientId && usableClients[0]?.instanceId) {
      setSelectedClientId(usableClients[0].instanceId);
    }
  }, [selectedClientId, usableClients]);

  async function addTorrent() {
    if (!selectedClient) {
      setMessage("Add a download client in Settings > Integrations first.");
      return;
    }

    if (!torrentValue.trim() && !torrentFile) return;

    const nextDownload = {
      id: `${Date.now()}`,
      name: friendlyTorrentName(torrentValue, torrentFile),
      client: selectedClient.name,
      source: "Other",
      state: torrentFile ? "torrentFile" : torrentValue.trim().startsWith("magnet:") ? "magnet" : "torrentURL",
      progress: 0,
      size: "Queued",
      down: "0 B/s",
      up: "0 B/s",
    };

    setIsSubmitting(true);
    setMessage("");
    try {
      await axios.post("/api/downloads/add", {
        client: selectedClient.name,
        value: torrentValue,
        fileName: torrentFile?.name,
      });
      setMessage(`${nextDownload.name} queued for ${selectedClient.name}`);
    } catch (error) {
      setMessage(error?.response?.data?.error || "Unable to queue download");
      setIsSubmitting(false);
      return;
    }

    setDownloads((current) => [nextDownload, ...current]);
    setTorrentValue("");
    setTorrentFile(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
    setIsSubmitting(false);
  }

  function removeDownload(id) {
    setDownloads((current) => current.filter((download) => download.id !== id));
  }

  return (
    <div className="downloads-page">
      <header className="download-page-header">
        <div>
          <p>Queue monitor</p>
          <h1>Downloads</h1>
          <span>Send magnet links or torrent files to connected clients and track active queue state.</span>
        </div>
      </header>

      <section className="download-add-bar">
        <label>
          <span>Client</span>
          <select value={selectedClientId} onChange={(event) => setSelectedClientId(event.target.value)} disabled={!usableClients.length}>
            {usableClients.length ? (
              usableClients.map((client) => (
                <option value={client.instanceId} key={client.instanceId}>
                  {client.name}
                </option>
              ))
            ) : (
              <option>No clients added</option>
            )}
          </select>
        </label>
        <label className="download-magnet-field">
          <span>Torrent URL or Magnet</span>
          <input value={torrentValue} onChange={(event) => setTorrentValue(event.target.value)} placeholder="magnet:?xt=... or https://example/torrent.torrent" />
        </label>
        <label className="download-file-button">
          <FileUploadLineIcon size={16} />
          <span>{torrentFile ? torrentFile.name : "Torrent File"}</span>
          <input ref={fileInputRef} type="file" accept=".torrent,application/x-bittorrent" onChange={(event) => setTorrentFile(event.target.files?.[0] || null)} />
        </label>
        <button type="button" className="download-add-button" onClick={addTorrent} disabled={isSubmitting || !usableClients.length}>
          <AddLineIcon size={18} />
          {isSubmitting ? "Adding..." : "Add Torrent"}
        </button>
        <button type="button" className="download-add-button" onClick={runDownloadSync}>
          <TimerFlashLineIcon size={18} />
          Sync Now
        </button>
      </section>
      {message ? <p className="download-inline-message">{message}</p> : null}

      <section className="download-console-grid">
        <article className="download-panel active-downloads-panel">
          <h2>Active Downloads</h2>
          <div className="download-list">
            {downloads.length ? downloads.map((download) => (
              <div className="download-row" key={download.id}>
                <div className="download-row-main">
                  <div className="download-title-group">
                    <span className="download-row-client-icon">
                      {clientIcon(clientByName.get(normalizeName(download.client))) || <DownloadCloud2FillIcon size={18} />}
                    </span>
                    <div>
                      <strong>{download.name}</strong>
                      <span>
                        {download.client} · {download.source} · {download.state}
                      </span>
                    </div>
                  </div>
                  <div className="download-row-actions">
                    <small>{download.progress}%</small>
                    <button type="button" aria-label="Pause or resume">
                      {download.progress >= 100 ? <PauseLineIcon size={17} /> : <PlayLineIcon size={17} />}
                    </button>
                    <button type="button" className="is-danger" aria-label="Remove download" onClick={() => removeDownload(download.id)}>
                      <CloseLineIcon size={17} />
                    </button>
                  </div>
                </div>
                <div className="download-progress-track">
                  <span style={{ width: `${download.progress}%` }} />
                </div>
                <div className="download-row-meta">
                  <span>{download.size}</span>
                  <span>Down {download.down}</span>
                  <span>Up {download.up}</span>
                  <span>
                    <TimerFlashLineIcon size={13} />
                    {download.progress >= 100 ? "Complete" : "Active"}
                  </span>
                </div>
              </div>
            )) : (
              <div className="integration-empty-state">No active downloads. Add a client in Settings &gt; Integrations, then sync the queue.</div>
            )}
          </div>
        </article>

        <article className="download-panel download-clients-panel">
          <h2>Clients</h2>
          <div className="download-client-list">
            {usableClients.length ? usableClients.map((client) => {
              const count = downloads.filter((download) => download.client === client.name).length;
              return (
                <div className="download-client-row" key={client.instanceId}>
                  <span className="download-client-icon">{clientIcon(client) || <DownloadCloud2FillIcon size={20} />}</span>
                  <div>
                    <strong>{client.name}</strong>
                    <span>
                      {client.name} · {count} download{count === 1 ? "" : "s"}
                    </span>
                    {client.message ? <small>{client.message}</small> : null}
                  </div>
                  <span className={`integration-status-light ${client.connected ? "is-connected" : "is-disconnected"}`} />
                </div>
              );
            }) : (
              <div className="integration-empty-state">No download clients added yet.</div>
            )}
          </div>
        </article>
      </section>
    </div>
  );
}
