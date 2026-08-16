import { useEffect, useMemo, useState } from "react";
import CheckboxCircleLineIcon from "remixicon-react/CheckboxCircleLineIcon";
import ErrorWarningLineIcon from "remixicon-react/ErrorWarningLineIcon";
import RefreshLineIcon from "remixicon-react/RefreshLineIcon";
import RadarLineIcon from "remixicon-react/RadarLineIcon";
import axios from "../lib/axios_instance";
import "./css/automation-health.css";

function formatNumber(value) {
  return new Intl.NumberFormat("en-GB").format(Number(value || 0));
}

function ServiceCard({ service }) {
  const isBazarr = service.type === "bazarr";
  return (
    <article className={`automation-service-card ${service.ok ? "is-ok" : "is-warning"}`}>
      <div className="automation-service-head">
        <span>
          {service.ok ? <CheckboxCircleLineIcon /> : <ErrorWarningLineIcon />}
        </span>
        <div>
          <h2>{service.name}</h2>
          <p>{isBazarr ? "Subtitle status" : "Indexer status"}{service.version ? ` · ${service.version}` : ""}</p>
        </div>
      </div>

      <div className="automation-service-metrics">
        {isBazarr ? (
          <>
            <span><strong>{formatNumber(service.stats?.missingEpisodes)}</strong>Missing episodes</span>
            <span><strong>{formatNumber(service.stats?.missingMovies)}</strong>Missing movies</span>
            <span><strong>{formatNumber(service.history?.length)}</strong>Recent grabs</span>
          </>
        ) : (
          <>
            <span><strong>{formatNumber(service.stats?.indexers)}</strong>Indexers</span>
            <span><strong>{formatNumber(service.stats?.failedIndexers)}</strong>Failed</span>
            <span><strong>{formatNumber(service.stats?.applications)}</strong>Apps</span>
          </>
        )}
      </div>

      {service.issues?.length ? (
        <div className="automation-issues">
          <strong>Issues</strong>
          {service.issues.slice(0, 6).map((issue) => (
            <p key={issue.id || issue.message}>
              <b>{issue.source}</b>
              <span>{issue.message}</span>
            </p>
          ))}
        </div>
      ) : null}

      {isBazarr && service.wanted?.length ? (
        <div className="automation-list">
          <strong>Missing subtitles</strong>
          {service.wanted.slice(0, 8).map((item) => (
            <p key={`${item.id}-${item.title}`}>
              <span>{item.title}</span>
              <small>{[item.type, item.language].filter(Boolean).join(" · ")}</small>
            </p>
          ))}
        </div>
      ) : null}

      {!isBazarr && service.indexers?.length ? (
        <div className="automation-list">
          <strong>Indexers</strong>
          {service.indexers.slice(0, 10).map((indexer) => (
            <p key={indexer.id}>
              <span>{indexer.name}</span>
              <small>{indexer.failure || indexer.disabledTill || (indexer.enabled ? "Healthy" : "Disabled")}</small>
            </p>
          ))}
        </div>
      ) : null}
    </article>
  );
}

export default function AutomationHealth() {
  const [data, setData] = useState({ services: [], stats: {} });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const services = useMemo(() => data.services || [], [data.services]);

  async function loadAutomationHealth() {
    try {
      setError("");
      const response = await axios.get("/api/automation-health");
      setData(response.data || { services: [], stats: {} });
    } catch (requestError) {
      setError(requestError.response?.data?.error || "Unable to load automation health.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadAutomationHealth();
    const intervalId = window.setInterval(loadAutomationHealth, 60000);
    return () => window.clearInterval(intervalId);
  }, []);

  return (
    <div className="automation-health-page">
      <header className="automation-health-header">
        <div>
          <p>Automation Health</p>
          <h1>Bazarr & Prowlarr</h1>
          <span>Subtitle gaps, recent grabs, indexer health, failed indexers, and app sync status.</span>
        </div>
        <button type="button" onClick={loadAutomationHealth} disabled={loading}>
          <RefreshLineIcon size={18} />
          {loading ? "Refreshing" : "Refresh"}
        </button>
      </header>

      {error ? <div className="automation-health-error">{error}</div> : null}

      <section className="automation-summary-grid">
        <article><RadarLineIcon /><strong>{formatNumber(data.stats?.services)}</strong><span>Services</span></article>
        <article><CheckboxCircleLineIcon /><strong>{formatNumber(data.stats?.healthy)}</strong><span>Healthy</span></article>
        <article><ErrorWarningLineIcon /><strong>{formatNumber(data.stats?.issues)}</strong><span>Issues</span></article>
        <article><ErrorWarningLineIcon /><strong>{formatNumber(data.stats?.missingSubtitles)}</strong><span>Missing subtitles</span></article>
        <article><ErrorWarningLineIcon /><strong>{formatNumber(data.stats?.failedIndexers)}</strong><span>Failed indexers</span></article>
      </section>

      <section className="automation-service-grid">
        {services.map((service) => <ServiceCard key={service.id} service={service} />)}
        {!services.length ? (
          <div className="automation-empty">
            <strong>{loading ? "Loading automation health" : "No Bazarr or Prowlarr integrations"}</strong>
            <span>Connect Bazarr or Prowlarr in Settings &gt; Integrations &gt; Arr Apps.</span>
          </div>
        ) : null}
      </section>
    </div>
  );
}
