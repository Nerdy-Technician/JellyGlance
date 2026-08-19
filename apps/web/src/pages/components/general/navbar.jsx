import { useEffect, useMemo, useState } from "react";
import { Button, Modal, Nav, Navbar as BootstrapNavbar } from "react-bootstrap";
import { Link, useLocation } from "react-router-dom";
import axios from "../../../lib/axios_instance";
import { navData } from "../../../lib/navdata";
import LogoutBoxLineIcon from "remixicon-react/LogoutBoxLineIcon";
import AccountCircleLineIcon from "remixicon-react/AccountCircleLineIcon";
import ArrowLeftSLineIcon from "remixicon-react/ArrowLeftSLineIcon";
import ArrowRightSLineIcon from "remixicon-react/ArrowRightSLineIcon";
import MagicLineIcon from "remixicon-react/MagicLineIcon";
import MenuLineIcon from "remixicon-react/MenuLineIcon";
import logo_dark from "../../images/icon-b-512.png";
import projectText from "../../images/project-text.png";
import "../../css/navbar.css";
import VersionCard from "./version-card";
import { OPEN_WHATS_NEW_EVENT } from "../../../lib/events";
import { Trans } from "react-i18next";
import baseUrl from "../../../lib/baseurl";
import socket from "../../../socket";
import { slugifyUserName } from "../../../lib/userProfile";
import Config from "../../../lib/config";
import { FONT_WEIGHT_OPTIONS, getStoredFontWeight, saveFontWeightPreference } from "../../../lib/appearance";
import { DEFAULT_THEME, THEME_PRESETS, getStoredTheme, resetTheme, saveTheme } from "../../../lib/theme";
import { applyNavOrder, getStoredHiddenNavLinks, getStoredNavOrder, LOCKED_NAV_LINKS } from "../../../lib/nav-order";

function getTokenPayload() {
  const token = localStorage.getItem("token");
  if (!token) return null;
  try {
    return JSON.parse(window.atob(token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/")));
  } catch {
    return null;
  }
}

function getCachedConfig() {
  try {
    const config = JSON.parse(localStorage.getItem("config") || "{}");
    // Merge jellyfinUser from the JWT token so the avatar is always available
    const tokenUser = getTokenPayload()?.user;
    if (tokenUser?.jellyfinUser && !config.settings?.auth?.jellyfinUser) {
      config.settings = config.settings || {};
      config.settings.auth = config.settings.auth || {};
      config.settings.auth.jellyfinUser = tokenUser.jellyfinUser;
    }
    return config;
  } catch {
    return {};
  }
}

const REQUEST_NAV_AVAILABLE_KEY = "jellyglance_request_nav_available";
const DOWNLOAD_NAV_AVAILABLE_KEY = "jellyglance_download_nav_available";
const WIZARR_NAV_AVAILABLE_KEY = "jellyglance_wizarr_nav_available";
const TDARR_NAV_AVAILABLE_KEY = "jellyglance_tdarr_nav_available";
const AUTOMATION_HEALTH_NAV_AVAILABLE_KEY = "jellyglance_automation_health_nav_available";
const NAV_COLLAPSED_KEY = "jellyglance_nav_collapsed";
const INTEGRATIONS_CACHE_TTL_MS = 10000;

let integrationsCache = null;
let integrationsCacheAt = 0;
let integrationsRequest = null;

async function loadNavbarIntegrations() {
  const now = Date.now();
  if (integrationsCache && now - integrationsCacheAt < INTEGRATIONS_CACHE_TTL_MS) {
    return integrationsCache;
  }

  if (!integrationsRequest) {
    integrationsRequest = axios
      .get("/api/integrations", {
        headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
      })
      .then((response) => {
        integrationsCache = response.data || { arrApps: [], clients: [], thirdParty: [] };
        integrationsCacheAt = Date.now();
        return integrationsCache;
      })
      .finally(() => {
        integrationsRequest = null;
      });
  }

  return integrationsRequest;
}

function clearNavbarIntegrationsCache() {
  integrationsCache = null;
  integrationsCacheAt = 0;
}

function getCachedRequestNavAvailable() {
  return localStorage.getItem(REQUEST_NAV_AVAILABLE_KEY) === "true";
}

function getCachedDownloadNavAvailable() {
  return localStorage.getItem(DOWNLOAD_NAV_AVAILABLE_KEY) === "true";
}

function getCachedWizarrNavAvailable() {
  return localStorage.getItem(WIZARR_NAV_AVAILABLE_KEY) === "true";
}

function getCachedTdarrNavAvailable() {
  return localStorage.getItem(TDARR_NAV_AVAILABLE_KEY) === "true";
}

function getCachedAutomationHealthNavAvailable() {
  return localStorage.getItem(AUTOMATION_HEALTH_NAV_AVAILABLE_KEY) === "true";
}

function getCachedNavCollapsed() {
  return localStorage.getItem(NAV_COLLAPSED_KEY) === "true";
}

function isConfiguredSeerrApp(app) {
  const name = String(app?.name || app?.slug || "").toLowerCase();
  const values = app?.values || {};
  return (
    (name === "seerr" || name.includes("jellyseerr") || name.includes("overseerr")) &&
    Boolean(app?.connected) &&
    Boolean(String(values.url || "").trim()) &&
    Boolean(String(values.secret || "").trim())
  );
}

function getRequestAvailabilityFromIntegrations(integrations) {
  return Array.isArray(integrations?.arrApps) && integrations.arrApps.some(isConfiguredSeerrApp);
}

function isConfiguredDownloadClient(client) {
  const values = client?.values || {};
  return (
    Boolean(client?.connected) &&
    (client?.protocol === "Torrent" || client?.protocol === "Usenet") &&
    Boolean(String(values.url || "").trim()) &&
    Boolean(String(values.secret || "").trim())
  );
}

function getDownloadAvailabilityFromIntegrations(integrations) {
  return Array.isArray(integrations?.clients) && integrations.clients.some(isConfiguredDownloadClient);
}

function isConfiguredWizarrApp(app) {
  const name = String(app?.name || app?.slug || "").toLowerCase();
  const values = app?.values || {};
  return name.includes("wizarr") && Boolean(app?.connected) && Boolean(String(values.url || "").trim()) && Boolean(String(values.secret || "").trim());
}

function getWizarrAvailabilityFromIntegrations(integrations) {
  return Array.isArray(integrations?.thirdParty) && integrations.thirdParty.some(isConfiguredWizarrApp);
}

function isConfiguredTdarrApp(app) {
  const name = String(app?.name || app?.slug || "").toLowerCase();
  const values = app?.values || {};
  return name.includes("tdarr") && Boolean(app?.connected) && Boolean(String(values.url || "").trim());
}

function getTdarrAvailabilityFromIntegrations(integrations) {
  return Array.isArray(integrations?.thirdParty) && integrations.thirdParty.some(isConfiguredTdarrApp);
}

function isConfiguredAutomationHealthApp(app) {
  const name = String(app?.name || app?.slug || "").toLowerCase();
  const values = app?.values || {};
  return (name.includes("bazarr") || name.includes("prowlarr")) && Boolean(app?.connected) && Boolean(String(values.url || "").trim()) && Boolean(String(values.secret || "").trim());
}

function getAutomationHealthAvailabilityFromIntegrations(integrations) {
  return Array.isArray(integrations?.arrApps) && integrations.arrApps.some(isConfiguredAutomationHealthApp);
}

function isNavItemActive(item, location) {
  const pathname = location.pathname.toLocaleLowerCase();
  const navPath = String(item.link || "").split("?")[0].toLocaleLowerCase();

  if (item.link === "settings") {
    return pathname === "/settings" || pathname.startsWith("/settings/");
  }

  return (
    pathname.includes(("/" + navPath).toLocaleLowerCase()) &&
    ((pathname.length > 0 && navPath.length > 0) || (pathname.length === 1 && navPath.length === 0))
  );
}

export default function Navbar() {
  const [showAccount, setShowAccount] = useState(false);
  const [config, setConfig] = useState(() => getCachedConfig());
  const [customAvatar, setCustomAvatar] = useState(() => localStorage.getItem("jellyglance_account_avatar") || "");
  const [customTheme, setCustomTheme] = useState(() => getStoredTheme());
  const [fontWeightPreference, setFontWeightPreference] = useState(() => getStoredFontWeight());
  const [activeStreamCount, setActiveStreamCount] = useState(0);
  const [activeDownloadCount, setActiveDownloadCount] = useState(() => Number(localStorage.getItem("jellyglance_active_download_count") || 0));
  const [activeTranscodeCount, setActiveTranscodeCount] = useState(() => Number(localStorage.getItem("jellyglance_active_transcode_count") || 0));
  const [requestBadgeCount, setRequestBadgeCount] = useState(() => Number(localStorage.getItem("jellyglance_request_badge_count") || 0));
  const [showRequestsNav, setShowRequestsNav] = useState(() => getCachedRequestNavAvailable());
  const [showDownloadsNav, setShowDownloadsNav] = useState(() => getCachedDownloadNavAvailable());
  const [showWizarrNav, setShowWizarrNav] = useState(() => getCachedWizarrNavAvailable());
  const [showTdarrNav, setShowTdarrNav] = useState(() => getCachedTdarrNavAvailable());
  const [showAutomationHealthNav, setShowAutomationHealthNav] = useState(() => getCachedAutomationHealthNavAvailable());
  const [navOrder, setNavOrder] = useState(() => getStoredNavOrder(navData));
  const [hiddenNavLinks, setHiddenNavLinks] = useState(() => getStoredHiddenNavLinks(navData));
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);
  const [isThemeMenuOpen, setIsThemeMenuOpen] = useState(false);
  const [isNavCollapsed, setIsNavCollapsed] = useState(() => getCachedNavCollapsed());
  const authMode = config?.settings?.auth?.mode || (config?.requireLogin === false ? "quick-connect" : "local");
  const authLabel =
    config?.settings?.auth?.label ||
    (authMode === "quick-connect" ? "Jellyfin Quick Connect" : authMode === "oidc" ? "OIDC / Authentik" : "Local login");
  const jellyfinUser = config?.settings?.auth?.jellyfinUser;
  const canUploadAvatar = authMode === "local" || authMode === "oidc";
  const accountName = jellyfinUser?.name || config?.username || authLabel;
  const currentRole = config?.settings?.auth?.role || "Viewer";
  const isJellyfinAdmin = currentRole === "Owner" || currentRole === "Admin";
  const accountRole = authMode === "quick-connect" ? (isJellyfinAdmin ? "Jellyfin Admin" : "Jellyfin User") : authMode === "oidc" ? "OIDC User" : "Local User";
  const showServerManagementNav = isJellyfinAdmin;
  const jellyfinUserId = jellyfinUser?.id || jellyfinUser?.Id || jellyfinUser?.userId || jellyfinUser?.UserId;
  const jellyfinImageTag = jellyfinUser?.primaryImageTag || jellyfinUser?.PrimaryImageTag || jellyfinUser?.imageTags?.Primary || jellyfinUser?.ImageTags?.Primary;
  const jellyfinAvatar = jellyfinUserId
    ? `${baseUrl}/proxy/Users/Images/Primary/?id=${encodeURIComponent(jellyfinUserId)}${jellyfinImageTag ? `&tag=${encodeURIComponent(jellyfinImageTag)}` : ""}&fillWidth=160&quality=80`
    : "";
  const avatarSrc = jellyfinAvatar || (canUploadAvatar ? customAvatar : "");
  const activeThemePreset = THEME_PRESETS.find(
    (preset) =>
      customTheme.primary === preset.primary &&
      customTheme.secondary === preset.secondary &&
      customTheme.background === preset.background &&
      customTheme.surface === preset.surface
  );
  const visibleNavData = useMemo(
    () =>
      applyNavOrder(
        navData.filter((item) => {
          if (!LOCKED_NAV_LINKS.has(item.link) && hiddenNavLinks.includes(item.link)) return false;
          if (item.link === "requests") return showRequestsNav;
          if (item.link === "downloads") return showDownloadsNav;
          if (item.link === "active-transcodes") return showTdarrNav;
          if (item.link === "automation-health") return showAutomationHealthNav;
          if (item.link === "wizarr") return showWizarrNav;
          if (item.link === "server-management") return showServerManagementNav;
          return true;
        }),
        navOrder
      ),
    [hiddenNavLinks, navOrder, showAutomationHealthNav, showDownloadsNav, showRequestsNav, showServerManagementNav, showTdarrNav, showWizarrNav]
  );

  const handleLogout = () => {
    localStorage.setItem("jellyglance_logged_out", "true");
    localStorage.removeItem("token");
    localStorage.removeItem("config");
    deleteLibraryTabKeys();
    window.location.reload();
  };

  const deleteLibraryTabKeys = () => {
    Object.keys(localStorage)
      .filter((key) => key.startsWith("PREF_"))
      .forEach((key) => localStorage.removeItem(key));
  };

  const location = useLocation();

  useEffect(() => {
    localStorage.setItem(NAV_COLLAPSED_KEY, String(isNavCollapsed));
    document.documentElement.style.setProperty("--jg-sidebar-width", isNavCollapsed ? "78px" : "250px");
  }, [isNavCollapsed]);

  useEffect(() => {
    function handleNavCollapsedUpdate(event) {
      setIsNavCollapsed(Boolean(event.detail));
    }

    window.addEventListener("jellyglance-nav-collapsed-updated", handleNavCollapsedUpdate);
    return () => window.removeEventListener("jellyglance-nav-collapsed-updated", handleNavCollapsedUpdate);
  }, []);

  useEffect(() => {
    let isMounted = true;

    const setAutomationHealthAvailability = (integrations) => {
      const nextAvailable = getAutomationHealthAvailabilityFromIntegrations(integrations);
      localStorage.setItem(AUTOMATION_HEALTH_NAV_AVAILABLE_KEY, String(nextAvailable));
      if (isMounted) {
        setShowAutomationHealthNav(nextAvailable);
      }
    };

    const refreshAutomationHealthAvailability = async () => {
      if (!localStorage.getItem("token")) {
        setAutomationHealthAvailability({ arrApps: [] });
        return;
      }

      try {
        setAutomationHealthAvailability(await loadNavbarIntegrations());
      } catch {
        if (isMounted) {
          setShowAutomationHealthNav(getCachedAutomationHealthNavAvailable());
        }
      }
    };

    const handleIntegrationsUpdated = (event) => {
      if (event.detail) {
        setAutomationHealthAvailability(event.detail);
        return;
      }
      clearNavbarIntegrationsCache();
      refreshAutomationHealthAvailability();
    };

    const startupTimer = window.setTimeout(refreshAutomationHealthAvailability, 500);
    window.addEventListener("jellyglance-integrations-updated", handleIntegrationsUpdated);
    return () => {
      isMounted = false;
      window.removeEventListener("jellyglance-integrations-updated", handleIntegrationsUpdated);
      window.clearTimeout(startupTimer);
    };
  }, []);

  useEffect(() => {
    let isMounted = true;

    const refreshConfig = async () => {
      if (!localStorage.getItem("token")) {
        setConfig(getCachedConfig());
        return;
      }

      const freshConfig = await Config.getConfig();
      if (isMounted && !freshConfig?.response) {
        setConfig(freshConfig);
      }
    };

    refreshConfig();
    window.addEventListener("jellyglance-config-updated", refreshConfig);
    window.addEventListener("storage", refreshConfig);

    return () => {
      isMounted = false;
      window.removeEventListener("jellyglance-config-updated", refreshConfig);
      window.removeEventListener("storage", refreshConfig);
    };
  }, []);

  useEffect(() => {
    const refreshNavOrder = () => setNavOrder(getStoredNavOrder(navData));
    const refreshNavVisibility = () => setHiddenNavLinks(getStoredHiddenNavLinks(navData));

    window.addEventListener("jellyglance-nav-order-updated", refreshNavOrder);
    window.addEventListener("jellyglance-nav-visibility-updated", refreshNavVisibility);
    window.addEventListener("storage", refreshNavOrder);
    window.addEventListener("storage", refreshNavVisibility);
    return () => {
      window.removeEventListener("jellyglance-nav-order-updated", refreshNavOrder);
      window.removeEventListener("jellyglance-nav-visibility-updated", refreshNavVisibility);
      window.removeEventListener("storage", refreshNavOrder);
      window.removeEventListener("storage", refreshNavVisibility);
    };
  }, []);

  useEffect(() => {
    const handleSessions = (sessionData) => {
      if (Array.isArray(sessionData)) {
        setActiveStreamCount(sessionData.filter((session) => session.NowPlayingItem !== undefined).length);
      }
    };

    socket.on("sessions", handleSessions);
    return () => socket.off("sessions", handleSessions);
  }, []);

  useEffect(() => {
    const handleDownloadCount = (event) => {
      const nextCount = Number(event.detail ?? localStorage.getItem("jellyglance_active_download_count") ?? 0);
      setActiveDownloadCount(Number.isFinite(nextCount) ? nextCount : 0);
    };

    const setDownloadAvailability = (integrations) => {
      const nextAvailable = getDownloadAvailabilityFromIntegrations(integrations);
      localStorage.setItem(DOWNLOAD_NAV_AVAILABLE_KEY, String(nextAvailable));
      setShowDownloadsNav(nextAvailable);
      if (!nextAvailable) {
        setActiveDownloadCount(0);
      }
    };

    const refreshDownloadAvailability = async () => {
      if (!localStorage.getItem("token")) {
        setDownloadAvailability({ clients: [] });
        return;
      }

      try {
        setDownloadAvailability(await loadNavbarIntegrations());
      } catch {
        setShowDownloadsNav(getCachedDownloadNavAvailable());
      }
    };

    const handleIntegrationsUpdated = (event) => {
      if (event.detail) {
        setDownloadAvailability(event.detail);
        return;
      }
      clearNavbarIntegrationsCache();
      refreshDownloadAvailability();
    };

    const startupTimer = window.setTimeout(refreshDownloadAvailability, 500);
    window.addEventListener("jellyglance-download-count", handleDownloadCount);
    window.addEventListener("jellyglance-integrations-updated", handleIntegrationsUpdated);
    window.addEventListener("storage", handleDownloadCount);
    return () => {
      window.removeEventListener("jellyglance-download-count", handleDownloadCount);
      window.removeEventListener("jellyglance-integrations-updated", handleIntegrationsUpdated);
      window.removeEventListener("storage", handleDownloadCount);
      window.clearTimeout(startupTimer);
    };
  }, []);

  useEffect(() => {
    let isMounted = true;

    const setWizarrAvailability = (integrations) => {
      const nextAvailable = getWizarrAvailabilityFromIntegrations(integrations);
      localStorage.setItem(WIZARR_NAV_AVAILABLE_KEY, String(nextAvailable));
      if (isMounted) {
        setShowWizarrNav(nextAvailable);
      }
    };

    const refreshWizarrAvailability = async () => {
      if (!localStorage.getItem("token")) {
        setWizarrAvailability({ thirdParty: [] });
        return;
      }

      try {
        setWizarrAvailability(await loadNavbarIntegrations());
      } catch {
        if (isMounted) {
          setShowWizarrNav(getCachedWizarrNavAvailable());
        }
      }
    };

    const handleIntegrationsUpdated = (event) => {
      if (event.detail) {
        setWizarrAvailability(event.detail);
        return;
      }
      clearNavbarIntegrationsCache();
      refreshWizarrAvailability();
    };

    const startupTimer = window.setTimeout(refreshWizarrAvailability, 500);
    window.addEventListener("jellyglance-integrations-updated", handleIntegrationsUpdated);
    return () => {
      isMounted = false;
      window.removeEventListener("jellyglance-integrations-updated", handleIntegrationsUpdated);
      window.clearTimeout(startupTimer);
    };
  }, []);

  useEffect(() => {
    let isMounted = true;

    const setTranscodeAvailability = (integrations) => {
      const nextAvailable = getTdarrAvailabilityFromIntegrations(integrations);
      localStorage.setItem(TDARR_NAV_AVAILABLE_KEY, String(nextAvailable));
      if (isMounted) {
        setShowTdarrNav(nextAvailable);
        if (!nextAvailable) {
          setActiveTranscodeCount(0);
        }
      }
      return nextAvailable;
    };

    const setSafeTranscodeCount = (value) => {
      const nextCount = Number(value || 0);
      if (isMounted) {
        setActiveTranscodeCount(Number.isFinite(nextCount) ? nextCount : 0);
      }
    };

    const refreshTranscodeAvailability = async () => {
      if (!localStorage.getItem("token")) {
        setTranscodeAvailability({ thirdParty: [] });
        return false;
      }

      try {
        return setTranscodeAvailability(await loadNavbarIntegrations());
      } catch {
        if (isMounted) {
          setShowTdarrNav(getCachedTdarrNavAvailable());
        }
        return getCachedTdarrNavAvailable();
      }
    };

    const refreshTranscodeCount = async () => {
      if (!localStorage.getItem("token")) {
        setTranscodeAvailability({ thirdParty: [] });
        return;
      }
      try {
        const response = await axios.get("/api/tdarr/transcodes", {
          headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
        });
        const nextCount = Number(response.data?.stats?.active || response.data?.active?.length || 0);
        localStorage.setItem("jellyglance_active_transcode_count", String(nextCount));
        setSafeTranscodeCount(nextCount);
      } catch {
        setSafeTranscodeCount(localStorage.getItem("jellyglance_active_transcode_count"));
      }
    };

    const handleTranscodeCount = (event) => setSafeTranscodeCount(event.detail ?? localStorage.getItem("jellyglance_active_transcode_count"));
    const handleIntegrationsUpdated = (event) => {
      const hasTdarr = event.detail ? setTranscodeAvailability(event.detail) : getCachedTdarrNavAvailable();
      if (!event.detail) {
        clearNavbarIntegrationsCache();
        refreshTranscodeAvailability();
      }
      if (hasTdarr) {
        refreshTranscodeCount();
      }
    };

    const startupTimer = window.setTimeout(() => {
      refreshTranscodeAvailability().then((hasTdarr) => {
        if (hasTdarr) refreshTranscodeCount();
      });
    }, 650);
    const intervalId = setInterval(refreshTranscodeCount, 60000);
    window.addEventListener("jellyglance-transcode-count", handleTranscodeCount);
    window.addEventListener("jellyglance-integrations-updated", handleIntegrationsUpdated);
    window.addEventListener("storage", handleTranscodeCount);

    return () => {
      isMounted = false;
      clearInterval(intervalId);
      window.clearTimeout(startupTimer);
      window.removeEventListener("jellyglance-transcode-count", handleTranscodeCount);
      window.removeEventListener("jellyglance-integrations-updated", handleIntegrationsUpdated);
      window.removeEventListener("storage", handleTranscodeCount);
    };
  }, []);

  useEffect(() => {
    let isMounted = true;

    const setSafeCount = (value) => {
      const nextCount = Number(value || 0);
      if (isMounted) {
        setRequestBadgeCount(Number.isFinite(nextCount) ? nextCount : 0);
      }
    };

    const setRequestAvailability = (sources) => {
      const nextAvailable = Array.isArray(sources) && sources.length > 0;
      localStorage.setItem(REQUEST_NAV_AVAILABLE_KEY, String(nextAvailable));
      if (isMounted) {
        setShowRequestsNav(nextAvailable);
      }
    };

    const refreshRequestAvailability = async () => {
      if (!localStorage.getItem("token")) {
        setRequestAvailability([]);
        return false;
      }

      try {
        const nextAvailable = getRequestAvailabilityFromIntegrations(await loadNavbarIntegrations());
        localStorage.setItem(REQUEST_NAV_AVAILABLE_KEY, String(nextAvailable));
        if (isMounted) {
          setShowRequestsNav(nextAvailable);
          if (!nextAvailable) {
            setRequestBadgeCount(0);
          }
        }
        return nextAvailable;
      } catch {
        if (isMounted) {
          setShowRequestsNav(getCachedRequestNavAvailable());
        }
        return getCachedRequestNavAvailable();
      }
    };

    const refreshRequestCount = async () => {
      if (!localStorage.getItem("token")) {
        setRequestAvailability([]);
        return;
      }
      try {
        const response = await axios.get("/api/requests/summary", {
          headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
        });
        const nextCount = Number(response.data?.stats?.badgeCount || 0);
        localStorage.setItem("jellyglance_request_badge_count", String(nextCount));
        setRequestAvailability(response.data?.sources);
        setSafeCount(nextCount);
      } catch {
        refreshRequestAvailability();
        setSafeCount(localStorage.getItem("jellyglance_request_badge_count"));
      }
    };

    const handleRequestCount = (event) => setSafeCount(event.detail ?? localStorage.getItem("jellyglance_request_badge_count"));
    const handleIntegrationsUpdated = (event) => {
      if (event.detail) {
        const nextAvailable = getRequestAvailabilityFromIntegrations(event.detail);
        localStorage.setItem(REQUEST_NAV_AVAILABLE_KEY, String(nextAvailable));
        if (isMounted) {
          setShowRequestsNav(nextAvailable);
          if (!nextAvailable) {
            setRequestBadgeCount(0);
          }
        }
        if (!nextAvailable) {
          return;
        }
      } else {
        clearNavbarIntegrationsCache();
      }
      refreshRequestCount();
    };

    const startupTimer = window.setTimeout(() => {
      refreshRequestAvailability();
      refreshRequestCount();
    }, 650);
    const intervalId = setInterval(refreshRequestCount, 60000);
    window.addEventListener("jellyglance-request-count", handleRequestCount);
    window.addEventListener("jellyglance-integrations-updated", handleIntegrationsUpdated);
    window.addEventListener("storage", handleRequestCount);

    return () => {
      isMounted = false;
      clearInterval(intervalId);
      window.clearTimeout(startupTimer);
      window.removeEventListener("jellyglance-request-count", handleRequestCount);
      window.removeEventListener("jellyglance-integrations-updated", handleIntegrationsUpdated);
      window.removeEventListener("storage", handleRequestCount);
    };
  }, []);

  const profilePath = `/users/${slugifyUserName(accountName) || "account"}`;

  const handleThemeChange = (key, value) => {
    setCustomTheme((currentTheme) => saveTheme({ ...currentTheme, [key]: value }));
  };

  const handleThemePreset = (preset) => {
    setCustomTheme(saveTheme(preset));
    setIsThemeMenuOpen(false);
  };

  const handleThemeReset = () => {
    setCustomTheme(resetTheme());
    setIsThemeMenuOpen(false);
  };

  const handleFontWeightPreference = (preference) => {
    setFontWeightPreference(saveFontWeightPreference(preference));
  };

  const handleAvatarUpload = (event) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const nextAvatar = reader.result;
      localStorage.setItem("jellyglance_account_avatar", nextAvatar);
      setCustomAvatar(nextAvatar);
    };
    reader.readAsDataURL(file);
  };

  const openWhatsNew = () => {
    window.dispatchEvent(new Event(OPEN_WHATS_NEW_EVENT));
    setShowAccount(false);
  };

  const getNavBadgeCount = (link) => {
    if (link === "") return activeStreamCount;
    if (link === "downloads") return activeDownloadCount;
    if (link === "active-transcodes") return activeTranscodeCount;
    if (link === "requests") return requestBadgeCount;
    return 0;
  };

  return (
    <>
      <div className="mobile-app-topbar">
        <button
          className="mobile-app-menu"
          type="button"
          onClick={() => setIsMobileNavOpen((isOpen) => !isOpen)}
          aria-label={isMobileNavOpen ? "Close navigation menu" : "Open navigation menu"}
          aria-controls="mobile-app-navigation"
          aria-expanded={isMobileNavOpen}
        >
          <MenuLineIcon size={24} />
        </button>
        <Link className="mobile-app-brand" to="/">
          <img src={logo_dark} alt="" />
          <img src={projectText} alt="JellyGlance" />
        </Link>
        <button className="mobile-app-account" type="button" onClick={() => setShowAccount(true)} aria-label="Open account settings">
          {avatarSrc ? <img src={avatarSrc} alt="" onError={(event) => (event.currentTarget.style.display = "none")} /> : <AccountCircleLineIcon />}
        </button>
      </div>

      <div id="mobile-app-navigation" className={`mobile-app-menu-panel${isMobileNavOpen ? " is-open" : ""}`} aria-hidden={!isMobileNavOpen}>
        <nav className="mobile-app-menu-shell" aria-label="Mobile navigation">
          <div className="mobile-app-menu-grid">
            {visibleNavData.map((item) => {
              const isActive = isNavItemActive(item, location);
              const badgeCount = getNavBadgeCount(item.link);

              return (
                <Link
                  key={item.id}
                  className={`mobile-app-menu-tile${isActive ? " active" : ""}`}
                  to={item.link}
                  onClick={() => setIsMobileNavOpen(false)}
                >
                  <span className="mobile-app-menu-icon">{item.icon}</span>
                  <span className="mobile-app-menu-label">{item.text}</span>
                  {badgeCount > 0 ? <span className="mobile-app-menu-badge">{badgeCount}</span> : null}
                </Link>
              );
            })}
          </div>

          <div className="mobile-app-menu-footer">
            <button
              className="mobile-app-menu-account"
              type="button"
              onClick={() => {
                setIsMobileNavOpen(false);
                setShowAccount(true);
              }}
            >
              <span className="account-nav-avatar">
                {avatarSrc ? (
                  <img src={avatarSrc} alt="" onError={(event) => (event.currentTarget.style.display = "none")} />
                ) : (
                  <AccountCircleLineIcon />
                )}
              </span>
              <span className="account-nav-copy">
                <strong>{accountName}</strong>
                <small>{accountRole}</small>
              </span>
            </button>
            <button className="mobile-app-menu-logout" type="button" onClick={handleLogout}>
              <LogoutBoxLineIcon size={22} />
              <span>
                <Trans i18nKey="MENU_TABS.LOGOUT" />
              </span>
            </button>
            <div className="mobile-app-menu-version">
              <VersionCard />
            </div>
          </div>
        </nav>
      </div>

      <BootstrapNavbar variant="dark" className={`desktop-navigation d-flex flex-column py-0 text-center sticky-top ${isNavCollapsed ? "is-collapsed" : ""}`} id="primary-navigation">
      <div className="sticky-top py-md-3">
        <div className="navbar-brand-row">
          <BootstrapNavbar.Brand as={Link} to={"/"} className="d-none d-md-inline">
          <img src={logo_dark} className="navbar-brand-icon px-2" alt="" />
          <img src={projectText} className="navbar-wordmark" alt="JellyGlance" />
        </BootstrapNavbar.Brand>
        </div>

        <Nav className="flex-row flex-md-column w-100">
          {visibleNavData.map((item) => {
            const isActive = isNavItemActive(item, location);
            const badgeCount =
              item.link === ""
                ? activeStreamCount
                : item.link === "downloads"
                ? activeDownloadCount
                : item.link === "active-transcodes"
                ? activeTranscodeCount
                : item.link === "requests"
                ? requestBadgeCount
                : 0;
            const navLabel = item.label || (typeof item.text === "string" ? item.text : "");
            return (
              <Nav.Link
                as={Link}
                key={item.id}
                className={`navitem${isActive ? " active" : ""} p-2`} // add the "active" class if the link is active
                to={item.link}
                onClick={() => setIsMobileNavOpen(false)}
                title={navLabel}
                aria-label={navLabel}
              >
                {item.icon}
                {badgeCount > 0 ? <span className="nav-icon-badge">{badgeCount}</span> : null}
                <span className="nav-text">
                  <span>{item.text}</span>
                  {item.link === "" && activeStreamCount > 0 ? (
                    <span className="nav-live-count" aria-label={`${activeStreamCount} active streams`}>
                      {activeStreamCount}
                    </span>
                  ) : null}
                  {item.link === "downloads" && activeDownloadCount > 0 ? (
                    <span className="nav-live-count" aria-label={`${activeDownloadCount} active downloads`}>
                      {activeDownloadCount}
                    </span>
                  ) : null}
                  {item.link === "active-transcodes" && activeTranscodeCount > 0 ? (
                    <span className="nav-live-count" aria-label={`${activeTranscodeCount} active transcodes`}>
                      {activeTranscodeCount}
                    </span>
                  ) : null}
                  {item.link === "requests" && requestBadgeCount > 0 ? (
                    <span className="nav-live-count" aria-label={`${requestBadgeCount} pending or failed requests`}>
                      {requestBadgeCount}
                    </span>
                  ) : null}
                </span>
              </Nav.Link>
            );
          })}
          <div className="navbar-inline-footer">
            <div className="navbar-footer-account-row">
              <button className="navitem account-navitem p-2" type="button" onClick={() => setShowAccount(true)}>
                <span className="account-nav-avatar">
                  {avatarSrc ? (
                    <img src={avatarSrc} alt="" onError={(event) => (event.currentTarget.style.display = "none")} />
                  ) : (
                    <AccountCircleLineIcon />
                  )}
                </span>
                <span className="account-nav-copy">
                  <strong>{accountName}</strong>
                  <small>{accountRole}</small>
                </span>
              </button>
              <button
                type="button"
                className="navbar-collapse-toggle"
                onClick={() => setIsNavCollapsed((current) => !current)}
                aria-label={isNavCollapsed ? "Expand side menu" : "Collapse side menu"}
                title={isNavCollapsed ? "Expand side menu" : "Collapse side menu"}
              >
                {isNavCollapsed ? <ArrowRightSLineIcon size={20} /> : <ArrowLeftSLineIcon size={20} />}
              </button>
            </div>
            <div className="navbar-version-row">
              <VersionCard />
            </div>
          </div>
        </Nav>
      </div>

      </BootstrapNavbar>

      <Modal show={showAccount} onHide={() => setShowAccount(false)} centered dialogClassName="profile-modal">
        <Modal.Header closeButton>
          <Modal.Title>Account</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <div className="profile-modal-identity">
            <div className="profile-modal-avatar">
              {avatarSrc ? <img src={avatarSrc} alt="" onError={(event) => (event.currentTarget.style.display = "none")} /> : <AccountCircleLineIcon />}
            </div>
            <div>
              <strong>{accountName}</strong>
              <span>{accountRole}</span>
            </div>
          </div>

          {canUploadAvatar ? (
            <label className="profile-avatar-upload">
              <span>Custom avatar</span>
              <input type="file" accept="image/*" onChange={handleAvatarUpload} />
            </label>
          ) : null}

          <button className="profile-whats-new-button" type="button" onClick={openWhatsNew}>
            <MagicLineIcon size={18} />
            <span>
              <strong>What&apos;s new</strong>
              <small>Open the latest JellyGlance update notes.</small>
            </span>
          </button>

          <section className="profile-font-panel" aria-labelledby="profile-font-heading">
            <div className="profile-font-header">
              <h3 id="profile-font-heading">Font weight</h3>
              <span>Choose how bold the interface feels for this browser.</span>
            </div>

            <div className="profile-font-options">
              {FONT_WEIGHT_OPTIONS.map((option) => (
                <button
                  key={option.id}
                  type="button"
                  className={fontWeightPreference === option.id ? "is-active" : ""}
                  onClick={() => handleFontWeightPreference(option.id)}
                  aria-pressed={fontWeightPreference === option.id}
                >
                  <strong>{option.label}</strong>
                  <span>{option.description}</span>
                </button>
              ))}
            </div>
          </section>

          <section className="profile-theme-panel" aria-labelledby="profile-theme-heading">
            <div className="profile-theme-header">
              <div>
                <h3 id="profile-theme-heading">Custom colours</h3>
                <span>Theme JellyGlance from this account.</span>
              </div>
              <button className="profile-theme-reset" type="button" onClick={handleThemeReset}>
                Reset
              </button>
            </div>

            <div className="profile-theme-select">
              <span>Theme preset</span>
              <button
                className="profile-theme-select-button"
                type="button"
                onClick={() => setIsThemeMenuOpen((open) => !open)}
                aria-expanded={isThemeMenuOpen}
              >
                <span className="profile-theme-preset-swatches" aria-hidden="true">
                  <i style={{ backgroundColor: activeThemePreset?.primary || customTheme.primary }} />
                  <i style={{ backgroundColor: activeThemePreset?.secondary || customTheme.secondary }} />
                  <i style={{ backgroundColor: activeThemePreset?.background || customTheme.background }} />
                </span>
                <strong>{activeThemePreset?.name || "Custom"}</strong>
                <span className="profile-theme-select-arrow" aria-hidden="true">
                  ▾
                </span>
              </button>
              {isThemeMenuOpen ? (
                <div className="profile-theme-select-menu" role="listbox">
                  {THEME_PRESETS.map((preset) => (
                    <button
                      key={preset.name}
                      type="button"
                      className={activeThemePreset?.name === preset.name ? "is-active" : ""}
                      onClick={() => handleThemePreset(preset)}
                      role="option"
                      aria-selected={activeThemePreset?.name === preset.name}
                    >
                      <span className="profile-theme-preset-swatches" aria-hidden="true">
                        <i style={{ backgroundColor: preset.primary }} />
                        <i style={{ backgroundColor: preset.secondary }} />
                        <i style={{ backgroundColor: preset.background }} />
                      </span>
                      <span>{preset.name}</span>
                    </button>
                  ))}
                </div>
              ) : null}
            </div>

            <div className="profile-theme-fields">
              {[
                ["primary", "Primary"],
                ["secondary", "Secondary"],
                ["background", "Background"],
                ["surface", "Surface"],
              ].map(([key, label]) => (
                <label className="profile-theme-field" key={key}>
                  <span>{label}</span>
                  <div className="profile-theme-input">
                    <input
                      type="color"
                      value={customTheme[key] || DEFAULT_THEME[key]}
                      onChange={(event) => handleThemeChange(key, event.target.value)}
                      aria-label={`${label} colour`}
                    />
                    <input
                      type="text"
                      value={customTheme[key] || DEFAULT_THEME[key]}
                      aria-label={`${label} hex colour`}
                      maxLength={7}
                      readOnly
                      spellCheck="false"
                    />
                  </div>
                </label>
              ))}
            </div>
          </section>
        </Modal.Body>
        <Modal.Footer>
          <div className="profile-modal-secondary-actions">
            <Button as={Link} to={profilePath} variant="outline-secondary" onClick={() => setShowAccount(false)}>
              View profile
            </Button>
            <Button variant="outline-secondary" onClick={() => setShowAccount(false)}>
              Close
            </Button>
          </div>
          <Button className="profile-logout-button" onClick={handleLogout}>
            Log out
          </Button>
        </Modal.Footer>
      </Modal>
    </>
  );
}
