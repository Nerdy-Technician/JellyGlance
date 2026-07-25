import { useEffect, useMemo, useState } from "react";
import axios from "../../../lib/axios_instance";
import CheckboxCircleLineIcon from "remixicon-react/CheckboxCircleLineIcon";
import ErrorWarningLineIcon from "remixicon-react/ErrorWarningLineIcon";
import HeartPulseLineIcon from "remixicon-react/HeartPulseLineIcon";
import HistoryLineIcon from "remixicon-react/HistoryLineIcon";
import Notification3LineIcon from "remixicon-react/Notification3LineIcon";
import RefreshLineIcon from "remixicon-react/RefreshLineIcon";
import { Button, Spinner } from "react-bootstrap";
import "../../css/settings/settings.css";

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
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function detailText(details = {}) {
  const entries = Object.entries(details || {}).filter(([, value]) => value !== undefined && value !== null && value !== "");
  if (!entries.length) return "No details";
  return entries.map(([key, value]) => `${key}: ${typeof value === "object" ? JSON.stringify(value) : value}`).join(" · ");
}

export default function HealthSettings() {
  const [health, setHealth] = useState(null);
  const [deliveries, setDeliveries] = useState([]);
  const [audit, setAudit] = useState([]);
  const [loading, setLoading] = useState(true);

  const recentFailures = useMemo(() => deliveries.filter((delivery) => !delivery.ok).slice(0, 5), [deliveries]);

  async function loadHealth() {
    try {
      setLoading(true);
      const [healthResponse, deliveryResponse, auditResponse] = await Promise.all([
        axios.get("/api/health", { headers: headers() }),
        axios.get("/webhooks/delivery-history", { headers: headers() }),
        axios.get("/api/admin-audit", { headers: headers() }),
      ]);
      setHealth(healthResponse.data);
      setDeliveries(deliveryResponse.data || []);
      setAudit(auditResponse.data || []);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadHealth();
    const intervalId = setInterval(loadHealth, 60000);
    return () => clearInterval(intervalId);
  }, []);

  return (
    <div className="health-settings">
      <header className="health-hero">
        <div>
          <span>Operations</span>
          <h1>Health</h1>
          <p>Backend reachability, task state, webhook deliveries, backup freshness, and admin changes.</p>
        </div>
        <Button type="button" onClick={loadHealth} disabled={loading}>
          {loading ? <Spinner size="sm" animation="border" /> : <RefreshLineIcon size={17} />}
          Refresh
        </Button>
      </header>

      <section className="health-check-grid">
        {(health?.checks || []).map((check) => (
          <article key={check.key} className={check.ok ? "is-ok" : "is-error"}>
            {check.ok ? <CheckboxCircleLineIcon /> : <ErrorWarningLineIcon />}
            <div>
              <strong>{check.label}</strong>
              <span>{check.message}</span>
            </div>
          </article>
        ))}
      </section>

      <section className="health-summary-grid">
        <article>
          <HeartPulseLineIcon />
          <div>
            <span>Overall</span>
            <strong>{health?.ok ? "Healthy" : "Needs attention"}</strong>
            <small>Checked {formatDate(health?.checkedAt)}</small>
          </div>
        </article>
        <article>
          <Notification3LineIcon />
          <div>
            <span>Webhook failures</span>
            <strong>{health?.webhooks?.recentFailures || 0}</strong>
            <small>{health?.webhooks?.recentDeliveries || 0} recent deliveries</small>
          </div>
        </article>
        <article>
          <HistoryLineIcon />
          <div>
            <span>Audit events</span>
            <strong>{audit.length}</strong>
            <small>{audit[0] ? formatDate(audit[0].timestamp) : "No admin changes yet"}</small>
          </div>
        </article>
      </section>

      <section className="health-panel">
        <div className="health-panel-title">
          <Notification3LineIcon size={20} />
          <h2>Webhook Delivery History</h2>
        </div>
        <div className="health-table">
          {deliveries.slice(0, 30).map((delivery) => (
            <article key={`${delivery.webhookId}-${delivery.timestamp}-${delivery.status}`} className={delivery.ok ? "is-ok" : "is-error"}>
              <strong>{delivery.name}</strong>
              <span>{delivery.eventType || "webhook"}</span>
              <span>{delivery.status || "No status"}</span>
              <span>{delivery.retryOnFailure ? `Retries ${delivery.maxRetries}` : "No retry"}</span>
              <small>{delivery.error || delivery.destination}</small>
              <time>{formatDate(delivery.timestamp)}</time>
            </article>
          ))}
          {!deliveries.length ? <div className="health-empty">No webhook deliveries recorded yet.</div> : null}
        </div>
        {recentFailures.length ? <p className="health-warning">{recentFailures.length} recent webhook delivery failure{recentFailures.length === 1 ? "" : "s"}.</p> : null}
      </section>

      <section className="health-panel">
        <div className="health-panel-title">
          <HistoryLineIcon size={20} />
          <h2>Admin Audit Log</h2>
        </div>
        <div className="health-table audit-table">
          {audit.slice(0, 40).map((entry) => (
            <article key={`${entry.action}-${entry.timestamp}-${entry.actor}`}>
              <strong>{entry.action}</strong>
              <span>{entry.actor}</span>
              <span>{entry.role || "Role unknown"}</span>
              <small>{detailText(entry.details)}</small>
              <time>{formatDate(entry.timestamp)}</time>
            </article>
          ))}
          {!audit.length ? <div className="health-empty">No admin audit events recorded yet.</div> : null}
        </div>
      </section>
    </div>
  );
}
