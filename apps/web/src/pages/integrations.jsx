import { useEffect, useMemo, useState } from "react";
import AddLineIcon from "remixicon-react/AddLineIcon";
import DownloadCloud2FillIcon from "remixicon-react/DownloadCloud2FillIcon";
import Plug2FillIcon from "remixicon-react/Plug2FillIcon";
import Settings3LineIcon from "remixicon-react/Settings3LineIcon";
import axios from "../lib/axios_instance";
import { loadSavedIntegrations, saveSavedIntegrations } from "../lib/integrations-storage";
import JellyfinIntegrationSettings from "./components/settings/JellyfinIntegrationSettings";
import "./css/integrations.css";

const iconUrl = (slug) => `https://cdn.jsdelivr.net/gh/selfhst/icons/svg/${slug}.svg`;

const automationApps = [
  { name: "Sonarr", slug: "sonarr", purpose: "Series automation", accent: "#35c5f4" },
  { name: "Radarr", slug: "radarr", purpose: "Movie automation", accent: "#f4c430" },
  { name: "Lidarr", slug: "lidarr", purpose: "Music automation", accent: "#00a4dc" },
  { name: "Bazarr", slug: "bazarr", purpose: "Subtitle automation", accent: "#84d160" },
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

const initialAutomationApps = automationApps.map((app, index) => ({
  ...app,
  instanceId: `${app.name}-${index}`,
  connected: false,
  values: {},
}));

function AppIcon({ app }) {
  if (!app.slug) {
    return <span className="integration-fallback-icon">{app.name.slice(0, 2)}</span>;
  }

  return <img src={iconUrl(app.slug)} alt="" loading="lazy" decoding="async" />;
}

function IntegrationCard({ app, type, onChange, onRemove, onSave, onTest, removable = false }) {
  const usesUserPass = type === "download" && app.auth === "userpass";
  const usesPasswordOnly = type === "download" && app.auth === "password";
  const authLabel = usesUserPass || usesPasswordOnly ? "Password" : "API key";
  const connected = Boolean(app.connected);
  const values = app.values || {};
  const secretPlaceholder = usesPasswordOnly || usesUserPass ? `${app.name} password` : "Paste API key";

  return (
    <article className="integration-card" style={{ "--integration-accent": app.accent || "#d78df0" }}>
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
          <input
            value={values.secret || ""}
            onChange={(event) => onChange(app.instanceId, "secret", event.target.value)}
            placeholder={secretPlaceholder}
            type="password"
            autoComplete={usesUserPass || usesPasswordOnly ? "current-password" : "off"}
          />
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

export default function Integrations({ embedded = false }) {
  const [activeTab, setActiveTab] = useState("media-server");
  const [arrApps, setArrApps] = useState(initialAutomationApps);
  const [clients, setClients] = useState([]);
  const [selectedClient, setSelectedClient] = useState(downloadClientOptions[0].name);
  const connectorCount = useMemo(() => arrApps.length + clients.length, [arrApps.length, clients.length]);

  useEffect(() => {
    async function loadIntegrations() {
      try {
        const response = await axios.get("/api/integrations", {
          headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
        });
        let saved = response.data || {};
        const localSaved = loadSavedIntegrations();
        const backendIsEmpty = !saved.arrApps?.length && !saved.clients?.length;
        const localHasIntegrations = localSaved.arrApps?.length || localSaved.clients?.length;

        if (backendIsEmpty && localHasIntegrations) {
          saved = localSaved;
          axios
            .post("/api/integrations", saved, {
              headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
            })
            .catch((error) => console.log("Unable to migrate local integrations", error));
        }

        saveSavedIntegrations(saved);
        if (Array.isArray(saved.arrApps) && saved.arrApps.length) {
          setArrApps(saved.arrApps);
        } else {
          setArrApps(initialAutomationApps);
        }
        if (Array.isArray(saved.clients)) {
          setClients(saved.clients);
        }
      } catch {
        const saved = loadSavedIntegrations();
        if (Array.isArray(saved.arrApps) && saved.arrApps.length) {
          setArrApps(saved.arrApps);
        } else {
          setArrApps(initialAutomationApps);
        }
        if (Array.isArray(saved.clients)) {
          setClients(saved.clients);
        }
      }
    }
    loadIntegrations();
  }, []);

  function persist(nextArrApps = arrApps, nextClients = clients) {
    const payload = { arrApps: nextArrApps, clients: nextClients };
    saveSavedIntegrations(payload);
    axios
      .post("/api/integrations", payload, {
        headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
      })
      .catch((error) => console.log("Unable to save integrations", error));
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
      persist(listName === "arrApps" ? next : arrApps, listName === "clients" ? next : clients);
      return next;
    });
  }

  function removeIntegration(listName, setList, instanceId) {
    setList((current) => {
      const next = current.filter((item) => item.instanceId !== instanceId);
      persist(listName === "arrApps" ? next : arrApps, listName === "clients" ? next : clients);
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
      persist(listName === "arrApps" ? next : arrApps, listName === "clients" ? next : clients);
      return next;
    });
  }

  async function testIntegration(listName, setList, instanceId) {
    const currentList = listName === "clients" ? clients : arrApps;
    const selectedIntegration = currentList.find((item) => item.instanceId === instanceId);

    if (!selectedIntegration) {
      return;
    }

    const values = selectedIntegration.values || {};
    const needsUsername = listName === "clients" && selectedIntegration.auth === "userpass";
    const missingUrl = !values.url?.trim();
    const missingUsername = needsUsername && !values.username?.trim();
    const missingSecret = !values.secret?.trim();
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
      persist(listName === "arrApps" ? next : arrApps, listName === "clients" ? next : clients);
      return next;
    });

    if (missingUrl || missingUsername || missingSecret || invalidUrl) {
      return;
    }

    try {
      const response = await axios.post(
        "/api/integrations/test",
        {
          type: listName === "clients" ? "download" : "automation",
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
        persist(listName === "arrApps" ? next : arrApps, listName === "clients" ? next : clients);
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
        persist(listName === "arrApps" ? next : arrApps, listName === "clients" ? next : clients);
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
      persist(arrApps, next);
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
        {[
          ["media-server", "Media Server"],
          ["automation", "Arr Apps"],
          ["downloads", "Download Clients"],
        ].map(([key, label]) => (
          <button type="button" className={activeTab === key ? "is-active" : ""} onClick={() => setActiveTab(key)} key={key}>
            {label}
          </button>
        ))}
      </nav>

      {activeTab === "media-server" ? <JellyfinIntegrationSettings compact /> : null}

      {activeTab === "automation" ? (
        <section className="integration-section">
          <div className="integration-section-title">
            <div>
              <h2>Arr Apps</h2>
              <span>Sonarr, Radarr, Lidarr, and Bazarr</span>
            </div>
            <Settings3LineIcon />
          </div>
          <div className="integration-grid">
            {arrApps.map((app) => (
              <IntegrationCard
                key={app.instanceId}
                app={app}
                type="automation"
                onChange={(instanceId, field, value) => updateIntegration("arrApps", setArrApps, instanceId, field, value)}
                onRemove={(instanceId) => removeIntegration("arrApps", setArrApps, instanceId)}
                onSave={(instanceId) => saveIntegration("arrApps", setArrApps, instanceId)}
                onTest={(instanceId) => testIntegration("arrApps", setArrApps, instanceId)}
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
                removable
              />
            ))}
          </div>
        </section>
      ) : null}

    </div>
  );
}
