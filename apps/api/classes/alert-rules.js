// Custom alert rules: "if <metric> <op> <value> [between hours] then alert".
// Pure helpers only; threshold-alerts.js gathers the live metrics and delivers.

const METRICS = {
  active_streams: { label: "Active streams", unit: "streams", needs: "sessions" },
  transcodes: { label: "Transcoding streams", unit: "streams", needs: "sessions" },
  user_streams: { label: "Streams by one user", unit: "streams", needs: "sessions" },
  bandwidth_mbps: { label: "Total stream bandwidth", unit: "Mbps", needs: "sessions" },
  disk_free_percent: { label: "Lowest disk free space", unit: "%", needs: "disks" },
  download_queue: { label: "Downloads in queue", unit: "items", needs: "downloads" },
};

const OPERATORS = {
  gt: { label: "above", test: (a, b) => a > b },
  gte: { label: "at or above", test: (a, b) => a >= b },
  lt: { label: "below", test: (a, b) => a < b },
  lte: { label: "at or below", test: (a, b) => a <= b },
  eq: { label: "exactly", test: (a, b) => a === b },
};

const SEVERITIES = new Set(["info", "warning", "critical"]);
const MAX_RULES = 25;

function clampHour(value) {
  const hour = Number.parseInt(value, 10);
  return Number.isInteger(hour) && hour >= 0 && hour <= 23 ? hour : null;
}

function normalizeRule(rule = {}, index = 0) {
  const metric = METRICS[rule.metric] ? rule.metric : "active_streams";
  const op = OPERATORS[rule.op] ? rule.op : "gt";
  const value = Number(rule.value);
  const from = clampHour(rule.from);
  const to = clampHour(rule.to);
  const hasWindow = from !== null && to !== null && from !== to;
  return {
    id: String(rule.id || `rule-${Date.now().toString(36)}-${index}`).slice(0, 64),
    name: String(rule.name || "").trim().slice(0, 80),
    enabled: rule.enabled !== false,
    metric,
    op,
    value: Number.isFinite(value) ? Math.max(0, Math.min(1_000_000, value)) : 0,
    from: hasWindow ? from : null,
    to: hasWindow ? to : null,
    severity: SEVERITIES.has(rule.severity) ? rule.severity : "warning",
  };
}

function normalizeRules(rules) {
  return (Array.isArray(rules) ? rules : []).slice(0, MAX_RULES).map(normalizeRule);
}

// Hours are local server time. A window like 23 -> 5 wraps past midnight.
function inWindow(rule, date = new Date()) {
  if (rule.from === null || rule.to === null) return true;
  const hour = date.getHours();
  return rule.from < rule.to ? hour >= rule.from && hour < rule.to : hour >= rule.from || hour < rule.to;
}

function sessionBitrate(session) {
  const transcode = Number(session.TranscodingInfo?.Bitrate || 0);
  if (transcode) return transcode;
  const streams = session.NowPlayingItem?.MediaStreams || [];
  return streams.reduce((sum, stream) => sum + (stream.Type === "Video" || stream.Type === "Audio" ? Number(stream.BitRate || 0) : 0), 0);
}

// Reduce raw inputs to one number per metric. Missing inputs leave the metric undefined
// so rules that depend on them are skipped rather than firing on a zero.
function collectMetrics({ sessions, disks, downloads } = {}) {
  const metrics = {};
  if (Array.isArray(sessions)) {
    const playing = sessions.filter((session) => session?.NowPlayingItem);
    const perUser = new Map();
    for (const session of playing) {
      const key = session.UserName || session.UserId || "unknown";
      perUser.set(key, (perUser.get(key) || 0) + 1);
    }
    const [topUser, topCount] = [...perUser.entries()].sort((a, b) => b[1] - a[1])[0] || [null, 0];
    metrics.active_streams = playing.length;
    metrics.transcodes = playing.filter((session) => /transcode/i.test(String(session.PlayState?.PlayMethod || ""))).length;
    metrics.user_streams = topCount;
    metrics.user_streams_who = topUser;
    metrics.bandwidth_mbps = Math.round((playing.reduce((sum, session) => sum + sessionBitrate(session), 0) / 1_000_000) * 10) / 10;
  }
  if (Array.isArray(disks) && disks.length) {
    const lowest = disks
      .filter((disk) => Number(disk.totalSpace) > 0)
      .map((disk) => ({ ...disk, percent: (Number(disk.freeSpace) / Number(disk.totalSpace)) * 100 }))
      .sort((a, b) => a.percent - b.percent)[0];
    if (lowest) {
      metrics.disk_free_percent = Math.round(lowest.percent * 10) / 10;
      metrics.disk_free_percent_who = lowest.label || lowest.path;
    }
  }
  if (Array.isArray(downloads)) metrics.download_queue = downloads.length;
  return metrics;
}

function describe(rule) {
  const metric = METRICS[rule.metric];
  const window = rule.from !== null ? ` between ${String(rule.from).padStart(2, "0")}:00 and ${String(rule.to).padStart(2, "0")}:00` : "";
  return `${metric.label} ${OPERATORS[rule.op].label} ${rule.value} ${metric.unit}${window}`;
}

function evaluateRules(rules, metrics, now = new Date()) {
  const alerts = [];
  for (const rule of normalizeRules(rules)) {
    if (!rule.enabled || !inWindow(rule, now)) continue;
    const actual = metrics[rule.metric];
    if (typeof actual !== "number" || !OPERATORS[rule.op].test(actual, rule.value)) continue;
    const metric = METRICS[rule.metric];
    const who = metrics[`${rule.metric}_who`];
    alerts.push({
      key: `rule:${rule.id}`,
      alertType: "custom_rule",
      severity: rule.severity,
      title: rule.name || metric.label,
      message: `${metric.label} is ${actual} ${metric.unit}${who ? ` (${who})` : ""}. Rule: ${describe(rule)}.`,
    });
  }
  return alerts;
}

function neededInputs(rules) {
  const needs = new Set();
  for (const rule of normalizeRules(rules)) if (rule.enabled) needs.add(METRICS[rule.metric].needs);
  return needs;
}

const CATALOG = {
  metrics: Object.entries(METRICS).map(([id, metric]) => ({ id, label: metric.label, unit: metric.unit })),
  operators: Object.entries(OPERATORS).map(([id, op]) => ({ id, label: op.label })),
  maxRules: MAX_RULES,
};

module.exports = { CATALOG, normalizeRules, collectMetrics, evaluateRules, neededInputs, inWindow, describe };
