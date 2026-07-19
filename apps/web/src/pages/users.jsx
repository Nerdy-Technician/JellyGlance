import React, { useEffect, useMemo, useState } from "react";
import axios from "../lib/axios_instance";
import Config from "../lib/config";
import { Link } from "react-router-dom";
import CryptoJS from "crypto-js";
import AccountCircleFillIcon from "remixicon-react/AccountCircleFillIcon";
import CheckFillIcon from "remixicon-react/CheckFillIcon";
import CloseFillIcon from "remixicon-react/CloseFillIcon";
import SearchLineIcon from "remixicon-react/SearchLineIcon";
import DeleteBinLineIcon from "remixicon-react/DeleteBinLineIcon";
import LockPasswordLineIcon from "remixicon-react/LockPasswordLineIcon";
import ShieldUserLineIcon from "remixicon-react/ShieldUserLineIcon";
import PriceTag3LineIcon from "remixicon-react/PriceTag3LineIcon";
import UserAddLineIcon from "remixicon-react/UserAddLineIcon";
import UserSettingsLineIcon from "remixicon-react/UserSettingsLineIcon";
import ShieldKeyholeLineIcon from "remixicon-react/ShieldKeyholeLineIcon";
import { Alert, Badge, Button, ButtonGroup, Form, FormControl, FormSelect, Modal, Spinner } from "react-bootstrap";

import "./css/users/users.css";

import Loading from "./components/general/loading";
import i18next from "i18next";

const token = localStorage.getItem("token");

function formatWatchTime(seconds = 0) {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  if (!hours && !minutes) {
    return `0 ${i18next.t("UNITS.MINUTES")}`;
  }

  return `${hours ? `${hours} ${i18next.t("UNITS.HOURS")}` : ""}${minutes ? ` ${minutes} ${i18next.t("UNITS.MINUTES")}` : ""}`.trim();
}

function formatLastSeen(time) {
  if (!time) {
    return "Never";
  }

  const units = [
    ["days", i18next.t("UNITS.DAYS")],
    ["hours", i18next.t("UNITS.HOUR")],
    ["minutes", i18next.t("UNITS.MINUTES")],
  ];
  const value = units.find(([key]) => time[key]);
  return value ? `${time[value[0]]} ${value[1]} ago` : "Just now";
}

function userImage(user, size = 48) {
  if (user.PrimaryImageTag) {
    return <img className="users-avatar" src={`proxy/Users/Images/Primary?id=${user.UserId}&quality=70`} alt="" style={{ width: size, height: size }} />;
  }

  return (
    <span className="users-avatar users-avatar-empty" style={{ width: size, height: size }}>
      <AccountCircleFillIcon size={size} />
    </span>
  );
}

function roleClass(role) {
  return `role-${role?.toLowerCase?.().replace(/[^a-z0-9]+/g, "-") || "viewer"}`;
}

function sourceClass(source) {
  return `source-${source?.toLowerCase?.().replace(/[^a-z0-9]+/g, "-") || "jellyfin"}`;
}

export default function Users() {
  const [data, setData] = useState(null);
  const [config, setConfig] = useState(null);
  const [access, setAccess] = useState(null);
  const [activeUserIds, setActiveUserIds] = useState(new Set());
  const [rowsPerPage, setRowsPerPage] = useState(parseInt(localStorage.getItem("PREF_USER_ACTIVITY_ItemCount") ?? "10"));
  const [page, setPage] = useState(0);
  const [searchQuery, setSearchQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState("All");
  const [sourceFilter, setSourceFilter] = useState("All");
  const [savingUserId, setSavingUserId] = useState("");
  const [alert, setAlert] = useState(null);
  const [showAddUser, setShowAddUser] = useState(false);
  const [showAddRole, setShowAddRole] = useState(false);
  const [showUsersManager, setShowUsersManager] = useState(false);
  const [showRolesManager, setShowRolesManager] = useState(false);
  const [resetTarget, setResetTarget] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [newLocalUser, setNewLocalUser] = useState({ username: "", password: "", role: "Viewer" });
  const [newRole, setNewRole] = useState("");
  const [resetPassword, setResetPassword] = useState("");

  async function fetchAccess() {
    const response = await axios.get("/api/userAccess", {
      headers: { Authorization: `Bearer ${token}` },
    });
    setAccess(response.data);
  }

  async function fetchData() {
    const [activityResponse, untrackedResponse, sessionsResponse] = await Promise.all([
      axios.get("/stats/getAllUserActivity", {
        params: { t: Date.now() },
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      }),
      axios.get("/api/UntrackedUsers", {
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      }),
      axios
        .get("/proxy/getSessions", {
          params: { t: Date.now() },
          headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        })
        .catch(() => ({ data: [] })),
    ]);

    setActiveUserIds(new Set(sessionsResponse.data.filter((session) => session.NowPlayingItem && session.UserId).map((session) => session.UserId)));
    setData(
      activityResponse.data.map((item) => ({
        ...item,
        Tracked: !untrackedResponse.data.includes(item.UserId),
      }))
    );
  }

  useEffect(() => {
    const init = async () => {
      try {
        const newConfig = await Config.getConfig();
        setConfig(newConfig);
        await Promise.all([fetchAccess(), fetchData()]);
      } catch (error) {
        console.log(error);
      }
    };

    init();
    const intervalId = setInterval(() => fetchData(), 60000);
    return () => clearInterval(intervalId);
  }, []);

  const rows = useMemo(() => {
    if (!data || !access) {
      return [];
    }

    const jellyfinRows = data.map((user) => {
      const role = access.jellyfinRoles?.[user.UserId] || (user.IsAdministrator ? "Admin" : "Viewer");
      return {
        ...user,
        AccountId: user.UserId,
        Role: role,
        Source: "Jellyfin",
        SourceLabel: user.IsAdministrator ? "Jellyfin admin" : "Jellyfin user",
        IsRunning: activeUserIds.has(user.UserId),
        SortWatchTime: Number(user.TotalWatchTime || 0),
      };
    });

    const primaryLocalRow = access.primaryLocalUser
      ? [
          {
            AccountId: `local-primary-${access.primaryLocalUser}`,
            UserId: `local-primary-${access.primaryLocalUser}`,
            UserName: access.primaryLocalUser,
            Role: "Owner",
            Source: "Local",
            SourceLabel: "Primary local account",
            LastWatched: "N/A",
            LastClient: "Local login",
            TotalWatchTime: 0,
            LastSeen: null,
            Tracked: false,
            IsRunning: false,
            IsLocalAccount: true,
            IsPrimaryLocal: true,
            SortWatchTime: -1,
          },
        ]
      : [];

    const localRows = (access.localUsers || []).map((user) => ({
      AccountId: `local-${user.id}`,
      UserId: `local-${user.id}`,
      UserName: user.username,
      Role: user.role || "Viewer",
      Source: "Local",
      SourceLabel: "Local JellyGlance user",
      LastWatched: "N/A",
      LastClient: "Local login",
      TotalWatchTime: 0,
      LastSeen: null,
      Tracked: false,
      IsRunning: false,
      IsLocalAccount: true,
      LocalUser: user,
      SortWatchTime: -1,
    }));

    const oidcRows =
      access.authMode === "oidc"
        ? [
            {
              AccountId: "oidc-provider",
              UserId: "oidc-provider",
              UserName: access.oidcLabel || "OIDC / Authentik",
              Role: "Admin",
              Source: "OIDC",
              SourceLabel: "OIDC identity provider",
              LastWatched: "N/A",
              LastClient: "OIDC login",
              TotalWatchTime: 0,
              LastSeen: null,
              Tracked: false,
              IsRunning: false,
              IsOidcAccount: true,
              SortWatchTime: -2,
            },
          ]
        : [];

    return [...jellyfinRows, ...oidcRows, ...primaryLocalRow, ...localRows];
  }, [access, activeUserIds, data]);

  const filteredRows = useMemo(() => {
    return rows
      .filter((user) => roleFilter === "All" || user.Role === roleFilter)
      .filter((user) => sourceFilter === "All" || user.Source === sourceFilter)
      .filter((user) => {
        if (!searchQuery) {
          return true;
        }

        const query = searchQuery.toLowerCase();
        return (
          user.UserName?.toLowerCase().includes(query) ||
          user.LastWatched?.toLowerCase().includes(query) ||
          user.LastClient?.toLowerCase().includes(query) ||
          user.Source?.toLowerCase().includes(query)
        );
      })
      .sort((a, b) => (b.SortWatchTime || 0) - (a.SortWatchTime || 0));
  }, [roleFilter, rows, searchQuery, sourceFilter]);

  const visibleRows = filteredRows.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage);
  const jellyfinRows = rows.filter((user) => user.Source === "Jellyfin");
  const trackedCount = jellyfinRows.filter((user) => user.Tracked).length;
  const totalWatchTime = jellyfinRows.reduce((total, user) => total + Number(user.TotalWatchTime || 0), 0);
  const localAccountCount = rows.filter((user) => user.Source === "Local").length;
  const oidcAccountCount = rows.filter((user) => user.Source === "OIDC").length;

  async function toggleTrackedState(userid) {
    const response = await axios.post(
      "/api/setUntrackedUsers",
      { userId: userid },
      { headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" } }
    );

    const excluded = response.data;
    setData((currentData) =>
      currentData.map((item) => ({
        ...item,
        Tracked: !excluded.includes(item.UserId),
      }))
    );
  }

  async function changeJellyfinRole(userid, role) {
    try {
      setSavingUserId(userid);
      await axios.patch(
        `/api/userRoles/${userid}`,
        { role },
        { headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" } }
      );
      setAccess((currentAccess) => ({
        ...currentAccess,
        jellyfinRoles: { ...(currentAccess?.jellyfinRoles || {}), [userid]: role },
      }));
      setAlert({ variant: "success", message: "Role updated." });
    } catch (error) {
      setAlert({ variant: "danger", message: error.response?.data?.errorMessage || "Unable to update role." });
    } finally {
      setSavingUserId("");
    }
  }

  async function addLocalUser(event) {
    event.preventDefault();
    try {
      const response = await axios.post(
        "/api/localUsers",
        {
          ...newLocalUser,
          password: CryptoJS.SHA3(newLocalUser.password).toString(),
        },
        { headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" } }
      );

      setAccess((currentAccess) => ({
        ...currentAccess,
        localUsers: [...(currentAccess?.localUsers || []), response.data],
      }));
      setNewLocalUser({ username: "", password: "", role: "Viewer" });
      setShowAddUser(false);
      setAlert({ variant: "success", message: "Local user added." });
    } catch (error) {
      setAlert({ variant: "danger", message: error.response?.data?.errorMessage || "Unable to add local user." });
    }
  }

  async function addRole(event) {
    event.preventDefault();
    try {
      const response = await axios.post(
        "/api/roles",
        { role: newRole },
        { headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" } }
      );

      setAccess((currentAccess) => ({
        ...currentAccess,
        roles: response.data.roles,
        rolePermissions: response.data.rolePermissions || currentAccess.rolePermissions,
      }));
      setNewRole("");
      setShowAddRole(false);
      setAlert({ variant: "success", message: "Role added." });
    } catch (error) {
      setAlert({ variant: "danger", message: error.response?.data?.errorMessage || "Unable to add role." });
    }
  }

  async function removeRole(role) {
    try {
      const response = await axios.delete(`/api/roles/${encodeURIComponent(role)}`, {
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      });

      setAccess((currentAccess) => ({
        ...currentAccess,
        roles: response.data.roles,
        rolePermissions: response.data.rolePermissions || currentAccess.rolePermissions,
        jellyfinRoles: Object.fromEntries(
          Object.entries(currentAccess.jellyfinRoles || {}).map(([userid, assignedRole]) => [userid, assignedRole === role ? "Viewer" : assignedRole])
        ),
        localUsers: currentAccess.localUsers.map((localUser) => ({
          ...localUser,
          role: localUser.role === role ? "Viewer" : localUser.role,
        })),
      }));
      setAlert({ variant: "success", message: "Role removed." });
    } catch (error) {
      setAlert({ variant: "danger", message: error.response?.data?.errorMessage || "Unable to remove role." });
    }
  }

  async function updateRolePermission(role, permission, enabled) {
    const nextPermissions = {
      dashboard: false,
      users: false,
      settings: false,
      apiKeys: false,
      ...(access.rolePermissions?.[role] || {}),
      [permission]: enabled,
    };

    setAccess((currentAccess) => ({
      ...currentAccess,
      rolePermissions: {
        ...(currentAccess.rolePermissions || {}),
        [role]: nextPermissions,
      },
    }));

    try {
      await axios.patch(
        `/api/roles/${encodeURIComponent(role)}/permissions`,
        { permissions: nextPermissions },
        { headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" } }
      );
    } catch (error) {
      setAlert({ variant: "danger", message: error.response?.data?.errorMessage || "Unable to update permissions." });
      await fetchAccess();
    }
  }

  async function changeLocalRole(user, role) {
    const response = await axios.patch(
      `/api/localUsers/${user.id}`,
      { role },
      { headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" } }
    );

    setAccess((currentAccess) => ({
      ...currentAccess,
      localUsers: currentAccess.localUsers.map((localUser) => (localUser.id === user.id ? response.data : localUser)),
    }));
  }

  async function removeLocalUser(user) {
    try {
      await axios.delete(`/api/localUsers/${user.id}`, {
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      });

      setAccess((currentAccess) => ({
        ...currentAccess,
        localUsers: currentAccess.localUsers.filter((localUser) => localUser.id !== user.id),
      }));
      setDeleteTarget(null);
      setAlert({ variant: "success", message: `${user.username} deleted.` });
    } catch (error) {
      setAlert({ variant: "danger", message: error.response?.data?.errorMessage || "Unable to delete local user." });
    }
  }

  async function submitPasswordReset(event) {
    event.preventDefault();
    if (!resetPassword || resetPassword.length < 6) {
      setAlert({ variant: "danger", message: i18next.t("ERROR_MESSAGES.PASSWORD_LENGTH") });
      return;
    }

    const payload = { password: CryptoJS.SHA3(resetPassword).toString() };
    if (resetTarget.primary) {
      await axios.patch("/api/primaryLocalPassword", payload, {
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      });
    } else {
      await axios.patch(`/api/localUsers/${resetTarget.id}`, payload, {
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      });
    }

    setResetPassword("");
    setResetTarget(null);
    setAlert({ variant: "success", message: "Password reset." });
  }

  if (!data || !config || !access) {
    return <Loading />;
  }

  return (
    <div className="Users users-page">
      <section className="users-hero">
        <div className="users-title-block">
          <div className="users-title-icon">
            <UserSettingsLineIcon size={26} />
          </div>
          <div>
            <p className="users-eyebrow">Access control</p>
            <h1>Users</h1>
            <p>Manage Jellyfin role metadata, tracking, and local JellyGlance accounts.</p>
          </div>
        </div>
        <div className="users-header-actions">
          <Button className="users-primary-action" onClick={() => setShowUsersManager(true)}>
            <UserAddLineIcon size={17} />
            Add Users
          </Button>
          <Button className="users-primary-action" onClick={() => setShowRolesManager(true)}>
            <PriceTag3LineIcon size={17} />
            Roles
          </Button>
        </div>
      </section>

      {alert && (
        <Alert variant={alert.variant} onClose={() => setAlert(null)} dismissible>
          {alert.message}
        </Alert>
      )}

      <section className="users-stat-grid">
        <div className="users-stat-card">
          <ShieldUserLineIcon />
          <span>Jellyfin</span>
          <strong>{jellyfinRows.length}</strong>
        </div>
        <div className="users-stat-card">
          <CheckFillIcon />
          <span>Tracked</span>
          <strong>{trackedCount}</strong>
        </div>
        <div className="users-stat-card">
          <UserSettingsLineIcon />
          <span>Local</span>
          <strong>{localAccountCount}</strong>
        </div>
        <div className="users-stat-card">
          <ShieldKeyholeLineIcon />
          <span>OIDC</span>
          <strong>{oidcAccountCount}</strong>
        </div>
      </section>

      <section className="users-management-grid">
        <div className="users-panel users-table-panel">
          <div className="users-panel-header">
            <div>
              <h2>JellyGlance Users</h2>
              <p>{formatWatchTime(totalWatchTime)} watched across synced users.</p>
            </div>
            <div className="users-toolbar">
              <div className="users-search">
                <SearchLineIcon size={17} />
                <FormControl type="text" placeholder="Search users, media, clients" value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} />
              </div>
              <FormSelect value={roleFilter} onChange={(event) => setRoleFilter(event.target.value)}>
                <option value="All">All roles</option>
                {access.roles.map((role) => (
                  <option key={role} value={role}>
                    {role}
                  </option>
                ))}
              </FormSelect>
              <FormSelect value={sourceFilter} onChange={(event) => setSourceFilter(event.target.value)}>
                <option value="All">All accounts</option>
                <option value="Jellyfin">Jellyfin</option>
                <option value="OIDC">OIDC</option>
                <option value="Local">Local</option>
              </FormSelect>
              <FormSelect
                value={rowsPerPage}
                onChange={(event) => {
                  const value = parseInt(event.target.value);
                  setRowsPerPage(value);
                  localStorage.setItem("PREF_USER_ACTIVITY_ItemCount", value);
                  setPage(0);
                }}
              >
                <option value="10">10 rows</option>
                <option value="25">25 rows</option>
                <option value="50">50 rows</option>
              </FormSelect>
            </div>
          </div>

          <div className="users-list">
            {visibleRows.map((user) => (
              <article className={`users-row-card ${user.Source !== "Jellyfin" ? "is-account-row" : ""}`} key={user.AccountId}>
                <div className="users-row-person">
                  {userImage(user, 54)}
                  <div>
                    {user.Source === "Jellyfin" ? <Link to={`/users/${user.UserId}`}>{user.UserName}</Link> : <strong>{user.UserName}</strong>}
                    <span>{user.SourceLabel}</span>
                  </div>
                </div>

                <div className="users-row-metrics">
                  <div className="users-row-meta">
                    <span>Last watched</span>
                    <strong>{user.LastWatched || "Never"}</strong>
                  </div>
                  <div className="users-row-meta">
                    <span>Client</span>
                    <strong>{user.LastClient || "N/A"}</strong>
                  </div>
                  <div className="users-row-meta">
                    <span>Watch time</span>
                    <strong>{formatWatchTime(user.TotalWatchTime)}</strong>
                  </div>
                  <div className="users-row-meta">
                    <span>{user.IsRunning ? "Watching now" : "Last seen"}</span>
                    <strong>{user.IsRunning ? "Running" : formatLastSeen(user.LastSeen)}</strong>
                  </div>
                </div>

                <div className="users-row-badges">
                  <Badge className={`users-role-badge ${roleClass(user.Role)}`}>{user.Role}</Badge>
                  <Badge className={`users-source-badge ${sourceClass(user.Source)}`}>{user.Source}</Badge>
                </div>

                {user.IsLocalAccount && !user.IsPrimaryLocal ? (
                  <FormSelect value={user.Role} onChange={(event) => changeLocalRole(user.LocalUser, event.target.value)}>
                    {access.roles.map((role) => (
                      <option key={role} value={role}>
                        {role}
                      </option>
                    ))}
                  </FormSelect>
                ) : user.Source === "Jellyfin" ? (
                  <FormSelect value={user.Role} onChange={(event) => changeJellyfinRole(user.UserId, event.target.value)} disabled={savingUserId === user.UserId}>
                    {access.roles.map((role) => (
                      <option key={role} value={role}>
                        {role}
                      </option>
                    ))}
                  </FormSelect>
                ) : (
                  <span className="users-role-readonly">{user.Role}</span>
                )}

                {user.Source === "Jellyfin" ? (
                  <Button
                    className={`users-track-button ${user.Tracked ? "is-tracked" : ""}`}
                    type="button"
                    onClick={() => toggleTrackedState(user.UserId)}
                    title={user.Tracked ? "Tracked" : "Not tracked"}
                  >
                    {user.Tracked ? <CheckFillIcon size={18} /> : <CloseFillIcon size={18} />}
                  </Button>
                ) : user.IsLocalAccount ? (
                  <div className="users-row-actions">
                    <Button
                      type="button"
                      className="users-row-action-button"
                      title="Reset password"
                      aria-label={`Reset password for ${user.UserName}`}
                      onClick={() =>
                        setResetTarget(
                          user.IsPrimaryLocal
                            ? { primary: true, username: user.UserName }
                            : user.LocalUser
                        )
                      }
                    >
                      <LockPasswordLineIcon size={17} />
                    </Button>
                    {!user.IsPrimaryLocal ? (
                      <Button
                        type="button"
                        className="users-row-action-button is-danger"
                        title="Delete local user"
                        aria-label={`Delete ${user.UserName}`}
                        onClick={() => setDeleteTarget(user.LocalUser)}
                      >
                        <DeleteBinLineIcon size={17} />
                      </Button>
                    ) : null}
                  </div>
                ) : (
                  <span className="users-track-placeholder" />
                )}
              </article>
            ))}
          </div>

          <div className="users-pagination">
            <span>
              {filteredRows.length ? page * rowsPerPage + 1 : 0}-{Math.min(page * rowsPerPage + rowsPerPage, filteredRows.length)} of {filteredRows.length}
            </span>
            <ButtonGroup>
              <Button onClick={() => setPage(0)} disabled={page === 0}>
                First
              </Button>
              <Button onClick={() => setPage((currentPage) => Math.max(currentPage - 1, 0))} disabled={page === 0}>
                Previous
              </Button>
              <Button onClick={() => setPage((currentPage) => currentPage + 1)} disabled={page >= Math.ceil(filteredRows.length / rowsPerPage) - 1}>
                Next
              </Button>
            </ButtonGroup>
          </div>
        </div>

      </section>

      <Modal show={showUsersManager} onHide={() => setShowUsersManager(false)} centered size="lg" contentClassName="users-modal users-manager-modal">
        <Modal.Header closeButton>
          <Modal.Title>Local Users</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <div className="users-modal-topline">
            <div>
              <strong>JellyGlance accounts</strong>
              <span>{(access.localUsers?.length || 0) + (access.primaryLocalUser ? 1 : 0)} accounts</span>
            </div>
            <Button className="users-primary-action" onClick={() => setShowAddUser(true)}>
              <UserAddLineIcon size={17} />
              Add User
            </Button>
          </div>

          <div className="local-users-modal-list">
            {access.primaryLocalUser && (
              <article className="local-user-card is-primary">
                <div>
                  <strong>{access.primaryLocalUser}</strong>
                  <span>Primary local account</span>
                </div>
                <Badge className="users-role-badge role-owner">Owner</Badge>
                <Button variant="outline-primary" onClick={() => setResetTarget({ primary: true, username: access.primaryLocalUser })}>
                  Reset
                </Button>
              </article>
            )}

            {access.localUsers.map((user) => (
              <article className="local-user-card" key={user.id}>
                <div>
                  <strong>{user.username}</strong>
                  <span>Local JellyGlance user</span>
                </div>
                <FormSelect value={user.role} onChange={(event) => changeLocalRole(user, event.target.value)}>
                  {access.roles.map((role) => (
                    <option key={role} value={role}>
                      {role}
                    </option>
                  ))}
                </FormSelect>
                <div className="local-user-actions">
                  <Button variant="outline-primary" onClick={() => setResetTarget(user)}>
                    Reset
                  </Button>
                  <Button variant="outline-danger" onClick={() => setDeleteTarget(user)}>
                    Remove
                  </Button>
                </div>
              </article>
            ))}
          </div>

          {!access.localUsers.length && <div className="users-empty-state">No extra local users yet.</div>}
        </Modal.Body>
      </Modal>

      <Modal show={showRolesManager} onHide={() => setShowRolesManager(false)} centered size="lg" contentClassName="users-modal users-manager-modal">
        <Modal.Header closeButton>
          <Modal.Title>Roles</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <div className="users-modal-topline">
            <div>
              <strong>Role permissions</strong>
              <span>{access.roles.length} roles</span>
            </div>
            <Button className="users-primary-action" onClick={() => setShowAddRole(true)}>
              <PriceTag3LineIcon size={17} />
              Add New Role
            </Button>
          </div>

          <div className="roles-manager">
            <div className="roles-permission-list">
              {access.roles.map((role) => (
                <article className="role-permission-card" key={role}>
                  <div className="role-permission-title">
                    <Badge className={`users-role-badge ${roleClass(role)}`}>{role}</Badge>
                    {!["Owner", "Admin", "Manager", "Viewer", "Disabled"].includes(role) && (
                      <button type="button" onClick={() => removeRole(role)} aria-label={`Remove ${role}`}>
                        <CloseFillIcon size={14} />
                      </button>
                    )}
                  </div>
                  <div className="permission-toggle-grid">
                    {[
                      ["dashboard", "Dashboard"],
                      ["users", "Users"],
                      ["settings", "Settings"],
                      ["apiKeys", "API Keys"],
                    ].map(([permission, label]) => (
                      <Form.Check
                        key={permission}
                        type="switch"
                        id={`role-${role}-${permission}`}
                        label={label}
                        checked={Boolean(access.rolePermissions?.[role]?.[permission])}
                        onChange={(event) => updateRolePermission(role, permission, event.target.checked)}
                      />
                    ))}
                  </div>
                </article>
              ))}
            </div>
          </div>
        </Modal.Body>
      </Modal>

      <Modal show={showAddUser} onHide={() => setShowAddUser(false)} centered contentClassName="users-modal">
        <Form onSubmit={addLocalUser}>
          <Modal.Header closeButton>
            <Modal.Title>Add local user</Modal.Title>
          </Modal.Header>
          <Modal.Body>
            <Form.Group className="mb-3">
              <Form.Label>Username</Form.Label>
              <Form.Control value={newLocalUser.username} onChange={(event) => setNewLocalUser({ ...newLocalUser, username: event.target.value })} required />
            </Form.Group>
            <Form.Group className="mb-3">
              <Form.Label>Password</Form.Label>
              <Form.Control
                type="password"
                minLength={6}
                value={newLocalUser.password}
                onChange={(event) => setNewLocalUser({ ...newLocalUser, password: event.target.value })}
                required
              />
            </Form.Group>
            <Form.Group>
              <Form.Label>Role</Form.Label>
              <FormSelect value={newLocalUser.role} onChange={(event) => setNewLocalUser({ ...newLocalUser, role: event.target.value })}>
                {access.roles.map((role) => (
                  <option key={role} value={role}>
                    {role}
                  </option>
                ))}
              </FormSelect>
            </Form.Group>
          </Modal.Body>
          <Modal.Footer>
            <Button variant="outline-secondary" onClick={() => setShowAddUser(false)}>
              Cancel
            </Button>
            <Button type="submit" className="users-primary-action">
              Add User
            </Button>
          </Modal.Footer>
        </Form>
      </Modal>

      <Modal show={showAddRole} onHide={() => setShowAddRole(false)} centered contentClassName="users-modal">
        <Form onSubmit={addRole}>
          <Modal.Header closeButton>
            <Modal.Title>Add new role</Modal.Title>
          </Modal.Header>
          <Modal.Body>
            <Form.Group>
              <Form.Label>Role name</Form.Label>
              <Form.Control value={newRole} onChange={(event) => setNewRole(event.target.value)} placeholder="Technician, Family, Read only..." required />
            </Form.Group>
          </Modal.Body>
          <Modal.Footer>
            <Button variant="outline-secondary" onClick={() => setShowAddRole(false)}>
              Cancel
            </Button>
            <Button type="submit" className="users-primary-action" disabled={!newRole.trim()}>
              Add New Role
            </Button>
          </Modal.Footer>
        </Form>
      </Modal>

      <Modal show={!!resetTarget} onHide={() => setResetTarget(null)} centered contentClassName="users-modal">
        <Form onSubmit={submitPasswordReset}>
          <Modal.Header closeButton>
            <Modal.Title>Reset password</Modal.Title>
          </Modal.Header>
          <Modal.Body>
            <p className="users-modal-copy">Set a new local password for {resetTarget?.username}.</p>
            <Form.Control
              type="password"
              minLength={6}
              value={resetPassword}
              onChange={(event) => setResetPassword(event.target.value)}
              placeholder="New password"
              required
            />
          </Modal.Body>
          <Modal.Footer>
            <Button variant="outline-secondary" onClick={() => setResetTarget(null)}>
              Cancel
            </Button>
            <Button type="submit" className="users-primary-action">
              Reset Password
            </Button>
          </Modal.Footer>
        </Form>
      </Modal>

      <Modal show={!!deleteTarget} onHide={() => setDeleteTarget(null)} centered contentClassName="users-modal">
        <Modal.Header closeButton>
          <Modal.Title>Delete local user</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <p className="users-modal-copy">
            Delete {deleteTarget?.username}? This removes the local JellyGlance account only.
          </p>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="outline-secondary" onClick={() => setDeleteTarget(null)}>
            Cancel
          </Button>
          <Button variant="danger" onClick={() => removeLocalUser(deleteTarget)}>
            Delete User
          </Button>
        </Modal.Footer>
      </Modal>
    </div>
  );
}
