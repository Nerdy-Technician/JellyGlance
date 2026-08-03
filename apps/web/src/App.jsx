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

function App() {
  const [setupState, setSetupState] = useState(0);
  const [config, setConfig] = useState(null);
  const [loading, setLoading] = useState(true);
  const [errorFlag, seterrorFlag] = useState(false);
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
        if (message && message.type === "Start") {
          listener.ref.current = toast.info(message?.message || message, {
            autoClose: 15000,
          });
        } else if (message && message.type === "Success" && !listener.ref.current) {
          listener.ref.current = toast.success(message?.message || message, {
            autoClose: 15000,
          });
        } else if (message && message.type === "Error" && !listener.ref.current) {
          listener.ref.current = toast.error(message?.message || message, {
            autoClose: 15000,
          });
        } else if (message && message.type === "Update" && !listener.ref.current) {
          listener.ref.current = toast.info(message?.message || message, {
            autoClose: 15000,
          });
        } else if (message && message.type === "Update") {
          toast.update(listener.ref.current, {
            render: message?.message || message,
            type: toast.TYPE.INFO,
            autoClose: 15000,
          });
        } else if (message && message.type === "Error") {
          toast.update(listener.ref.current, {
            render: message?.message || message,
            type: toast.TYPE.ERROR,
            autoClose: 5000,
          });
        } else if (message && message.type === "Success") {
          toast.update(listener.ref.current, {
            render: message?.message || message,
            type: toast.TYPE.SUCCESS,
            autoClose: 5000,
          });
        }
      });
    });

    return () => {
      wsListeners.forEach((listener) => {
        socket.off(listener.task);
      });
    };
  });

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
          position="bottom-right"
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
