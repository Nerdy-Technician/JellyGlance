// import logo from './logo.svg';
import "./App.css";
import React, { useState, useEffect } from "react";
import { Routes, Route } from "react-router-dom";
import axios from "./lib/axios_instance";

import socket from "./socket";
import { ToastContainer, toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

import Config from "./lib/config";
import { INTEGRATIONS_STORAGE_KEY } from "./lib/integrations-storage";
import { prewarmActiveSessions } from "./lib/session-cache";
import { DEFAULT_THEME, applyTheme } from "./lib/theme";
import { getStoredNotificationSettings, normalizeNotificationSettings, storeNotificationSettings } from "./lib/notification-settings";

import Loading from "./pages/components/general/loading";

import Signup from "./pages/signup";
import Setup from "./pages/setup";
import FirstRunExtras from "./pages/first-run-extras";
import Login from "./pages/login";

import Navbar from "./pages/components/general/navbar";
import ErrorPage from "./pages/components/general/error";
import WhatsNewModal from "./pages/components/general/WhatsNewModal";
import routes from "./routes";
import { FIRST_RUN_EXTRAS_KEY } from "./lib/first-run";

function notificationKind(message) {
  const type = String(message?.type || "").toLowerCase();
  if (type === "error") return "error";
  if (type === "warning" || type === "warn") return "warning";
  if (type === "success") return "success";
  return "info";
}

function isManualTaskNotification(message) {
  const triggerType = String(message?.triggerType || message?.triggertype || "").toLowerCase();
  const text = String(message?.message || message || "");
  return message?.manual === true || triggerType === "manual" || /^manual\b/i.test(text);
}

function shouldShowNotification(message, settings) {
  if (settings.manualTaskToasts && isManualTaskNotification(message)) return true;
  const kind = notificationKind(message);
  if (settings.mode === "all") return true;
  if (settings.mode === "important") return kind === "warning" || kind === "error";
  if (settings.mode === "errors") return kind === "error";
  return false;
}

function toastOptions(settings, autoCloseOverride) {
  return {
    autoClose: autoCloseOverride || settings.durationSeconds * 1000,
  };
}

function isLibrarySyncProgress(message) {
  const type = String(message?.type || "").toLowerCase();
  const text = String(message?.message || message || "");
  return (type === "start" || type === "update") && /\b(?:syncing|fetching) (?:data for )?library\b/i.test(text);
}

function taskToastId(task) {
  return `jellyglance-task-toast:${task}`;
}

const recentTaskNotifications = new Map();
const TASK_NOTIFICATION_DEDUPE_MS = 30000;

function isDuplicateTaskNotification(task, message) {
  const key = [
    task,
    message?.type || "Info",
    message?.triggerType || message?.triggertype || "",
    message?.message || message || "",
  ].join(":");
  const now = Date.now();
  const lastSeen = recentTaskNotifications.get(key) || 0;

  recentTaskNotifications.set(key, now);
  recentTaskNotifications.forEach((timestamp, notificationKey) => {
    if (now - timestamp > TASK_NOTIFICATION_DEDUPE_MS) {
      recentTaskNotifications.delete(notificationKey);
    }
  });

  return now - lastSeen < TASK_NOTIFICATION_DEDUPE_MS;
}

function App() {
  const [setupState, setSetupState] = useState(0);
  const [config, setConfig] = useState(null);
  const [loading, setLoading] = useState(true);
  const [errorFlag, seterrorFlag] = useState(false);
  const [notificationSettings, setNotificationSettings] = useState(getStoredNotificationSettings);
  const token = localStorage.getItem("token");
  const shouldShowFirstRunExtras =
    setupState === 2 &&
    token !== undefined &&
    token !== null &&
    config?.settings?.firstRunExtrasCompleted !== true &&
    (localStorage.getItem(FIRST_RUN_EXTRAS_KEY) === "true" || config?.settings?.firstRunExtrasPending === true);
  const kioskMode = window.location.pathname === "/home/kiosk";

  const wsListeners = [
    { task: "PlaybackSyncTask", ref: React.useRef(null) },
    { task: "PartialSyncTask", ref: React.useRef(null) },
    { task: "FullSyncTask", ref: React.useRef(null) },
    { task: "BackupTask", ref: React.useRef(null) },
    { task: "TaskError", ref: React.useRef(null) },
    { task: "GeneralAlert", ref: React.useRef(null) },
  ];

  useEffect(() => {
    wsListeners.forEach((listener) => {
      socket.on(listener.task, (message) => {
        if (!shouldShowNotification(message, notificationSettings)) {
          return;
        }
        if (isDuplicateTaskNotification(listener.task, message)) {
          return;
        }
        const toastId = taskToastId(listener.task);
        const options = {
          ...toastOptions(notificationSettings, message?.type === "Start" || message?.type === "Update" ? 15000 : undefined),
          hideProgressBar: isLibrarySyncProgress(message),
        };
        const onCloseOptions = {
          ...options,
          toastId,
          onClose: () => {
            if (listener.ref.current === toastId) {
              listener.ref.current = null;
            }
          },
        };
        if (!listener.ref.current && toast.isActive(toastId)) {
          listener.ref.current = toastId;
        }
        if (message && message.type === "Start") {
          listener.ref.current = toast.info(message?.message || message, {
            ...onCloseOptions,
          });
        } else if (message && message.type === "Success" && !listener.ref.current) {
          listener.ref.current = toast.success(message?.message || message, {
            ...onCloseOptions,
          });
        } else if (message && message.type === "Error" && !listener.ref.current) {
          listener.ref.current = toast.error(message?.message || message, {
            ...onCloseOptions,
          });
        } else if (message && message.type === "Update" && !listener.ref.current) {
          listener.ref.current = toast.info(message?.message || message, {
            ...onCloseOptions,
          });
        } else if (message && message.type === "Update") {
          toast.update(toastId, {
            render: message?.message || message,
            type: toast.TYPE.INFO,
            ...options,
          });
        } else if (message && message.type === "Error") {
          toast.update(toastId, {
            render: message?.message || message,
            type: toast.TYPE.ERROR,
            ...toastOptions(notificationSettings),
          });
        } else if (message && message.type === "Success") {
          toast.update(toastId, {
            render: message?.message || message,
            type: toast.TYPE.SUCCESS,
            ...toastOptions(notificationSettings),
          });
        }
      });
    });

    return () => {
      wsListeners.forEach((listener) => {
        socket.off(listener.task);
      });
    };
  }, [notificationSettings]);

  useEffect(() => {
    function handleNotificationSettings(event) {
      setNotificationSettings(normalizeNotificationSettings(event.detail));
    }

    window.addEventListener("jellyglance-notification-settings-updated", handleNotificationSettings);
    return () => {
      window.removeEventListener("jellyglance-notification-settings-updated", handleNotificationSettings);
    };
  }, []);

  useEffect(() => {
    const fetchConfig = async () => {
      try {
        const newConfig = await Config.getConfig(true);
        if (!newConfig.response) {
          setConfig(newConfig);
        } else {
          if (newConfig.response.status === 403 || newConfig.response.status === 401) {
            const savedIntegrations = localStorage.getItem(INTEGRATIONS_STORAGE_KEY);
            const firstRunExtras = localStorage.getItem(FIRST_RUN_EXTRAS_KEY);
            localStorage.clear();
            if (savedIntegrations) {
              localStorage.setItem(INTEGRATIONS_STORAGE_KEY, savedIntegrations);
            }
            if (firstRunExtras) {
              localStorage.setItem(FIRST_RUN_EXTRAS_KEY, firstRunExtras);
            }
            window.location.reload();
          } else if (newConfig.response.status !== 403) {
            seterrorFlag(true);
          }
        }
        setLoading(false);
        if (!newConfig.response) {
          setNotificationSettings(storeNotificationSettings(newConfig.settings?.notifications));
        }
      } catch (error) {
        console.log(error);
      }
    };

    if (setupState === 0) {
      setLoading(false);
      axios
        .get("/auth/isConfigured")
        .then(async (response) => {
          if (response.status === 200) {
            setSetupState(response.data.state);
          }
        })
        .catch((error) => {
          console.log(error);
          seterrorFlag(true);
        });
    }

    if (!config && setupState === 2 && token !== undefined && token !== null) {
      fetchConfig();
    }
  }, [config, setupState, token]);

  useEffect(() => {
    if (setupState === 2 && token !== undefined && token !== null) {
      prewarmActiveSessions(token);
    }
  }, [setupState, token]);

  useEffect(() => {
    if (setupState < 2 || shouldShowFirstRunExtras) {
      applyTheme(DEFAULT_THEME);
    }
  }, [setupState, shouldShowFirstRunExtras]);

  useEffect(() => {
    const handleAuthExpired = () => {
      setConfig(null);
    };

    window.addEventListener("jellyglance-auth-expired", handleAuthExpired);
    return () => window.removeEventListener("jellyglance-auth-expired", handleAuthExpired);
  }, []);

  if (loading) {
    return <Loading />;
  }

  if (errorFlag) {
    return <ErrorPage message={"Error: Unable to connect to JellyGlance Backend"} />;
  }

  if (!config && setupState === 2 && (token === undefined || token === null)) {
    return <Login />;
  }

  if (setupState === 0) {
    return <Setup />;
  }
  if (setupState === 1) {
    return <Signup />;
  }

  if (config && shouldShowFirstRunExtras) {
    return <FirstRunExtras />;
  }

  if (config && setupState === 2 && token !== null) {
    return (
      <div className="App">
        <div className="d-flex flex-column flex-md-row">
          {kioskMode ? null : <Navbar />}
          <main className="app-shell-main w-md-100">
            <Routes>
              {routes.map((route, index) => (
                <Route key={index} path={route.path} element={route.element} />
              ))}
            </Routes>
          </main>
        </div>
        <ToastContainer
          theme="dark"
          position={notificationSettings.position}
          limit={5}
          pauseOnFocusLoss={false}
          hideProgressBar={false}
          className="jellyglance-toast-container"
          toastClassName="jellyglance-toast"
          bodyClassName="jellyglance-toast-body"
          progressClassName="jellyglance-toast-progress"
        />
        <WhatsNewModal enabled={!kioskMode} />
      </div>
    );
  }
}

export default App;
