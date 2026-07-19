import { useEffect, useState } from "react";
import { Button, Modal, Nav, Navbar as BootstrapNavbar } from "react-bootstrap";
import { Link, useLocation } from "react-router-dom";
import { navData } from "../../../lib/navdata";
import LogoutBoxLineIcon from "remixicon-react/LogoutBoxLineIcon";
import AccountCircleLineIcon from "remixicon-react/AccountCircleLineIcon";
import logo_dark from "../../images/icon-b-512.png";
import projectText from "../../images/project-text.png";
import "../../css/navbar.css";
import VersionCard from "./version-card";
import { Trans } from "react-i18next";
import baseUrl from "../../../lib/baseurl";
import socket from "../../../socket";
import { slugifyUserName } from "../../../lib/userProfile";

function getCachedConfig() {
  try {
    return JSON.parse(localStorage.getItem("config") || "{}");
  } catch {
    return {};
  }
}

export default function Navbar() {
  const [showAccount, setShowAccount] = useState(false);
  const [customAvatar, setCustomAvatar] = useState(() => localStorage.getItem("jellyglance_account_avatar") || "");
  const [activeStreamCount, setActiveStreamCount] = useState(0);
  const [activeDownloadCount, setActiveDownloadCount] = useState(() => Number(localStorage.getItem("jellyglance_active_download_count") || 0));
  const config = getCachedConfig();
  const authMode = config?.settings?.auth?.mode || (config?.requireLogin === false ? "quick-connect" : "local");
  const authLabel =
    config?.settings?.auth?.label ||
    (authMode === "quick-connect" ? "Jellyfin Quick Connect" : authMode === "oidc" ? "OIDC / Authentik" : "Local login");
  const jellyfinUser = config?.settings?.auth?.jellyfinUser;
  const canUploadAvatar = authMode === "local" || authMode === "oidc";
  const accountName = jellyfinUser?.name || config?.username || authLabel;
  const accountRole = authMode === "quick-connect" ? "Jellyfin User" : authMode === "oidc" ? "OIDC User" : "Local User";
  const jellyfinAvatar = jellyfinUser?.id ? `${baseUrl}/proxy/Users/Images/Primary?id=${jellyfinUser.id}&fillWidth=160&quality=80` : "";
  const avatarSrc = canUploadAvatar ? customAvatar : jellyfinAvatar;

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

  const profilePath = `/users/${slugifyUserName(accountName) || "account"}`;

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

  return (
    <>
      <div className="mobile-app-topbar d-md-none">
        <Link className="mobile-app-brand" to="/">
          <img src={logo_dark} alt="" />
          <img src={projectText} alt="JellyGlance" />
        </Link>
        <Link className="mobile-app-account" to={profilePath} aria-label="Open account dashboard">
          {avatarSrc ? <img src={avatarSrc} alt="" onError={(event) => (event.currentTarget.style.display = "none")} /> : <AccountCircleLineIcon />}
        </Link>
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
                </span>
              </Nav.Link>
            );
          })}
          <div className="navbar-inline-footer">
            <Link className="navitem account-navitem p-2" to={profilePath}>
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
            </Link>
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
        </Modal.Body>
        <Modal.Footer>
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
