import { useEffect, useMemo, useState } from "react";
import axios from "../../../lib/axios_instance";
import { Alert, Button, Form, Spinner } from "react-bootstrap";
import { useTranslation } from "react-i18next";
import AddLineIcon from "remixicon-react/AddLineIcon";
import ClipboardLineIcon from "remixicon-react/ClipboardLineIcon";
import DeleteBinLineIcon from "remixicon-react/DeleteBinLineIcon";
import Key2LineIcon from "remixicon-react/Key2LineIcon";

import "../../css/settings/apiKeys.css";
import ApiKeyWidgets from "./apiKeyWidgets";

const token = localStorage.getItem("token");

function authHeaders() {
  return {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  };
}

function maskKey(key = "") {
  if (key.length <= 12) {
    return key;
  }

  return `${key.slice(0, 8)} ... ${key.slice(-6)}`;
}

function formatLastUsed(value, neverLabel) {
  if (!value) return neverLabel;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return neverLabel;
  return date.toLocaleString();
}

export default function ApiKeys() {
  const { t } = useTranslation();
  const [keys, setKeys] = useState([]);
  const [name, setName] = useState("");
  const [scope, setScope] = useState("widgets");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState(null);

  const sortedKeys = useMemo(() => [...keys].sort((a, b) => a.name.localeCompare(b.name)), [keys]);

  async function fetchKeys() {
    try {
      const response = await axios.get("/api/keys", { headers: authHeaders() });
      setKeys(response.data || []);
    } catch (error) {
      setMessage({ variant: "danger", text: error.response?.data?.error || t("SETTINGS_PAGE.API_KEY_LOAD_ERROR") });
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
      setMessage({ variant: "danger", text: t("SETTINGS_PAGE.API_KEY_NAME_REQUIRED") });
      return;
    }

    try {
      setSaving(true);
      const response = await axios.post("/api/keys", { name: name.trim(), scope }, { headers: authHeaders() });
      setKeys(response.data || []);
      setName("");
      setMessage({ variant: "success", text: t("SETTINGS_PAGE.API_KEY_CREATED") });
    } catch (error) {
      setMessage({ variant: "danger", text: error.response?.data?.error || t("SETTINGS_PAGE.API_KEY_CREATE_ERROR") });
    } finally {
      setSaving(false);
    }
  }

  async function changeScope(keyValue, nextScope) {
    try {
      const response = await axios.patch("/api/keys", { key: keyValue, scope: nextScope }, { headers: authHeaders() });
      setKeys(response.data || []);
      setMessage({ variant: "success", text: t("SETTINGS_PAGE.API_KEY_SCOPE_SAVED") });
    } catch (error) {
      setMessage({ variant: "danger", text: error.response?.data?.error || t("SETTINGS_PAGE.API_KEY_SCOPE_ERROR") });
    }
  }

  async function deleteKey(keyValue) {
    try {
      await axios.delete("/api/keys", {
        headers: authHeaders(),
        data: { key: keyValue },
      });
      setKeys((currentKeys) => currentKeys.filter((key) => key.key !== keyValue));
      setMessage({ variant: "success", text: t("SETTINGS_PAGE.API_KEY_DELETED") });
    } catch (error) {
      setMessage({ variant: "danger", text: error.response?.data?.error || t("SETTINGS_PAGE.API_KEY_DELETE_ERROR") });
    }
  }

  async function copyKey(keyValue) {
    try {
      await navigator.clipboard.writeText(keyValue);
      setMessage({ variant: "success", text: t("SETTINGS_PAGE.API_KEY_COPIED") });
    } catch {
      setMessage({ variant: "danger", text: t("SETTINGS_PAGE.API_KEY_COPY_ERROR") });
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
          <h1>{t("SETTINGS_PAGE.API_KEYS")}</h1>
          <p>{t("SETTINGS_PAGE.API_KEY_INTRO")}</p>
        </div>
        <span className="api-keys-count">{t("SETTINGS_PAGE.API_KEY_COUNT", { count: keys.length })}</span>
      </div>

      {message && (
        <Alert variant={message.variant} onClose={() => setMessage(null)} dismissible>
          {message.text}
        </Alert>
      )}

      <Form className="api-key-create" onSubmit={addKey}>
        <div>
          <Form.Label>{t("SETTINGS_PAGE.API_KEY_NAME")}</Form.Label>
          <Form.Control value={name} onChange={(event) => setName(event.target.value)} placeholder={t("SETTINGS_PAGE.API_KEY_NAME_PLACEHOLDER")} />
        </div>
        <div>
          <Form.Label>{t("SETTINGS_PAGE.API_KEY_SCOPE")}</Form.Label>
          <Form.Select value={scope} onChange={(event) => setScope(event.target.value)}>
            <option value="widgets">{t("SETTINGS_PAGE.API_KEY_SCOPE_WIDGETS")}</option>
            <option value="widgets-write">{t("SETTINGS_PAGE.API_KEY_SCOPE_WRITE")}</option>
            <option value="full">{t("SETTINGS_PAGE.API_KEY_SCOPE_FULL")}</option>
          </Form.Select>
        </div>
        <Button type="submit" disabled={saving}>
          {saving ? <Spinner animation="border" size="sm" /> : <AddLineIcon size={18} />}
          {t("SETTINGS_PAGE.API_KEY_ADD")}
        </Button>
      </Form>
      <p className="api-key-scope-help">{t("SETTINGS_PAGE.API_KEY_SCOPE_HELP")}</p>

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
                <span className="api-key-meta">
                  {t("SETTINGS_PAGE.API_KEY_LAST_USED")}: {formatLastUsed(apiKey.lastUsed, t("SETTINGS_PAGE.API_KEY_NEVER_USED"))}
                </span>
              </div>
              <div className="api-key-actions">
                <Form.Select
                  className="api-key-scope-select"
                  value={apiKey.scope === "widgets" || apiKey.scope === "widgets-write" ? apiKey.scope : "full"}
                  onChange={(event) => changeScope(apiKey.key, event.target.value)}
                  aria-label={t("SETTINGS_PAGE.API_KEY_SCOPE")}
                >
                  <option value="widgets">{t("SETTINGS_PAGE.API_KEY_SCOPE_WIDGETS")}</option>
                  <option value="widgets-write">{t("SETTINGS_PAGE.API_KEY_SCOPE_WRITE")}</option>
                  <option value="full">{t("SETTINGS_PAGE.API_KEY_SCOPE_FULL")}</option>
                </Form.Select>
                <Button variant="outline-primary" onClick={() => copyKey(apiKey.key)} title={t("SETTINGS_PAGE.API_KEY_COPY")}>
                  <ClipboardLineIcon size={17} />
                </Button>
                <Button variant="outline-danger" onClick={() => deleteKey(apiKey.key)} title={t("SETTINGS_PAGE.API_KEY_DELETE")}>
                  <DeleteBinLineIcon size={17} />
                </Button>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <div className="api-keys-empty">
          <Key2LineIcon size={32} />
          <strong>{t("SETTINGS_PAGE.API_KEY_EMPTY")}</strong>
          <p>{t("SETTINGS_PAGE.API_KEY_EMPTY_HINT")}</p>
        </div>
      )}

      <ApiKeyWidgets keys={sortedKeys} onMessage={setMessage} />
    </div>
  );
}
