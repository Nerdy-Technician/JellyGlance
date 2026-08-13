import { useEffect, useMemo, useState } from "react";
import { Button, Modal, Nav, Navbar as BootstrapNavbar } from "react-bootstrap";
import { Link, useLocation } from "react-router-dom";
import axios from "../../../lib/axios_instance";
import { navData } from "../../../lib/navdata";
import LogoutBoxLineIcon from "remixicon-react/LogoutBoxLineIcon";
import AccountCircleLineIcon from "remixicon-react/AccountCircleLineIcon";
import MagicLineIcon from "remixicon-react/MagicLineIcon";
import MenuLineIcon from "remixicon-react/MenuLineIcon";
import logo_dark from "../../images/icon-b-512.png";
import projectText from "../../images/project-text.png";
import "../../css/navbar.css";
import VersionCard from "./version-card";
import { OPEN_WHATS_NEW_EVENT } from "./WhatsNewModal";
import { Trans } from "react-i18next";
import baseUrl from "../../../lib/baseurl";
import socket from "../../../socket";
import { slugifyUserName } from "../../../lib/userProfile";
import Config from "../../../lib/config";
import { FONT_WEIGHT_OPTIONS, getStoredFontWeight, saveFontWeightPreference } from "../../../lib/appearance";
import { DEFAULT_THEME, THEME_PRESETS, getStoredTheme, resetTheme, saveTheme } from "../../../lib/theme";

function getCachedConfig() {
  try {
    return JSON.parse(localStorage.getItem("config") || "{}");
  } catch {
    return {};
  }
}

const REQUEST_NAV_AVAILABLE_KEY = "jellyglance_request_nav_available";
const DOWNLOAD_NAV_AVAILABLE_KEY = "jellyglance_download_nav_available";
const WIZARR_NAV_AVAILABLE_KEY = "jellyglance_wizarr_nav_available";

function getCachedRequestNavAvailable() {
  return localStorage.getItem(REQUEST_NAV_AVAILABLE_KEY) === "true";
}

function getCachedDownloadNavAvailable() {
  return localStorage.getItem(DOWNLOAD_NAV_AVAILABLE_KEY) === "true";
}

function getCachedWizarrNavAvailable() {
  return localStorage.getItem(WIZARR_NAV_AVAILABLE_KEY) === "true";
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

function isNavItemActive(item, location) {
  const pathname = location.pathname.toLocaleLowerCase();
  const navPath = String(item.link || "").split("?")[0].toLocaleLowerCase();

  if (item.link === "settings") {
    return pathname === "/settings";
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
  const [requestBadgeCount, setRequestBadgeCount] = useState(() => Number(localStorage.getItem("jellyglance_request_badge_count") || 0));
  const [showRequestsNav, setShowRequestsNav] = useState(() => getCachedRequestNavAvailable());
  const [showDownloadsNav, setShowDownloadsNav] = useState(() => getCachedDownloadNavAvailable());
  const [showWizarrNav, setShowWizarrNav] = useState(() => getCachedWizarrNavAvailable());
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);
  const [isThemeMenuOpen, setIsThemeMenuOpen] = useState(false);
  const authMode = config?.settings?.auth?.mode || (config?.requireLogin === false ? "quick-connect" : "local");
  const authLabel =
    config?.settings?.auth?.label ||
    (authMode === "quick-connect" ? "Jellyfin Quick Connect" : authMode === "oidc" ? "OIDC / Authentik" : "Local login");
  const jellyfinUser = config?.settings?.auth?.jellyfinUser;
  const canUploadAvatar = authMode === "local" || authMode === "oidc";
  const accountName = jellyfinUser?.name || config?.username || authLabel;
  const accountRole = authMode === "quick-connect" ? "Jellyfin User" : authMode === "oidc" ? "OIDC User" : "Local User";
  const currentRole = config?.settings?.auth?.role || "Viewer";
  const showServerManagementNav = currentRole === "Owner" || currentRole === "Admin";
  const jellyfinAvatar = jellyfinUser?.id ? `${baseUrl}/proxy/Users/Images/Primary?id=${jellyfinUser.id}&fillWidth=160&quality=80` : "";
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
      navData.filter((item) => {
        if (item.link === "requests") return showRequestsNav;
        if (item.link === "downloads") return showDownloadsNav;
        if (item.link === "wizarr") return showWizarrNav;
        if (item.link === "server-management") return showServerManagementNav;
        return true;
      }),
    [showDownloadsNav, showRequestsNav, showServerManagementNav, showWizarrNav]
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
    let isMounted = true;

    const refreshConfig = async () => {
      if (!localStorage.getItem("token")) {
        setConfig(getCachedConfig());
        return;
      }

      const freshConfig = await Config.getConfig(true);
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
        const response = await axios.get("/api/integrations", {
          headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
        });
        setDownloadAvailability(response.data || { clients: [] });
      } catch {
        setShowDownloadsNav(getCachedDownloadNavAvailable());
      }
    };

    const handleIntegrationsUpdated = (event) => {
      if (event.detail) {
        setDownloadAvailability(event.detail);
        return;
      }
      refreshDownloadAvailability();
    };

    refreshDownloadAvailability();
    window.addEventListener("jellyglance-download-count", handleDownloadCount);
    window.addEventListener("jellyglance-integrations-updated", handleIntegrationsUpdated);
    window.addEventListener("storage", handleDownloadCount);
    return () => {
      window.removeEventListener("jellyglance-download-count", handleDownloadCount);
      window.removeEventListener("jellyglance-integrations-updated", handleIntegrationsUpdated);
      window.removeEventListener("storage", handleDownloadCount);
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
        const response = await axios.get("/api/integrations", {
          headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
        });
        setWizarrAvailability(response.data || { thirdParty: [] });
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
      refreshWizarrAvailability();
    };

    refreshWizarrAvailability();
    window.addEventListener("jellyglance-integrations-updated", handleIntegrationsUpdated);
    return () => {
      isMounted = false;
      window.removeEventListener("jellyglance-integrations-updated", handleIntegrationsUpdated);
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
        const response = await axios.get("/api/integrations", {
          headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
        });
        const nextAvailable = getRequestAvailabilityFromIntegrations(response.data || {});
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
      }
      refreshRequestCount();
    };

    refreshRequestAvailability();
    refreshRequestCount();
    const intervalId = setInterval(refreshRequestCount, 60000);
    window.addEventListener("jellyglance-request-count", handleRequestCount);
    window.addEventListener("jellyglance-integrations-updated", handleIntegrationsUpdated);
    window.addEventListener("storage", handleRequestCount);

    return () => {
      isMounted = false;
      clearInterval(intervalId);
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

      <BootstrapNavbar variant="dark" className="desktop-navigation d-flex flex-column py-0 text-center sticky-top" id="primary-navigation">
      <div className="sticky-top py-md-3">
        <BootstrapNavbar.Brand as={Link} to={"/"} className="d-none d-md-inline">
          <img src={logo_dark} style={{ height: "52px" }} className="px-2" alt="" />
          <img src={projectText} className="navbar-wordmark" alt="JellyGlance" />
        </BootstrapNavbar.Brand>

        <Nav className="flex-row flex-md-column w-100">
          {visibleNavData.map((item) => {
            const isActive = isNavItemActive(item, location);
            return (
              <Nav.Link
                as={Link}
                key={item.id}
                className={`navitem${isActive ? " active" : ""} p-2`} // add the "active" class if the link is active
                to={item.link}
                onClick={() => setIsMobileNavOpen(false)}
              >
                {item.icon}
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
            <button className="navitem footer-logout p-2" type="button" onClick={handleLogout}>
              <LogoutBoxLineIcon />
              <span className="nav-text">
                <Trans i18nKey="MENU_TABS.LOGOUT" />
              </span>
            </button>
            <VersionCard />
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
              <span>{authLabel}</span>
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
          <Button as={Link} to={profilePath} variant="outline-secondary" onClick={() => setShowAccount(false)}>
            View profile
          </Button>
          <Button variant="outline-secondary" onClick={() => setShowAccount(false)}>
            Close
          </Button>
          <Button className="profile-logout-button" onClick={handleLogout}>
            Log out
          </Button>
        </Modal.Footer>
      </Modal>
    </>
  );
}
