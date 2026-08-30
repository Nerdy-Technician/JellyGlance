import { useRef, useState } from "react";
import axios from "../lib/axios_instance";
import baseUrl from "../lib/baseurl";
import { clearApiCache } from "../lib/api-cache";
import Form from "react-bootstrap/Form";
import Button from "react-bootstrap/Button";
import { InputGroup } from "react-bootstrap";

import EyeFillIcon from "remixicon-react/EyeFillIcon";
import EyeOffFillIcon from "remixicon-react/EyeOffFillIcon";
import UploadCloud2LineIcon from "remixicon-react/UploadCloud2LineIcon";
import Database2LineIcon from "remixicon-react/Database2LineIcon";
import jellyfinLogo from "./images/jellyfin.svg";

import "./css/setup.css";
import i18next from "i18next";
import { Trans } from "react-i18next";
import SetupShell from "./components/setup/SetupShell";

const RESTORE_WAIT_TIMEOUT_MS = 60 * 60 * 1000;

function waitForFirstRunRestoreComplete() {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      cleanup();
      reject(new Error("Restore is taking longer than expected. Refresh the page to check whether setup finished."));
    }, RESTORE_WAIT_TIMEOUT_MS);

    const poll = setInterval(async () => {
      try {
        const [statusResponse, configResponse] = await Promise.all([
          axios.get("/backup/first-run/restore/status"),
          axios.get("/auth/isConfigured"),
        ]);

        const restoreStatus = statusResponse.data || {};
        const configuredState = Number(configResponse.data?.state ?? 0);

        if (restoreStatus.status === "complete") {
          cleanup();
          resolve({
            setupState: Number(restoreStatus.setupState ?? configuredState ?? 0),
            restoredRows: Number(restoreStatus.restoredRows || 0),
          });
          return;
        }

        if (restoreStatus.status === "failed") {
          cleanup();
          reject(new Error(restoreStatus.error || "Restore failed"));
          return;
        }

        if (configuredState >= 2) {
          cleanup();
          resolve({ setupState: configuredState, restoredRows: Number(restoreStatus.restoredRows || 0) });
        }
      } catch {
        // Ignore transient polling errors while restore runs.
      }
    }, 2000);

    function cleanup() {
      clearTimeout(timeout);
      clearInterval(poll);
    }
  });
}

function Setup() {
  const [formValues, setFormValues] = useState({});
  const [processing, setProcessing] = useState(false);
  const [submitButtonText, setsubmitButtonText] = useState(i18next.t("SAVE_JELLYFIN_DETAILS"));
  const [showPassword, setShowPassword] = useState(false);
  const [connectionTest, setConnectionTest] = useState({ status: "idle", message: "" });
  const [restoreStatus, setRestoreStatus] = useState({ status: "idle", message: "" });
  const [restoreProgress, setRestoreProgress] = useState(0);
  const [restorePhase, setRestorePhase] = useState("idle");
  const fileInputRef = useRef(null);

  function redirectToAppRoot() {
    const rootPath = baseUrl ? `${baseUrl}/` : "/";
    window.location.replace(rootPath);
  }

  function clearStoredAuth() {
    localStorage.removeItem("token");
    localStorage.removeItem("config");
    clearApiCache();
  }

  function finishRestoreFlow({ setupState, restoredRows }) {
    setRestorePhase("complete");

    if (setupState >= 2) {
      setRestoreStatus({
        status: "success",
        message: `Restored ${restoredRows.toLocaleString()} rows. Opening login...`,
      });
      clearStoredAuth();
      setTimeout(redirectToAppRoot, 700);
      return;
    }

    if (setupState === 1) {
      setRestoreStatus({
        status: "success",
        message: `Restored ${restoredRows.toLocaleString()} rows. Continue with admin access setup...`,
      });
      clearStoredAuth();
      setTimeout(redirectToAppRoot, 700);
      return;
    }

    setRestoreStatus({
      status: "success",
      message: `Restored ${restoredRows.toLocaleString()} rows. Connect Jellyfin to finish setup.`,
    });
    setProcessing(false);
    setRestorePhase("idle");
    setRestoreProgress(0);
  }

  function handleFormChange(event) {
    setFormValues({ ...formValues, [event.target.name]: event.target.value });
    setConnectionTest({ status: "idle", message: "" });
    setsubmitButtonText(i18next.t("SAVE_JELLYFIN_DETAILS"));
  }

  async function testConnection() {
    setProcessing(true);
    setConnectionTest({ status: "testing", message: "Testing Jellyfin connection..." });

    try {
      const response = await axios.post("/auth/test-jellyfin", formValues, {
        headers: {
          "Content-Type": "application/json",
        },
      });

      setFormValues((current) => ({
        ...current,
        JF_HOST: response.data.cleanedUrl || current.JF_HOST,
      }));
      setConnectionTest({
        status: "success",
        testedHost: response.data.cleanedUrl || formValues.JF_HOST,
        testedKey: formValues.JF_API_KEY,
        message: `Connected to ${response.data.cleanedUrl || formValues.JF_HOST}`,
      });
      setsubmitButtonText("Save Jellyfin Details");
    } catch (error) {
      const errorMessage =
        error.response?.data?.errorMessage ||
        error.response?.data ||
        (error.code === "ERR_NETWORK" ? i18next.t("ERROR_MESSAGES.NETWORK_ERROR") : `Error : ${error.response?.status || "Unknown"}`);
      setConnectionTest({ status: "error", message: errorMessage });
      setsubmitButtonText("Test connection first");
    } finally {
      setProcessing(false);
    }
  }

  async function handleFormSubmit(event) {
    setProcessing(true);
    event.preventDefault();

    const testedHost = connectionTest.testedHost?.replace(/\/+$/, "");
    const currentHost = formValues.JF_HOST?.trim()?.replace(/\/+$/, "");
    const testedKey = connectionTest.testedKey;

    if (connectionTest.status !== "success" || testedHost !== currentHost || testedKey !== formValues.JF_API_KEY) {
      setConnectionTest({ status: "error", message: "Test the Jellyfin connection before saving." });
      setsubmitButtonText("Test connection first");
      setProcessing(false);
      return;
    }

    axios
      .post("/auth/configSetup/", formValues)
      .then(async () => {
        setsubmitButtonText(i18next.t("SETTINGS_SAVED"));
        setProcessing(false);
        setTimeout(() => window.location.reload(), 600);

        return;
      })
      .catch((error) => {
        let errorMessage = "";
        if (error.code === "ERR_NETWORK") {
          errorMessage = i18next.t("ERROR_MESSAGES.NETWORK_ERROR");
        } else if (error.response.status === 401) {
          errorMessage = i18next.t("ERROR_MESSAGES.INVALID_LOGIN");
        } else if (error.response.status === 404) {
          errorMessage = i18next.t("ERROR_MESSAGES.INVALID_URL").replace("{STATUS}", error.response.status);
        } else {
          errorMessage = `Error : ${error.errorMessage ?? error.response.status}`;
        }
        console.log(error);
        setsubmitButtonText(errorMessage);
        setProcessing(false);
      });
  }

  async function handleBackupRestore(event) {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!String(file.name || "").toLowerCase().endsWith(".json")) {
      setRestoreStatus({ status: "error", message: "Choose a JellyGlance or Jellystat .json backup file." });
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }

    const formData = new FormData();
    formData.append("file", file);

    try {
      setProcessing(true);
      setRestoreProgress(0);
      setRestorePhase("uploading");
      setRestoreStatus({ status: "testing", message: `Uploading ${file.name}...` });

      const response = await axios.post("/backup/first-run/restore", formData, {
        timeout: 0,
        onUploadProgress: (progressEvent) => {
          if (progressEvent.total) {
            const progress = Math.round((progressEvent.loaded / progressEvent.total) * 100);
            setRestoreProgress(progress);
            if (progress >= 100) {
              setRestorePhase("applying");
              setRestoreStatus({
                status: "testing",
                message: "Applying backup to database. Large backups can take several minutes...",
              });
            }
          }
        },
      });

      let restoreResult;
      if (response.data?.status === "processing") {
        restoreResult = await waitForFirstRunRestoreComplete();
      } else {
        restoreResult = {
          setupState: Number(response.data?.setupState ?? 0),
          restoredRows: Number(response.data?.restoredRows || 0),
        };
      }

      finishRestoreFlow(restoreResult);
    } catch (error) {
      const payload = error.response?.data;
      const message =
        (typeof payload === "object" && payload?.error) ||
        (typeof payload === "string" && payload) ||
        error.message ||
        "Restore failed";
      setRestoreStatus({ status: "error", message });
      setProcessing(false);
      setRestorePhase("idle");
      setRestoreProgress(0);
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  return (
    <SetupShell
      step={1}
      eyebrow="Media server connection"
      title="Connect Jellyfin"
      description="Add your Jellyfin URL and API key, or restore a previous JellyGlance backup to bring an old install back."
      minimal
    >
      <section className="setup-stage-shell">
        <section className="setup-stage-form-card">
          <div className="setup-jellyfin-form-header">
            <div className="setup-jellyfin-logo" aria-hidden="true">
              <img src={jellyfinLogo} alt="" />
            </div>
            <div className="setup-form-heading-block">
              <strong>Jellyfin connection</strong>
              <span>Enter the server you want JellyGlance to index and monitor.</span>
            </div>
          </div>
          <Form onSubmit={handleFormSubmit} className="setup-form">
            <Form.Group className="inputbox">
              <Form.Label>URL</Form.Label>
              <Form.Control
                id="JF_HOST"
                name="JF_HOST"
                value={formValues.JF_HOST || ""}
                onChange={handleFormChange}
                placeholder="https://jellyfin.example.com"
              />
            </Form.Group>

            <Form.Group className="inputbox">
              <Form.Label>
                <Trans i18nKey={"SETTINGS_PAGE.API_KEY"} />
              </Form.Label>
              <InputGroup>
                <Form.Control
                  className="px-0"
                  id="JF_API_KEY"
                  name="JF_API_KEY"
                  value={formValues.JF_API_KEY || ""}
                  onChange={handleFormChange}
                  type={showPassword ? "text" : "password"}
                  placeholder="Paste Jellyfin API key"
                  autoComplete="off"
                />
                <Button className="login-show-password" type="button" onClick={() => setShowPassword(!showPassword)}>
                  {showPassword ? <EyeFillIcon /> : <EyeOffFillIcon />}
                </Button>
              </InputGroup>
            </Form.Group>

            {connectionTest.message && (
              <div className={`setup-connection-status is-${connectionTest.status}`} role="status">
                {connectionTest.message}
              </div>
            )}

            <div className="setup-button-row">
              <Button type="button" className="setup-secondary-button" disabled={processing} onClick={testConnection}>
                {connectionTest.status === "testing" ? `${i18next.t("VALIDATING")}...` : "Test Connection"}
              </Button>
              <Button type="submit" className="setup-button" disabled={processing || connectionTest.status !== "success"}>
                {processing && restoreStatus.status === "idle" ? `${i18next.t("VALIDATING")}...` : submitButtonText}
              </Button>
            </div>
          </Form>
        </section>

        <section className="setup-stage-form-card setup-restore-card">
          <div className="setup-jellyfin-form-header">
            <div className="setup-jellyfin-logo" aria-hidden="true">
              <Database2LineIcon size={28} />
            </div>
            <div className="setup-form-heading-block">
              <strong>Restore from backup</strong>
              <span>Moving installs? Upload a JellyGlance JSON backup to restore config, libraries, and activity.</span>
            </div>
          </div>

          <div className="setup-restore-actions">
            <label className={`setup-restore-upload${processing ? " is-disabled" : ""}`}>
              <UploadCloud2LineIcon size={18} />
              <span>
                {processing && restoreStatus.status === "testing"
                  ? restorePhase === "applying"
                    ? "Applying backup..."
                    : restoreProgress > 0
                      ? `Uploading ${restoreProgress}%...`
                      : "Preparing upload..."
                  : restorePhase === "complete"
                    ? "Restore complete"
                    : "Choose backup JSON"}
              </span>
              <input
                ref={fileInputRef}
                type="file"
                accept=".json,application/json"
                disabled={processing}
                onChange={handleBackupRestore}
              />
            </label>
            <p className="setup-restore-hint">Works with JellyGlance backups. Older backups without app config still restore library and activity data.</p>
          </div>

          {restoreStatus.message ? (
            <div className={`setup-connection-status is-${restoreStatus.status}`} role="status">
              {restoreStatus.message}
            </div>
          ) : null}
        </section>
      </section>
    </SetupShell>
  );
}

export default Setup;
