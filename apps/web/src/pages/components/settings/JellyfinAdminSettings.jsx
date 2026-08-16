import { useEffect, useMemo, useState } from "react";
import Alert from "react-bootstrap/Alert";
import Button from "react-bootstrap/Button";
import axios from "../../../lib/axios_instance";
import AppsLineIcon from "remixicon-react/AppsLineIcon";
import DeviceLineIcon from "remixicon-react/DeviceLineIcon";
import Plug2LineIcon from "remixicon-react/Plug2LineIcon";
import RefreshLineIcon from "remixicon-react/RefreshLineIcon";
import { PlatformIcon } from "../../../lib/platform-icons.jsx";

import "../../css/settings/settings.css";

function errorText(error, fallback) {
  const data = error?.response?.data;
  if (typeof data === "string") return data;
  return data?.error || data?.message || fallback;
}

function formatDate(value) {
  if (!value) return "Never";
  try {
    return new Intl.DateTimeFormat(undefined, {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date(value));
  } catch {
    return "Unknown";
  }
}

export default function JellyfinAdminSettings({ view = "devices" }) {
  const isPluginsView = view === "plugins";
  const [devices, setDevices] = useState([]);
  const [plugins, setPlugins] = useState([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState(null);

  const pluginCounts = useMemo(
    () => ({
      total: plugins.length,
      enabled: plugins.filter((plugin) => plugin.enabled).length,
    }),
    [plugins]
  );

  async function loadJellyfinAdmin() {
    setLoading(true);
    setMessage(null);

    try {
      if (isPluginsView) {
        const response = await axios.get("/api/jellyfin/plugins");
        setPlugins(response.data?.plugins || []);
      } else {
        const response = await axios.get("/api/jellyfin/devices");
        setDevices(response.data?.devices || []);
      }
    } catch (error) {
      setMessage({ type: "danger", text: errorText(error, "Unable to load Jellyfin admin data") });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadJellyfinAdmin();
  }, [view]);

  return (
    <div className="jellyfin-admin-settings">
      <div className="jellyfin-admin-header">
        <div>
          <p>{isPluginsView ? "Jellyfin plugins" : "Jellyfin devices"}</p>
          <h1>{isPluginsView ? "Plugins" : "Authorised Devices"}</h1>
          <span>
            {isPluginsView
              ? "Review installed and enabled plugin packages reported by Jellyfin."
              : "Review client devices returned by your Jellyfin server."}
          </span>
        </div>
        <Button type="button" variant="outline-light" onClick={loadJellyfinAdmin} disabled={loading}>
          <RefreshLineIcon size={17} />
          Refresh
        </Button>
      </div>

      {message ? (
        <Alert variant={message.type} onClose={() => setMessage(null)} dismissible>
          {message.text}
        </Alert>
      ) : null}

      {!isPluginsView ? (
        <section className="jellyfin-admin-section">
          <div className="jellyfin-admin-section-heading">
            <div>
              <DeviceLineIcon size={20} />
              <div>
                <h2>Authorised Devices</h2>
                <p>{devices.length} devices returned by Jellyfin.</p>
              </div>
            </div>
          </div>
          <div className="jellyfin-device-list">
            {loading ? <div className="jellyfin-admin-empty">Loading devices...</div> : null}
            {!loading && !devices.length ? <div className="jellyfin-admin-empty">No authorised devices were returned by Jellyfin.</div> : null}
            {devices.map((device) => (
              <article key={device.id || `${device.name}-${device.appName}`} className="jellyfin-device-row">
                <div className="jellyfin-device-icon">
                  <PlatformIcon client={device.appName} deviceName={device.name} />
                </div>
                <div>
                  <span>{device.appName}</span>
                  <strong>{device.name}</strong>
                  <p>{device.appVersion ? `Version ${device.appVersion}` : "No app version reported"}</p>
                </div>
                <div className="jellyfin-device-meta">
                  <span>{device.lastUserName || "No user"}</span>
                  <strong>{formatDate(device.dateLastActivity)}</strong>
                </div>
              </article>
            ))}
          </div>
        </section>
      ) : null}

      {isPluginsView ? (
        <section className="jellyfin-admin-section">
          <div className="jellyfin-admin-section-heading">
            <div>
              <AppsLineIcon size={20} />
              <div>
                <h2>Installed Plugins</h2>
                <p>{pluginCounts.enabled}/{pluginCounts.total} enabled.</p>
              </div>
            </div>
          </div>
          <div className="jellyfin-plugin-grid">
            {loading ? <div className="jellyfin-admin-empty">Loading plugins...</div> : null}
            {!loading && !plugins.length ? <div className="jellyfin-admin-empty">No plugins were returned by Jellyfin.</div> : null}
            {plugins.map((plugin) => (
              <article key={plugin.id || plugin.name} className={`jellyfin-plugin-card ${plugin.enabled ? "is-enabled" : "is-disabled"}`}>
                <div className={`jellyfin-plugin-art ${plugin.imageUrl ? "" : "is-empty"}`} aria-hidden="true">
                  {plugin.imageUrl ? (
                    <img
                      src={plugin.imageUrl}
                      alt=""
                      loading="lazy"
                      onError={(event) => {
                        const art = event.currentTarget.closest(".jellyfin-plugin-art");
                        event.currentTarget.remove();
                        art?.classList.add("is-empty");
                      }}
                    />
                  ) : null}
                </div>
                <div className="jellyfin-plugin-body">
                  <div className="jellyfin-plugin-top">
                    <span className="jellyfin-plugin-icon">
                      <Plug2LineIcon size={18} />
                      {plugin.enabled ? "Enabled" : "Disabled"}
                    </span>
                    {plugin.canUninstall ? <em>Removable</em> : null}
                  </div>
                  <strong>{plugin.name}</strong>
                  <p>{plugin.description || "No plugin description reported."}</p>
                  <small>{plugin.version || plugin.configurationFileName || "Version unavailable"}</small>
                </div>
              </article>
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}
