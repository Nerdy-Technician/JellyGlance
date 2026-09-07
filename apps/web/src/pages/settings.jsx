import { Tabs, Tab } from "react-bootstrap";
import { lazy, Suspense, useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";

import "./css/settings/settings.css";
import { useTranslation } from "react-i18next";
import ErrorBoundary from "./components/general/ErrorBoundary";
import Loading from "./components/general/loading";
import Settings3LineIcon from "remixicon-react/Settings3LineIcon";
import ShieldKeyholeLineIcon from "remixicon-react/ShieldKeyholeLineIcon";
import PulseLineIcon from "remixicon-react/PulseLineIcon";
import TaskLineIcon from "remixicon-react/TaskLineIcon";
import GalleryLineIcon from "remixicon-react/GalleryLineIcon";
import Key2LineIcon from "remixicon-react/Key2LineIcon";
import Notification3LineIcon from "remixicon-react/Notification3LineIcon";
import ArchiveLineIcon from "remixicon-react/ArchiveLineIcon";
import FileList3LineIcon from "remixicon-react/FileList3LineIcon";
import Plug2LineIcon from "remixicon-react/Plug2LineIcon";
import HeartPulseLineIcon from "remixicon-react/HeartPulseLineIcon";
import Database2LineIcon from "remixicon-react/Database2LineIcon";
import MailSettingsLineIcon from "remixicon-react/MailSettingsLineIcon";
import ToolsLineIcon from "remixicon-react/ToolsLineIcon";
import DeviceLineIcon from "remixicon-react/DeviceLineIcon";
import AppsLineIcon from "remixicon-react/AppsLineIcon";
import CalendarLineIcon from "remixicon-react/CalendarLineIcon";
import Tv2LineIcon from "remixicon-react/Tv2LineIcon";

const SettingsConfig = lazy(() => import("./components/settings/settingsConfig"));
const Tasks = lazy(() => import("./components/settings/Tasks"));
const SecuritySettings = lazy(() => import("./components/settings/security"));
const ApiKeys = lazy(() => import("./components/settings/apiKeys"));
const LibrarySelector = lazy(() => import("./library_selector"));
const ActivityMonitorSettings = lazy(() => import("./components/settings/ActivityMonitorSettings"));
const WebhooksSettings = lazy(() => import("./components/settings/webhooks"));
const Integrations = lazy(() => import("./integrations"));
const RepairHub = lazy(() => import("./repair-hub"));
const HealthSettings = lazy(() => import("./components/settings/health"));
const JellystatImport = lazy(() => import("./components/settings/JellystatImport"));
const TautulliImport = lazy(() => import("./components/settings/TautulliImport"));
const NewsletterSettings = lazy(() => import("./components/settings/NewsletterSettings"));
const NotificationSettings = lazy(() => import("./components/settings/NotificationSettings"));
const JellyfinAdminSettings = lazy(() => import("./components/settings/JellyfinAdminSettings"));
const JellyfinJobSchedules = lazy(() => import("./components/settings/JellyfinJobSchedules"));
const BackupPage = lazy(() => import("./components/settings/backup_page"));
const Logs = lazy(() => import("./components/settings/logs"));
const KioskSettings = lazy(() => import("./components/settings/KioskSettings"));

function tabTitle(Icon, label) {
  return (
    <span className="settings-tab-title">
      <Icon size={16} />
      <span>{label}</span>
    </span>
  );
}

function SettingsPane({ children }) {
  return (
    <ErrorBoundary>
      <Suspense fallback={<Loading />}>{children}</Suspense>
    </ErrorBoundary>
  );
}

const settingsTabItems = [
  { key: "tabGeneral", Icon: Settings3LineIcon, labelKey: "SETTINGS_PAGE.GENERAL", groupKey: "SETTINGS_PAGE.GROUP_CORE" },
  { key: "tabSecurity", Icon: ShieldKeyholeLineIcon, labelKey: "SETTINGS_PAGE.SECURITY", groupKey: "SETTINGS_PAGE.GROUP_CORE" },
  { key: "tabKiosk", Icon: Tv2LineIcon, labelKey: "SETTINGS_PAGE.KIOSK", groupKey: "SETTINGS_PAGE.GROUP_CORE" },
  { key: "tabLibraries", Icon: GalleryLineIcon, labelKey: "SETTINGS_PAGE.LIBRARY_SETTINGS", groupKey: "SETTINGS_PAGE.GROUP_MEDIA" },
  { key: "tabActivityMonitor", Icon: PulseLineIcon, labelKey: "SETTINGS_PAGE.ACTIVITY_MONITOR", groupKey: "SETTINGS_PAGE.GROUP_MEDIA" },
  { key: "tabJellyfinDevices", Icon: DeviceLineIcon, labelKey: "SETTINGS_PAGE.AUTHORISED_DEVICES", groupKey: "SETTINGS_PAGE.GROUP_MEDIA" },
  { key: "tabJellyfinPlugins", Icon: AppsLineIcon, labelKey: "SETTINGS_PAGE.PLUGINS", groupKey: "SETTINGS_PAGE.GROUP_MEDIA" },
  { key: "tabJellyfinJobs", Icon: CalendarLineIcon, labelKey: "SETTINGS_PAGE.JELLYFIN_JOBS", groupKey: "SETTINGS_PAGE.GROUP_MEDIA" },
  { key: "tabIntegrations", Icon: Plug2LineIcon, labelKey: "SETTINGS_PAGE.INTEGRATIONS", groupKey: "SETTINGS_PAGE.GROUP_CONNECTIONS" },
  { key: "tabKeys", Icon: Key2LineIcon, labelKey: "SETTINGS_PAGE.API_KEY", groupKey: "SETTINGS_PAGE.GROUP_CONNECTIONS" },
  { key: "tabWebhooks", Icon: Notification3LineIcon, labelKey: "SETTINGS_PAGE.WEBHOOKS", groupKey: "SETTINGS_PAGE.GROUP_CONNECTIONS" },
  { key: "tabNotifications", Icon: Notification3LineIcon, labelKey: "SETTINGS_PAGE.NOTIFICATIONS", groupKey: "SETTINGS_PAGE.GROUP_CONNECTIONS" },
  { key: "tabNewsletter", Icon: MailSettingsLineIcon, labelKey: "SETTINGS_PAGE.NEWSLETTER", groupKey: "SETTINGS_PAGE.GROUP_CONNECTIONS" },
  { key: "tabTasks", Icon: TaskLineIcon, labelKey: "SETTINGS_PAGE.TASKS", groupKey: "SETTINGS_PAGE.GROUP_OPERATIONS" },
  { key: "tabBackup", Icon: ArchiveLineIcon, labelKey: "SETTINGS_PAGE.BACKUP", groupKey: "SETTINGS_PAGE.GROUP_OPERATIONS" },
  { key: "tabImports", Icon: Database2LineIcon, labelKey: "SETTINGS_PAGE.IMPORTS", groupKey: "SETTINGS_PAGE.GROUP_OPERATIONS" },
  { key: "tabHealth", Icon: HeartPulseLineIcon, labelKey: "SETTINGS_PAGE.HEALTH", groupKey: "SETTINGS_PAGE.GROUP_OPERATIONS" },
  { key: "tabRepair", Icon: ToolsLineIcon, labelKey: "SETTINGS_PAGE.REPAIR", groupKey: "SETTINGS_PAGE.GROUP_OPERATIONS" },
  { key: "tabLogs", Icon: FileList3LineIcon, labelKey: "SETTINGS_PAGE.LOGS", groupKey: "SETTINGS_PAGE.GROUP_OPERATIONS" },
];

const settingsTabs = settingsTabItems.map((item) => item.key);
const settingsTabGroups = settingsTabItems.reduce((groups, item) => {
  const group = groups.find((entry) => entry.groupKey === item.groupKey);
  if (group) {
    group.items.push(item);
  } else {
    groups.push({ groupKey: item.groupKey, items: [item] });
  }
  return groups;
}, []);
const settingsTabItemMap = Object.fromEntries(settingsTabItems.map((item) => [item.key, item]));

function tabTitleFor(key, t) {
  const item = settingsTabItemMap[key] || settingsTabItems[0];
  return tabTitle(item.Icon, t(item.labelKey));
}
const settingsTabHashes = {
  tabGeneral: "general",
  tabSecurity: "security",
  tabActivityMonitor: "activity-monitor",
  tabJellyfinDevices: "devices",
  tabJellyfinPlugins: "plugins",
  tabJellyfinJobs: "jellyfin-jobs",
  tabTasks: "tasks",
  tabKiosk: "kiosk",
  tabLibraries: "libraries",
  tabIntegrations: "integrations",
  tabKeys: "apikeys",
  tabWebhooks: "webhooks",
  tabNotifications: "notifications",
  tabBackup: "backup",
  tabImports: "imports",
  tabNewsletter: "newsletter",
  tabHealth: "health",
  tabRepair: "repair",
  tabLogs: "logs",
};
const settingsTabPaths = {
  tabGeneral: "general",
  tabSecurity: "security",
  tabActivityMonitor: "activity-monitor",
  tabJellyfinDevices: "devices",
  tabJellyfinPlugins: "plugins",
  tabJellyfinJobs: "jellyfin-jobs",
  tabTasks: "tasks",
  tabKiosk: "kiosk",
  tabLibraries: "libraries",
  tabIntegrations: "integrations",
  tabKeys: "api-key",
  tabWebhooks: "webhooks",
  tabNotifications: "notifications",
  tabBackup: "backup",
  tabImports: "imports",
  tabNewsletter: "newsletter",
  tabHealth: "health",
  tabRepair: "repair",
  tabLogs: "logs",
};
const settingsHashAliases = {
  api: "tabKeys",
  apikey: "tabKeys",
  apiKey: "tabKeys",
  apikeys: "tabKeys",
  apiKeys: "tabKeys",
  keys: "tabKeys",
  swagger: "tabKeys",
  swaggerui: "tabKeys",
  "swagger-ui": "tabKeys",
  apidocs: "tabKeys",
  "api-docs": "tabKeys",
  activity: "tabActivityMonitor",
  activitymonitor: "tabActivityMonitor",
  "activity-monitor": "tabActivityMonitor",
  authorizeddevices: "tabJellyfinDevices",
  authoriseddevices: "tabJellyfinDevices",
  "authorized-devices": "tabJellyfinDevices",
  "authorised-devices": "tabJellyfinDevices",
  jellyfindevices: "tabJellyfinDevices",
  "jellyfin-devices": "tabJellyfinDevices",
  jellyfinplugins: "tabJellyfinPlugins",
  "jellyfin-plugins": "tabJellyfinPlugins",
  jellyfinjobs: "tabJellyfinJobs",
  "jellyfin-jobs": "tabJellyfinJobs",
  jobs: "tabJellyfinJobs",
  "scheduled-jobs": "tabJellyfinJobs",
  schedules: "tabJellyfinJobs",
};
const settingsHashToTab = {
  ...Object.fromEntries(Object.entries(settingsTabHashes).map(([key, hash]) => [hash, key])),
  ...Object.fromEntries(Object.entries(settingsTabPaths).map(([key, slug]) => [slug, key])),
  ...settingsHashAliases,
};
const integrationSettingsTabAliases = {
  media: "media-server",
  mediaserver: "media-server",
  "media-server": "media-server",
  jellyfin: "media-server",
  arr: "automation",
  arrapps: "automation",
  "arr-apps": "automation",
  automation: "automation",
  jellyseerr: "seerr",
  overseerr: "seerr",
  seerr: "seerr",
  download: "downloads",
  downloads: "downloads",
  "download-clients": "downloads",
  clients: "downloads",
  invite: "invites",
  invites: "invites",
  "invites-transcodes": "invites",
  transcodes: "invites",
  tdarr: "invites",
};

function normalizeSettingsSlug(value = "") {
  return String(value).replace(/^#\/?/, "").trim().toLowerCase();
}

function normalizeIntegrationSettingsTabSlug(value = "") {
  const normalized = normalizeSettingsSlug(value);
  return integrationSettingsTabAliases[normalized] || "";
}

function getTabFromHash(hash = window.location.hash) {
  return settingsHashToTab[normalizeSettingsSlug(hash)] || "";
}

function getSettingsPathParts(pathname = window.location.pathname) {
  const parts = pathname.split("/").filter(Boolean);
  const settingsIndex = parts.findIndex((part) => part.toLowerCase() === "settings");
  return settingsIndex >= 0 ? parts.slice(settingsIndex + 1) : [];
}

function getTabFromPath(pathname = window.location.pathname) {
  const [tabSlug] = getSettingsPathParts(pathname);
  return settingsHashToTab[normalizeSettingsSlug(tabSlug)] || "";
}

function getSettingsIntegrationPathTab(pathname = window.location.pathname) {
  const [tabSlug, integrationTabSlug] = getSettingsPathParts(pathname);
  const tabName = settingsHashToTab[normalizeSettingsSlug(tabSlug)];
  return tabName === "tabIntegrations" ? normalizeIntegrationSettingsTabSlug(integrationTabSlug) : "";
}

function getSettingsInitialTab(location = window.location) {
  const pathTab = getTabFromPath(location.pathname);
  if (settingsTabs.includes(pathTab)) return pathTab;

  const hashTab = getTabFromHash(location.hash);
  if (settingsTabs.includes(hashTab)) return hashTab;

  const requestedTab = new URLSearchParams(location.search).get("tab");
  if (settingsTabs.includes(requestedTab)) return requestedTab;

  const savedTab = localStorage.getItem(`PREF_SETTINGS_LAST_SELECTED_TAB`) ?? "tabGeneral";
  return settingsTabs.includes(savedTab) ? savedTab : "tabGeneral";
}

function getSettingsPath(tabName, integrationTab = "") {
  const tabSlug = settingsTabPaths[tabName] || settingsTabPaths.tabGeneral;
  const integrationSlug = tabName === "tabIntegrations" ? normalizeIntegrationSettingsTabSlug(integrationTab) : "";
  return integrationSlug ? `/settings/${tabSlug}/${integrationSlug}` : `/settings/${tabSlug}`;
}

function isSettingsHubPath(pathname = "") {
  return String(pathname).replace(/\/+$/, "") === "/settings";
}

export default function Settings() {
  const { t } = useTranslation();
  const location = useLocation();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState(() => getSettingsInitialTab(location));
  const [activeIntegrationTab, setActiveIntegrationTab] = useState(() => getSettingsIntegrationPathTab(location.pathname) || "media-server");

  useEffect(() => {
    const nextTab = getSettingsInitialTab(location);
    const nextIntegrationTab = getSettingsIntegrationPathTab(location.pathname) || normalizeIntegrationSettingsTabSlug(location.hash) || "media-server";
    if (settingsTabs.includes(nextTab)) {
      setActiveTab(nextTab);
      localStorage.setItem(`PREF_SETTINGS_LAST_SELECTED_TAB`, nextTab);
    }
    if (nextTab === "tabIntegrations") {
      setActiveIntegrationTab(nextIntegrationTab);
    }
  }, [location]);

  useEffect(() => {
    const pathTab = getTabFromPath(location.pathname);
    if (settingsTabs.includes(pathTab)) return;

    const hashTab = getTabFromHash(location.hash);
    if (settingsTabs.includes(hashTab)) {
      const hashIntegrationTab = hashTab === "tabIntegrations" ? normalizeIntegrationSettingsTabSlug(location.hash) || activeIntegrationTab : "";
      navigate(getSettingsPath(hashTab, hashIntegrationTab), { replace: true });
      return;
    }

    if (isSettingsHubPath(location.pathname)) {
      const requestedTab = new URLSearchParams(location.search).get("tab");
      if (settingsTabs.includes(requestedTab)) {
        navigate(getSettingsPath(requestedTab), { replace: true });
        return;
      }
      if (!location.hash) {
        navigate(getSettingsPath(activeTab, activeIntegrationTab), { replace: true });
      }
    }
  }, [activeIntegrationTab, activeTab, location.hash, location.pathname, location.search, navigate]);

  function setTab(tabName, updateMode = "push") {
    if (!settingsTabs.includes(tabName)) {
      tabName = "tabGeneral";
    }
    setActiveTab(tabName);
    localStorage.setItem(`PREF_SETTINGS_LAST_SELECTED_TAB`, tabName);
    navigate(getSettingsPath(tabName, activeIntegrationTab), { replace: updateMode === "replace" });
  }

  function setIntegrationTab(tabName) {
    const nextTab = normalizeIntegrationSettingsTabSlug(tabName) || "media-server";
    setActiveIntegrationTab(nextTab);
    navigate(getSettingsPath("tabIntegrations", nextTab));
  }

  function renderActiveSettingsPane() {
    switch (activeTab) {
      case "tabSecurity":
        return (
          <SettingsPane>
            <SecuritySettings />
          </SettingsPane>
        );
      case "tabKiosk":
        return (
          <SettingsPane>
            <KioskSettings />
          </SettingsPane>
        );
      case "tabLibraries":
        return (
          <SettingsPane>
            <LibrarySelector />
          </SettingsPane>
        );
      case "tabActivityMonitor":
        return (
          <SettingsPane>
            <ActivityMonitorSettings />
          </SettingsPane>
        );
      case "tabJellyfinDevices":
        return (
          <SettingsPane>
            <JellyfinAdminSettings view="devices" />
          </SettingsPane>
        );
      case "tabJellyfinPlugins":
        return (
          <SettingsPane>
            <JellyfinAdminSettings view="plugins" />
          </SettingsPane>
        );
      case "tabJellyfinJobs":
        return (
          <SettingsPane>
            <JellyfinJobSchedules />
          </SettingsPane>
        );
      case "tabIntegrations":
        return (
          <SettingsPane>
            <Integrations embedded activeTab={activeIntegrationTab} onTabChange={setIntegrationTab} />
          </SettingsPane>
        );
      case "tabKeys":
        return (
          <SettingsPane>
            <ApiKeys />
          </SettingsPane>
        );
      case "tabWebhooks":
        return (
          <SettingsPane>
            <WebhooksSettings />
          </SettingsPane>
        );
      case "tabNotifications":
        return (
          <SettingsPane>
            <NotificationSettings />
          </SettingsPane>
        );
      case "tabNewsletter":
        return (
          <SettingsPane>
            <NewsletterSettings />
          </SettingsPane>
        );
      case "tabTasks":
        return (
          <SettingsPane>
            <Tasks />
          </SettingsPane>
        );
      case "tabBackup":
        return (
          <SettingsPane>
            <BackupPage />
          </SettingsPane>
        );
      case "tabImports":
        return (
          <Tabs defaultActiveKey="jellystat" variant="pills" className="settings-import-tabs" transition={false} mountOnEnter>
            <Tab eventKey="jellystat" title="Jellystat" className="settings-import-pane">
              <SettingsPane>
                <JellystatImport />
              </SettingsPane>
            </Tab>
            <Tab eventKey="tautulli" title="Tautulli" className="settings-import-pane">
              <SettingsPane>
                <TautulliImport />
              </SettingsPane>
            </Tab>
          </Tabs>
        );
      case "tabHealth":
        return (
          <SettingsPane>
            <HealthSettings />
          </SettingsPane>
        );
      case "tabRepair":
        return (
          <SettingsPane>
            <RepairHub embedded />
          </SettingsPane>
        );
      case "tabLogs":
        return (
          <SettingsPane>
            <Logs />
          </SettingsPane>
        );
      case "tabGeneral":
      default:
        return (
          <SettingsPane>
            <SettingsConfig />
          </SettingsPane>
        );
    }
  }

  return (
    <div className="settings has-mobile-settings-menu">
      <div className="settings-mobile-menu">
        <div className="settings-mobile-menu-list" role="tablist" aria-label="Settings sections">
          {settingsTabItems.map(({ key, Icon, labelKey }) => (
            <button
              key={key}
              type="button"
              className={activeTab === key ? "is-active" : ""}
              onClick={() => setTab(key)}
              role="tab"
              aria-selected={activeTab === key}
            >
              {tabTitle(Icon, t(labelKey))}
            </button>
          ))}
        </div>
      </div>

      <nav className="nav nav-pills settings-sidebar-nav" role="tablist" aria-label="Settings sections">
        {settingsTabGroups.map((group) => (
          <div className="settings-sidebar-group" key={group.groupKey}>
            <span className="settings-sidebar-category">{t(group.groupKey)}</span>
            {group.items.map(({ key }) => (
              <button
                key={key}
                type="button"
                className={`nav-link ${activeTab === key ? "active" : ""}`.trim()}
                onClick={() => setTab(key)}
                role="tab"
                aria-selected={activeTab === key}
              >
                {tabTitleFor(key, t)}
              </button>
            ))}
          </div>
        ))}
      </nav>

      <div className="tab-content">
        <div className={`settings-tab-pane bg-transparent tab-pane active show${activeTab === "tabIntegrations" ? " integrations-settings-tab" : ""}`.trim()}>
          {renderActiveSettingsPane()}
        </div>
      </div>
    </div>
  );
}
