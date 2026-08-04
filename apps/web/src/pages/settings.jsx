import { Tabs, Tab } from "react-bootstrap";
import { useState } from "react";

import SettingsConfig from "./components/settings/settingsConfig";
import Tasks from "./components/settings/Tasks";
import SecuritySettings from "./components/settings/security";
import ApiKeys from "./components/settings/apiKeys";
import LibrarySelector from "./library_selector";
import ActivityMonitorSettings from "./components/settings/ActivityMonitorSettings";
import WebhooksSettings from "./components/settings/webhooks";
import Integrations from "./integrations";
import HealthSettings from "./components/settings/health";
import JellystatImport from "./components/settings/JellystatImport";
import TautulliImport from "./components/settings/TautulliImport";
import NewsletterSettings from "./components/settings/NewsletterSettings";
import NotificationSettings from "./components/settings/NotificationSettings";

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

function tabTitle(Icon, label) {
  return (
    <span className="settings-tab-title">
      <Icon size={16} />
      <span>{label}</span>
    </span>
  );
}

const settingsTabItems = [
  { key: "tabGeneral", Icon: Settings3LineIcon, label: <Trans i18nKey={"SETTINGS_PAGE.SETTINGS"} /> },
  { key: "tabSecurity", Icon: ShieldKeyholeLineIcon, label: <Trans i18nKey={"SETTINGS_PAGE.SECURITY"} /> },
  { key: "tabActivityMonitor", Icon: PulseLineIcon, label: <Trans i18nKey={"SETTINGS_PAGE.ACTIVITY_MONITOR"} defaults="Activity Monitor" /> },
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
  { key: "tabLogs", Icon: FileList3LineIcon, label: <Trans i18nKey={"SETTINGS_PAGE.LOGS"} /> },
];

const settingsTabs = settingsTabItems.map((item) => item.key);

export default function Settings() {
  const requestedTab = new URLSearchParams(window.location.search).get("tab");
  const savedTab = localStorage.getItem(`PREF_SETTINGS_LAST_SELECTED_TAB`) ?? "tabGeneral";
  const initialTab = settingsTabs.includes(requestedTab) ? requestedTab : savedTab;
  const [activeTab, setActiveTab] = useState(settingsTabs.includes(initialTab) ? initialTab : "tabGeneral");

  function setTab(tabName) {
    if (!settingsTabs.includes(tabName)) {
      tabName = "tabGeneral";
    }
    setActiveTab(tabName);
    localStorage.setItem(`PREF_SETTINGS_LAST_SELECTED_TAB`, tabName);
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
          <SettingsConfig />
        </Tab>

        <Tab
          eventKey="tabSecurity"
          className="settings-tab-pane bg-transparent"
          title={tabTitle(ShieldKeyholeLineIcon, settingsTabItems[1].label)}
        >
          <SecuritySettings />
        </Tab>

        <Tab
          eventKey="tabActivityMonitor"
          className="settings-tab-pane bg-transparent"
          title={tabTitle(PulseLineIcon, settingsTabItems[2].label)}
        >
          <ActivityMonitorSettings />
        </Tab>

        <Tab
          eventKey="tabTasks"
          className="settings-tab-pane bg-transparent"
          title={tabTitle(TaskLineIcon, settingsTabItems[3].label)}
        >
          <Tasks />
        </Tab>

        <Tab
          eventKey="tabLibraries"
          className="settings-tab-pane bg-transparent"
          title={tabTitle(GalleryLineIcon, settingsTabItems[4].label)}
        >
          <LibrarySelector />
        </Tab>

        <Tab
          eventKey="tabIntegrations"
          className="settings-tab-pane bg-transparent integrations-settings-tab"
          title={tabTitle(Plug2LineIcon, settingsTabItems[5].label)}
        >
          <Integrations embedded />
        </Tab>

        <Tab
          eventKey="tabKeys"
          className="settings-tab-pane bg-transparent"
          title={tabTitle(Key2LineIcon, settingsTabItems[6].label)}
        >
          <ApiKeys />
        </Tab>

        <Tab
          eventKey="tabWebhooks"
          className="settings-tab-pane bg-transparent"
          title={tabTitle(Notification3LineIcon, settingsTabItems[7].label)}
        >
          <ErrorBoundary>
            <WebhooksSettings />
          </ErrorBoundary>
        </Tab>

        <Tab
          eventKey="tabNotifications"
          className="settings-tab-pane bg-transparent"
          title={tabTitle(Notification3LineIcon, settingsTabItems[8].label)}
        >
          <NotificationSettings />
        </Tab>

        <Tab
          eventKey="tabBackup"
          className="settings-tab-pane bg-transparent"
          title={tabTitle(ArchiveLineIcon, settingsTabItems[9].label)}
        >
          <BackupPage />
        </Tab>

        <Tab
          eventKey="tabImports"
          className="settings-tab-pane bg-transparent"
          title={tabTitle(Database2LineIcon, settingsTabItems[10].label)}
        >
          <Tabs defaultActiveKey="jellystat" variant="pills" className="settings-import-tabs" transition={false} mountOnEnter>
            <Tab eventKey="jellystat" title="Jellystat" className="settings-import-pane">
              <ErrorBoundary>
                <JellystatImport />
              </ErrorBoundary>
            </Tab>
            <Tab eventKey="tautulli" title="Tautulli" className="settings-import-pane">
              <ErrorBoundary>
                <TautulliImport />
              </ErrorBoundary>
            </Tab>
          </Tabs>
        </Tab>

        <Tab
          eventKey="tabNewsletter"
          className="settings-tab-pane bg-transparent"
          title={tabTitle(MailSettingsLineIcon, settingsTabItems[11].label)}
        >
          <NewsletterSettings />
        </Tab>

        <Tab
          eventKey="tabHealth"
          className="settings-tab-pane bg-transparent"
          title={tabTitle(HeartPulseLineIcon, settingsTabItems[12].label)}
        >
          <HealthSettings />
        </Tab>

        <Tab
          eventKey="tabLogs"
          className="settings-tab-pane bg-transparent"
          title={tabTitle(FileList3LineIcon, settingsTabItems[13].label)}
        >
          <Logs />
        </Tab>
      </Tabs>
    </div>
  );
}
