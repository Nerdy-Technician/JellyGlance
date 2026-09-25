import { useEffect, useMemo, useRef, useState } from "react";
import AddLineIcon from "remixicon-react/AddLineIcon";
import ArrowDownSLineIcon from "remixicon-react/ArrowDownSLineIcon";
import ArrowUpSLineIcon from "remixicon-react/ArrowUpSLineIcon";
import DeleteBinLineIcon from "remixicon-react/DeleteBinLineIcon";
import EyeLineIcon from "remixicon-react/EyeLineIcon";
import EyeOffLineIcon from "remixicon-react/EyeOffLineIcon";
import ExternalLinkLineIcon from "remixicon-react/ExternalLinkLineIcon";
import axios from "../../../lib/axios_instance";
import baseUrl from "../../../lib/baseurl";
import { StatusPageView } from "../../public-status";
import "../../css/public-status.css";
import "../../css/settings/status-page-builder.css";

const BLOCK_INFO = {
  banner: { name: "Status banner", text: "The big up, down or maintenance message." },
  metrics: { name: "Stat tiles", text: "Small tiles with the numbers you pick." },
  uptime: { name: "Uptime history", text: "A bar for each day, green when the server was up." },
  services: { name: "Services", text: "Online or offline for your connected apps, by name only." },
  recent: { name: "Recently added", text: "Posters of the newest titles." },
  text: { name: "Text", text: "Your own heading and message." },
  links: { name: "Link buttons", text: "Buttons to your request page, Discord and so on." },
};

const METRIC_OPTIONS = [
  ["server", "Server online or offline"],
  ["latency", "Response time"],
  ["streams", "Streams playing now (number only)"],
  ["uptime24h", "Uptime, last 24 hours"],
  ["uptime7d", "Uptime, last 7 days"],
  ["uptime30d", "Uptime, last 30 days"],
  ["checked", "Last checked"],
];

const NEW_BLOCK = {
  banner: { upText: "", downText: "" },
  metrics: { items: ["server", "latency"] },
  uptime: { heading: "Uptime", days: 30 },
  services: { heading: "Services", services: [] },
  recent: { heading: "Recently added", count: 12, layout: "grid", filter: "all" },
  text: { heading: "About this server", body: "" },
  links: { heading: "", items: [{ label: "Request something", url: "" }] },
};

const PRESETS = {
  simple: {
    name: "Simple",
    blocks: [
      { type: "banner", upText: "", downText: "" },
      { type: "metrics", items: ["server", "latency", "checked"] },
    ],
  },
  full: {
    name: "Everything",
    blocks: [
      { type: "banner", upText: "", downText: "" },
      { type: "metrics", items: ["server", "latency", "streams", "uptime30d"] },
      { type: "uptime", heading: "Uptime", days: 30 },
      { type: "services", heading: "Services", services: [] },
      { type: "recent", heading: "Recently added", count: 18, layout: "grid", filter: "all" },
    ],
  },
  showcase: {
    name: "New arrivals",
    blocks: [
      { type: "banner", upText: "We're online. Grab the popcorn.", downText: "" },
      { type: "recent", heading: "New movies", count: 12, layout: "row", filter: "movies" },
      { type: "recent", heading: "New episodes", count: 12, layout: "row", filter: "tv" },
      { type: "links", heading: "", items: [] },
    ],
  },
};

let localSeq = 0;
function newId() {
  localSeq += 1;
  return `n${Date.now().toString(36)}${localSeq}`;
}

function authHeader() {
  return { Authorization: `Bearer ${localStorage.getItem("token")}` };
}

function Toggle({ checked, onChange, children }) {
  return (
    <label className="spb-check">
      <input type="checkbox" checked={Boolean(checked)} onChange={(event) => onChange(event.target.checked)} />
      <span>{children}</span>
    </label>
  );
}

function Field({ label, children, hint }) {
  return (
    <label className="spb-field">
      <span>{label}</span>
      {children}
      {hint ? <small>{hint}</small> : null}
    </label>
  );
}

function BlockEditor({ block, services, onChange }) {
  const set = (patch) => onChange({ ...block, ...patch });
  switch (block.type) {
    case "banner":
      return (
        <>
          <Field label="Message when everything is up" hint="Leave blank for the default.">
            <input type="text" maxLength={160} placeholder="Everything is up and running" value={block.upText} onChange={(event) => set({ upText: event.target.value })} />
          </Field>
          <Field label="Message when the server is down">
            <input type="text" maxLength={160} placeholder="The server is unreachable" value={block.downText} onChange={(event) => set({ downText: event.target.value })} />
          </Field>
          <small className="spb-note">The maintenance notice (set above) replaces this banner while it&apos;s switched on.</small>
        </>
      );
    case "metrics":
      return (
        <div className="spb-checks">
          {METRIC_OPTIONS.map(([key, label]) => (
            <Toggle
              key={key}
              checked={block.items.includes(key)}
              onChange={(on) => set({ items: on ? [...block.items, key] : block.items.filter((item) => item !== key) })}
            >
              {label}
            </Toggle>
          ))}
        </div>
      );
    case "uptime":
      return (
        <div className="spb-row">
          <Field label="Heading">
            <input type="text" maxLength={80} value={block.heading} onChange={(event) => set({ heading: event.target.value })} />
          </Field>
          <Field label="Days shown">
            <select value={block.days} onChange={(event) => set({ days: Number(event.target.value) })}>
              <option value={7}>7 days</option>
              <option value={30}>30 days</option>
              <option value={90}>90 days</option>
            </select>
          </Field>
        </div>
      );
    case "services":
      return (
        <>
          <Field label="Heading">
            <input type="text" maxLength={80} value={block.heading} onChange={(event) => set({ heading: event.target.value })} />
          </Field>
          {services.length ? (
            <>
              <small className="spb-note">Pick which apps to show. With none ticked, all of them are shown.</small>
              <div className="spb-checks">
                {services.map((service) => (
                  <Toggle
                    key={service.id}
                    checked={block.services.includes(service.id)}
                    onChange={(on) => set({ services: on ? [...block.services, service.id] : block.services.filter((id) => id !== service.id) })}
                  >
                    {service.name}
                  </Toggle>
                ))}
              </div>
            </>
          ) : (
            <small className="spb-note">No connected apps with a URL were found in Integrations.</small>
          )}
        </>
      );
    case "recent":
      return (
        <>
          <div className="spb-row">
            <Field label="Heading">
              <input type="text" maxLength={80} value={block.heading} onChange={(event) => set({ heading: event.target.value })} />
            </Field>
            <Field label="How many">
              <input type="number" min={4} max={30} value={block.count} onChange={(event) => set({ count: Number(event.target.value) || 12 })} />
            </Field>
          </div>
          <div className="spb-row">
            <Field label="Show">
              <select value={block.filter} onChange={(event) => set({ filter: event.target.value })}>
                <option value="all">Movies and TV</option>
                <option value="movies">Movies only</option>
                <option value="tv">TV only</option>
              </select>
            </Field>
            <Field label="Layout">
              <select value={block.layout} onChange={(event) => set({ layout: event.target.value })}>
                <option value="grid">Grid</option>
                <option value="row">Scrolling row</option>
              </select>
            </Field>
          </div>
        </>
      );
    case "text":
      return (
        <>
          <Field label="Heading">
            <input type="text" maxLength={80} value={block.heading} onChange={(event) => set({ heading: event.target.value })} />
          </Field>
          <Field label="Message" hint="Plain text. Line breaks are kept.">
            <textarea rows={4} maxLength={2000} value={block.body} onChange={(event) => set({ body: event.target.value })} />
          </Field>
        </>
      );
    case "links":
      return (
        <>
          <Field label="Heading (optional)">
            <input type="text" maxLength={80} value={block.heading} onChange={(event) => set({ heading: event.target.value })} />
          </Field>
          {block.items.map((item, index) => (
            <div className="spb-link-row" key={index}>
              <input
                type="text"
                maxLength={40}
                placeholder="Button text"
                value={item.label}
                onChange={(event) => set({ items: block.items.map((row, i) => (i === index ? { ...row, label: event.target.value } : row)) })}
              />
              <input
                type="url"
                placeholder="https://"
                value={item.url}
                onChange={(event) => set({ items: block.items.map((row, i) => (i === index ? { ...row, url: event.target.value } : row)) })}
              />
              <button type="button" aria-label="Remove link" onClick={() => set({ items: block.items.filter((_, i) => i !== index) })}>
                <DeleteBinLineIcon size={15} />
              </button>
            </div>
          ))}
          {block.items.length < 8 ? (
            <button type="button" className="spb-small-button" onClick={() => set({ items: [...block.items, { label: "", url: "" }] })}>
              <AddLineIcon size={14} /> Add link
            </button>
          ) : null}
          <small className="spb-note">Only full http or https links are kept when you save.</small>
        </>
      );
    default:
      return null;
  }
}

export default function StatusPageBuilder() {
  const [draft, setDraft] = useState(null);
  const [saved, setSaved] = useState("");
  const [services, setServices] = useState([]);
  const [preview, setPreview] = useState(null);
  const [previewError, setPreviewError] = useState("");
  const [openBlock, setOpenBlock] = useState(null);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const previewTimer = useRef(null);
  const statusUrl = `${window.location.origin}${baseUrl}/status`;

  useEffect(() => {
    axios
      .get("/status-data/admin/settings", { headers: authHeader() })
      .then((response) => {
        setDraft(response.data.settings);
        setSaved(JSON.stringify(response.data.settings));
        setServices(response.data.services || []);
      })
      .catch((error) => setMessage(error.response?.data?.error || "Unable to load the status page settings."));
  }, []);

  useEffect(() => {
    if (!draft) return undefined;
    window.clearTimeout(previewTimer.current);
    previewTimer.current = window.setTimeout(() => {
      axios
        .post("/status-data/admin/preview", draft, { headers: authHeader() })
        .then((response) => {
          setPreview(response.data);
          setPreviewError("");
        })
        .catch(() => setPreviewError("The preview couldn't load."));
    }, 600);
    return () => window.clearTimeout(previewTimer.current);
  }, [draft]);

  const dirty = useMemo(() => draft && JSON.stringify(draft) !== saved, [draft, saved]);

  if (!draft) return <div className="spb-loading">{message || "Loading the status page builder…"}</div>;

  const update = (patch) => setDraft((current) => ({ ...current, ...patch }));
  const setBlocks = (blocks) => update({ blocks });

  function moveBlock(index, delta) {
    const next = [...draft.blocks];
    const target = index + delta;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    setBlocks(next);
  }

  function addBlock(type) {
    const block = { id: newId(), type, enabled: true, ...JSON.parse(JSON.stringify(NEW_BLOCK[type])) };
    setBlocks([...draft.blocks, block]);
    setOpenBlock(block.id);
  }

  function applyPreset(key) {
    if (!window.confirm(`Replace your current blocks with the "${PRESETS[key].name}" layout?`)) return;
    setBlocks(PRESETS[key].blocks.map((block) => ({ id: newId(), enabled: true, ...JSON.parse(JSON.stringify(block)) })));
    setOpenBlock(null);
  }

  async function save() {
    setBusy(true);
    setMessage("");
    try {
      const response = await axios.put("/status-data/admin/settings", draft, { headers: authHeader() });
      setDraft(response.data.settings);
      setSaved(JSON.stringify(response.data.settings));
      setMessage(response.data.settings.enabled ? "Saved. The status page is live." : "Saved. The status page is still switched off.");
    } catch (error) {
      setMessage(error.response?.data?.error || "Couldn't save the status page.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="spb">
      <header className="spb-hero">
        <div>
          <h2>Status Page</h2>
          <p>
            Build a public page anyone can open without logging in. It never shows usernames, devices, IP addresses or what people are watching.
          </p>
        </div>
        <div className="spb-hero-actions">
          <label className={`spb-switch${draft.enabled ? " is-on" : ""}`}>
            <input type="checkbox" checked={draft.enabled} onChange={(event) => update({ enabled: event.target.checked })} />
            <span>{draft.enabled ? "Public page on" : "Public page off"}</span>
          </label>
          <button type="button" className="spb-primary" disabled={busy || !dirty} onClick={save}>
            {dirty ? "Save changes" : "Saved"}
          </button>
        </div>
      </header>
      {message ? <div className="spb-message">{message}</div> : null}

      <div className="spb-layout">
        <div className="spb-editor">
          <section className="spb-card">
            <h3>Page</h3>
            <div className="spb-link">
              <code>{statusUrl}</code>
              <a href={statusUrl} target="_blank" rel="noreferrer">
                <ExternalLinkLineIcon size={14} /> Open
              </a>
            </div>
            <Field label="Title" hint="Leave blank to use your Jellyfin server name.">
              <input type="text" maxLength={80} value={draft.title} onChange={(event) => update({ title: event.target.value })} />
            </Field>
            <Field label="Subtitle">
              <input type="text" maxLength={160} placeholder="For example: Family media server" value={draft.subtitle} onChange={(event) => update({ subtitle: event.target.value })} />
            </Field>
            <div className="spb-row">
              <Field label="Accent colour">
                <div className="spb-colour">
                  <input type="color" value={draft.accent} onChange={(event) => update({ accent: event.target.value })} />
                  <input type="text" maxLength={7} value={draft.accent} onChange={(event) => update({ accent: event.target.value })} />
                </div>
              </Field>
              <Field label="Background">
                <select value={draft.background} onChange={(event) => update({ background: event.target.value })}>
                  <option value="aurora">Glow</option>
                  <option value="midnight">Fade</option>
                  <option value="solid">Solid</option>
                </select>
              </Field>
            </div>
            <div className="spb-row">
              <Field label="Width">
                <select value={draft.width} onChange={(event) => update({ width: event.target.value })}>
                  <option value="wide">Wide</option>
                  <option value="narrow">Narrow</option>
                </select>
              </Field>
              <Field label="Refresh every">
                <select value={draft.refreshSeconds} onChange={(event) => update({ refreshSeconds: Number(event.target.value) })}>
                  <option value={30}>30 seconds</option>
                  <option value={60}>1 minute</option>
                  <option value={120}>2 minutes</option>
                  <option value={300}>5 minutes</option>
                </select>
              </Field>
            </div>
            <Toggle checked={draft.showLogo} onChange={(on) => update({ showLogo: on })}>
              Show the JellyGlance logo
            </Toggle>
            <Field label="Footer text">
              <input type="text" maxLength={200} placeholder="For example: Questions? Message Roffo." value={draft.footerText} onChange={(event) => update({ footerText: event.target.value })} />
            </Field>
          </section>

          <section className={`spb-card spb-maintenance${draft.maintenanceActive ? " is-on" : ""}`}>
            <h3>Maintenance notice</h3>
            <Toggle checked={draft.maintenanceActive} onChange={(on) => update({ maintenanceActive: on })}>
              Show a maintenance notice instead of the normal banner
            </Toggle>
            <textarea
              rows={3}
              maxLength={500}
              placeholder="For example: Moving to a new drive tonight. Expect a few hours of downtime from 10pm."
              value={draft.maintenanceMessage}
              onChange={(event) => update({ maintenanceMessage: event.target.value })}
            />
          </section>

          <section className="spb-card">
            <div className="spb-card-head">
              <h3>Blocks</h3>
              <div className="spb-presets">
                <span>Start from</span>
                {Object.entries(PRESETS).map(([key, preset]) => (
                  <button type="button" key={key} onClick={() => applyPreset(key)}>
                    {preset.name}
                  </button>
                ))}
              </div>
            </div>
            <div className="spb-blocks">
              {draft.blocks.map((block, index) => (
                <article key={block.id} className={`spb-block${block.enabled ? "" : " is-hidden"}${openBlock === block.id ? " is-open" : ""}`}>
                  <div className="spb-block-head">
                    <button type="button" className="spb-block-title" onClick={() => setOpenBlock(openBlock === block.id ? null : block.id)}>
                      <strong>{BLOCK_INFO[block.type]?.name || block.type}</strong>
                      <small>{block.heading || BLOCK_INFO[block.type]?.text}</small>
                    </button>
                    <div className="spb-block-tools">
                      <button type="button" aria-label="Move up" disabled={index === 0} onClick={() => moveBlock(index, -1)}>
                        <ArrowUpSLineIcon size={16} />
                      </button>
                      <button type="button" aria-label="Move down" disabled={index === draft.blocks.length - 1} onClick={() => moveBlock(index, 1)}>
                        <ArrowDownSLineIcon size={16} />
                      </button>
                      <button
                        type="button"
                        aria-label={block.enabled ? "Hide block" : "Show block"}
                        onClick={() => setBlocks(draft.blocks.map((row) => (row.id === block.id ? { ...row, enabled: !row.enabled } : row)))}
                      >
                        {block.enabled ? <EyeLineIcon size={16} /> : <EyeOffLineIcon size={16} />}
                      </button>
                      <button type="button" aria-label="Remove block" onClick={() => setBlocks(draft.blocks.filter((row) => row.id !== block.id))}>
                        <DeleteBinLineIcon size={16} />
                      </button>
                    </div>
                  </div>
                  {openBlock === block.id ? (
                    <div className="spb-block-body">
                      <BlockEditor block={block} services={services} onChange={(next) => setBlocks(draft.blocks.map((row) => (row.id === block.id ? next : row)))} />
                    </div>
                  ) : null}
                </article>
              ))}
              {!draft.blocks.length ? <p className="spb-note">No blocks yet. Add one below or start from a layout.</p> : null}
            </div>
            <div className="spb-add">
              <span>Add a block</span>
              {Object.entries(BLOCK_INFO).map(([type, info]) => (
                <button type="button" key={type} title={info.text} onClick={() => addBlock(type)}>
                  <AddLineIcon size={14} /> {info.name}
                </button>
              ))}
            </div>
          </section>
        </div>

        <aside className="spb-preview">
          <div className="spb-preview-bar">
            <span>Live preview</span>
            <small>{previewError || (draft.enabled ? "Visitors see this once you save." : "Switched off. Visitors see a \u201cstatus page is off\u201d message.")}</small>
          </div>
          <div className="spb-preview-frame">{preview ? <StatusPageView payload={preview} preview /> : <div className="spb-loading">Building preview…</div>}</div>
        </aside>
      </div>
    </div>
  );
}
