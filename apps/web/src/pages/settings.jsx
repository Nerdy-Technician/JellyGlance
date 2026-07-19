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

const settingsTabs = [
  "tabGeneral",
  "tabSecurity",
  "tabActivityMonitor",
  "tabTasks",
  "tabLibraries",
  "tabIntegrations",
  "tabKeys",
  "tabWebhooks",
  "tabBackup",
  "tabLogs",
];

function tabTitle(Icon, label) {
  return (
    <span className="settings-tab-title">
      <Icon size={16} />
      <span>{label}</span>
    </span>
  );
}

export default function Settings() {
  const savedTab = localStorage.getItem(`PREF_SETTINGS_LAST_SELECTED_TAB`) ?? "tabGeneral";
  const [activeTab, setActiveTab] = useState(settingsTabs.includes(savedTab) ? savedTab : "tabGeneral");

  function setTab(tabName) {
    if (!settingsTabs.includes(tabName)) {
      tabName = "tabGeneral";
    }
    setActiveTab(tabName);
    localStorage.setItem(`PREF_SETTINGS_LAST_SELECTED_TAB`, tabName);
  }

  return (
    <div className="settings">
      <div className="settings-page-header">
        <div>
          <p className="settings-eyebrow">Control center</p>
          <h1>
            <Trans i18nKey={"SETTINGS_PAGE.SETTINGS"} />
          </h1>
          <p>Configure JellyGlance sync, security, libraries, keys, backups, and logs.</p>
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
          title={tabTitle(Settings3LineIcon, <Trans i18nKey={"SETTINGS_PAGE.SETTINGS"} />)}
        >
          <SettingsConfig />
        </Tab>

        <Tab
          eventKey="tabSecurity"
          className="settings-tab-pane bg-transparent"
          title={tabTitle(ShieldKeyholeLineIcon, <Trans i18nKey={"SETTINGS_PAGE.SECURITY"} />)}
        >
          <SecuritySettings />
        </Tab>

        <Tab
          eventKey="tabActivityMonitor"
          className="settings-tab-pane bg-transparent"
          title={tabTitle(PulseLineIcon, <Trans i18nKey={"SETTINGS_PAGE.ACTIVITY_MONITOR"} defaults="Activity Monitor" />)}
        >
          <ActivityMonitorSettings />
        </Tab>

        <Tab
          eventKey="tabTasks"
          className="settings-tab-pane bg-transparent"
          title={tabTitle(TaskLineIcon, <Trans i18nKey={"SETTINGS_PAGE.TASKS"} />)}
        >
          <Tasks />
        </Tab>

        <Tab
          eventKey="tabLibraries"
          className="settings-tab-pane bg-transparent"
          title={tabTitle(GalleryLineIcon, <Trans i18nKey={"SETTINGS_PAGE.LIBRARY_SETTINGS"} />)}
        >
          <LibrarySelector />
        </Tab>

        <Tab
          eventKey="tabIntegrations"
          className="settings-tab-pane bg-transparent integrations-settings-tab"
          title={tabTitle(Plug2LineIcon, "Integrations")}
        >
          <Integrations embedded />
        </Tab>

        <Tab
          eventKey="tabKeys"
          className="settings-tab-pane bg-transparent"
          title={tabTitle(Key2LineIcon, <Trans i18nKey={"SETTINGS_PAGE.API_KEY"} />)}
        >
          <ApiKeys />
        </Tab>

        <Tab
          eventKey="tabWebhooks"
          className="settings-tab-pane bg-transparent"
          title={tabTitle(Notification3LineIcon, <Trans i18nKey={"SETTINGS_PAGE.WEBHOOKS"} />)}
        >
          <ErrorBoundary>
            <WebhooksSettings />
          </ErrorBoundary>
        </Tab>

        <Tab
          eventKey="tabBackup"
          className="settings-tab-pane bg-transparent"
          title={tabTitle(ArchiveLineIcon, <Trans i18nKey={"SETTINGS_PAGE.BACKUP"} />)}
        >
          <BackupPage />
        </Tab>

        <Tab
          eventKey="tabLogs"
          className="settings-tab-pane bg-transparent"
          title={tabTitle(FileList3LineIcon, <Trans i18nKey={"SETTINGS_PAGE.LOGS"} />)}
        >
          <Logs />
        </Tab>
      </Tabs>
    </div>
  );
}
