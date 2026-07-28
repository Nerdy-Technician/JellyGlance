import { useEffect, useMemo, useState } from "react";
import { Alert, Button, Form, Spinner } from "react-bootstrap";
import ArticleLineIcon from "remixicon-react/ArticleLineIcon";
import ExternalLinkLineIcon from "remixicon-react/ExternalLinkLineIcon";
import MailCheckLineIcon from "remixicon-react/MailCheckLineIcon";
import MailSettingsLineIcon from "remixicon-react/MailSettingsLineIcon";
import RefreshLineIcon from "remixicon-react/RefreshLineIcon";
import SendPlaneLineIcon from "remixicon-react/SendPlaneLineIcon";
import axios from "../../../lib/axios_instance";
import "../../css/settings/settings.css";

const emptySettings = {
  enabled: false,
  senderName: "JellyGlance",
  senderEmail: "",
  recipients: [],
  frequency: "manual",
  smtp: {
    host: "",
    port: 587,
    secure: false,
    username: "",
    password: "",
    rejectUnauthorized: true,
    hasPassword: false,
  },
  history: [],
};

function headers() {
  return {
    Authorization: `Bearer ${localStorage.getItem("token")}`,
    "Content-Type": "application/json",
  };
}

function formatDate(value) {
  if (!value) return "Never";
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function recipientsToText(recipients) {
  return Array.isArray(recipients) ? recipients.join("\n") : "";
}

function textToRecipients(value) {
  return String(value || "")
    .split(/[\n,;]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

export default function NewsletterSettings() {
  const [settings, setSettings] = useState(emptySettings);
  const [recipientText, setRecipientText] = useState("");
  const [testRecipient, setTestRecipient] = useState("");
  const [preview, setPreview] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busyAction, setBusyAction] = useState("");
  const [message, setMessage] = useState(null);

  const recipientCount = useMemo(() => textToRecipients(recipientText).length, [recipientText]);

  async function loadNewsletter() {
    try {
      setLoading(true);
      const [settingsResponse, previewResponse] = await Promise.all([
        axios.get("/newsletter/settings", { headers: headers() }),
        axios.get("/newsletter/preview", { headers: headers() }),
      ]);
      setSettings({
        ...emptySettings,
        ...settingsResponse.data,
        smtp: { ...emptySettings.smtp, ...(settingsResponse.data?.smtp || {}) },
      });
      setRecipientText(recipientsToText(settingsResponse.data?.recipients || []));
      setPreview(previewResponse.data);
    } catch (error) {
      setMessage({ type: "danger", text: error.response?.data?.error || "Unable to load newsletter settings." });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadNewsletter();
  }, []);

  function updateField(field, value) {
    setSettings((current) => ({ ...current, [field]: value }));
  }

  function updateSmtp(field, value) {
    setSettings((current) => ({ ...current, smtp: { ...current.smtp, [field]: value } }));
  }

  async function saveSettings(event) {
    event?.preventDefault();
    try {
      setBusyAction("save");
      setMessage(null);
      const response = await axios.post(
        "/newsletter/settings",
        {
          ...settings,
          recipients: textToRecipients(recipientText),
        },
        { headers: headers() }
      );
      setSettings({
        ...emptySettings,
        ...response.data,
        smtp: { ...emptySettings.smtp, ...(response.data?.smtp || {}) },
      });
      setRecipientText(recipientsToText(response.data?.recipients || []));
      setMessage({ type: "success", text: "Newsletter settings saved." });
    } catch (error) {
      setMessage({ type: "danger", text: error.response?.data?.error || "Unable to save newsletter settings." });
    } finally {
      setBusyAction("");
    }
  }

  async function generatePreview() {
    try {
      setBusyAction("preview");
      const response = await axios.get("/newsletter/preview", { headers: headers() });
      setPreview(response.data);
      setMessage({ type: "success", text: "Newsletter preview refreshed." });
    } catch (error) {
      setMessage({ type: "danger", text: error.response?.data?.error || "Unable to generate newsletter preview." });
    } finally {
      setBusyAction("");
    }
  }

  async function sendTest() {
    try {
      setBusyAction("test");
      const response = await axios.post("/newsletter/test", { recipients: [testRecipient] }, { headers: headers() });
      setMessage({ type: "success", text: `Test newsletter sent to ${response.data.recipientCount} recipient.` });
      await loadNewsletter();
    } catch (error) {
      setMessage({ type: "danger", text: error.response?.data?.error || "Unable to send test newsletter." });
      await loadNewsletter();
    } finally {
      setBusyAction("");
    }
  }

  async function sendNewsletter() {
    const confirmed = window.confirm(`Send this newsletter to ${recipientCount} recipient${recipientCount === 1 ? "" : "s"}?`);
    if (!confirmed) return;

    try {
      setBusyAction("send");
      const response = await axios.post("/newsletter/send", { recipients: textToRecipients(recipientText) }, { headers: headers() });
      setMessage({ type: "success", text: `Newsletter sent to ${response.data.recipientCount} recipient${response.data.recipientCount === 1 ? "" : "s"}.` });
      await loadNewsletter();
    } catch (error) {
      setMessage({ type: "danger", text: error.response?.data?.error || "Unable to send newsletter." });
      await loadNewsletter();
    } finally {
      setBusyAction("");
    }
  }

  function openPreviewTab() {
    if (!preview?.html) return;
    const previewWindow = window.open("", "_blank");
    if (!previewWindow) {
      setMessage({ type: "warning", text: "Browser blocked the preview tab. Allow popups for JellyGlance and try again." });
      return;
    }
    previewWindow.opener = null;
    previewWindow.document.open();
    previewWindow.document.write(preview.html);
    previewWindow.document.close();
  }

  if (loading) {
    return (
      <div className="newsletter-settings newsletter-loading">
        <Spinner animation="border" />
      </div>
    );
  }

  return (
    <div className="newsletter-settings">
      <header className="settings-section-header">
        <div>
          <span>Digest email</span>
          <h2>Newsletter Generator</h2>
          <p>Generate a JellyGlance digest with recently added media, weekly watch stats, active viewers, and repair status.</p>
        </div>
        <Button type="button" variant="outline-primary" onClick={generatePreview} disabled={Boolean(busyAction)}>
          {busyAction === "preview" ? <Spinner size="sm" animation="border" /> : <RefreshLineIcon size={17} />}
          Generate preview
        </Button>
      </header>

      {message ? (
        <Alert variant={message.type} onClose={() => setMessage(null)} dismissible>
          {message.text}
        </Alert>
      ) : null}

      <div className="newsletter-layout">
        <Form className="newsletter-form" onSubmit={saveSettings}>
          <section className="newsletter-panel">
            <div className="newsletter-panel-title">
              <MailSettingsLineIcon size={19} />
              <h3>SMTP Options</h3>
            </div>
            <div className="newsletter-form-grid">
              <Form.Group>
                <Form.Label>SMTP host</Form.Label>
                <Form.Control value={settings.smtp.host} onChange={(event) => updateSmtp("host", event.target.value)} placeholder="smtp.example.com" />
              </Form.Group>
              <Form.Group>
                <Form.Label>Port</Form.Label>
                <Form.Control type="number" min="1" value={settings.smtp.port} onChange={(event) => updateSmtp("port", Number(event.target.value))} />
              </Form.Group>
              <Form.Group>
                <Form.Label>Username</Form.Label>
                <Form.Control value={settings.smtp.username} onChange={(event) => updateSmtp("username", event.target.value)} autoComplete="username" />
              </Form.Group>
              <Form.Group>
                <Form.Label>Password</Form.Label>
                <Form.Control
                  type="password"
                  value={settings.smtp.password}
                  onChange={(event) => updateSmtp("password", event.target.value)}
                  placeholder={settings.smtp.hasPassword ? "Stored password unchanged" : "SMTP password"}
                  autoComplete="new-password"
                />
              </Form.Group>
            </div>
            <div className="newsletter-toggle-row">
              <Form.Check type="switch" id="newsletter-secure" label="Use implicit TLS" checked={settings.smtp.secure} onChange={(event) => updateSmtp("secure", event.target.checked)} />
              <Form.Check type="switch" id="newsletter-tls-verify" label="Verify TLS certificates" checked={settings.smtp.rejectUnauthorized} onChange={(event) => updateSmtp("rejectUnauthorized", event.target.checked)} />
            </div>
          </section>

          <section className="newsletter-panel">
            <div className="newsletter-panel-title">
              <ArticleLineIcon size={19} />
              <h3>Newsletter</h3>
            </div>
            <div className="newsletter-form-grid">
              <Form.Group>
                <Form.Label>Sender name</Form.Label>
                <Form.Control value={settings.senderName} onChange={(event) => updateField("senderName", event.target.value)} />
              </Form.Group>
              <Form.Group>
                <Form.Label>Sender email</Form.Label>
                <Form.Control type="email" value={settings.senderEmail} onChange={(event) => updateField("senderEmail", event.target.value)} placeholder="jellyglance@example.com" />
              </Form.Group>
              <Form.Group>
                <Form.Label>Frequency</Form.Label>
                <Form.Select value={settings.frequency} onChange={(event) => updateField("frequency", event.target.value)}>
                  <option value="manual">Manual only</option>
                  <option value="weekly">Weekly</option>
                  <option value="monthly">Monthly</option>
                </Form.Select>
              </Form.Group>
              <Form.Group>
                <Form.Label>Test recipient</Form.Label>
                <Form.Control type="email" value={testRecipient} onChange={(event) => setTestRecipient(event.target.value)} placeholder="you@example.com" />
              </Form.Group>
            </div>
            <Form.Group className="newsletter-recipient-box">
              <Form.Label>Recipients</Form.Label>
              <Form.Control as="textarea" rows={5} value={recipientText} onChange={(event) => setRecipientText(event.target.value)} placeholder={"one@example.com\nfamily@example.com"} />
              <Form.Text>{recipientCount} recipient{recipientCount === 1 ? "" : "s"} configured.</Form.Text>
            </Form.Group>
            <div className="newsletter-toggle-row">
              <Form.Check type="switch" id="newsletter-enabled" label="Enable newsletter config" checked={settings.enabled} onChange={(event) => updateField("enabled", event.target.checked)} />
            </div>
            <div className="newsletter-actions">
              <Button type="submit" disabled={Boolean(busyAction)}>
                {busyAction === "save" ? <Spinner size="sm" animation="border" /> : <MailCheckLineIcon size={17} />}
                Save settings
              </Button>
              <Button type="button" variant="outline-primary" onClick={sendTest} disabled={!testRecipient || Boolean(busyAction)}>
                {busyAction === "test" ? <Spinner size="sm" animation="border" /> : <SendPlaneLineIcon size={17} />}
                Send test
              </Button>
              <Button type="button" variant="primary" onClick={sendNewsletter} disabled={!recipientCount || Boolean(busyAction)}>
                {busyAction === "send" ? <Spinner size="sm" animation="border" /> : <SendPlaneLineIcon size={17} />}
                Send newsletter
              </Button>
            </div>
          </section>
        </Form>

        <aside className="newsletter-preview-column">
          <section className="newsletter-panel">
            <div className="newsletter-panel-title">
              <div>
                <ArticleLineIcon size={19} />
                <h3>Preview</h3>
              </div>
              <Button type="button" variant="outline-primary" size="sm" onClick={openPreviewTab} disabled={!preview?.html}>
                <ExternalLinkLineIcon size={15} />
                Open in tab
              </Button>
            </div>
            <div className="newsletter-preview-meta">
              <strong>{preview?.subject || "Newsletter preview"}</strong>
              <span>Generated {formatDate(preview?.generatedAt)}</span>
            </div>
            <div className="newsletter-preview-frame" dangerouslySetInnerHTML={{ __html: preview?.html || "" }} />
          </section>

          <section className="newsletter-panel">
            <div className="newsletter-panel-title">
              <MailCheckLineIcon size={19} />
              <h3>Send History</h3>
            </div>
            <div className="newsletter-history">
              {(settings.history || []).map((entry) => (
                <article key={`${entry.timestamp}-${entry.mode}-${entry.messageId || entry.error}`} className={entry.ok ? "is-ok" : "is-error"}>
                  <strong>{entry.mode === "test" ? "Test email" : "Newsletter send"}</strong>
                  <span>{entry.ok ? `${entry.recipientCount || 0} recipient${entry.recipientCount === 1 ? "" : "s"}` : entry.error}</span>
                  <time>{formatDate(entry.timestamp)}</time>
                </article>
              ))}
              {!(settings.history || []).length ? <div className="newsletter-empty">No newsletter sends yet.</div> : null}
            </div>
          </section>
        </aside>
      </div>
    </div>
  );
}
