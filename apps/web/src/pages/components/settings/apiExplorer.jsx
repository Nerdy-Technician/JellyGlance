import { useEffect, useMemo, useState } from "react";
import axios from "../../../lib/axios_instance";
import { Button, Form, Spinner } from "react-bootstrap";
import PlayLineIcon from "remixicon-react/PlayLineIcon";
import RefreshLineIcon from "remixicon-react/RefreshLineIcon";
import { TOKEN_API_ENDPOINTS } from "../../../lib/widgetSnippets";
import "../../css/settings/apiKeys.css";
import "../../css/swagger.css";

const token = localStorage.getItem("token");

function resolvePath(path, itemId) {
  if (!String(path || "").includes(":id")) return path;
  return path.replace(":id", encodeURIComponent(String(itemId || "").trim() || "ITEM_ID"));
}

function needsItemId(path) {
  return String(path || "").includes(":id");
}

export default function ApiExplorer({ onMessage, autoLoad = false }) {
  const [endpoints, setEndpoints] = useState(TOKEN_API_ENDPOINTS);
  const [path, setPath] = useState("/api/widgets/homepage");
  const [itemId, setItemId] = useState("");
  const [payload, setPayload] = useState(null);
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(false);

  const selected = useMemo(() => endpoints.find((item) => item.path === path) || endpoints[0], [endpoints, path]);
  const resolvedPath = resolvePath(selected?.path || path, itemId);
  const itemRequired = needsItemId(selected?.path || path);

  useEffect(() => {
    let cancelled = false;
    axios
      .get("/api/widgets", {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      })
      .then((response) => {
        if (cancelled) return;
        const live = Array.isArray(response.data?.endpoints) ? response.data.endpoints : [];
        if (live.length) setEndpoints(live);
      })
      .catch(() => {
        if (!cancelled) setEndpoints(TOKEN_API_ENDPOINTS);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function runRequest(nextPath = resolvedPath) {
    if (needsItemId(selected?.path || path) && !String(itemId || "").trim()) {
      onMessage?.({ variant: "danger", text: "Add a Jellyfin item id before calling item glance." });
      return;
    }

    try {
      setLoading(true);
      const response = await axios.get(nextPath, {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        validateStatus: () => true,
      });
      setStatus(response.status);
      setPayload(response.data ?? null);
      if (response.status >= 400) {
        onMessage?.({ variant: "danger", text: response.data?.error || response.data?.message || `Request failed (${response.status}).` });
      }
    } catch (error) {
      setStatus(null);
      setPayload({ error: error.message || "Request failed." });
      onMessage?.({ variant: "danger", text: error.response?.data?.error || "Unable to call that endpoint." });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!autoLoad) return;
    runRequest("/api/widgets/homepage");
    // Load the default snapshot once when the page opens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoLoad]);

  return (
    <section className="api-explorer">
      <div className="api-key-widgets-header">
        <div>
          <p className="api-keys-eyebrow">Live API</p>
          <h2>Try endpoints</h2>
          <p>
            Calls use your signed-in session. Dashboards should send <code>x-api-token</code> instead. Current path: <code>{resolvedPath}</code>
          </p>
        </div>
        <Button variant="outline-primary" onClick={() => runRequest()} disabled={loading || (itemRequired && !itemId.trim())}>
          {loading ? <Spinner animation="border" size="sm" /> : <PlayLineIcon size={16} />}
          Try
        </Button>
      </div>

      <div className="api-explorer-grid">
        <ul className="api-explorer-list">
          {endpoints.map((item) => {
            const active = item.path === selected?.path;
            return (
              <li key={item.path}>
                <button
                  type="button"
                  className={active ? "is-active" : ""}
                  onClick={() => {
                    setPath(item.path);
                    setStatus(null);
                    if (!needsItemId(item.path)) {
                      runRequest(item.path);
                    }
                  }}
                >
                  <strong>
                    <em>GET</em>
                    {item.path}
                  </strong>
                  <span>{item.summary}</span>
                </button>
              </li>
            );
          })}
        </ul>

        <div className="api-explorer-result">
          {itemRequired ? (
            <div className="api-explorer-id">
              <Form.Label>Jellyfin item id</Form.Label>
              <Form.Control
                value={itemId}
                onChange={(event) => setItemId(event.target.value)}
                placeholder="Item GUID"
                spellCheck={false}
              />
            </div>
          ) : null}
          <div className="api-explorer-meta">
            <span>{status ? `HTTP ${status}` : "Ready"}</span>
            <Button variant="outline-primary" size="sm" onClick={() => runRequest()} disabled={loading}>
              {loading ? <Spinner animation="border" size="sm" /> : <RefreshLineIcon size={14} />}
              Reload
            </Button>
          </div>
          <pre>
            <code>
              {payload
                ? JSON.stringify(payload, null, 2)
                : '{\n  "jellyglance": true,\n  "hint": "Pick an endpoint and press Try"\n}'}
            </code>
          </pre>
        </div>
      </div>
    </section>
  );
}
