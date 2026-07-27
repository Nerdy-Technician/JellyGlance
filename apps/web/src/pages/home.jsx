import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Modal } from "react-bootstrap";
import axios from "../lib/axios_instance";
import Config from "../lib/config";

import ArrowDownSLineIcon from "remixicon-react/ArrowDownSLineIcon";
import ArrowUpSLineIcon from "remixicon-react/ArrowUpSLineIcon";
import BarChartGroupedLineIcon from "remixicon-react/BarChartGroupedLineIcon";
import ChatCheckLineIcon from "remixicon-react/ChatCheckLineIcon";
import CheckboxCircleLineIcon from "remixicon-react/CheckboxCircleLineIcon";
import Database2LineIcon from "remixicon-react/Database2LineIcon";
import DownloadCloud2LineIcon from "remixicon-react/DownloadCloud2LineIcon";
import EyeLineIcon from "remixicon-react/EyeLineIcon";
import EyeOffLineIcon from "remixicon-react/EyeOffLineIcon";
import ErrorWarningLineIcon from "remixicon-react/ErrorWarningLineIcon";
import FireLineIcon from "remixicon-react/FireLineIcon";
import FilmLineIcon from "remixicon-react/FilmLineIcon";
import GroupLineIcon from "remixicon-react/GroupLineIcon";
import HeartPulseLineIcon from "remixicon-react/HeartPulseLineIcon";
import MagicLineIcon from "remixicon-react/MagicLineIcon";
import Music2LineIcon from "remixicon-react/Music2LineIcon";
import PlayCircleLineIcon from "remixicon-react/PlayCircleLineIcon";
import RestartLineIcon from "remixicon-react/RestartLineIcon";
import RefreshLineIcon from "remixicon-react/RefreshLineIcon";
import Settings3LineIcon from "remixicon-react/Settings3LineIcon";
import StarSmileLineIcon from "remixicon-react/StarSmileLineIcon";
import TimeLineIcon from "remixicon-react/TimeLineIcon";
import TrophyLineIcon from "remixicon-react/TrophyLineIcon";
import Tv2LineIcon from "remixicon-react/Tv2LineIcon";
import User3LineIcon from "remixicon-react/User3LineIcon";

import Sessions from "./components/sessions/sessions";
import "./css/home.css";

const numberFormat = new Intl.NumberFormat();
const HOME_SETTINGS_STORAGE_PREFIX = "jellyglance_home_settings";
const LEGACY_HOME_ORDER_STORAGE_KEY = "jellyglance_home_section_order";
const HOME_LAYOUT_VERSION = 2;
const HOME_SECTION_DEFINITIONS = [
  { id: "sessions", label: "Active sessions" },
  { id: "overview", label: "Overview" },
  { id: "hall", label: "Hall of Fame" },
  { id: "library", label: "Library health" },
  { id: "catalog", label: "Catalog totals" },
  { id: "milestones", label: "Milestones" },
  { id: "week", label: "This week" },
  { id: "attention", label: "Needs attention" },
  { id: "trends", label: "Today vs last week" },
  { id: "issues", label: "Library issues" },
  { id: "watchParty", label: "Watch party" },
  { id: "seasonGaps", label: "Season gaps" },
  { id: "automation", label: "Automation feed" },
  { id: "quickActions", label: "Quick actions" },
  { id: "operations", label: "Operations" },
];
const DEFAULT_HOME_ORDER = HOME_SECTION_DEFINITIONS.map((section) => section.id);
const CURATED_DEFAULT_HOME_ORDER = [
  "attention",
  "sessions",
  "overview",
  "operations",
  "milestones",
  "week",
  "hall",
  "trends",
  "watchParty",
  "quickActions",
  "library",
  "catalog",
  "issues",
  "seasonGaps",
  "automation",
];
const DEFAULT_HOME_SETTINGS = {
  order: CURATED_DEFAULT_HOME_ORDER,
  hidden: ["seasonGaps"],
  pinned: "",
  density: "comfortable",
  autoRotate: false,
  preset: "default",
  title: "",
  theme: "default",
  alertRules: { backupDays: 7, requestThreshold: 1, missingPosterThreshold: 1 },
  dismissedAlerts: {},
  sizes: {},
  version: HOME_LAYOUT_VERSION,
};
const HOME_PRESETS = {
  default: {
    label: "Default",
    order: CURATED_DEFAULT_HOME_ORDER,
    hidden: ["seasonGaps"],
    density: "comfortable",
    sizes: {
      sessions: "large",
      overview: "large",
      attention: "small",
      quickActions: "small",
    },
  },
  admin: {
    label: "Admin",
    order: ["attention", "operations", "quickActions", "automation", "sessions", "overview", "milestones", "trends", "issues", "week", "hall", "library", "catalog", "seasonGaps", "watchParty"],
    hidden: ["watchParty"],
    density: "compact",
    sizes: {
      attention: "small",
      operations: "large",
      quickActions: "small",
      automation: "small",
    },
  },
  family: {
    label: "Family",
    order: ["sessions", "watchParty", "week", "milestones", "hall", "overview", "trends", "catalog", "operations", "quickActions", "library", "attention", "issues", "seasonGaps", "automation"],
    hidden: ["issues", "seasonGaps", "automation"],
    density: "comfortable",
    sizes: {
      sessions: "large",
      watchParty: "large",
      week: "medium",
      hall: "large",
    },
  },
  media: {
    label: "Media Stats",
    order: ["overview", "milestones", "trends", "catalog", "library", "issues", "seasonGaps", "week", "watchParty", "hall", "sessions", "operations", "quickActions", "attention", "automation"],
    hidden: ["automation"],
    density: "comfortable",
    sizes: {
      overview: "large",
      trends: "large",
      catalog: "medium",
      issues: "medium",
    },
  },
  requests: {
    label: "Requests First",
    order: ["attention", "operations", "quickActions", "automation", "sessions", "week", "milestones", "overview", "hall", "trends", "library", "catalog", "issues", "seasonGaps", "watchParty"],
    hidden: ["seasonGaps"],
    density: "compact",
    sizes: {
      attention: "small",
      operations: "large",
      quickActions: "small",
    },
  },
};

function normalizeHomeOrder(order) {
  const knownSections = new Set(DEFAULT_HOME_ORDER);
  const savedOrder = Array.isArray(order) ? order.filter((sectionId) => knownSections.has(sectionId)) : [];
  const missingSections = DEFAULT_HOME_ORDER.filter((sectionId) => !savedOrder.includes(sectionId));
  return [...savedOrder, ...missingSections];
}

function getHomeUserStorageKey() {
  const payload = getHomeTokenPayload();
  if (!payload) return `${HOME_SETTINGS_STORAGE_PREFIX}:browser`;
  return `${HOME_SETTINGS_STORAGE_PREFIX}:${payload.sub || payload.userid || payload.username || payload.name || "user"}`;
}

function getHomeTokenPayload() {
  const token = localStorage.getItem("token");
  if (!token) return null;
  try {
    return JSON.parse(window.atob(token.split(".")[1]?.replace(/-/g, "+").replace(/_/g, "/") || ""));
  } catch {
    return null;
  }
}

function normalizeHomeSettings(settings) {
  const normalized = { ...DEFAULT_HOME_SETTINGS, ...(settings || {}) };
  const knownSections = new Set(DEFAULT_HOME_ORDER);
  normalized.order = normalizeHomeOrder(normalized.order);
  normalized.hidden = Array.isArray(normalized.hidden) ? [...new Set(normalized.hidden.filter((sectionId) => knownSections.has(sectionId)))] : [];
  normalized.pinned = knownSections.has(normalized.pinned) ? normalized.pinned : "";
  normalized.density = normalized.density === "compact" ? "compact" : "comfortable";
  normalized.autoRotate = Boolean(normalized.autoRotate);
  normalized.preset = normalized.preset || "custom";
  normalized.title = typeof normalized.title === "string" ? normalized.title : "";
  normalized.theme = ["default", "darker", "neon", "highContrast", "wall"].includes(normalized.theme) ? normalized.theme : "default";
  normalized.alertRules = {
    ...DEFAULT_HOME_SETTINGS.alertRules,
    ...(normalized.alertRules || {}),
  };
  normalized.dismissedAlerts = normalized.dismissedAlerts && typeof normalized.dismissedAlerts === "object" ? normalized.dismissedAlerts : {};
  normalized.sizes = normalized.sizes && typeof normalized.sizes === "object" ? { ...DEFAULT_HOME_SETTINGS.sizes, ...normalized.sizes } : DEFAULT_HOME_SETTINGS.sizes;
  normalized.version = Number(normalized.version || 0);
  return normalized;
}

function loadHomeSettings() {
  const storageKey = getHomeUserStorageKey();
  try {
    const saved = localStorage.getItem(storageKey);
    if (saved) {
      const parsed = JSON.parse(saved);
      const normalized = normalizeHomeSettings(parsed);
      const stillOldDefault = normalized.version < HOME_LAYOUT_VERSION && (!parsed.preset || parsed.preset === "custom") && JSON.stringify(normalizeHomeOrder(parsed.order)) === JSON.stringify(DEFAULT_HOME_ORDER);
      return stillOldDefault ? normalizeHomeSettings(DEFAULT_HOME_SETTINGS) : normalized;
    }

    const legacyOrder = localStorage.getItem(LEGACY_HOME_ORDER_STORAGE_KEY);
    if (legacyOrder) return normalizeHomeSettings({ order: JSON.parse(legacyOrder) });
  } catch {
    return DEFAULT_HOME_SETTINGS;
  }

  const payload = getHomeTokenPayload();
  const role = String(payload?.role || payload?.Role || payload?.roles?.[0] || "").toLowerCase();
  if (role.includes("admin") || role.includes("owner") || role.includes("manager")) {
    return normalizeHomeSettings({ ...DEFAULT_HOME_SETTINGS, ...HOME_PRESETS.admin, sizes: HOME_PRESETS.admin.sizes, preset: "admin" });
  }
  return normalizeHomeSettings({ ...DEFAULT_HOME_SETTINGS, ...HOME_PRESETS.family, sizes: HOME_PRESETS.family.sizes, preset: "family" });
}

function formatNumber(value) {
  return numberFormat.format(Number(value || 0));
}

function formatDate(value) {
  if (!value) return "Unknown";
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function formatBytes(bytes) {
  const size = Number(bytes || 0);
  if (!size) return "0 B";

  const units = ["B", "KB", "MB", "GB", "TB", "PB"];
  const index = Math.min(Math.floor(Math.log(size) / Math.log(1024)), units.length - 1);
  const value = size / 1024 ** index;

  return `${value >= 10 || index === 0 ? value.toFixed(0) : value.toFixed(1)} ${units[index]}`;
}

function formatDuration(seconds) {
  const total = Number(seconds || 0);
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);

  if (hours >= 1000) return `${formatNumber(hours)} hours`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

function getNextMilestone(value, steps) {
  const current = Number(value || 0);
  return steps.find((step) => current < step) || steps[steps.length - 1];
}

function getMilestoneProgress(value, target) {
  const nextTarget = Number(target || 1);
  return Math.max(0, Math.min(100, (Number(value || 0) / nextTarget) * 100));
}

function buildHomeMilestones(dashboard, operations) {
  if (!dashboard) return [];

  const totalPlaybacks = Number(dashboard?.totals?.totalPlaybacks || 0);
  const totalWatchSeconds = Number(dashboard?.totals?.totalWatchSeconds || 0);
  const totalWatchHours = totalWatchSeconds / 3600;
  const uniqueViewers = Number(dashboard?.totals?.uniqueViewers || 0);
  const catalogItems = Number(dashboard?.catalog?.movies || 0) + Number(dashboard?.catalog?.shows || 0) + Number(dashboard?.catalog?.artists || 0);
  const weeklyTopPlays = Number(dashboard?.weekPulse?.topItem?.plays || 0);
  const weeklyTopName = dashboard?.weekPulse?.topItem?.name || "No weekly top item yet";
  const healthOk = Boolean(operations?.health?.ok);
  const requestStats = operations?.requests?.stats || {};
  const requestWins = Number(requestStats.available || 0) + Number(requestStats.approved || 0);
  const issueCount = Object.values(dashboard?.libraryIssues || {}).reduce((total, value) => total + Number(value || 0), 0);

  const playbackTarget = getNextMilestone(totalPlaybacks, [10, 50, 100, 250, 500, 1000, 2500, 5000, 10000, 25000, 50000]);
  const hoursTarget = getNextMilestone(totalWatchHours, [10, 25, 50, 100, 250, 500, 1000, 2500, 5000, 10000]);
  const catalogTarget = getNextMilestone(catalogItems, [50, 100, 250, 500, 1000, 2500, 5000, 10000, 25000]);

  return [
    {
      id: "playback-count",
      title: totalPlaybacks >= 10000 ? "10K Play Club" : "Playback Climber",
      value: formatNumber(totalPlaybacks),
      detail: `${formatNumber(Math.max(playbackTarget - totalPlaybacks, 0))} plays to ${formatNumber(playbackTarget)}`,
      progress: getMilestoneProgress(totalPlaybacks, playbackTarget),
      icon: PlayCircleLineIcon,
      unlocked: totalPlaybacks >= 10,
    },
    {
      id: "watch-hours",
      title: totalWatchHours >= 1000 ? "Thousand-Hour Theatre" : "Time Collector",
      value: formatDuration(totalWatchSeconds),
      detail: `${formatDuration(Math.max(hoursTarget * 3600 - totalWatchSeconds, 0))} to ${formatNumber(hoursTarget)} hours`,
      progress: getMilestoneProgress(totalWatchHours, hoursTarget),
      icon: TimeLineIcon,
      unlocked: totalWatchHours >= 10,
    },
    {
      id: "household",
      title: uniqueViewers >= 5 ? "Full House" : "Household Spark",
      value: formatNumber(uniqueViewers),
      detail: uniqueViewers >= 5 ? "Five or more viewers have synced activity." : `${formatNumber(Math.max(5 - uniqueViewers, 0))} more viewers to Full House`,
      progress: getMilestoneProgress(uniqueViewers, 5),
      icon: GroupLineIcon,
      unlocked: uniqueViewers >= 5,
    },
    {
      id: "weekly-binge",
      title: weeklyTopPlays >= 10 ? "Binge Beacon" : "Weekly Favourite",
      value: formatNumber(weeklyTopPlays),
      detail: `${weeklyTopName} leads this week`,
      progress: getMilestoneProgress(weeklyTopPlays, 10),
      icon: FireLineIcon,
      unlocked: weeklyTopPlays >= 10,
    },
    {
      id: "catalog",
      title: catalogItems >= 1000 ? "Vault Builder" : "Catalog Builder",
      value: formatNumber(catalogItems),
      detail: `${formatNumber(Math.max(catalogTarget - catalogItems, 0))} items to ${formatNumber(catalogTarget)}`,
      progress: getMilestoneProgress(catalogItems, catalogTarget),
      icon: Database2LineIcon,
      unlocked: catalogItems >= 50,
    },
    {
      id: "ops-health",
      title: healthOk && issueCount === 0 ? "Clean Bill" : "Care Package",
      value: healthOk ? "Healthy" : "Watch",
      detail: issueCount === 0 ? "No library issues in the current dashboard." : `${formatNumber(issueCount)} library issues tracked`,
      progress: healthOk && issueCount === 0 ? 100 : healthOk ? 65 : 28,
      icon: healthOk ? CheckboxCircleLineIcon : ErrorWarningLineIcon,
      unlocked: healthOk && issueCount === 0,
    },
    {
      id: "requests",
      title: requestWins >= 25 ? "Request Hero" : "Request Ripple",
      value: formatNumber(requestWins),
      detail: `${formatNumber(requestWins)} requests approved or available`,
      progress: getMilestoneProgress(requestWins, 25),
      icon: ChatCheckLineIcon,
      unlocked: requestWins >= 25,
    },
  ];
}

function hourLabel(hour) {
  if (hour === 0) return "12am";
  if (hour === 12) return "12pm";
  if (hour === 23) return "11pm";
  return hour < 12 ? `${hour}am` : `${hour - 12}pm`;
}

function HomeAvatar({ user, size = 58 }) {
  const [failed, setFailed] = useState(!user?.primaryImageTag);

  if (failed) {
    return (
      <span className="home-avatar home-avatar-fallback" style={{ width: size, height: size }}>
        <User3LineIcon size={Math.round(size * 0.52)} />
      </span>
    );
  }

  return (
    <img
      className="home-avatar"
      src={`/proxy/Users/Images/Primary?id=${user.userId}&fillWidth=${Math.max(size * 2, 120)}&quality=80`}
      alt=""
      width={size}
      height={size}
      loading="lazy"
      onError={() => setFailed(true)}
    />
  );
}

function MetricCard({ icon: Icon, label, value, detail, accent = "cyan" }) {
  const isLoading = value === undefined || value === null;

  return (
    <article className={`home-glass-card home-metric-card home-accent-${accent}`}>
      <span className="home-icon-bubble">
        <Icon size={24} />
      </span>
      <div>
        <p>{label}</p>
        <strong className={isLoading ? "home-value-skeleton" : ""}>{isLoading ? "" : value}</strong>
        {isLoading ? <small className="home-detail-skeleton" /> : detail ? <small>{detail}</small> : null}
      </div>
    </article>
  );
}

function CatalogCard({ icon: Icon, label, value, detail }) {
  const isLoading = value === undefined || value === null;

  return (
    <article className="home-glass-card home-catalog-card">
      <Icon size={24} />
      <div>
        <p>{label}</p>
        <strong className={isLoading ? "home-value-skeleton" : ""}>{isLoading ? "" : value}</strong>
        {isLoading ? <small className="home-detail-skeleton" /> : detail ? <small>{detail}</small> : null}
      </div>
    </article>
  );
}

function HomeOpsCard({ icon: Icon, label, value, detail, to, accent = "cyan" }) {
  const content = (
    <>
      <span className="home-icon-bubble">
        <Icon size={22} />
      </span>
      <div>
        <p>{label}</p>
        <strong>{value}</strong>
        <small>{detail}</small>
      </div>
    </>
  );

  if (to) {
    return (
      <Link className={`home-glass-card home-ops-card home-accent-${accent}`} to={to}>
        {content}
      </Link>
    );
  }

  return <article className={`home-glass-card home-ops-card home-accent-${accent}`}>{content}</article>;
}

export default function Home({ kioskMode = false }) {
  const [dashboard, setDashboard] = useState(null);
  const [operations, setOperations] = useState({ requests: null, health: null });
  const [isOrderingHome, setIsOrderingHome] = useState(false);
  const [homeSettings, setHomeSettings] = useState(loadHomeSettings);
  const [rotateIndex, setRotateIndex] = useState(0);
  const [actionMessage, setActionMessage] = useState("");
  const [busyAction, setBusyAction] = useState("");
  const [draggedSection, setDraggedSection] = useState("");
  const [detailModal, setDetailModal] = useState(null);
  const [, setError] = useState("");

  async function loadDashboardData() {
    try {
      const cachedToken = localStorage.getItem("token");
      const config = cachedToken ? { token: cachedToken } : await Config.getConfig();
      const response = await axios.get("/stats/getHomeDashboard", {
        headers: { Authorization: `Bearer ${config.token}` },
      });
      setDashboard(response.data);
      setError("");
    } catch (err) {
      console.log(err);
      setError("Home dashboard data is unavailable.");
    }
  }

  async function loadOperationsData(forceRequests = false) {
    const token = localStorage.getItem("token");
    if (!token) return;

    const headers = { Authorization: `Bearer ${token}` };
    const [requestsResponse, healthResponse] = await Promise.allSettled([
      axios.get("/api/requests", { headers, params: forceRequests ? { force: "true" } : undefined }),
      axios.get("/api/health", { headers }),
    ]);

    setOperations({
      requests: requestsResponse.status === "fulfilled" ? requestsResponse.value.data : null,
      health: healthResponse.status === "fulfilled" ? healthResponse.value.data : null,
    });
  }

  useEffect(() => {
    let active = true;

    async function fetchDashboard() {
      await loadDashboardData();
    }

    fetchDashboard();
    const interval = setInterval(fetchDashboard, 60000 * 2);

    return () => {
      active = false;
      clearInterval(interval);
    };
  }, []);

  useEffect(() => {
    let active = true;

    async function fetchOperations() {
      if (!active) return;
      await loadOperationsData();
    }

    fetchOperations();
    const interval = setInterval(fetchOperations, 60000);

    return () => {
      active = false;
      clearInterval(interval);
    };
  }, []);

  const peakHours = dashboard?.peakHours || [];
  const maxPeak = useMemo(() => Math.max(...peakHours.map((hour) => Number(hour.count || 0)), 1), [peakHours]);
  const hallOfFame = dashboard?.hallOfFame || [];
  const podium = hallOfFame.slice(0, 3);
  const runners = hallOfFame.slice(3, 5);
  const concentration = Number(dashboard?.libraryBalance?.concentration || 0);
  const requestStats = operations.requests?.stats || {};
  const recentRequests = (operations.requests?.requests || []).slice(0, 4);
  const healthChecks = operations.health?.checks || [];
  const failingChecks = healthChecks.filter((check) => !check.ok);
  const healthLabel = operations.health ? (operations.health.ok ? "Healthy" : `${failingChecks.length} issue${failingChecks.length === 1 ? "" : "s"}`) : "Loading";
  const backupDate = operations.health?.backup?.latestBackup?.datecreated;
  const weekPulse = dashboard?.weekPulse || {};
  const topItem = weekPulse.topItem;
  const activeViewer = weekPulse.mostActiveViewer;
  const quietUsers = weekPulse.quietUsers || [];
  const trendDelta = dashboard?.trends?.delta || {};
  const todayTrend = dashboard?.trends?.today || {};
  const libraryIssues = dashboard?.libraryIssues || {};
  const watchParty = dashboard?.watchParty || [];
  const requestUrgency = Number(requestStats.pending || 0) + Number(requestStats.failed || 0);
  const backupAgeMs = backupDate ? Date.now() - new Date(backupDate).getTime() : Infinity;
  const backupAgeDays = Number.isFinite(backupAgeMs) ? Math.floor(backupAgeMs / (24 * 60 * 60 * 1000)) : Infinity;
  const attentionItems = [
    requestUrgency >= Number(homeSettings.alertRules.requestThreshold || 1)
      ? { key: `requests:${requestUrgency}`, label: `${formatNumber(requestUrgency)} request${requestUrgency === 1 ? "" : "s"} need attention`, type: "requests" }
      : null,
    failingChecks.length ? { key: `health:${failingChecks.map((check) => check.key).join(",")}`, label: `${failingChecks.length} health check${failingChecks.length === 1 ? "" : "s"} failing`, type: "health" } : null,
    backupAgeDays >= Number(homeSettings.alertRules.backupDays || 7) ? { key: `backup:${backupDate || "missing"}`, label: "Backup is stale or missing", type: "backup" } : null,
    Number(libraryIssues.missingPosters || 0) >= Number(homeSettings.alertRules.missingPosterThreshold || 1)
      ? { key: `posters:${libraryIssues.missingPosters}`, label: `${formatNumber(libraryIssues.missingPosters)} missing posters`, type: "posters" }
      : null,
  ].filter((item) => item && !homeSettings.dismissedAlerts?.[item.key]);
  const seasonGaps = dashboard?.seasonGaps || [];
  const automationFeed = dashboard?.automationFeed || [];
  const milestones = useMemo(() => buildHomeMilestones(dashboard, operations), [dashboard, operations]);

  useEffect(() => {
    localStorage.setItem(getHomeUserStorageKey(), JSON.stringify(homeSettings));
  }, [homeSettings]);

  function updateHomeSettings(updater) {
    setHomeSettings((current) => normalizeHomeSettings(typeof updater === "function" ? updater(current) : { ...current, ...updater }));
  }

  function moveHomeSection(sectionId, direction) {
    updateHomeSettings((current) => {
      const nextOrder = normalizeHomeOrder(current.order);
      const currentIndex = nextOrder.indexOf(sectionId);
      const nextIndex = currentIndex + direction;

      if (currentIndex < 0 || nextIndex < 0 || nextIndex >= nextOrder.length) {
        return current;
      }

      [nextOrder[currentIndex], nextOrder[nextIndex]] = [nextOrder[nextIndex], nextOrder[currentIndex]];
      return { ...current, order: nextOrder, preset: "custom" };
    });
  }

  function resetHomeOrder() {
    updateHomeSettings(DEFAULT_HOME_SETTINGS);
  }

  function toggleHomeSection(sectionId) {
    updateHomeSettings((current) => {
      const hidden = new Set(current.hidden || []);
      if (hidden.has(sectionId)) {
        hidden.delete(sectionId);
      } else {
        hidden.add(sectionId);
      }
      return { ...current, hidden: [...hidden], preset: "custom" };
    });
  }

  function dismissHomeAlert(alertKey) {
    updateHomeSettings((current) => ({
      ...current,
      dismissedAlerts: { ...(current.dismissedAlerts || {}), [alertKey]: new Date().toISOString() },
      preset: "custom",
    }));
  }

  function updateWidgetSize(sectionId, size) {
    updateHomeSettings((current) => ({
      ...current,
      sizes: { ...(current.sizes || {}), [sectionId]: size },
      preset: "custom",
    }));
  }

  function moveSectionTo(sectionId, targetId) {
    if (!sectionId || !targetId || sectionId === targetId) return;
    updateHomeSettings((current) => {
      const withoutDragged = normalizeHomeOrder(current.order).filter((id) => id !== sectionId);
      const targetIndex = withoutDragged.indexOf(targetId);
      withoutDragged.splice(targetIndex < 0 ? withoutDragged.length : targetIndex, 0, sectionId);
      return { ...current, order: withoutDragged, preset: "custom" };
    });
  }

  function exportHomeLayout() {
    const payload = JSON.stringify(homeSettings, null, 2);
    navigator.clipboard?.writeText(payload).then(() => setActionMessage("Homepage layout copied as JSON."), () => setActionMessage(payload));
  }

  function applyHomePreset(presetId) {
    const preset = HOME_PRESETS[presetId];
    if (!preset) return;
    updateHomeSettings((current) => ({
      ...current,
      order: preset.order,
      hidden: preset.hidden,
      density: preset.density,
      sizes: preset.sizes || {},
      preset: presetId,
    }));
  }

  async function runQuickAction(action) {
    const token = localStorage.getItem("token");
    const headers = { Authorization: `Bearer ${token}` };
    const actions = {
      sync: { label: "Jellyfin sync", request: () => axios.get("/sync/beginSync", { headers }) },
      backup: { label: "Backup", request: () => axios.get("/backup/beginBackup", { headers }) },
      integrations: { label: "Integration test", request: () => axios.post("/api/integrations/test-all", {}, { headers }) },
    };
    const selected = actions[action];
    if (!selected) return;

    try {
      setBusyAction(action);
      setActionMessage("");
      await selected.request();
      setActionMessage(`${selected.label} started.`);
    } catch (error) {
      setActionMessage(error.response?.data?.error || error.message || `${selected.label} failed.`);
    } finally {
      setBusyAction("");
    }
  }

  const sectionLabels = HOME_SECTION_DEFINITIONS.reduce((labels, section) => ({ ...labels, [section.id]: section.label }), {});
  const orderedSectionIds = useMemo(() => {
    const hidden = new Set(homeSettings.hidden);
    let ordered = normalizeHomeOrder(homeSettings.order).filter((sectionId) => !hidden.has(sectionId));

    if (homeSettings.pinned && ordered.includes(homeSettings.pinned)) {
      ordered = [homeSettings.pinned, ...ordered.filter((sectionId) => sectionId !== homeSettings.pinned)];
    }

    if (requestUrgency > 0 && ordered.includes("operations") && homeSettings.pinned !== "operations") {
      ordered = ["operations", ...ordered.filter((sectionId) => sectionId !== "operations")];
      if (homeSettings.pinned && ordered.includes(homeSettings.pinned)) {
        ordered = [homeSettings.pinned, ...ordered.filter((sectionId) => sectionId !== homeSettings.pinned)];
      }
    }

    return ordered;
  }, [homeSettings.hidden, homeSettings.order, homeSettings.pinned, requestUrgency]);
  const effectiveAutoRotate = homeSettings.autoRotate || kioskMode;
  const activeRotateSection = effectiveAutoRotate && orderedSectionIds.length ? orderedSectionIds[rotateIndex % orderedSectionIds.length] : null;
  const homeSectionOrder = useMemo(() => Object.fromEntries(orderedSectionIds.map((sectionId, index) => [sectionId, index])), [orderedSectionIds]);
  const getHomeSectionStyle = (sectionId) => ({ order: homeSectionOrder[sectionId] ?? DEFAULT_HOME_ORDER.indexOf(sectionId) });
  const getHomeSectionClass = (sectionId, className = "") => `${className} home-widget-size-${homeSettings.sizes?.[sectionId] || "medium"}`.trim();
  const shouldRenderSection = (sectionId) => orderedSectionIds.includes(sectionId) && (!activeRotateSection || activeRotateSection === sectionId);

  useEffect(() => {
    setRotateIndex(0);
  }, [orderedSectionIds.join("|"), effectiveAutoRotate]);

  useEffect(() => {
    if (!effectiveAutoRotate || orderedSectionIds.length < 2) return undefined;
    const interval = setInterval(() => {
      setRotateIndex((current) => (current + 1) % orderedSectionIds.length);
    }, 20000);
    return () => clearInterval(interval);
  }, [effectiveAutoRotate, orderedSectionIds.length]);

  return (
    <div className={`Home home-dashboard home-density-${homeSettings.density} home-theme-${homeSettings.theme} ${effectiveAutoRotate ? "is-rotating-home" : ""} ${kioskMode ? "is-kiosk-home" : ""}`}>
      <div className="home-dashboard-backdrop" aria-hidden="true" />

      <div className="home-order-toolbar">
        <div>
          <strong>{homeSettings.title || (kioskMode ? "JellyGlance Kiosk" : "JellyGlance Home")}</strong>
        </div>
        <button type="button" onClick={loadDashboardData}>
          <RefreshLineIcon size={17} />
          Dashboard
        </button>
        <button type="button" onClick={() => loadOperationsData(true)}>
          <RefreshLineIcon size={17} />
          Ops
        </button>
        <button type="button" onClick={() => setIsOrderingHome((current) => !current)} aria-pressed={isOrderingHome}>
          <Settings3LineIcon size={17} />
          Order
        </button>
      </div>

      {isOrderingHome ? (
        <div className="home-order-panel home-glass-card">
          <div className="home-order-panel-heading">
            <div>
              <p>Homepage order</p>
              <strong>Move, hide, pin, and preset sections.</strong>
            </div>
            <button type="button" onClick={resetHomeOrder}>
              <RestartLineIcon size={16} />
              Reset
            </button>
            <button type="button" onClick={exportHomeLayout}>
              <DownloadCloud2LineIcon size={16} />
              Export
            </button>
          </div>
          <div className="home-order-options">
            <label>
              <span>Title</span>
              <input value={homeSettings.title} placeholder="JellyGlance Home" onChange={(event) => updateHomeSettings({ title: event.target.value, preset: "custom" })} />
            </label>
            <label>
              <span>Preset</span>
              <select value={homeSettings.preset} onChange={(event) => applyHomePreset(event.target.value)}>
                <option value="custom">Custom</option>
                {Object.entries(HOME_PRESETS).map(([presetId, preset]) => (
                  <option key={presetId} value={presetId}>{preset.label}</option>
                ))}
              </select>
            </label>
            <label>
              <span>Pin top</span>
              <select value={homeSettings.pinned} onChange={(event) => updateHomeSettings({ pinned: event.target.value, preset: "custom" })}>
                <option value="">None</option>
                {HOME_SECTION_DEFINITIONS.map((section) => (
                  <option key={section.id} value={section.id}>{section.label}</option>
                ))}
              </select>
            </label>
            <label>
              <span>Density</span>
              <select value={homeSettings.density} onChange={(event) => updateHomeSettings({ density: event.target.value, preset: "custom" })}>
                <option value="comfortable">Comfortable</option>
                <option value="compact">Compact</option>
              </select>
            </label>
            <label>
              <span>Theme</span>
              <select value={homeSettings.theme} onChange={(event) => updateHomeSettings({ theme: event.target.value, preset: "custom" })}>
                <option value="default">Default</option>
                <option value="darker">Darker</option>
                <option value="neon">Neon</option>
                <option value="highContrast">High contrast</option>
                <option value="wall">Wall display</option>
              </select>
            </label>
            <button type="button" className={homeSettings.autoRotate ? "is-enabled" : ""} onClick={() => updateHomeSettings((current) => ({ ...current, autoRotate: !current.autoRotate, preset: "custom" }))}>
              <PlayCircleLineIcon size={16} />
              Auto rotate
            </button>
          </div>
          <div className="home-order-options is-alert-rules">
            <label>
              <span>Backup days</span>
              <input type="number" min="1" value={homeSettings.alertRules.backupDays} onChange={(event) => updateHomeSettings((current) => ({ ...current, alertRules: { ...current.alertRules, backupDays: Number(event.target.value) || 1 }, preset: "custom" }))} />
            </label>
            <label>
              <span>Requests alert</span>
              <input type="number" min="1" value={homeSettings.alertRules.requestThreshold} onChange={(event) => updateHomeSettings((current) => ({ ...current, alertRules: { ...current.alertRules, requestThreshold: Number(event.target.value) || 1 }, preset: "custom" }))} />
            </label>
            <label>
              <span>Missing posters</span>
              <input type="number" min="1" value={homeSettings.alertRules.missingPosterThreshold} onChange={(event) => updateHomeSettings((current) => ({ ...current, alertRules: { ...current.alertRules, missingPosterThreshold: Number(event.target.value) || 1 }, preset: "custom" }))} />
            </label>
            <button type="button" onClick={() => updateHomeSettings((current) => ({ ...current, dismissedAlerts: {}, preset: "custom" }))}>Restore alerts</button>
          </div>
          {requestUrgency > 0 ? <p className="home-order-note">{formatNumber(requestUrgency)} request issue{requestUrgency === 1 ? "" : "s"} detected, so Operations is bubbling up.</p> : null}
          <div className="home-order-list">
            {normalizeHomeOrder(homeSettings.order).map((sectionId, index) => {
              const isHidden = homeSettings.hidden.includes(sectionId);
              return (
              <article
                key={sectionId}
                draggable
                onDragStart={() => setDraggedSection(sectionId)}
                onDragOver={(event) => event.preventDefault()}
                onDrop={() => {
                  moveSectionTo(draggedSection, sectionId);
                  setDraggedSection("");
                }}
              >
                <span>{index + 1}</span>
                <strong className={isHidden ? "is-hidden-section" : ""}>{sectionLabels[sectionId]}</strong>
                <div>
                  <select title="Widget size" value={homeSettings.sizes?.[sectionId] || "medium"} onChange={(event) => updateWidgetSize(sectionId, event.target.value)}>
                    <option value="small">S</option>
                    <option value="medium">M</option>
                    <option value="large">L</option>
                  </select>
                  <button type="button" title={isHidden ? "Show section" : "Hide section"} onClick={() => toggleHomeSection(sectionId)}>
                    {isHidden ? <EyeOffLineIcon size={17} /> : <EyeLineIcon size={17} />}
                  </button>
                  <button type="button" title="Move up" disabled={index === 0} onClick={() => moveHomeSection(sectionId, -1)}>
                    <ArrowUpSLineIcon size={18} />
                  </button>
                  <button type="button" title="Move down" disabled={index === homeSettings.order.length - 1} onClick={() => moveHomeSection(sectionId, 1)}>
                    <ArrowDownSLineIcon size={18} />
                  </button>
                </div>
              </article>
            );
            })}
          </div>
        </div>
      ) : null}

      <div className="home-section-stack">
      {shouldRenderSection("sessions") ? <section className={getHomeSectionClass("sessions", "home-active-sessions home-glass-card")} style={getHomeSectionStyle("sessions")}>
        <Sessions />
      </section> : null}

      {shouldRenderSection("overview") ? <section className={getHomeSectionClass("overview", "home-hero-grid")} aria-label="JellyGlance overview" style={getHomeSectionStyle("overview")}>
        <MetricCard
          icon={PlayCircleLineIcon}
          label="Total playbacks"
          value={dashboard ? formatNumber(dashboard?.totals?.totalPlaybacks) : undefined}
          detail={dashboard ? `${formatDuration(dashboard?.totals?.totalWatchSeconds)} watched` : ""}
        />
        <MetricCard
          icon={GroupLineIcon}
          label="Unique viewers"
          value={dashboard ? formatNumber(dashboard?.totals?.uniqueViewers) : undefined}
          detail={dashboard ? "people with synced activity" : ""}
          accent="purple"
        />
        <article className="home-glass-card home-peak-card">
          <div className="home-card-label">
            <TimeLineIcon size={17} />
            <span>Peak viewing hours</span>
          </div>
          <div className="home-hour-bars" aria-label="Playback count by hour">
            {peakHours.map((hour) => (
              <span key={hour.hour} className="home-hour">
                <span style={{ height: `${Math.max(12, (Number(hour.count || 0) / maxPeak) * 100)}%` }} />
              </span>
            ))}
            {!dashboard
              ? Array.from({ length: 24 }, (_, index) => (
                  <span key={`loading-${index}`} className="home-hour is-loading">
                    <span style={{ height: `${18 + (index % 6) * 10}%` }} />
                  </span>
                ))
              : null}
          </div>
          <div className="home-hour-labels">
            <span>{hourLabel(0)}</span>
            <span>{hourLabel(6)}</span>
            <span>{hourLabel(12)}</span>
            <span>{hourLabel(18)}</span>
            <span>{hourLabel(23)}</span>
          </div>
        </article>
      </section> : null}

      {shouldRenderSection("hall") ? <section className={getHomeSectionClass("hall", "home-hall-section")} style={getHomeSectionStyle("hall")}>
        <div className="home-section-title">
          <TrophyLineIcon size={20} />
          <h2>Hall of Fame</h2>
        </div>

        <div className="home-hall-grid">
          <div className="home-podium">
            {(dashboard ? podium : [0, 1, 2]).map((user, index) => (
              <article key={dashboard ? user.userId || user.userName : `loading-${index}`} className={`home-podium-card rank-${index + 1}`}>
                <span className="home-rank-medal">#{index + 1}</span>
                {dashboard ? <HomeAvatar user={user} size={index === 0 ? 74 : 58} /> : <span className="home-avatar home-avatar-skeleton" style={{ width: index === 0 ? 74 : 58, height: index === 0 ? 74 : 58 }} />}
                <strong className={!dashboard ? "home-name-skeleton" : ""}>{dashboard ? user.userName || "Unknown" : ""}</strong>
                {dashboard ? <small>{formatNumber(user.plays)} plays</small> : <small className="home-detail-skeleton" />}
              </article>
            ))}
          </div>

          <div className="home-runner-list">
            {runners.length > 0 ? (
              runners.map((user, index) => (
                <article key={user.userId || user.userName} className="home-runner-row">
                  <span>#{index + 4}</span>
                  <HomeAvatar user={user} size={38} />
                  <strong>{user.userName || "Unknown"}</strong>
                  <small>{formatNumber(user.plays)} plays</small>
                </article>
              ))
            ) : (
              <article className="home-runner-empty">More playback history will appear here as JellyGlance syncs.</article>
            )}
          </div>
        </div>
      </section> : null}

      {shouldRenderSection("library") ? <section className={getHomeSectionClass("library", "home-secondary-grid")} aria-label="Library health" style={getHomeSectionStyle("library")}>
        <article className="home-glass-card home-balance-card">
          <p>Library balance</p>
          <strong className={!dashboard ? "home-value-skeleton" : ""}>{dashboard?.libraryBalance?.label || ""}</strong>
          {dashboard ? <small>Top library represents {concentration.toFixed(1)}% of tracked plays.</small> : <small className="home-detail-skeleton" />}
        </article>
        <MetricCard
          icon={BarChartGroupedLineIcon}
          label="Active libraries"
          value={dashboard ? formatNumber(dashboard?.catalog?.activeLibraries) : undefined}
          detail={dashboard ? "Libraries with synced items" : ""}
          accent="purple"
        />
        <MetricCard
          icon={Database2LineIcon}
          label="Catalog size"
          value={dashboard ? formatNumber(dashboard?.catalog?.movies + dashboard?.catalog?.shows) : undefined}
          detail={dashboard ? formatBytes(dashboard?.catalog?.size) : ""}
        />
        <article className="home-glass-card home-balance-card">
          <p>Usage concentration</p>
          <strong className={!dashboard ? "home-value-skeleton" : ""}>{dashboard ? `${concentration.toFixed(1)}%` : ""}</strong>
          {dashboard ? <small>Watched share in the busiest library.</small> : <small className="home-detail-skeleton" />}
        </article>
      </section> : null}

      {shouldRenderSection("catalog") ? <section className={getHomeSectionClass("catalog", "home-catalog-grid")} aria-label="Catalog totals" style={getHomeSectionStyle("catalog")}>
        <CatalogCard
          icon={FilmLineIcon}
          label="Movies catalog"
          value={dashboard ? formatNumber(dashboard?.catalog?.movies) : undefined}
          detail={dashboard ? "Total movies in library" : ""}
        />
        <CatalogCard
          icon={Tv2LineIcon}
          label="TV shows catalog"
          value={dashboard ? formatNumber(dashboard?.catalog?.shows) : undefined}
          detail={dashboard ? `${formatNumber(dashboard?.catalog?.episodes)} episodes` : ""}
        />
        <CatalogCard
          icon={Music2LineIcon}
          label="Music catalog"
          value={dashboard ? formatNumber(dashboard?.catalog?.artists) : undefined}
          detail={dashboard ? "Artists tracked" : ""}
        />
      </section> : null}

      {shouldRenderSection("milestones") ? (
        <section className={getHomeSectionClass("milestones", "home-milestones home-glass-card")} aria-label="Achievements and media milestones" style={getHomeSectionStyle("milestones")}>
          <div className="home-section-title">
            <StarSmileLineIcon size={20} />
            <h2>Milestones</h2>
          </div>
          <div className="home-milestone-grid">
            {(dashboard ? milestones : Array.from({ length: 4 })).map((milestone, index) => {
              const Icon = milestone?.icon || TrophyLineIcon;
              return (
                <article
                  key={milestone?.id || `loading-${index}`}
                  className={`home-milestone-card ${milestone?.unlocked ? "is-unlocked" : ""}`}
                  role={milestone ? "button" : undefined}
                  tabIndex={milestone ? 0 : undefined}
                  onClick={() => milestone ? setDetailModal({ type: "milestone", title: milestone.title, milestone }) : null}
                >
                  <span className="home-milestone-icon">
                    <Icon size={22} />
                  </span>
                  <div>
                    <strong className={!dashboard ? "home-value-skeleton" : ""}>{milestone?.title || ""}</strong>
                    {dashboard ? <small>{milestone.detail}</small> : <small className="home-detail-skeleton" />}
                  </div>
                  <em className={!dashboard ? "home-value-skeleton" : ""}>{milestone?.value || ""}</em>
                  <span className="home-milestone-progress" aria-hidden="true">
                    <i style={{ width: `${milestone?.progress || 0}%` }} />
                  </span>
                </article>
              );
            })}
          </div>
        </section>
      ) : null}

      {shouldRenderSection("week") ? <section className={getHomeSectionClass("week", "home-week-pulse home-glass-card")} aria-label="This week pulse" style={getHomeSectionStyle("week")}>
        <div className="home-section-title">
          <FireLineIcon size={20} />
          <h2>This Week</h2>
        </div>
        <div className="home-week-grid">
          <article className="home-week-feature">
            <span>Top item</span>
            <strong className={!dashboard ? "home-value-skeleton" : ""}>{dashboard ? topItem?.name || "No plays yet" : ""}</strong>
            {dashboard ? <small>{topItem ? `${formatNumber(topItem.plays)} plays · ${formatDuration(topItem.watchSeconds)}` : "Waiting for this week's viewing history."}</small> : <small className="home-detail-skeleton" />}
          </article>
          <article>
            <span>Most active</span>
            <strong className={!dashboard ? "home-value-skeleton" : ""}>{dashboard ? activeViewer?.userName || "Nobody yet" : ""}</strong>
            {dashboard ? <small>{activeViewer ? `${formatNumber(activeViewer.plays)} plays this week` : "No weekly activity found."}</small> : <small className="home-detail-skeleton" />}
          </article>
          <article>
            <span>Quiet users</span>
            <strong className={!dashboard ? "home-value-skeleton" : ""}>{dashboard ? formatNumber(quietUsers.length) : ""}</strong>
            {dashboard ? <small>{quietUsers.length ? quietUsers.map((user) => user.userName).join(", ") : "Everyone has checked in recently."}</small> : <small className="home-detail-skeleton" />}
          </article>
        </div>
      </section> : null}

      {shouldRenderSection("attention") ? (
        <section className={getHomeSectionClass("attention", "home-attention-section home-glass-card")} aria-label="Needs attention" style={getHomeSectionStyle("attention")}>
          <div className="home-section-title">
            <ErrorWarningLineIcon size={20} />
            <h2>Needs Attention</h2>
          </div>
          <div className="home-attention-list">
            {attentionItems.length ? attentionItems.map((item) => (
              <span key={item.key}>
                {item.label}
                <button type="button" onClick={() => dismissHomeAlert(item.key)}>Dismiss</button>
              </span>
            )) : <span>Nothing urgent right now.</span>}
          </div>
        </section>
      ) : null}

      {shouldRenderSection("trends") ? (
        <section className={getHomeSectionClass("trends", "home-trend-grid")} aria-label="Today versus last week" style={getHomeSectionStyle("trends")}>
          <MetricCard icon={PlayCircleLineIcon} label="Plays today" value={dashboard ? formatNumber(todayTrend.plays) : undefined} detail={dashboard ? `${trendDelta.plays >= 0 ? "+" : ""}${formatNumber(trendDelta.plays)} vs last week` : ""} />
          <MetricCard icon={TimeLineIcon} label="Hours today" value={dashboard ? formatDuration(todayTrend.watchSeconds) : undefined} detail={dashboard ? `${trendDelta.watchSeconds >= 0 ? "+" : ""}${formatDuration(Math.abs(trendDelta.watchSeconds || 0))} vs last week` : ""} accent="purple" />
          <MetricCard icon={GroupLineIcon} label="Active today" value={dashboard ? formatNumber(todayTrend.activeUsers) : undefined} detail={dashboard ? `${trendDelta.activeUsers >= 0 ? "+" : ""}${formatNumber(trendDelta.activeUsers)} users vs last week` : ""} />
        </section>
      ) : null}

      {shouldRenderSection("issues") ? (
        <section className={getHomeSectionClass("issues", "home-issue-grid")} aria-label="Library issues" style={getHomeSectionStyle("issues")}>
          <button type="button" className="home-issue-button" onClick={() => setDetailModal({ type: "issues", title: "Missing Posters", body: `${formatNumber(libraryIssues.missingPosters)} items are missing primary artwork.` })}>
            <MetricCard icon={FilmLineIcon} label="Missing posters" value={dashboard ? formatNumber(libraryIssues.missingPosters) : undefined} detail={dashboard ? "Items without primary art" : ""} accent="purple" />
          </button>
          <button type="button" className="home-issue-button" onClick={() => setDetailModal({ type: "seasonGaps", title: "Season Gaps", items: seasonGaps })}>
            <MetricCard icon={Tv2LineIcon} label="Missing episodes" value={dashboard ? formatNumber(libraryIssues.missingEpisodeSeries) : undefined} detail={dashboard ? "Series with no synced episodes" : ""} />
          </button>
          <button type="button" className="home-issue-button" onClick={() => setDetailModal({ type: "issues", title: "Missing Runtime", body: `${formatNumber(libraryIssues.missingRuntime)} items are missing runtime data.` })}>
            <MetricCard icon={Database2LineIcon} label="Missing runtime" value={dashboard ? formatNumber(libraryIssues.missingRuntime) : undefined} detail={dashboard ? "Items without runtime data" : ""} accent="purple" />
          </button>
        </section>
      ) : null}

      {shouldRenderSection("watchParty") ? (
        <section className={getHomeSectionClass("watchParty", "home-watch-party home-glass-card")} aria-label="Watch party suggestions" style={getHomeSectionStyle("watchParty")}>
          <div className="home-section-title">
            <StarSmileLineIcon size={20} />
            <h2>Watch Party</h2>
          </div>
          <div className="home-watch-party-list">
            {watchParty.length ? watchParty.map((item) => (
              <article key={`${item.itemId}-${item.name}`} role="button" tabIndex={0} onClick={() => setDetailModal({ type: "watchParty", title: item.name, item })}>
                <strong>{item.name}</strong>
                <small>{formatNumber(item.users)} users · {formatNumber(item.plays)} plays in 30 days</small>
              </article>
            )) : <span>No shared viewing overlap yet.</span>}
          </div>
        </section>
      ) : null}

      {shouldRenderSection("seasonGaps") ? (
        <section className={getHomeSectionClass("seasonGaps", "home-watch-party home-glass-card")} aria-label="Season gaps" style={getHomeSectionStyle("seasonGaps")}>
          <div className="home-section-title">
            <Tv2LineIcon size={20} />
            <h2>Season Gaps</h2>
          </div>
          <div className="home-watch-party-list">
            {seasonGaps.length ? seasonGaps.map((item) => (
              <article key={item.itemId}>
                <strong>{item.name}</strong>
                <small>No synced episodes found</small>
              </article>
            )) : <span>No season gaps found.</span>}
          </div>
        </section>
      ) : null}

      {shouldRenderSection("automation") ? (
        <section className={getHomeSectionClass("automation", "home-watch-party home-glass-card")} aria-label="Automation activity feed" style={getHomeSectionStyle("automation")}>
          <div className="home-section-title">
            <RefreshLineIcon size={20} />
            <h2>Automation</h2>
          </div>
          <div className="home-watch-party-list">
            {automationFeed.length ? automationFeed.map((item) => (
              <article key={item.id}>
                <strong>{item.name}</strong>
                <small>{item.result} · {formatDate(item.timeRun)}</small>
              </article>
            )) : <span>No automation activity yet.</span>}
          </div>
        </section>
      ) : null}

      {shouldRenderSection("quickActions") ? (
        <section className={getHomeSectionClass("quickActions", "home-quick-actions home-glass-card")} aria-label="Homepage quick actions" style={getHomeSectionStyle("quickActions")}>
          <div className="home-section-title">
            <MagicLineIcon size={20} />
            <h2>Quick Actions</h2>
          </div>
          <div className="home-quick-action-grid">
            <button type="button" disabled={Boolean(busyAction)} onClick={() => runQuickAction("sync")}>Sync Jellyfin</button>
            <button type="button" disabled={Boolean(busyAction)} onClick={() => runQuickAction("integrations")}>Test integrations</button>
            <button type="button" disabled={Boolean(busyAction)} onClick={() => runQuickAction("backup")}>Run backup</button>
            <Link to="/requests">Open Requests</Link>
          </div>
          {actionMessage ? <p>{actionMessage}</p> : null}
        </section>
      ) : null}

      {shouldRenderSection("operations") ? <section className={getHomeSectionClass("operations", "home-ops-section")} aria-label="Server operations" style={getHomeSectionStyle("operations")}>
        <div className="home-section-title">
          <HeartPulseLineIcon size={20} />
          <h2>Operations</h2>
        </div>

        <div className="home-ops-grid">
          <HomeOpsCard
            icon={ChatCheckLineIcon}
            label="Request queue"
            value={`${formatNumber(requestStats.pending)} pending`}
            detail={`${formatNumber(requestStats.failed)} failed · ${formatNumber(requestStats.available)} available`}
            to="/requests"
            accent="purple"
          />
          <HomeOpsCard
            icon={operations.health?.ok ? CheckboxCircleLineIcon : ErrorWarningLineIcon}
            label="System health"
            value={healthLabel}
            detail={operations.health ? healthChecks.map((check) => `${check.label}: ${check.ok ? "OK" : "Issue"}`).slice(0, 2).join(" · ") : "Checking services"}
            to="/settings"
          />
          <HomeOpsCard
            icon={Database2LineIcon}
            label="Backups"
            value={operations.health?.backup?.count ?? "Loading"}
            detail={backupDate ? `Latest ${formatDate(backupDate)}` : "No backup found"}
            to="/settings"
            accent="purple"
          />
        </div>

        <div className="home-request-preview home-glass-card">
          <div className="home-request-preview-heading">
            <div>
              <p>Recent requests</p>
              <strong>{formatNumber(operations.requests?.requests?.length || 0)} total</strong>
            </div>
            <Link to="/requests">Open Requests</Link>
          </div>
          <div className="home-request-list">
            {recentRequests.length ? (
              recentRequests.map((request) => (
                <article key={request.id}>
                  <span className={`home-request-status is-${String(request.status || "unknown").toLowerCase()}`}>{request.status}</span>
                  <div>
                    <strong>{request.title}{request.year ? ` (${request.year})` : ""}</strong>
                    <small>{request.requestedBy} · {request.source}</small>
                  </div>
                  <em>{request.availability?.status || "Unknown"}</em>
                </article>
              ))
            ) : (
              <span className="home-request-empty">No requests to show yet.</span>
            )}
          </div>
        </div>
      </section> : null}
      </div>
      <Modal show={Boolean(detailModal)} onHide={() => setDetailModal(null)} centered contentClassName="home-detail-modal">
        <Modal.Header closeButton>
          <Modal.Title>{detailModal?.title}</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {detailModal?.body ? <p>{detailModal.body}</p> : null}
          {detailModal?.item ? <p>{detailModal.item.name} has overlap across {formatNumber(detailModal.item.users)} users and {formatNumber(detailModal.item.plays)} recent plays.</p> : null}
          {detailModal?.milestone ? (
            <p>
              {detailModal.milestone.unlocked ? "Unlocked." : "In progress."} {detailModal.milestone.detail}
            </p>
          ) : null}
          {detailModal?.items?.length ? detailModal.items.map((item) => (
            <article key={item.itemId} className="home-detail-row">
              <strong>{item.name}</strong>
              <small>No synced episodes found</small>
            </article>
          )) : null}
        </Modal.Body>
      </Modal>
    </div>
  );
}
