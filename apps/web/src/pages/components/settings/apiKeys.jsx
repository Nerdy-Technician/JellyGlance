import { useEffect, useMemo, useState } from "react";
import axios from "../../../lib/axios_instance";
import { Alert, Button, Form, Spinner } from "react-bootstrap";
import AddLineIcon from "remixicon-react/AddLineIcon";
import ClipboardLineIcon from "remixicon-react/ClipboardLineIcon";
import DeleteBinLineIcon from "remixicon-react/DeleteBinLineIcon";
import Key2LineIcon from "remixicon-react/Key2LineIcon";

import "../../css/settings/apiKeys.css";

const token = localStorage.getItem("token");

function maskKey(key = "") {
  if (key.length <= 12) {
    return key;
  }

  return `${key.slice(0, 8)} ... ${key.slice(-6)}`;
}

export default function ApiKeys() {
  const [keys, setKeys] = useState([]);
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState(null);

  const sortedKeys = useMemo(() => [...keys].sort((a, b) => a.name.localeCompare(b.name)), [keys]);

  async function fetchKeys() {
    try {
      const response = await axios.get("/api/keys", {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      });
      setKeys(response.data || []);
    } catch (error) {
      setMessage({ variant: "danger", text: error.response?.data?.error || "Unable to load API keys." });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchKeys();
  }, []);

  async function addKey(event) {
    event.preventDefault();
    if (!name.trim()) {
      setMessage({ variant: "danger", text: "Add a name before generating a key." });
      return;
    }

    try {
      setSaving(true);
      const response = await axios.post(
        "/api/keys",
        { name: name.trim() },
        {
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
        }
      );
      setKeys(response.data || []);
      setName("");
      setMessage({ variant: "success", text: "API key created." });
    } catch (error) {
      setMessage({ variant: "danger", text: error.response?.data?.error || "Unable to create API key." });
    } finally {
      setSaving(false);
    }
  }

  async function deleteKey(keyValue) {
    try {
      await axios.delete("/api/keys", {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        data: { key: keyValue },
      });
      setKeys((currentKeys) => currentKeys.filter((key) => key.key !== keyValue));
      setMessage({ variant: "success", text: "API key deleted." });
    } catch (error) {
      setMessage({ variant: "danger", text: error.response?.data?.error || "Unable to delete API key." });
    }
  }

  async function copyKey(keyValue) {
    try {
      await navigator.clipboard.writeText(keyValue);
      setMessage({ variant: "success", text: "API key copied to clipboard." });
    } catch {
      setMessage({ variant: "danger", text: "Clipboard access failed." });
    }
  }

  if (loading) {
    return (
      <div className="api-keys-page">
        <Spinner animation="border" />
      </div>
    );
  }

  return (
    <div className="api-keys-page">
      <div className="api-keys-header">
        <div>
          <p className="api-keys-eyebrow">Access tokens</p>
          <h1>API Keys</h1>
          <p>Create scoped JellyGlance tokens for automation, dashboards, and integrations.</p>
        </div>
        <div className="api-keys-count">
          <Key2LineIcon size={22} />
          <span>{keys.length}</span>
        </div>
      </div>

      {message && (
        <Alert variant={message.variant} onClose={() => setMessage(null)} dismissible>
          {message.text}
        </Alert>
      )}

      <Form className="api-key-create" onSubmit={addKey}>
        <div>
          <Form.Label>Key name</Form.Label>
          <Form.Control value={name} onChange={(event) => setName(event.target.value)} placeholder="Automation, Grafana, Home Assistant..." />
        </div>
        <Button type="submit" disabled={saving}>
          {saving ? <Spinner animation="border" size="sm" /> : <AddLineIcon size={18} />}
          Add Key
        </Button>
      </Form>

      {sortedKeys.length ? (
        <div className="api-key-list">
          {sortedKeys.map((apiKey) => (
            <article className="api-key-card" key={apiKey.key}>
              <div className="api-key-icon">
                <Key2LineIcon size={20} />
              </div>
              <div className="api-key-main">
                <strong>{apiKey.name}</strong>
                <code>{maskKey(apiKey.key)}</code>
              </div>
              <div className="api-key-actions">
                <Button variant="outline-primary" onClick={() => copyKey(apiKey.key)} title="Copy key">
                  <ClipboardLineIcon size={17} />
                </Button>
                <Button variant="outline-danger" onClick={() => deleteKey(apiKey.key)} title="Delete key">
                  <DeleteBinLineIcon size={17} />
                </Button>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <div className="api-keys-empty">
          <Key2LineIcon size={32} />
          <strong>No API keys yet</strong>
          <p>Create a key when another tool needs to call JellyGlance.</p>
        </div>
      )}
    </div>
  );
}
