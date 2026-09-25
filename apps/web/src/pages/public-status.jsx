import { useEffect, useState } from "react";
import baseUrl from "../lib/baseurl";
import "./css/public-status.css";

function timeAgo(value) {
  if (!value) return "";
  const minutes = Math.round((Date.now() - new Date(value).getTime()) / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} min ago`;
  if (minutes < 1440) return `${Math.round(minutes / 60)} h ago`;
  const days = Math.round(minutes / 1440);
  return `${days} day${days === 1 ? "" : "s"} ago`;
}

function pctText(value) {
  return value == null ? "No data yet" : `${value}%`;
}

function uptimeTone(pct) {
  if (pct == null) return "is-empty";
  if (pct >= 99) return "is-good";
  if (pct >= 95) return "is-warn";
  return "is-bad";
}

function Banner({ block, data }) {
  const online = data.server?.online;
  const maintenance = data.maintenance;
  const tone = maintenance ? "maintenance" : online ? "online" : "offline";
  const headline = maintenance ? "Planned maintenance" : online ? block.upText || "Everything is up and running" : block.downText || "The server is unreachable";
  return (
    <section className={`public-status-banner is-${tone}`}>
      <span className="public-status-dot" />
      <div>
        <h2>{headline}</h2>
        <p>
          {maintenance
            ? maintenance.message || "Some things may be slow or unavailable for a while."
            : online
              ? "Streaming is available."
              : "Streaming may not work right now. We're looking into it."}
        </p>
        {maintenance?.since ? <small>Started {timeAgo(maintenance.since)}</small> : null}
      </div>
    </section>
  );
}

const METRIC_RENDER = {
  server: (data) => ({ label: "Media server", value: data.server?.online ? "Online" : "Offline", tone: data.server?.online ? "is-good" : "is-bad" }),
  latency: (data) => (data.server?.online && data.server?.latencyMs != null ? { label: "Response time", value: `${data.server.latencyMs} ms` } : null),
  streams: (data) => (data.streams != null ? { label: "Watching now", value: String(data.streams) } : null),
  uptime24h: (data) => ({ label: "Uptime, 24 hours", value: pctText(data.uptime24h) }),
  uptime7d: (data) => ({ label: "Uptime, 7 days", value: pctText(data.uptime7d) }),
  uptime30d: (data) => ({ label: "Uptime, 30 days", value: pctText(data.uptime30d) }),
  checked: (data) => ({ label: "Last checked", value: timeAgo(data.checkedAt) }),
};

function Metrics({ block, data }) {
  const tiles = (block.items || []).map((item) => METRIC_RENDER[item]?.(data)).filter(Boolean);
  if (!tiles.length) return null;
  return (
    <section className="public-status-tiles">
      {tiles.map((tile) => (
        <article key={tile.label}>
          <small>{tile.label}</small>
          <strong className={tile.tone || ""}>{tile.value}</strong>
        </article>
      ))}
    </section>
  );
}

function Uptime({ block, data }) {
  const days = (data.uptimeDays || []).slice(-block.days);
  if (!days.length) return null;
  const withData = days.filter((day) => day.pct != null);
  const average = withData.length ? Math.round((withData.reduce((sum, day) => sum + day.pct, 0) / withData.length) * 10) / 10 : null;
  return (
    <section className="public-status-section">
      <div className="public-status-section-head">
        <h3>{block.heading || "Uptime"}</h3>
        <span>{average == null ? "Collecting data" : `${average}% over ${block.days} days`}</span>
      </div>
      <div className="public-status-uptime" style={{ gridTemplateColumns: `repeat(${days.length}, 1fr)` }}>
        {days.map((day) => (
          <span key={day.date} className={uptimeTone(day.pct)} title={`${day.date}: ${pctText(day.pct)}`} />
        ))}
      </div>
      <div className="public-status-uptime-legend">
        <span>{block.days} days ago</span>
        <span>Today</span>
      </div>
    </section>
  );
}

function Services({ block, data }) {
  const services = data.services || [];
  if (!services.length) return null;
  return (
    <section className="public-status-section">
      <div className="public-status-section-head">
        <h3>{block.heading || "Services"}</h3>
      </div>
      <div className="public-status-services">
        {services.map((service) => (
          <div key={service.id} className="public-status-service">
            <span className={`public-status-service-dot ${service.online == null ? "is-empty" : service.online ? "is-good" : "is-bad"}`} />
            <strong>{service.name}</strong>
            <small>{service.online == null ? "Not checked yet" : service.online ? "Online" : "Offline"}</small>
            {service.uptime24h != null ? <em>{service.uptime24h}% today</em> : null}
          </div>
        ))}
      </div>
    </section>
  );
}

function Recent({ block, data }) {
  const items = (data.recent || []).filter((item) => block.filter === "all" || item.kind === block.filter).slice(0, block.count);
  if (!items.length) return null;
  return (
    <section className="public-status-section">
      <div className="public-status-section-head">
        <h3>{block.heading || "Recently added"}</h3>
      </div>
      <div className={`public-status-posters is-${block.layout}`}>
        {items.map((item) => (
          <figure key={item.id}>
            <div className="public-status-poster">
              {item.poster ? <img src={`${baseUrl}/${item.poster}`} alt="" loading="lazy" onError={(event) => (event.currentTarget.style.display = "none")} /> : null}
            </div>
            <figcaption>
              <strong>{item.title}</strong>
              <span>{[item.subtitle, timeAgo(item.added)].filter(Boolean).join(" · ")}</span>
            </figcaption>
          </figure>
        ))}
      </div>
    </section>
  );
}

function TextBlock({ block }) {
  if (!block.heading && !block.body) return null;
  return (
    <section className="public-status-section public-status-text">
      {block.heading ? <h3>{block.heading}</h3> : null}
      {block.body ? <p>{block.body}</p> : null}
    </section>
  );
}

function Links({ block }) {
  if (!block.items?.length) return null;
  return (
    <section className="public-status-section">
      {block.heading ? (
        <div className="public-status-section-head">
          <h3>{block.heading}</h3>
        </div>
      ) : null}
      <div className="public-status-links">
        {block.items.map((item) => (
          <a key={`${item.label}-${item.url}`} href={item.url} target="_blank" rel="noopener noreferrer">
            {item.label}
          </a>
        ))}
      </div>
    </section>
  );
}

const BLOCK_RENDER = { banner: Banner, metrics: Metrics, uptime: Uptime, services: Services, recent: Recent, text: TextBlock, links: Links };

function hexToRgb(hex) {
  const value = /^#([0-9a-f]{6})$/i.exec(hex || "")?.[1] || "8b5cf6";
  return [0, 2, 4].map((offset) => Number.parseInt(value.slice(offset, offset + 2), 16)).join(", ");
}

export function StatusPageView({ payload, preview = false }) {
  const config = payload.config || {};
  const data = payload.data || {};
  const style = { "--status-accent": config.accent || "#8b5cf6", "--status-accent-rgb": hexToRgb(config.accent) };
  return (
    <div className={`public-status bg-${config.background || "aurora"} width-${config.width || "wide"}${preview ? " is-preview" : ""}`} style={style}>
      <main>
        <header className="public-status-header">
          {config.showLogo !== false ? <img src={`${baseUrl}/icon-b-512.png`} alt="" onError={(event) => (event.currentTarget.style.display = "none")} /> : null}
          <div>
            <small>Server status</small>
            <h1>{config.title}</h1>
            {config.subtitle ? <p>{config.subtitle}</p> : null}
          </div>
        </header>
        {(config.blocks || [])
          .filter((block) => block.enabled)
          .map((block) => {
            const Block = BLOCK_RENDER[block.type];
            return Block ? <Block key={block.id} block={block} data={data} /> : null;
          })}
        <footer className="public-status-footer">
          {config.footerText ? <span>{config.footerText}</span> : null}
          <span>Powered by JellyGlance. This page refreshes every {config.refreshSeconds >= 120 ? `${Math.round(config.refreshSeconds / 60)} minutes` : `${config.refreshSeconds || 60} seconds`}.</span>
        </footer>
      </main>
    </div>
  );
}

export default function PublicStatusPage() {
  const [payload, setPayload] = useState(null);
  const [state, setState] = useState("loading");
  const refreshSeconds = payload?.config?.refreshSeconds || 60;

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const response = await fetch(`${baseUrl}/status-data`, { cache: "no-store" });
        if (response.status === 404) {
          if (!cancelled) setState("disabled");
          return;
        }
        const data = await response.json();
        if (cancelled) return;
        setPayload(data);
        setState(data.error ? "error" : "ready");
        if (data.config?.title) document.title = `${data.config.title} status`;
      } catch {
        if (!cancelled) setState("error");
      }
    }
    load();
    const timer = window.setInterval(load, refreshSeconds * 1000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [refreshSeconds]);

  if (state === "loading") return <div className="public-status is-centered">Loading status…</div>;

  if (state === "disabled" || state === "error" || !payload) {
    return (
      <div className="public-status is-centered">
        <div className="public-status-card">
          <h1>{state === "disabled" ? "Status page is off" : "Status unavailable"}</h1>
          <p>
            {state === "disabled"
              ? "The owner of this server hasn't turned on the public status page."
              : "We couldn't load the status right now. This page will try again shortly."}
          </p>
        </div>
      </div>
    );
  }

  return <StatusPageView payload={payload} />;
}
