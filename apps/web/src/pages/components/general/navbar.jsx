import { useEffect, useState } from "react";
import { Button, Modal, Nav, Navbar as BootstrapNavbar } from "react-bootstrap";
import { Link, useLocation } from "react-router-dom";
import axios from "../../../lib/axios_instance";
import { navData } from "../../../lib/navdata";
import LogoutBoxLineIcon from "remixicon-react/LogoutBoxLineIcon";
import AccountCircleLineIcon from "remixicon-react/AccountCircleLineIcon";
import MagicLineIcon from "remixicon-react/MagicLineIcon";
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
import { DEFAULT_THEME, THEME_PRESETS, getStoredTheme, resetTheme, saveTheme } from "../../../lib/theme";

function getCachedConfig() {
  try {
    return JSON.parse(localStorage.getItem("config") || "{}");
  } catch {
    return {};
  }
}

export default function Navbar() {
  const [showAccount, setShowAccount] = useState(false);
  const [config, setConfig] = useState(() => getCachedConfig());
  const [customAvatar, setCustomAvatar] = useState(() => localStorage.getItem("jellyglance_account_avatar") || "");
  const [customTheme, setCustomTheme] = useState(() => getStoredTheme());
  const [activeStreamCount, setActiveStreamCount] = useState(0);
  const [activeDownloadCount, setActiveDownloadCount] = useState(() => Number(localStorage.getItem("jellyglance_active_download_count") || 0));
  const [requestBadgeCount, setRequestBadgeCount] = useState(() => Number(localStorage.getItem("jellyglance_request_badge_count") || 0));
  const authMode = config?.settings?.auth?.mode || (config?.requireLogin === false ? "quick-connect" : "local");
  const authLabel =
    config?.settings?.auth?.label ||
    (authMode === "quick-connect" ? "Jellyfin Quick Connect" : authMode === "oidc" ? "OIDC / Authentik" : "Local login");
  const jellyfinUser = config?.settings?.auth?.jellyfinUser;
  const canUploadAvatar = authMode === "local" || authMode === "oidc";
  const accountName = jellyfinUser?.name || config?.username || authLabel;
  const accountRole = authMode === "quick-connect" ? "Jellyfin User" : authMode === "oidc" ? "OIDC User" : "Local User";
  const jellyfinAvatar = jellyfinUser?.id ? `${baseUrl}/proxy/Users/Images/Primary?id=${jellyfinUser.id}&fillWidth=160&quality=80` : "";
  const avatarSrc = jellyfinAvatar || (canUploadAvatar ? customAvatar : "");

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

    window.addEventListener("jellyglance-download-count", handleDownloadCount);
    window.addEventListener("storage", handleDownloadCount);
    return () => {
      window.removeEventListener("jellyglance-download-count", handleDownloadCount);
      window.removeEventListener("storage", handleDownloadCount);
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

    const refreshRequestCount = async () => {
      if (!localStorage.getItem("token")) return;
      try {
        const response = await axios.get("/api/requests/summary", {
          headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
        });
        const nextCount = Number(response.data?.stats?.badgeCount || 0);
        localStorage.setItem("jellyglance_request_badge_count", String(nextCount));
        setSafeCount(nextCount);
      } catch {
        setSafeCount(localStorage.getItem("jellyglance_request_badge_count"));
      }
    };

    const handleRequestCount = (event) => setSafeCount(event.detail ?? localStorage.getItem("jellyglance_request_badge_count"));

    refreshRequestCount();
    const intervalId = setInterval(refreshRequestCount, 60000);
    window.addEventListener("jellyglance-request-count", handleRequestCount);
    window.addEventListener("storage", handleRequestCount);

    return () => {
      isMounted = false;
      clearInterval(intervalId);
      window.removeEventListener("jellyglance-request-count", handleRequestCount);
      window.removeEventListener("storage", handleRequestCount);
    };
  }, []);

  const profilePath = `/users/${slugifyUserName(accountName) || "account"}`;

  const handleThemeChange = (key, value) => {
    setCustomTheme((currentTheme) => saveTheme({ ...currentTheme, [key]: value }));
  };

  const handleThemePreset = (preset) => {
    setCustomTheme(saveTheme(preset));
  };

  const handleThemeReset = () => {
    setCustomTheme(resetTheme());
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

  return (
    <>
      <div className="mobile-app-topbar d-md-none">
        <Link className="mobile-app-brand" to="/">
          <img src={logo_dark} alt="" />
          <img src={projectText} alt="JellyGlance" />
        </Link>
        <button className="mobile-app-account" type="button" onClick={() => setShowAccount(true)} aria-label="Open account settings">
          {avatarSrc ? <img src={avatarSrc} alt="" onError={(event) => (event.currentTarget.style.display = "none")} /> : <AccountCircleLineIcon />}
        </button>
      </div>

      <BootstrapNavbar variant="dark" className=" d-flex flex-column py-0 text-center sticky-top">
      <div className="sticky-top py-md-3">
        <BootstrapNavbar.Brand as={Link} to={"/"} className="d-none d-md-inline">
          <img src={logo_dark} style={{ height: "52px" }} className="px-2" alt="" />
          <img src={projectText} className="navbar-wordmark" alt="JellyGlance" />
        </BootstrapNavbar.Brand>

        <Nav className="flex-row flex-md-column w-100">
          {navData.map((item) => {
            const locationString = location.pathname.toLocaleLowerCase();
            const isActive =
              locationString.includes(("/" + item.link).toLocaleLowerCase()) &&
              ((locationString.length > 0 && item.link.length > 0) || (locationString.length === 1 && item.link.length === 0)); // check if the link is the current path
            return (
              <Nav.Link
                as={Link}
                key={item.id}
                className={`navitem${isActive ? " active" : ""} p-2`} // add the "active" class if the link is active
                to={item.link}
              >
                {item.icon}
                <span className="d-none d-md-flex nav-text">
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

            <div className="profile-theme-presets" aria-label="Colour theme presets">
              {THEME_PRESETS.map((preset) => {
                const isActive =
                  customTheme.primary === preset.primary &&
                  customTheme.secondary === preset.secondary &&
                  customTheme.background === preset.background &&
                  customTheme.surface === preset.surface;

                return (
                  <button
                    className={`profile-theme-preset${isActive ? " active" : ""}`}
                    type="button"
                    key={preset.name}
                    onClick={() => handleThemePreset(preset)}
                    aria-pressed={isActive}
                  >
                    <span className="profile-theme-preset-swatches" aria-hidden="true">
                      <i style={{ backgroundColor: preset.primary }} />
                      <i style={{ backgroundColor: preset.secondary }} />
                      <i style={{ backgroundColor: preset.background }} />
                    </span>
                    <span>{preset.name}</span>
                  </button>
                );
              })}
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
