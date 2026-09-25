import { useEffect, useState } from "react";
import AlarmWarningLineIcon from "remixicon-react/AlarmWarningLineIcon";
import axios from "../../../lib/axios_instance";

function authHeader() {
  return { Authorization: `Bearer ${localStorage.getItem("token")}` };
}

function isAdmin() {
  try {
    const role = JSON.parse(localStorage.getItem("config") || "{}")?.settings?.auth?.role;
    return role === "Owner" || role === "Admin";
  } catch {
    return false;
  }
}

const CHECKS = [
  { key: "stuckDownloads", title: "Stuck downloads", text: "A download has made no progress for a while." },
  { key: "lowDisk", title: "Low disk space", text: "A Sonarr, Radarr or Lidarr disk drops below the free-space limit." },
  { key: "failedJobs", title: "Failed server jobs", text: "A Jellyfin scheduled task fails or is aborted." },
  { key: "newDevices", title: "New devices", text: "Someone plays something on a device that hasn't been seen before." },
];

function timeAgo(value) {
  const minutes = Math.round((Date.now() - new Date(value).getTime()) / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  if (minutes < 1440) return `${Math.round(minutes / 60)}h ago`;
  return `${Math.round(minutes / 1440)}d ago`;
}

export default function ThresholdAlertsPanel() {
  const [settings, setSettings] = useState(null);
  const [log, setLog] = useState([]);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const admin = isAdmin();

  function load() {
    axios
      .get("/alerts-data/settings", { headers: authHeader() })
      .then((response) => {
        setSettings(response.data.settings);
        setLog(response.data.log || []);
      })
      .catch((error) => setMessage(error.response?.data?.error || "Unable to load alert settings."));
  }

  useEffect(() => {
    if (admin) load();
  }, [admin]);

  if (!admin) return null;

  function update(patch) {
    setSettings((current) => ({ ...current, ...patch }));
  }

  async function run(action) {
    setBusy(true);
    setMessage("");
    try {
      if (action === "save") {
        const response = await axios.put("/alerts-data/settings", settings, { headers: authHeader() });
        setSettings(response.data.settings);
        setMessage("Alert settings saved.");
      } else if (action === "test") {
        await axios.post("/alerts-data/test", {}, { headers: authHeader() });
        setMessage("Test alert sent to your webhooks and this browser.");
        load();
      } else {
        const response = await axios.post("/alerts-data/run", {}, { headers: authHeader() });
        setMessage(response.data.sent ? `Checked now and sent ${response.data.sent} alert${response.data.sent === 1 ? "" : "s"}.` : "Checked now. Nothing needs attention.");
        load();
      }
    } catch (error) {
      setMessage(error.response?.data?.error || "That didn't work.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="notification-panel threshold-alerts">
      <div className="notification-panel-title">
        <AlarmWarningLineIcon size={18} />
        <h3>Threshold alerts</h3>
      </div>
      <p className="threshold-alerts-copy">
        JellyGlance checks these every 5 minutes. Alerts appear here for admins and go to any webhook subscribed to the <strong>Threshold alert</strong> event.
      </p>
      {!settings ? (
        <p className="threshold-alerts-copy">{message || "Loading…"}</p>
      ) : (
        <>
          <label className="threshold-alerts-master">
            <input type="checkbox" checked={settings.enabled} onChange={(event) => update({ enabled: event.target.checked })} />
            <span>Alerts are {settings.enabled ? "on" : "off"}</span>
          </label>
          <div className={`threshold-alerts-grid${settings.enabled ? "" : " is-disabled"}`}>
            {CHECKS.map((check) => (
              <div key={check.key} className="threshold-alerts-item">
                <label>
                  <input type="checkbox" checked={settings[check.key]} onChange={(event) => update({ [check.key]: event.target.checked })} />
                  <span>
                    <strong>{check.title}</strong>
                    <small>{check.text}</small>
                  </span>
                </label>
                {check.key === "stuckDownloads" ? (
                  <div className="threshold-alerts-limit">
                    Stuck for
                    <input type="number" min="10" max="1440" value={settings.stuckMinutes} onChange={(event) => update({ stuckMinutes: event.target.value })} />
                    minutes
                  </div>
                ) : null}
                {check.key === "lowDisk" ? (
                  <div className="threshold-alerts-limit">
                    Below
                    <input type="number" min="1" max="50" value={settings.lowDiskPercent} onChange={(event) => update({ lowDiskPercent: event.target.value })} />% free
                  </div>
                ) : null}
              </div>
            ))}
          </div>
          <div className="threshold-alerts-actions">
            <button type="button" className="is-primary" disabled={busy} onClick={() => run("save")}>
              Save alerts
            </button>
            <button type="button" disabled={busy} onClick={() => run("check")}>
              Check now
            </button>
            <button type="button" disabled={busy} onClick={() => run("test")}>
              Send test
            </button>
            {message ? <em>{message}</em> : null}
          </div>
          {log.length ? (
            <div className="threshold-alerts-log">
              <h4>Recent alerts</h4>
              {log.slice(0, 10).map((entry, index) => (
                <div key={`${entry.at}-${index}`} className={`threshold-alerts-log-row is-${entry.severity || "warning"}`}>
                  <strong>{entry.title}</strong>
                  <span>{entry.message}</span>
                  <small>{timeAgo(entry.at)}</small>
                </div>
              ))}
            </div>
          ) : null}
        </>
      )}
    </section>
  );
}
