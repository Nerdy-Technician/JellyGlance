import { useEffect, useMemo, useState } from "react";
import { Button, Form } from "react-bootstrap";
import ClipboardLineIcon from "remixicon-react/ClipboardLineIcon";
import Download2LineIcon from "remixicon-react/Download2LineIcon";
import CodeSSlashLineIcon from "remixicon-react/CodeSSlashLineIcon";
import {
  DEFAULT_WIDGET_HOST,
  WIDGET_GROUPS,
  downloadTextFile,
  widgetExportFiles,
} from "../../../lib/widgetSnippets";
import baseUrl from "../../../lib/baseurl";
import ApiExplorer from "./apiExplorer";

export default function ApiKeyWidgets({ keys = [], onMessage }) {
  const [host, setHost] = useState(() => (typeof window !== "undefined" ? window.location.origin : DEFAULT_WIDGET_HOST));
  const [keyValue, setKeyValue] = useState("");
  const [copied, setCopied] = useState("");
  const [group, setGroup] = useState("All");

  useEffect(() => {
    if (!keyValue && keys[0]?.key) {
      setKeyValue(keys[0].key);
    }
  }, [keyValue, keys]);

  const files = useMemo(() => widgetExportFiles(host, keyValue || "YOUR_JELLYGLANCE_API_KEY"), [host, keyValue]);
  const groups = useMemo(() => ["All", ...WIDGET_GROUPS, "Kit"], []);
  const visible = useMemo(() => (group === "All" ? files : files.filter((file) => file.group === group)), [files, group]);

  async function copyText(id, value) {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(value);
      } else {
        const area = document.createElement("textarea");
        area.value = value;
        document.body.appendChild(area);
        area.select();
        document.execCommand("copy");
        area.remove();
      }
      setCopied(id);
      onMessage?.({ variant: "success", text: "Copied to clipboard." });
      window.setTimeout(() => {
        setCopied((current) => (current === id ? "" : current));
      }, 1600);
    } catch {
      onMessage?.({ variant: "danger", text: "Clipboard access failed." });
    }
  }

  return (
    <section className="api-key-widgets">
      <div className="api-key-widgets-header">
        <div>
          <p className="api-keys-eyebrow">Dashboards</p>
          <h2>Homepage and Homarr</h2>
          <p>Thirty Homarr widgets cover sessions, catalog, queues, calendar, Seerr, Wizarr, Tdarr, Maintainerr, jobs, and health. Homarr never stores the key in the file — paste it after import as header <code>x-api-token</code>.</p>
        </div>
        <a className="btn btn-outline-primary" href={`${baseUrl}/swagger-ui`} target="_blank" rel="noreferrer">
          <CodeSSlashLineIcon size={16} />
          Standalone UI
        </a>
      </div>

      <div className="api-key-widget-form">
        <div>
          <Form.Label>Glance URL</Form.Label>
          <Form.Control
            value={host}
            onChange={(event) => setHost(event.target.value)}
            placeholder={DEFAULT_WIDGET_HOST}
            spellCheck={false}
          />
        </div>
        <div>
          <Form.Label>Key for curl</Form.Label>
          <Form.Select value={keyValue} onChange={(event) => setKeyValue(event.target.value)} disabled={!keys.length}>
            {!keys.length ? <option value="">Create a key first</option> : null}
            {keys.map((apiKey) => (
              <option key={apiKey.key} value={apiKey.key}>
                {apiKey.name}
              </option>
            ))}
          </Form.Select>
        </div>
      </div>

      <div className="api-key-widget-groups" role="tablist" aria-label="Widget groups">
        {groups.map((name) => (
          <button
            key={name}
            type="button"
            className={name === group ? "is-active" : undefined}
            onClick={() => setGroup(name)}
          >
            {name}
          </button>
        ))}
      </div>

      <div className="api-key-widget-grid">
        {visible.map((file) => (
          <article className={`api-key-widget-card is-${file.tone}${file.wide ? " is-wide" : ""}`} key={file.id}>
            <div className="api-key-widget-card-top">
              <span>{file.kicker}</span>
              <em>{file.kind}</em>
            </div>
            <strong>{file.title}</strong>
            <p>{file.detail}</p>
            <code>{file.filename}</code>
            <div className="api-key-widget-actions">
              <Button variant="outline-primary" onClick={() => copyText(file.id, file.body)}>
                <ClipboardLineIcon size={16} />
                {copied === file.id ? "Copied" : "Copy"}
              </Button>
              <Button className="is-primary" onClick={() => downloadTextFile(file.filename, file.body, file.mime)}>
                <Download2LineIcon size={16} />
                Download
              </Button>
            </div>
          </article>
        ))}
      </div>

      <ApiExplorer onMessage={onMessage} />

      <section className="swagger-frame" aria-label="Swagger UI">
        <iframe title="JellyGlance Swagger UI" src={`${baseUrl}/swagger-ui`} />
      </section>
    </section>
  );
}
