import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import AddLineIcon from "remixicon-react/AddLineIcon";
import CheckboxCircleLineIcon from "remixicon-react/CheckboxCircleLineIcon";
import ClipboardLineIcon from "remixicon-react/ClipboardLineIcon";
import DownloadCloud2FillIcon from "remixicon-react/DownloadCloud2FillIcon";
import ErrorWarningLineIcon from "remixicon-react/ErrorWarningLineIcon";
import EyeFillIcon from "remixicon-react/EyeFillIcon";
import EyeOffFillIcon from "remixicon-react/EyeOffFillIcon";
import HeartPulseLineIcon from "remixicon-react/HeartPulseLineIcon";
import Plug2FillIcon from "remixicon-react/Plug2FillIcon";
import Settings3LineIcon from "remixicon-react/Settings3LineIcon";
import UploadCloud2LineIcon from "remixicon-react/UploadCloud2LineIcon";
import UserAddLineIcon from "remixicon-react/UserAddLineIcon";
import axios from "../lib/axios_instance";
import { loadSavedIntegrations, saveSavedIntegrations } from "../lib/integrations-storage";
import JellyfinIntegrationSettings from "./components/settings/JellyfinIntegrationSettings";
import "./css/integrations.css";

const iconUrl = (slug) => `https://cdn.jsdelivr.net/gh/selfhst/icons/svg/${slug}.svg`;
const tdarrLogoUrl = "https://home.tdarr.io/static/media/logo3-min.246d6df44c7f16ddebaf.png";
const integrationTabItems = [
  ["media-server", "Media Server"],
  ["automation", "Arr Apps"],
  ["seerr", "Seerr Apps"],
  ["downloads", "Download Clients"],
  ["invites", "Invites / Transcodes"],
];
const integrationTabKeys = integrationTabItems.map(([key]) => key);

function normalizeIntegrationTabSlug(value = "") {
  const normalized = String(value || "")
    .replace(/^#\/?/, "")
    .trim()
    .toLowerCase();
  const aliases = {
    media: "media-server",
    mediaserver: "media-server",
    "media-server": "media-server",
    jellyfin: "media-server",
    arr: "automation",
    arrapps: "automation",
    "arr-apps": "automation",
    automation: "automation",
    jellyseerr: "seerr",
    overseerr: "seerr",
    seerr: "seerr",
    download: "downloads",
    downloads: "downloads",
    "download-clients": "downloads",
    clients: "downloads",
    invite: "invites",
    invites: "invites",
    "invites-transcodes": "invites",
    transcodes: "invites",
    tdarr: "invites",
  };
  return aliases[normalized] || (integrationTabKeys.includes(normalized) ? normalized : "");
}

const automationApps = [
  { name: "Sonarr", slug: "sonarr", purpose: "Series automation", accent: "#35c5f4" },
  { name: "Radarr", slug: "radarr", purpose: "Movie automation", accent: "#f4c430" },
  { name: "Lidarr", slug: "lidarr", purpose: "Music automation", accent: "var(--secondary-color)" },
  { name: "Prowlarr", slug: "prowlarr", purpose: "Indexer management", accent: "#4aa8f0" },
  { name: "Bazarr", slug: "bazarr", purpose: "Subtitle automation", accent: "#84d160" },
  { name: "Jellyseerr", slug: "jellyseerr", purpose: "Request management", accent: "#6366f1" },
  { name: "Overseerr", slug: "overseerr", purpose: "Request management", accent: "#7dd3fc" },
];

const downloadClientOptions = [
  { name: "qBittorrent", slug: "qbittorrent", protocol: "Torrent", auth: "userpass" },
  { name: "Transmission", slug: "transmission", protocol: "Torrent", auth: "userpass" },
  { name: "Deluge", slug: "deluge", protocol: "Torrent", auth: "password" },
  { name: "SABnzbd", slug: "sabnzbd", protocol: "Usenet" },
  { name: "NZBGet", slug: "nzbget", protocol: "Usenet" },
  { name: "BitTorrent", slug: null, protocol: "Torrent" },
  { name: "rTorrent", slug: null, protocol: "Torrent" },
];

const thirdPartyOptions = [
  { name: "Tdarr", slug: "tdarr", purpose: "Active transcodes", accent: "var(--primary-light-color)", secretOptional: true },
  { name: "Wizarr", slug: "wizarr", purpose: "Jellyfin invite links", accent: "#8b5cf6" },
];

const initialThirdPartyApps = thirdPartyOptions.map((app, index) => ({
  ...app,
  instanceId: `${app.name}-${index}`,
  connected: false,
  values: {},
}));

const initialAutomationApps = automationApps.map((app, index) => ({
  ...app,
  instanceId: `${app.name}-${index}`,
  connected: false,
  values: {},
}));

const seerrAppNames = new Set(["seerr", "jellyseerr", "overseerr"]);

function isSeerrApp(app) {
  return seerrAppNames.has(String(app.name || app.slug || "").toLowerCase());
}

function normalizeAutomationApps(savedApps) {
  if (!Array.isArray(savedApps) || !savedApps.length) {
    return initialAutomationApps;
  }

  const savedNames = new Set(savedApps.map((app) => String(app.name || "").toLowerCase()));
  const missingDefaults = initialAutomationApps.filter((app) => !savedNames.has(app.name.toLowerCase()));
  return [...savedApps, ...missingDefaults];
}

function normalizeThirdPartyApps(savedApps) {
  if (!Array.isArray(savedApps) || !savedApps.length) {
    return initialThirdPartyApps;
  }

  const savedNames = new Set(savedApps.map((app) => String(app.name || "").toLowerCase()));
  const missingDefaults = initialThirdPartyApps.filter((app) => !savedNames.has(app.name.toLowerCase()));
  return [...savedApps, ...missingDefaults];
}

function AppIcon({ app }) {
  const normalizedName = String(app.name || "").toLowerCase();
  if (normalizedName.includes("tdarr")) {
    return <img src={tdarrLogoUrl} alt="" loading="lazy" decoding="async" />;
  }

  const iconSlug =
    normalizedName.includes("home assistant") || normalizedName.includes("hacs")
      ? "home-assistant"
      : app.slug;

  if (!iconSlug) {
    return <span className="integration-fallback-icon">{app.name.slice(0, 2)}</span>;
  }

  return <img src={iconUrl(iconSlug)} alt="" loading="lazy" decoding="async" />;
}

function formatHealthDate(value) {
  if (!value) return "Never";
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function summarizeHealth(entries = []) {
  if (!entries.length) {
    return { successRate: "No checks", failingSince: null };
  }

  const successCount = entries.filter((entry) => entry.ok).length;
  const successRate = `${Math.round((successCount / entries.length) * 100)}% healthy`;
  if (entries[0]?.ok) {
    return { successRate, failingSince: null };
  }

  const failureStreak = [];
  for (const entry of entries) {
    if (entry.ok) break;
    failureStreak.push(entry);
  }

  return {
    successRate,
    failingSince: failureStreak[failureStreak.length - 1]?.checkedAt || entries[0]?.checkedAt,
  };
}

function buildHealthTimeline(entries = []) {
  return [...entries]
    .sort((first, second) => new Date(first.checkedAt || 0) - new Date(second.checkedAt || 0))
    .slice(-24);
}

function IntegrationCard({ app, type, onChange, onRemove, onSave, onTest, onCopySecret, removable = false }) {
  const usesUserPass = type === "download" && app.auth === "userpass";
  const usesPasswordOnly = type === "download" && app.auth === "password";
  const secretOptional = Boolean(app.secretOptional) || String(app.name || app.slug || "").toLowerCase().includes("tdarr");
  const authLabel = usesUserPass || usesPasswordOnly ? "Password" : secretOptional ? "API key (optional)" : "API key";
  const connected = Boolean(app.connected);
  const values = app.values || {};
  const secretPlaceholder = usesPasswordOnly || usesUserPass ? `${app.name} password` : secretOptional ? "Paste API key if auth is enabled" : "Paste API key";
  const [showSecret, setShowSecret] = useState(false);

  return (
    <article className="integration-card" style={{ "--integration-accent": app.accent || "var(--primary-light-color)" }}>
      <div className="integration-card-header">
        <span className="integration-icon">
          <AppIcon app={app} />
        </span>
        <div>
          <h2>{app.name}</h2>
          <p>{type === "download" ? app.protocol : app.purpose}</p>
        </div>
        <span
          className={`integration-status-light ${connected ? "is-connected" : "is-disconnected"}`}
          aria-label={connected ? "Connected" : "Not connected"}
          title={connected ? "Connected" : "Not connected"}
        />
      </div>
      <div className="integration-fields">
        <label>
          URL
          <input
            value={values.url || ""}
            onChange={(event) => onChange(app.instanceId, "url", event.target.value)}
            placeholder={`https://${app.name.toLowerCase().replaceAll(" ", "-")}.local`}
          />
        </label>
        {usesUserPass ? (
          <label>
            Username
            <input
              value={values.username || ""}
              onChange={(event) => onChange(app.instanceId, "username", event.target.value)}
              placeholder={`${app.name} username`}
              autoComplete="username"
            />
          </label>
        ) : null}
        <label>
          {authLabel}
          <span className="integration-secret-field">
            <input
              value={values.secret || ""}
              onChange={(event) => onChange(app.instanceId, "secret", event.target.value)}
              placeholder={secretPlaceholder}
              type={showSecret ? "text" : "password"}
              autoComplete={usesUserPass || usesPasswordOnly ? "current-password" : "off"}
            />
            <button type="button" title={showSecret ? "Hide secret" : "Reveal secret"} onClick={() => setShowSecret(!showSecret)}>
              {showSecret ? <EyeOffFillIcon size={17} /> : <EyeFillIcon size={17} />}
            </button>
            <button type="button" title="Copy secret" onClick={() => onCopySecret(values.secret || "")} disabled={!values.secret}>
              <ClipboardLineIcon size={17} />
            </button>
          </span>
        </label>
      </div>
      {app.message ? <p className={`integration-message ${app.messageType === "error" ? "is-error" : ""}`}>{app.message}</p> : null}
      <div className="integration-actions">
        <button type="button" onClick={() => onTest(app.instanceId)}>
          Test
        </button>
        <button type="button" onClick={() => onSave(app.instanceId)}>
          Save
        </button>
        {removable ? (
          <button type="button" className="is-danger" onClick={() => onRemove(app.instanceId)}>
            Remove
          </button>
        ) : null}
      </div>
    </article>
  );
}

export default function Integrations({ embedded = false, firstRun = false, activeTab: controlledActiveTab = "", onTabChange }) {
  const fileInputRef = useRef(null);
  const [internalActiveTab, setInternalActiveTab] = useState(normalizeIntegrationTabSlug(controlledActiveTab) || "media-server");
  const activeTab = normalizeIntegrationTabSlug(controlledActiveTab) || internalActiveTab;
  const [arrApps, setArrApps] = useState(initialAutomationApps);
  const [clients, setClients] = useState([]);
  const [thirdParty, setThirdParty] = useState(initialThirdPartyApps);
  const [selectedClient, setSelectedClient] = useState(downloadClientOptions[0].name);
  const [healthHistory, setHealthHistory] = useState([]);
  const [diagnostics, setDiagnostics] = useState([]);
  const [busyAction, setBusyAction] = useState("");
  const [notice, setNotice] = useState("");
  const [savedIntegrationsAvailable, setSavedIntegrationsAvailable] = useState(false);
  const [loadedSavedIntegrations, setLoadedSavedIntegrations] = useState(!firstRun);
  const connectorCount = useMemo(() => arrApps.length + clients.length + thirdParty.length, [arrApps.length, clients.length, thirdParty.length]);
  const automationOnlyApps = useMemo(() => arrApps.filter((app) => !isSeerrApp(app)), [arrApps]);
  const seerrApps = useMemo(() => arrApps.filter(isSeerrApp), [arrApps]);
  const enabledIntegrations = useMemo(() => [...arrApps, ...clients, ...thirdParty].filter((item) => item.connected), [arrApps, clients, thirdParty]);
  const latestHealthById = useMemo(() => {
    const lookup = new Map();
    healthHistory.forEach((entry) => {
      if (entry.instanceId && !lookup.has(entry.instanceId)) {
        lookup.set(entry.instanceId, entry);
      }
    });
    return lookup;
  }, [healthHistory]);

  useEffect(() => {
    const normalized = normalizeIntegrationTabSlug(controlledActiveTab);
    if (normalized) {
      setInternalActiveTab(normalized);
    }
  }, [controlledActiveTab]);

  function selectIntegrationTab(tabKey) {
    const normalized = normalizeIntegrationTabSlug(tabKey) || "media-server";
    setInternalActiveTab(normalized);
    onTabChange?.(normalized);
  }

  useEffect(() => {
    async function loadIntegrations() {
      if (firstRun && !loadedSavedIntegrations) {
        setArrApps(initialAutomationApps);
        setClients([]);
        setThirdParty(initialThirdPartyApps);
        setHealthHistory([]);
        setSavedIntegrationsAvailable(true);
        return;
      }

      try {
        const response = await axios.get("/api/integrations", {
          headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
        });
        let saved = response.data || {};
        const localSaved = loadSavedIntegrations();
        const backendIsEmpty = !saved.arrApps?.length && !saved.clients?.length && !saved.thirdParty?.length;
        const localHasIntegrations = localSaved.arrApps?.length || localSaved.clients?.length || localSaved.thirdParty?.length;

        if (backendIsEmpty && localHasIntegrations) {
          saved = localSaved;
          axios
            .post("/api/integrations", saved, {
              headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
            })
            .catch((error) => console.log("Unable to migrate local integrations", error));
        }

        saveSavedIntegrations(saved);
        setHealthHistory(Array.isArray(saved.healthHistory) ? saved.healthHistory : []);
        setArrApps(normalizeAutomationApps(saved.arrApps));
        if (Array.isArray(saved.clients)) {
          setClients(saved.clients);
        }
        setThirdParty(normalizeThirdPartyApps(saved.thirdParty));
      } catch {
        const saved = loadSavedIntegrations();
        setArrApps(normalizeAutomationApps(saved.arrApps));
        if (Array.isArray(saved.clients)) {
          setClients(saved.clients);
        }
        setThirdParty(normalizeThirdPartyApps(saved.thirdParty));
      }
    }
    loadIntegrations();
    if (!firstRun || loadedSavedIntegrations) {
      loadHealthHistory();
    }
  }, [firstRun, loadedSavedIntegrations]);

  async function loadHealthHistory() {
    try {
      const response = await axios.get("/api/integrations/health-history", {
        headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
      });
      setHealthHistory(response.data || []);
    } catch (error) {
      console.log("Unable to load integration health history", error);
    }
  }

  function persist(nextArrApps = arrApps, nextClients = clients, nextThirdParty = thirdParty) {
    const payload = { arrApps: nextArrApps, clients: nextClients, thirdParty: nextThirdParty };
    saveSavedIntegrations(payload);
    window.dispatchEvent(new CustomEvent("jellyglance-integrations-updated", { detail: payload }));
    axios
      .post("/api/integrations", payload, {
        headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
      })
      .then(() => window.dispatchEvent(new CustomEvent("jellyglance-integrations-updated", { detail: payload })))
      .catch((error) => console.log("Unable to save integrations", error));
  }

  function loadExistingIntegrations() {
    setLoadedSavedIntegrations(true);
    setNotice("Loaded saved integrations into first-run setup.");
  }

  function exportIntegrations() {
    const payload = {
      exportedAt: new Date().toISOString(),
      version: 1,
      integrations: { arrApps, clients, thirdParty },
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `jellyglance-integrations-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(link);
    link.click();
    URL.revokeObjectURL(link.href);
    link.remove();
    setNotice("Integration config exported.");
  }

  async function importIntegrations(event) {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      const imported = parsed.integrations || parsed;
      const nextArrApps = normalizeAutomationApps(imported.arrApps);
      const nextClients = Array.isArray(imported.clients) ? imported.clients : [];
      const nextThirdParty = normalizeThirdPartyApps(imported.thirdParty);
      setArrApps(nextArrApps);
      setClients(nextClients);
      setThirdParty(nextThirdParty);
      persist(nextArrApps, nextClients, nextThirdParty);
      setNotice(`${file.name} imported.`);
    } catch (error) {
      setNotice("Import failed. Choose a JellyGlance integrations JSON file.");
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  async function copySecret(secret) {
    if (!secret) return;
    await navigator.clipboard.writeText(secret);
    setNotice("Secret copied.");
  }

  function persistForList(listName, next) {
    persist(listName === "arrApps" ? next : arrApps, listName === "clients" ? next : clients, listName === "thirdParty" ? next : thirdParty);
  }

  async function testAllIntegrations() {
    try {
      setBusyAction("test-all");
      setNotice("");
      const response = await axios.post(
        "/api/integrations/test-all",
        {},
        {
          headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
        }
      );
      setDiagnostics(response.data.results || []);
      setHealthHistory(response.data.history || []);
      setNotice("Integration diagnostics complete.");
    } catch (error) {
      setNotice(error?.response?.data?.error || "Unable to run integration diagnostics.");
    } finally {
      setBusyAction("");
    }
  }

  function updateIntegration(listName, setList, instanceId, field, value) {
    setList((current) => {
      const next = current.map((item) =>
        item.instanceId === instanceId
          ? {
              ...item,
              connected: false,
              message: "",
              values: {
                ...(item.values || {}),
                [field]: value,
              },
            }
          : item
      );
      persistForList(listName, next);
      return next;
    });
  }

  function removeIntegration(listName, setList, instanceId) {
    setList((current) => {
      const next = current.filter((item) => item.instanceId !== instanceId);
      persistForList(listName, next);
      return next;
    });
  }

  function saveIntegration(listName, setList, instanceId) {
    setList((current) => {
      const next = current.map((item) =>
        item.instanceId === instanceId
          ? {
              ...item,
              message: "Saved",
              messageType: "success",
            }
          : item
      );
      persistForList(listName, next);
      return next;
    });
  }

  async function testIntegration(listName, setList, instanceId) {
    const currentList = listName === "clients" ? clients : listName === "thirdParty" ? thirdParty : arrApps;
    const selectedIntegration = currentList.find((item) => item.instanceId === instanceId);

    if (!selectedIntegration) {
      return;
    }

    const values = selectedIntegration.values || {};
    const needsUsername = listName === "clients" && selectedIntegration.auth === "userpass";
    const missingUrl = !values.url?.trim();
    const missingUsername = needsUsername && !values.username?.trim();
    const secretOptional = listName === "thirdParty" && (selectedIntegration.secretOptional || String(selectedIntegration.name || selectedIntegration.slug || "").toLowerCase().includes("tdarr"));
    const missingSecret = !secretOptional && !values.secret?.trim();
    const invalidUrl = values.url?.trim() && !/^https?:\/\//i.test(values.url.trim());
    const validationError = invalidUrl ? "URL must start with http:// or https://" : "Fill in all required fields before testing";

    setList((current) => {
      const next = current.map((item) => {
        if (item.instanceId !== instanceId) return item;

        if (missingUrl || missingUsername || missingSecret || invalidUrl) {
          return {
            ...item,
            connected: false,
            message: validationError,
            messageType: "error",
          };
        }

        return {
          ...item,
          connected: false,
          message: "Testing connection...",
          messageType: "success",
        };
      });
      persistForList(listName, next);
      return next;
    });

    if (missingUrl || missingUsername || missingSecret || invalidUrl) {
      return;
    }

    try {
      const response = await axios.post(
        "/api/integrations/test",
        {
          type: listName === "clients" ? "download" : listName === "thirdParty" ? "thirdParty" : "automation",
          integration: selectedIntegration,
        },
        {
          headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
        }
      );

      setList((current) => {
        const next = current.map((item) =>
          item.instanceId === instanceId
            ? {
                ...item,
                connected: true,
                version: response.data.version,
                message: response.data.message || `Connected to ${response.data.version}`,
                messageType: "success",
              }
            : item
        );
        persistForList(listName, next);
        return next;
      });
    } catch (error) {
      const message = error?.response?.data?.error || "Connection test failed";
      setList((current) => {
        const next = current.map((item) =>
          item.instanceId === instanceId
            ? {
                ...item,
                connected: false,
                message,
                messageType: "error",
              }
            : item
        );
        persistForList(listName, next);
        return next;
      });
    }
  }

  function addClient() {
    const client = downloadClientOptions.find((item) => item.name === selectedClient);
    if (!client) return;
    setClients((current) => {
      const next = [
        ...current,
        {
          ...client,
          instanceId: `${client.name}-${Date.now()}-${current.length}`,
          connected: false,
          values: {},
        },
      ];
      persist(arrApps, next, thirdParty);
      return next;
    });
  }

  return (
    <div className={`integrations-page${embedded ? " is-embedded" : ""}`}>
      <section className="integrations-hero">
        <div>
          <p>Media control</p>
          <h1>Integrations</h1>
          <span>Connect automation apps and as many download clients as your stack needs.</span>
        </div>
        <div className="integrations-status">
          <Plug2FillIcon />
          <strong>{connectorCount}</strong>
          <span>connectors</span>
        </div>
      </section>

      <nav className="integration-subtabs" aria-label="Integration categories">
        {integrationTabItems.map(([key, label]) => (
          <button type="button" className={activeTab === key ? "is-active" : ""} onClick={() => selectIntegrationTab(key)} key={key}>
            {label}
          </button>
        ))}
      </nav>

      {activeTab === "media-server" ? <JellyfinIntegrationSettings compact firstRun={firstRun} /> : null}

      {notice ? <div className="integration-notice">{notice}</div> : null}

      {activeTab === "automation" ? (
        <section className="integration-section">
          <div className="integration-section-title">
            <div>
              <h2>Arr Apps</h2>
              <span>Sonarr, Radarr, Lidarr, Prowlarr, and Bazarr</span>
            </div>
            <Settings3LineIcon />
          </div>
          <div className="integration-toolbar">
            {firstRun && !loadedSavedIntegrations && savedIntegrationsAvailable ? (
              <button type="button" onClick={loadExistingIntegrations}>
                <DownloadCloud2FillIcon size={18} />
                Load saved integrations
              </button>
            ) : null}
            {!firstRun || loadedSavedIntegrations ? (
              <button type="button" onClick={testAllIntegrations} disabled={busyAction === "test-all"}>
                <HeartPulseLineIcon size={18} />
                {busyAction === "test-all" ? "Testing" : "Test all"}
              </button>
            ) : null}
            <button type="button" onClick={exportIntegrations}>
              <DownloadCloud2FillIcon size={18} />
              Export
            </button>
            <label>
              <UploadCloud2LineIcon size={18} />
              Import
              <input ref={fileInputRef} type="file" accept=".json,application/json" onChange={importIntegrations} />
            </label>
          </div>
          <div className="integration-grid">
            {automationOnlyApps.map((app) => (
              <IntegrationCard
                key={app.instanceId}
                app={app}
                type="automation"
                onChange={(instanceId, field, value) => updateIntegration("arrApps", setArrApps, instanceId, field, value)}
                onRemove={(instanceId) => removeIntegration("arrApps", setArrApps, instanceId)}
                onSave={(instanceId) => saveIntegration("arrApps", setArrApps, instanceId)}
                onTest={(instanceId) => testIntegration("arrApps", setArrApps, instanceId)}
                onCopySecret={copySecret}
              />
            ))}
          </div>
          <div className="integration-link-panel">
            <div>
              <strong>Automation health</strong>
              <span>Review Bazarr subtitles and Prowlarr indexer status from one JellyGlance view.</span>
            </div>
            <div className="integration-link-actions">
              <Link to="/automation-health">Open Automation Health</Link>
            </div>
          </div>
        </section>
      ) : null}

      {activeTab === "seerr" ? (
        <section className="integration-section">
          <div className="integration-section-title">
            <div>
              <h2>Seerr Apps</h2>
              <span>Jellyseerr and Overseerr request management</span>
            </div>
            <Settings3LineIcon />
          </div>
          <div className="integration-toolbar">
            {firstRun && !loadedSavedIntegrations && savedIntegrationsAvailable ? (
              <button type="button" onClick={loadExistingIntegrations}>
                <DownloadCloud2FillIcon size={18} />
                Load saved integrations
              </button>
            ) : null}
            {!firstRun || loadedSavedIntegrations ? (
              <button type="button" onClick={testAllIntegrations} disabled={busyAction === "test-all"}>
                <HeartPulseLineIcon size={18} />
                {busyAction === "test-all" ? "Testing" : "Test all"}
              </button>
            ) : null}
            <button type="button" onClick={exportIntegrations}>
              <DownloadCloud2FillIcon size={18} />
              Export
            </button>
            <label>
              <UploadCloud2LineIcon size={18} />
              Import
              <input ref={fileInputRef} type="file" accept=".json,application/json" onChange={importIntegrations} />
            </label>
          </div>
          <div className="integration-grid">
            {seerrApps.map((app) => (
              <IntegrationCard
                key={app.instanceId}
                app={app}
                type="automation"
                onChange={(instanceId, field, value) => updateIntegration("arrApps", setArrApps, instanceId, field, value)}
                onRemove={(instanceId) => removeIntegration("arrApps", setArrApps, instanceId)}
                onSave={(instanceId) => saveIntegration("arrApps", setArrApps, instanceId)}
                onTest={(instanceId) => testIntegration("arrApps", setArrApps, instanceId)}
                onCopySecret={copySecret}
              />
            ))}
          </div>
        </section>
      ) : null}

      {activeTab === "downloads" ? (
        <section className="integration-section">
          <div className="integration-section-title">
            <div>
              <h2>Download Clients</h2>
              <span>Add more than one torrent or Usenet client</span>
            </div>
            <div className="client-adder">
              {firstRun && !loadedSavedIntegrations && savedIntegrationsAvailable ? (
                <button type="button" onClick={loadExistingIntegrations}>
                  <DownloadCloud2FillIcon size={18} />
                  Load saved integrations
                </button>
              ) : null}
              {!firstRun || loadedSavedIntegrations ? (
                <button type="button" onClick={testAllIntegrations} disabled={busyAction === "test-all"}>
                  <HeartPulseLineIcon size={18} />
                  {busyAction === "test-all" ? "Testing" : "Test all"}
                </button>
              ) : null}
              <button type="button" onClick={exportIntegrations}>
                <DownloadCloud2FillIcon size={18} />
                Export
              </button>
              <label className="integration-import-button">
                <UploadCloud2LineIcon size={18} />
                Import
                <input ref={fileInputRef} type="file" accept=".json,application/json" onChange={importIntegrations} />
              </label>
              <select value={selectedClient} onChange={(event) => setSelectedClient(event.target.value)}>
                {downloadClientOptions.map((client) => (
                  <option key={client.name}>{client.name}</option>
                ))}
              </select>
              <button type="button" onClick={addClient}>
                <AddLineIcon size={18} />
                Add client
              </button>
            </div>
          </div>
          <div className="integration-grid">
            {clients.map((client) => (
              <IntegrationCard
                key={client.instanceId}
                app={client}
                type="download"
                onChange={(instanceId, field, value) => updateIntegration("clients", setClients, instanceId, field, value)}
                onRemove={(instanceId) => removeIntegration("clients", setClients, instanceId)}
                onSave={(instanceId) => saveIntegration("clients", setClients, instanceId)}
                onTest={(instanceId) => testIntegration("clients", setClients, instanceId)}
                onCopySecret={copySecret}
                removable
              />
            ))}
          </div>
        </section>
      ) : null}

      {activeTab === "invites" ? (
        <section className="integration-section">
          <div className="integration-section-title">
            <div>
              <h2>Third-party Apps</h2>
              <span>Wizarr invites and Tdarr active transcode monitoring</span>
            </div>
            <UserAddLineIcon />
          </div>
          <div className="integration-toolbar">
            {firstRun && !loadedSavedIntegrations && savedIntegrationsAvailable ? (
              <button type="button" onClick={loadExistingIntegrations}>
                <DownloadCloud2FillIcon size={18} />
                Load saved integrations
              </button>
            ) : null}
            {!firstRun || loadedSavedIntegrations ? (
              <button type="button" onClick={testAllIntegrations} disabled={busyAction === "test-all"}>
                <HeartPulseLineIcon size={18} />
                {busyAction === "test-all" ? "Testing" : "Test all"}
              </button>
            ) : null}
            <button type="button" onClick={exportIntegrations}>
              <DownloadCloud2FillIcon size={18} />
              Export
            </button>
            <label>
              <UploadCloud2LineIcon size={18} />
              Import
              <input ref={fileInputRef} type="file" accept=".json,application/json" onChange={importIntegrations} />
            </label>
          </div>
          <div className="integration-grid">
            {thirdParty.map((app) => (
              <IntegrationCard
                key={app.instanceId}
                app={app}
                type="thirdParty"
                onChange={(instanceId, field, value) => updateIntegration("thirdParty", setThirdParty, instanceId, field, value)}
                onRemove={(instanceId) => removeIntegration("thirdParty", setThirdParty, instanceId)}
                onSave={(instanceId) => saveIntegration("thirdParty", setThirdParty, instanceId)}
                onTest={(instanceId) => testIntegration("thirdParty", setThirdParty, instanceId)}
                onCopySecret={copySecret}
              />
            ))}
          </div>
          <div className="integration-link-panel">
            <div>
              <strong>Open connected tools</strong>
              <span>Manage Wizarr invitations or monitor Tdarr active, queued, and finished transcodes from JellyGlance.</span>
            </div>
            <div className="integration-link-actions">
              <Link to="/wizarr">Open Wizarr links</Link>
              <Link to="/active-transcodes">Open Active Transcodes</Link>
            </div>
          </div>
        </section>
      ) : null}

      {activeTab !== "media-server" ? (
        <section className="integration-section integration-health-panel">
          <div className="integration-section-title">
            <div>
              <h2>Health History</h2>
              <span>Recent integration checks</span>
            </div>
            <HeartPulseLineIcon />
          </div>
          <div className="integration-health-grid">
            {enabledIntegrations.map((item) => {
              const health = latestHealthById.get(item.instanceId);
              const healthEntries = healthHistory.filter((entry) => entry.instanceId === item.instanceId);
              const summary = summarizeHealth(healthEntries);
              return (
                <article key={item.instanceId} className={health?.ok ? "is-ok" : "is-error"}>
                  {health?.ok ? <CheckboxCircleLineIcon size={18} /> : <ErrorWarningLineIcon size={18} />}
                  <div>
                    <strong>{item.name}</strong>
                    <span>{health?.message || "No health checks recorded"}</span>
                    <em>{summary.failingSince ? `Failing since ${formatHealthDate(summary.failingSince)}` : summary.successRate}</em>
                    <div className="integration-uptime-timeline" aria-label={`${item.name} uptime timeline`}>
                      {buildHealthTimeline(healthEntries).map((entry, index) => (
                        <i
                          key={`${entry.checkedAt || index}-${index}`}
                          className={entry.ok ? "is-ok" : "is-error"}
                          title={`${formatHealthDate(entry.checkedAt)} · ${entry.ok ? "Healthy" : "Failed"}`}
                        />
                      ))}
                    </div>
                  </div>
                  <small>{formatHealthDate(health?.checkedAt)}</small>
                </article>
              );
            })}
            {!enabledIntegrations.length ? <div className="integration-empty-state">No enabled integrations yet.</div> : null}
          </div>
          {diagnostics.length ? (
            <div className="integration-diagnostic-list">
              {diagnostics.filter((result) => enabledIntegrations.some((item) => item.instanceId === result.instanceId)).map((result) => (
                <span key={`${result.instanceId}-${result.checkedAt}`} className={result.ok ? "is-ok" : "is-error"}>
                  {result.name}: {result.message}
                </span>
              ))}
            </div>
          ) : null}
        </section>
      ) : null}

    </div>
  );
}
