import { Tabs, Tab } from "react-bootstrap";
import { useEffect, useState } from "react";

import SettingsConfig from "./components/settings/settingsConfig";
import Tasks from "./components/settings/Tasks";
import SecuritySettings from "./components/settings/security";
import ApiKeys from "./components/settings/apiKeys";
import LibrarySelector from "./library_selector";
import ActivityMonitorSettings from "./components/settings/ActivityMonitorSettings";
import WebhooksSettings from "./components/settings/webhooks";
import Integrations from "./integrations";
import RepairHub from "./repair-hub";
import HealthSettings from "./components/settings/health";
import JellystatImport from "./components/settings/JellystatImport";
import TautulliImport from "./components/settings/TautulliImport";
import NewsletterSettings from "./components/settings/NewsletterSettings";
import NotificationSettings from "./components/settings/NotificationSettings";
import JellyfinAdminSettings from "./components/settings/JellyfinAdminSettings";

import Logs from "./components/settings/logs";

import "./css/settings/settings.css";
import { Trans } from "react-i18next";
import BackupPage from "./components/settings/backup_page";
import ErrorBoundary from "./components/general/ErrorBoundary";
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

function tabTitle(Icon, label) {
  return (
    <span className="settings-tab-title">
      <Icon size={16} />
      <span>{label}</span>
    </span>
  );
}

function SettingsPane({ children }) {
  return <ErrorBoundary>{children}</ErrorBoundary>;
}

const settingsTabItems = [
  { key: "tabGeneral", Icon: Settings3LineIcon, label: <Trans i18nKey={"SETTINGS_PAGE.SETTINGS"} /> },
  { key: "tabSecurity", Icon: ShieldKeyholeLineIcon, label: <Trans i18nKey={"SETTINGS_PAGE.SECURITY"} /> },
  { key: "tabActivityMonitor", Icon: PulseLineIcon, label: <Trans i18nKey={"SETTINGS_PAGE.ACTIVITY_MONITOR"} defaults="Activity Monitor" /> },
  { key: "tabJellyfinDevices", Icon: DeviceLineIcon, label: "Authorised Devices" },
  { key: "tabJellyfinPlugins", Icon: AppsLineIcon, label: "Plugins" },
  { key: "tabTasks", Icon: TaskLineIcon, label: <Trans i18nKey={"SETTINGS_PAGE.TASKS"} /> },
  { key: "tabLibraries", Icon: GalleryLineIcon, label: <Trans i18nKey={"SETTINGS_PAGE.LIBRARY_SETTINGS"} /> },
  { key: "tabIntegrations", Icon: Plug2LineIcon, label: "Integrations" },
  { key: "tabKeys", Icon: Key2LineIcon, label: <Trans i18nKey={"SETTINGS_PAGE.API_KEY"} /> },
  { key: "tabWebhooks", Icon: Notification3LineIcon, label: <Trans i18nKey={"SETTINGS_PAGE.WEBHOOKS"} /> },
  { key: "tabNotifications", Icon: Notification3LineIcon, label: "Notifications" },
  { key: "tabBackup", Icon: ArchiveLineIcon, label: <Trans i18nKey={"SETTINGS_PAGE.BACKUP"} /> },
  { key: "tabImports", Icon: Database2LineIcon, label: "Imports" },
  { key: "tabNewsletter", Icon: MailSettingsLineIcon, label: "Newsletter" },
  { key: "tabHealth", Icon: HeartPulseLineIcon, label: "Health" },
  { key: "tabRepair", Icon: ToolsLineIcon, label: "Repair" },
  { key: "tabLogs", Icon: FileList3LineIcon, label: <Trans i18nKey={"SETTINGS_PAGE.LOGS"} /> },
];

const settingsTabs = settingsTabItems.map((item) => item.key);
const settingsTabHashes = {
  tabGeneral: "general",
  tabSecurity: "security",
  tabActivityMonitor: "activity-monitor",
  tabJellyfinDevices: "devices",
  tabJellyfinPlugins: "plugins",
  tabTasks: "tasks",
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
const settingsHashAliases = {
  api: "tabKeys",
  apikey: "tabKeys",
  apiKey: "tabKeys",
  apikeys: "tabKeys",
  apiKeys: "tabKeys",
  keys: "tabKeys",
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
};
const settingsHashToTab = {
  ...Object.fromEntries(Object.entries(settingsTabHashes).map(([key, hash]) => [hash, key])),
  ...settingsHashAliases,
};

function normalizeSettingsHash(hash = "") {
  return String(hash).replace(/^#/, "").trim().toLowerCase();
}

function getTabFromHash() {
  return settingsHashToTab[normalizeSettingsHash(window.location.hash)] || "";
}

function getSettingsInitialTab() {
  const hashTab = getTabFromHash();
  if (settingsTabs.includes(hashTab)) return hashTab;

  const requestedTab = new URLSearchParams(window.location.search).get("tab");
  if (settingsTabs.includes(requestedTab)) return requestedTab;

  const savedTab = localStorage.getItem(`PREF_SETTINGS_LAST_SELECTED_TAB`) ?? "tabGeneral";
  return settingsTabs.includes(savedTab) ? savedTab : "tabGeneral";
}

function setSettingsHash(tabName, mode = "replace") {
  const nextHash = settingsTabHashes[tabName] || settingsTabHashes.tabGeneral;
  const nextUrl = `${window.location.pathname}${window.location.search}#${nextHash}`;
  if (window.location.hash === `#${nextHash}`) return;
  window.history[mode === "push" ? "pushState" : "replaceState"](null, "", nextUrl);
}

export default function Settings() {
  const [activeTab, setActiveTab] = useState(getSettingsInitialTab);

  useEffect(() => {
    setSettingsHash(activeTab);
  }, []);

  useEffect(() => {
    function handleHashChange() {
      const hashTab = getTabFromHash();
      if (settingsTabs.includes(hashTab)) {
        setActiveTab(hashTab);
        localStorage.setItem(`PREF_SETTINGS_LAST_SELECTED_TAB`, hashTab);
      }
    }

    window.addEventListener("hashchange", handleHashChange);
    return () => window.removeEventListener("hashchange", handleHashChange);
  }, []);

  function setTab(tabName, updateMode = "push") {
    if (!settingsTabs.includes(tabName)) {
      tabName = "tabGeneral";
    }
    setActiveTab(tabName);
    localStorage.setItem(`PREF_SETTINGS_LAST_SELECTED_TAB`, tabName);
    setSettingsHash(tabName, updateMode);
  }

  return (
    <div className="settings has-mobile-settings-menu">
      <div className="settings-page-header">
        <div>
          <p className="settings-eyebrow">Control center</p>
          <h1>
            <Trans i18nKey={"SETTINGS_PAGE.SETTINGS"} />
          </h1>
          <p>Configure JellyGlance sync, security, libraries, keys, backups, and logs.</p>
        </div>
      </div>

      <div className="settings-mobile-menu">
        <div className="settings-mobile-menu-list" role="tablist" aria-label="Settings sections">
          {settingsTabItems.map(({ key, Icon, label }) => (
            <button
              key={key}
              type="button"
              className={activeTab === key ? "is-active" : ""}
              onClick={() => setTab(key)}
              role="tab"
              aria-selected={activeTab === key}
            >
              {tabTitle(Icon, label)}
            </button>
          ))}
        </div>
      </div>

      <Tabs
        defaultActiveKey={activeTab}
        activeKey={activeTab}
        onSelect={setTab}
        variant="pills"
        transition={false}
        mountOnEnter
        unmountOnExit
      >
        <Tab
          eventKey="tabGeneral"
          className="settings-tab-pane bg-transparent"
          title={tabTitle(Settings3LineIcon, settingsTabItems[0].label)}
        >
          <SettingsPane>
            <SettingsConfig />
          </SettingsPane>
        </Tab>

        <Tab
          eventKey="tabSecurity"
          className="settings-tab-pane bg-transparent"
          title={tabTitle(ShieldKeyholeLineIcon, settingsTabItems[1].label)}
        >
          <SettingsPane>
            <SecuritySettings />
          </SettingsPane>
        </Tab>

        <Tab
          eventKey="tabActivityMonitor"
          className="settings-tab-pane bg-transparent"
          title={tabTitle(PulseLineIcon, settingsTabItems[2].label)}
        >
          <SettingsPane>
            <ActivityMonitorSettings />
          </SettingsPane>
        </Tab>

        <Tab
          eventKey="tabJellyfinDevices"
          className="settings-tab-pane bg-transparent"
          title={tabTitle(DeviceLineIcon, settingsTabItems[3].label)}
        >
          <SettingsPane>
            <JellyfinAdminSettings view="devices" />
          </SettingsPane>
        </Tab>

        <Tab
          eventKey="tabJellyfinPlugins"
          className="settings-tab-pane bg-transparent"
          title={tabTitle(AppsLineIcon, settingsTabItems[4].label)}
        >
          <SettingsPane>
            <JellyfinAdminSettings view="plugins" />
          </SettingsPane>
        </Tab>

        <Tab
          eventKey="tabTasks"
          className="settings-tab-pane bg-transparent"
          title={tabTitle(TaskLineIcon, settingsTabItems[5].label)}
        >
          <SettingsPane>
            <Tasks />
          </SettingsPane>
        </Tab>

        <Tab
          eventKey="tabLibraries"
          className="settings-tab-pane bg-transparent"
          title={tabTitle(GalleryLineIcon, settingsTabItems[6].label)}
        >
          <SettingsPane>
            <LibrarySelector />
          </SettingsPane>
        </Tab>

        <Tab
          eventKey="tabIntegrations"
          className="settings-tab-pane bg-transparent integrations-settings-tab"
          title={tabTitle(Plug2LineIcon, settingsTabItems[7].label)}
        >
          <SettingsPane>
            <Integrations embedded />
          </SettingsPane>
        </Tab>

        <Tab
          eventKey="tabKeys"
          className="settings-tab-pane bg-transparent"
          title={tabTitle(Key2LineIcon, settingsTabItems[8].label)}
        >
          <SettingsPane>
            <ApiKeys />
          </SettingsPane>
        </Tab>

        <Tab
          eventKey="tabWebhooks"
          className="settings-tab-pane bg-transparent"
          title={tabTitle(Notification3LineIcon, settingsTabItems[9].label)}
        >
          <SettingsPane>
            <WebhooksSettings />
          </SettingsPane>
        </Tab>

        <Tab
          eventKey="tabNotifications"
          className="settings-tab-pane bg-transparent"
          title={tabTitle(Notification3LineIcon, settingsTabItems[10].label)}
        >
          <SettingsPane>
            <NotificationSettings />
          </SettingsPane>
        </Tab>

        <Tab
          eventKey="tabBackup"
          className="settings-tab-pane bg-transparent"
          title={tabTitle(ArchiveLineIcon, settingsTabItems[11].label)}
        >
          <SettingsPane>
            <BackupPage />
          </SettingsPane>
        </Tab>

        <Tab
          eventKey="tabImports"
          className="settings-tab-pane bg-transparent"
          title={tabTitle(Database2LineIcon, settingsTabItems[12].label)}
        >
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
        </Tab>

        <Tab
          eventKey="tabNewsletter"
          className="settings-tab-pane bg-transparent"
          title={tabTitle(MailSettingsLineIcon, settingsTabItems[13].label)}
        >
          <SettingsPane>
            <NewsletterSettings />
          </SettingsPane>
        </Tab>

        <Tab
          eventKey="tabHealth"
          className="settings-tab-pane bg-transparent"
          title={tabTitle(HeartPulseLineIcon, settingsTabItems[14].label)}
        >
          <SettingsPane>
            <HealthSettings />
          </SettingsPane>
        </Tab>

        <Tab
          eventKey="tabRepair"
          className="settings-tab-pane bg-transparent"
          title={tabTitle(ToolsLineIcon, settingsTabItems[15].label)}
        >
          <SettingsPane>
            <RepairHub embedded />
          </SettingsPane>
        </Tab>

        <Tab
          eventKey="tabLogs"
          className="settings-tab-pane bg-transparent"
          title={tabTitle(FileList3LineIcon, settingsTabItems[16].label)}
        >
          <SettingsPane>
            <Logs />
          </SettingsPane>
        </Tab>
      </Tabs>
    </div>
  );
}
