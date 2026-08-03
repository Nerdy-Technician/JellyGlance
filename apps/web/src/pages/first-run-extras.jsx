import { useState } from "react";
import Button from "react-bootstrap/Button";
import Plug2LineIcon from "remixicon-react/Plug2LineIcon";
import Database2LineIcon from "remixicon-react/Database2LineIcon";
import RefreshLineIcon from "remixicon-react/RefreshLineIcon";
import axios from "../lib/axios_instance";
import Config from "../lib/config";
import baseUrl from "../lib/baseurl";
import { FIRST_RUN_EXTRAS_KEY } from "../lib/first-run";
import Integrations from "./integrations";
import JellystatImport from "./components/settings/JellystatImport";
import TautulliImport from "./components/settings/TautulliImport";
import SetupShell from "./components/setup/SetupShell";
import "./css/settings/settings.css";

export default function FirstRunExtras() {
  const [activePanel, setActivePanel] = useState("integrations");
  const [activeImportSource, setActiveImportSource] = useState("jellystat");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  const currentStep = activePanel === "integrations" ? 3 : activePanel === "imports" ? 4 : 5;

  async function startFirstSync() {
    try {
      setBusy(true);
      setMessage("");
      await axios.post(
        "/api/first-run/start-sync",
        {},
        {
          headers: {
            Authorization: `Bearer ${localStorage.getItem("token")}`,
            "Content-Type": "application/json",
          },
        }
      );
      localStorage.removeItem(FIRST_RUN_EXTRAS_KEY);
      localStorage.removeItem("config");
      await Config.setConfig();
      window.location.assign(`${baseUrl || ""}/`);
    } catch (error) {
      setMessage(error.response?.data?.error || "Unable to start the first sync.");
      setBusy(false);
    }
  }

  function goNext() {
    if (activePanel === "integrations") {
      setActivePanel("imports");
      return;
    }

    if (activePanel === "imports") {
      setActivePanel("sync");
      return;
    }

    startFirstSync();
  }

  function goBack() {
    if (activePanel === "imports") {
      setActivePanel("integrations");
      return;
    }

    if (activePanel === "sync") {
      setActivePanel("imports");
    }
  }

  return (
    <SetupShell
      step={currentStep}
      eyebrow={activePanel === "integrations" ? "Media stack" : activePanel === "imports" ? "Legacy history" : "Build dashboard"}
      title={
        activePanel === "integrations"
          ? "Configure integrations"
          : activePanel === "imports"
            ? "Import old watch history"
            : "Start the first sync"
      }
      description={
        activePanel === "integrations"
          ? "Add Arr apps, Seerr request services, and download clients before JellyGlance builds its first dashboard cache."
          : activePanel === "imports"
            ? "Import Jellystat or Tautulli history and match legacy users before the initial Jellyfin sync fills the rest of the dashboard."
            : "JellyGlance will run the first full Jellyfin sync, recently added sync, Playback Reporting import, and dashboard stat refresh."
      }
    >
      <div className="setup-extras">
        <nav className="setup-extra-tabs" aria-label="First-run setup areas">
          <button type="button" className={activePanel === "integrations" ? "is-active" : ""} onClick={() => setActivePanel("integrations")}>
            <Plug2LineIcon size={18} />
            Integrations
          </button>
          <button type="button" className={activePanel === "imports" ? "is-active" : ""} onClick={() => setActivePanel("imports")}>
            <Database2LineIcon size={18} />
            History Import
          </button>
          <button type="button" className={activePanel === "sync" ? "is-active" : ""} onClick={() => setActivePanel("sync")}>
            <RefreshLineIcon size={18} />
            First Sync
          </button>
        </nav>

        {message ? <div className="setup-connection-status is-error">{message}</div> : null}

        <div className="setup-extra-panel">
          {activePanel === "integrations" ? <Integrations embedded firstRun /> : null}
          {activePanel === "imports" ? (
            <>
              <div className="setup-import-note">
                <strong>Import Jellystat or Tautulli history before the first sync.</strong>
                <span>Choose the backup source, import watch history, then match any legacy users to Jellyfin profiles.</span>
              </div>
              <div className="setup-import-source-tabs" role="tablist" aria-label="History import source">
                <button
                  type="button"
                  className={activeImportSource === "jellystat" ? "is-active" : ""}
                  onClick={() => setActiveImportSource("jellystat")}
                >
                  Jellystat
                </button>
                <button
                  type="button"
                  className={activeImportSource === "tautulli" ? "is-active" : ""}
                  onClick={() => setActiveImportSource("tautulli")}
                >
                  Tautulli
                </button>
              </div>
              {activeImportSource === "jellystat" ? <JellystatImport /> : <TautulliImport />}
            </>
          ) : null}
          {activePanel === "sync" ? (
            <section className="setup-sync-panel">
              <RefreshLineIcon />
              <div>
                <h3>Ready to build JellyGlance</h3>
                <p>
                  The first sync starts only after this step. You can still skip integrations or imports, then configure them later
                  from Settings.
                </p>
                <ul>
                  <li>Complete Jellyfin library and user sync</li>
                  <li>Recently added media sync</li>
                  <li>Playback Reporting Plugin import when available</li>
                  <li>Dashboard statistics refresh</li>
                </ul>
              </div>
            </section>
          ) : null}
        </div>

        <div className="setup-button-row setup-extra-actions">
          {activePanel !== "integrations" ? (
            <Button type="button" className="setup-secondary-button" onClick={goBack} disabled={busy}>
              Back
            </Button>
          ) : null}
          <Button type="button" className="setup-secondary-button" onClick={() => setActivePanel("sync")} disabled={busy}>
            Skip to sync
          </Button>
          <Button type="button" className="setup-button" onClick={goNext} disabled={busy}>
            {busy ? "Starting sync..." : activePanel === "sync" ? "Start first sync" : "Continue"}
          </Button>
        </div>
      </div>
    </SetupShell>
  );
}
