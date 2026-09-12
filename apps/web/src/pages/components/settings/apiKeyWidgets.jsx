import { useEffect, useMemo, useState } from "react";
import { Button, Form } from "react-bootstrap";
import CheckLineIcon from "remixicon-react/CheckLineIcon";
import ClipboardLineIcon from "remixicon-react/ClipboardLineIcon";
import Download2LineIcon from "remixicon-react/Download2LineIcon";
import ExternalLinkLineIcon from "remixicon-react/ExternalLinkLineIcon";
import SearchLineIcon from "remixicon-react/SearchLineIcon";
import { useTranslation } from "react-i18next";
import {
  DEFAULT_WIDGET_HOST,
  WIDGET_GROUPS,
  downloadTextFile,
  widgetExportFiles,
} from "../../../lib/widgetSnippets";
import baseUrl from "../../../lib/baseurl";
import ApiExplorer from "./apiExplorer";
import { widgetFileIcon, widgetGroupIcon } from "./widgetKitIcons";

export default function ApiKeyWidgets({ keys = [], onMessage }) {
  const { t } = useTranslation();
  const [host, setHost] = useState(() => (typeof window !== "undefined" ? window.location.origin : DEFAULT_WIDGET_HOST));
  const [keyValue, setKeyValue] = useState("");
  const [copied, setCopied] = useState("");
  const [group, setGroup] = useState("All");
  const [query, setQuery] = useState("");

  useEffect(() => {
    if (!keyValue && keys[0]?.key) {
      setKeyValue(keys[0].key);
    }
  }, [keyValue, keys]);

  const files = useMemo(() => widgetExportFiles(host, keyValue || "YOUR_JELLYGLANCE_API_KEY"), [host, keyValue]);
  const groups = useMemo(() => ["All", ...WIDGET_GROUPS, "Kit"], []);
  const visible = useMemo(() => {
    const byGroup = group === "All" ? files : files.filter((file) => file.group === group);
    const needle = query.trim().toLowerCase();
    if (!needle) return byGroup;
    return byGroup.filter((file) =>
      [file.title, file.filename, file.detail, file.kind, file.group].join(" ").toLowerCase().includes(needle)
    );
  }, [files, group, query]);
  const grouped = useMemo(() => {
    const order = [];
    const buckets = new Map();
    for (const file of visible) {
      if (!buckets.has(file.group)) {
        buckets.set(file.group, []);
        order.push(file.group);
      }
      buckets.get(file.group).push(file);
    }
    return order.map((name) => ({ name, items: buckets.get(name) }));
  }, [visible]);

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
      onMessage?.({ variant: "success", text: t("SETTINGS_PAGE.API_KEY_COPIED") });
      window.setTimeout(() => {
        setCopied((current) => (current === id ? "" : current));
      }, 1600);
    } catch {
      onMessage?.({ variant: "danger", text: t("SETTINGS_PAGE.API_KEY_COPY_ERROR") });
    }
  }

  return (
    <section className="api-key-widgets">
      <div className="api-key-widgets-header">
        <div>
          <h2>{t("SETTINGS_PAGE.WIDGET_KIT_TITLE")}</h2>
          <p>{t("SETTINGS_PAGE.WIDGET_KIT_INTRO")}</p>
        </div>
        <a className="api-key-header-link" href={`${baseUrl}/swagger-ui`} target="_blank" rel="noreferrer">
          <ExternalLinkLineIcon size={15} />
          {t("SETTINGS_PAGE.SWAGGER")}
        </a>
      </div>

      <div className="api-key-widget-form">
        <div>
          <Form.Label>{t("SETTINGS_PAGE.WIDGET_KIT_HOST")}</Form.Label>
          <Form.Control
            value={host}
            onChange={(event) => setHost(event.target.value)}
            placeholder={DEFAULT_WIDGET_HOST}
            spellCheck={false}
          />
        </div>
        <div>
          <Form.Label>{t("SETTINGS_PAGE.WIDGET_KIT_CURL_KEY")}</Form.Label>
          <Form.Select value={keyValue} onChange={(event) => setKeyValue(event.target.value)} disabled={!keys.length}>
            {!keys.length ? <option value="">{t("SETTINGS_PAGE.WIDGET_KIT_CREATE_FIRST")}</option> : null}
            {keys.map((apiKey) => (
              <option key={apiKey.key} value={apiKey.key}>
                {apiKey.name}
              </option>
            ))}
          </Form.Select>
        </div>
        <div className="api-key-widget-search">
          <Form.Label>{t("SETTINGS_PAGE.WIDGET_KIT_FILTER")}</Form.Label>
          <div className="api-key-widget-search-field">
            <SearchLineIcon size={15} />
            <Form.Control
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={t("SETTINGS_PAGE.WIDGET_KIT_FILTER")}
              spellCheck={false}
            />
          </div>
        </div>
      </div>

      <div className="api-key-widget-groups" role="tablist" aria-label={t("SETTINGS_PAGE.WIDGET_KIT_GROUPS")}>
        {groups.map((name) => {
          const GroupIcon = widgetGroupIcon(name);
          return (
            <button
              key={name}
              type="button"
              className={name === group ? "is-active" : undefined}
              onClick={() => setGroup(name)}
            >
              <GroupIcon size={14} />
              {t(`SETTINGS_PAGE.WIDGET_GROUP_${name.toUpperCase()}`, { defaultValue: name })}
            </button>
          );
        })}
      </div>

      {grouped.length ? (
        <div className="api-key-widget-list">
          {grouped.map((section) => {
            const SectionIcon = widgetGroupIcon(section.name);
            return (
              <section className="api-key-widget-section" key={section.name}>
                <h3>
                  <SectionIcon size={15} />
                  {t(`SETTINGS_PAGE.WIDGET_GROUP_${section.name.toUpperCase()}`, { defaultValue: section.name })}
                  <em>{section.items.length}</em>
                </h3>
                <div className="api-key-widget-rows">
                  {section.items.map((file) => {
                    const FileIcon = widgetFileIcon(file.id);
                    const copiedThis = copied === file.id;
                    return (
                      <article className="api-key-widget-row" key={file.id} title={file.detail}>
                        <span className="api-key-widget-row-icon">
                          <FileIcon size={16} />
                        </span>
                        <div className="api-key-widget-row-main">
                          <strong>{file.title}</strong>
                          <p>
                            <code>{file.filename}</code>
                            <span>{file.detail}</span>
                          </p>
                        </div>
                        <span className="api-key-widget-kind">{file.kind}</span>
                        <div className="api-key-widget-row-actions">
                          <Button
                            variant="outline-primary"
                            onClick={() => copyText(file.id, file.body)}
                            title={copiedThis ? t("SETTINGS_PAGE.WIDGET_KIT_COPIED") : t("SETTINGS_PAGE.WIDGET_KIT_COPY")}
                          >
                            {copiedThis ? <CheckLineIcon size={15} /> : <ClipboardLineIcon size={15} />}
                          </Button>
                          <Button
                            variant="outline-primary"
                            onClick={() => downloadTextFile(file.filename, file.body, file.mime)}
                            title={t("SETTINGS_PAGE.WIDGET_KIT_DOWNLOAD")}
                          >
                            <Download2LineIcon size={15} />
                          </Button>
                        </div>
                      </article>
                    );
                  })}
                </div>
              </section>
            );
          })}
        </div>
      ) : (
        <p className="api-key-widget-empty">{t("SETTINGS_PAGE.WIDGET_KIT_EMPTY")}</p>
      )}

      <ApiExplorer onMessage={onMessage} />
    </section>
  );
}
