import { useEffect, useState } from "react";
import { Alert, Button, Form, Spinner } from "react-bootstrap";
import Notification3LineIcon from "remixicon-react/Notification3LineIcon";
import Save3LineIcon from "remixicon-react/Save3LineIcon";
import axios from "../../../lib/axios_instance";
import Config from "../../../lib/config";
import { defaultNotificationSettings, normalizeNotificationSettings, storeNotificationSettings } from "../../../lib/notification-settings";
import "../../css/settings/settings.css";

const modes = [
  { value: "all", title: "All notifications", text: "Show starts, updates, successes, warnings, and errors." },
  { value: "important", title: "Warnings and errors", text: "Hide automatic success and progress messages." },
  { value: "errors", title: "Errors only", text: "Only interrupt for failed or stopped work." },
  { value: "off", title: "Off", text: "Hide background in-app notifications." },
];

export default function NotificationSettings() {
  const [settings, setSettings] = useState(defaultNotificationSettings);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState(null);

  useEffect(() => {
    Config.getConfig(true)
      .then((config) => {
        const nextSettings = normalizeNotificationSettings(config?.settings?.notifications);
        setSettings(storeNotificationSettings(nextSettings));
      })
      .catch(() => {
        setMessage({ type: "warning", text: "Using browser notification preferences until the backend is reachable." });
      })
      .finally(() => setLoading(false));
  }, []);

  function updateSetting(key, value) {
    setSettings((current) => normalizeNotificationSettings({ ...current, [key]: value }));
  }

  async function saveSettings(event) {
    event.preventDefault();
    try {
      setSaving(true);
      setMessage(null);
      const response = await axios.post("/api/notification-settings", settings, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem("token")}`,
          "Content-Type": "application/json",
        },
      });
      const saved = storeNotificationSettings(response.data);
      setSettings(saved);
      await Config.setConfig();
      setMessage({ type: "success", text: "Notification settings saved." });
    } catch (error) {
      storeNotificationSettings(settings);
      setMessage({ type: "danger", text: error.response?.data?.error || "Unable to save notification settings." });
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="notification-settings notification-settings-loading">
        <Spinner animation="border" />
      </div>
    );
  }

  return (
    <Form className="notification-settings" onSubmit={saveSettings}>
      <header className="settings-section-header">
        <div>
          <span>In-app alerts</span>
          <h2>Notifications</h2>
          <p>Control when JellyGlance shows toast messages while background tasks, syncs, backups, and repairs run.</p>
        </div>
      </header>

      {message ? (
        <Alert variant={message.type} onClose={() => setMessage(null)} dismissible>
          {message.text}
        </Alert>
      ) : null}

      <section className="notification-panel">
        <div className="notification-panel-title">
          <Notification3LineIcon size={20} />
          <h3>Toast Behaviour</h3>
        </div>
        <div className="notification-mode-grid">
          {modes.map((mode) => (
            <button
              key={mode.value}
              type="button"
              className={settings.mode === mode.value ? "is-active" : ""}
              onClick={() => updateSetting("mode", mode.value)}
            >
              <strong>{mode.title}</strong>
              <span>{mode.text}</span>
            </button>
          ))}
        </div>
      </section>

      <section className="notification-panel">
        <div className="notification-field-grid">
          <Form.Group>
            <Form.Label>Screen position</Form.Label>
            <Form.Select value={settings.position} onChange={(event) => updateSetting("position", event.target.value)}>
              <option value="bottom-right">Bottom right</option>
              <option value="bottom-center">Bottom center</option>
              <option value="top-right">Top right</option>
              <option value="top-center">Top center</option>
            </Form.Select>
          </Form.Group>
          <Form.Group>
            <Form.Label>Display duration</Form.Label>
            <Form.Control
              type="number"
              min="3"
              max="30"
              value={settings.durationSeconds}
              onChange={(event) => updateSetting("durationSeconds", Number(event.target.value))}
            />
            <Form.Text>Seconds before a toast closes.</Form.Text>
          </Form.Group>
        </div>
        <Form.Check
          type="switch"
          id="manual-task-notifications"
          className="notification-switch"
          label="Always show manually triggered task notifications"
          checked={settings.manualTaskToasts}
          onChange={(event) => updateSetting("manualTaskToasts", event.target.checked)}
        />
      </section>

      <div className="notification-actions">
        <Button type="submit" disabled={saving}>
          {saving ? <Spinner size="sm" animation="border" /> : <Save3LineIcon size={17} />}
          Save notifications
        </Button>
      </div>
    </Form>
  );
}
