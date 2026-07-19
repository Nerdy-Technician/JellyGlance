import { useState, useEffect } from "react";

import axios from "../lib/axios_instance";
import Config from "../lib/config";
import CryptoJS from "crypto-js";
import "./css/setup.css";
import Loading from "./components/general/loading";
import Form from "react-bootstrap/Form";
import Button from "react-bootstrap/Button";
import { InputGroup } from "react-bootstrap";

import EyeFillIcon from "remixicon-react/EyeFillIcon";
import EyeOffFillIcon from "remixicon-react/EyeOffFillIcon";
import i18next from "i18next";
import { Trans } from "react-i18next";
import SetupShell from "./components/setup/SetupShell";

function Signup() {
  const [config, setConfig] = useState(null);
  const [formValues, setFormValues] = useState({});
  const [processing, setProcessing] = useState(false);
  const [submitButtonText, setsubmitButtonText] = useState(i18next.t("CREATE_USER"));
  const [showPassword, setShowPassword] = useState(false);
  const [authMode, setAuthMode] = useState("quick-connect");
  const [quickConnect, setQuickConnect] = useState(null);
  const [quickConnectStatus, setQuickConnectStatus] = useState("");

  function handleFormChange(event) {
    setFormValues({ ...formValues, [event.target.name]: event.target.value });
  }

  function handleAuthModeChange(nextMode) {
    setAuthMode(nextMode);
    setQuickConnect(null);
    setQuickConnectStatus("");
    setsubmitButtonText(
      nextMode === "quick-connect" ? "Enable Quick Connect" : nextMode === "oidc" ? "Test & Save OIDC" : i18next.t("CREATE_USER")
    );
  }

  async function handleFormSubmit(event) {
    setProcessing(true);
    event.preventDefault();

    if (authMode === "quick-connect") {
      startQuickConnect();
      return;
    }

    let hashedPassword = formValues.JS_PASSWORD ? CryptoJS.SHA3(formValues.JS_PASSWORD).toString() : undefined;
    saveAuthSetup(hashedPassword);
  }

  async function saveAuthSetup(hashedPassword) {
    axios
      .post(
        "/auth/setup-auth",
        {
          mode: authMode,
          username: formValues.JS_USERNAME,
          password: hashedPassword,
          issuerUrl: formValues.OIDC_ISSUER_URL,
          clientId: formValues.OIDC_CLIENT_ID,
          clientSecret: formValues.OIDC_CLIENT_SECRET,
          redirectUri: formValues.OIDC_REDIRECT_URI,
        },
        {
          headers: {
            "Content-Type": "application/json",
          },
        }
      )
      .then(async (response) => {
        localStorage.setItem("token", response.data.token);
        setsubmitButtonText("Settings Saved");
        await beginSync(response.data.token);
        setProcessing(false);
        window.location.reload();
        return;
      })
      .catch((error) => {
        let errorMessage = `Error : ${error.response?.status || "Unknown"}`;
        if (error.code === "ERR_NETWORK") {
          errorMessage = i18next.t("ERROR_MESSAGES.NETWORK_ERROR");
        } else if (error.response?.data?.errorMessage) {
          errorMessage = error.response.data.errorMessage;
        } else if (error.response?.status === 401) {
          errorMessage = i18next.t("ERROR_MESSAGES.UNAUTHORIZED").replace("{STATUS}", error.response.status);
        } else if (error.response?.status === 404) {
          errorMessage = i18next.t("ERROR_MESSAGES.INVALID_URL").replace("{STATUS}", error.response.status);
        }
        setsubmitButtonText(errorMessage);
        setProcessing(false);
      });
  }

  async function finishQuickConnect(secret) {
    try {
      setProcessing(true);
      setQuickConnectStatus("Approved. Saving Jellyfin Quick Connect...");
      await axios.post(
        "/auth/jellyfin-quick-connect/complete",
        { secret },
        {
          headers: {
            "Content-Type": "application/json",
          },
        }
      );
      saveAuthSetup();
    } catch (error) {
      const errorMessage = error.response?.data?.errorMessage || `Error : ${error.response?.status || "Unknown"}`;
      setQuickConnectStatus(errorMessage);
      setProcessing(false);
    }
  }

  async function startQuickConnect() {
    try {
      setQuickConnect(null);
      setQuickConnectStatus("Requesting a Jellyfin Quick Connect code...");
      const response = await axios.post("/auth/jellyfin-quick-connect/initiate");
      setQuickConnect(response.data);
      setQuickConnectStatus("Enter this code in Jellyfin Quick Connect to approve setup.");
      setProcessing(false);
    } catch (error) {
      const errorMessage = error.response?.data?.errorMessage || `Error : ${error.response?.status || "Unknown"}`;
      setQuickConnectStatus(errorMessage);
      setProcessing(false);
    }
  }

  async function beginSync(token) {
    await axios
      .get("/sync/beginSync", {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      })
      .catch((error) => {
        console.log(error);
      });
  }

  useEffect(() => {
    const fetchConfig = async () => {
      try {
        const newConfig = await Config.getConfig(true);
        setConfig(newConfig);
      } catch (error) {
        if (error.code === "ERR_NETWORK") {
          console.log(error);
        }
      }
    };

    if (!config) {
      fetchConfig();
    }
  }, [config]);

  useEffect(() => {
    if (!quickConnect?.secret || processing) {
      return undefined;
    }

    const interval = window.setInterval(async () => {
      try {
        const response = await axios.get("/auth/jellyfin-quick-connect/status", {
          params: { secret: quickConnect.secret },
        });

        if (response.data.authenticated) {
          window.clearInterval(interval);
          finishQuickConnect(quickConnect.secret);
        }
      } catch (error) {
        setQuickConnectStatus(error.response?.data?.errorMessage || "Still waiting for Jellyfin approval...");
      }
    }, 5000);

    return () => window.clearInterval(interval);
  }, [quickConnect?.secret, processing]);

  if (!config) {
    return <Loading />;
  }

  return (
    <SetupShell
      step={2}
      eyebrow="Admin access"
      title="Choose admin authentication"
      description="Choose how JellyGlance should protect the dashboard. Quick Connect uses Jellyfin auth, OIDC validates your provider first, or Local creates JellyGlance credentials."
    >
        <div className="setup-auth-options" role="radiogroup" aria-label="Admin authentication method">
          <button
            type="button"
            className={`setup-auth-option ${authMode === "quick-connect" ? "is-active" : ""}`}
            onClick={() => handleAuthModeChange("quick-connect")}
          >
            <strong>Jellyfin Quick Connect</strong>
            <small>No local admin details</small>
          </button>
          <button
            type="button"
            className={`setup-auth-option ${authMode === "oidc" ? "is-active" : ""}`}
            onClick={() => handleAuthModeChange("oidc")}
          >
            <strong>OIDC / Authentik</strong>
            <small>Test provider first</small>
          </button>
          <button
            type="button"
            className={`setup-auth-option ${authMode === "local" ? "is-active" : ""}`}
            onClick={() => handleAuthModeChange("local")}
          >
            <strong>Local login</strong>
            <small>Set JellyGlance details</small>
          </button>
        </div>

        <Form onSubmit={handleFormSubmit} className="setup-form">
          {authMode === "quick-connect" && (
            <div className="setup-auth-summary">
              <strong>Jellyfin Quick Connect</strong>
              {quickConnect?.code ? (
                <>
                  <span className="quick-connect-code">{quickConnect.code}</span>
                  <small>Open Jellyfin, approve Quick Connect with an administrator account, and enter this code.</small>
                </>
              ) : (
                <small>Approve setup through Jellyfin Quick Connect instead of creating local JellyGlance credentials.</small>
              )}
              {quickConnectStatus && <small className="quick-connect-status">{quickConnectStatus}</small>}
            </div>
          )}

          {authMode === "local" && (
            <>
              <Form.Group className="inputbox">
                <Form.Label>
                  <Trans i18nKey={"USERNAME"} />
                </Form.Label>
                <Form.Control
                  id="JS_USERNAME"
                  name="JS_USERNAME"
                  value={formValues.JS_USERNAME || ""}
                  onChange={handleFormChange}
                  placeholder=" "
                  required={authMode === "local"}
                />
              </Form.Group>

              <Form.Group className="inputbox">
                <Form.Label>
                  <Trans i18nKey={"PASSWORD"} />
                </Form.Label>
                <InputGroup>
                  <Form.Control
                    id="JS_PASSWORD"
                    name="JS_PASSWORD"
                    value={formValues.JS_PASSWORD || ""}
                    onChange={handleFormChange}
                    type={showPassword ? "text" : "password"}
                    placeholder=" "
                    required={authMode === "local"}
                  />
                  <Button className="login-show-password" type="button" onClick={() => setShowPassword(!showPassword)}>
                    {showPassword ? <EyeFillIcon /> : <EyeOffFillIcon />}
                  </Button>
                </InputGroup>
              </Form.Group>
            </>
          )}

          {authMode === "oidc" && (
            <>
              <Form.Group className="inputbox">
                <Form.Label>Issuer URL</Form.Label>
                <Form.Control
                  id="OIDC_ISSUER_URL"
                  name="OIDC_ISSUER_URL"
                  value={formValues.OIDC_ISSUER_URL || ""}
                  onChange={handleFormChange}
                  placeholder="https://auth.example.com/application/o/jellyglance/"
                  required={authMode === "oidc"}
                />
              </Form.Group>

              <Form.Group className="inputbox">
                <Form.Label>Client ID</Form.Label>
                <Form.Control
                  id="OIDC_CLIENT_ID"
                  name="OIDC_CLIENT_ID"
                  value={formValues.OIDC_CLIENT_ID || ""}
                  onChange={handleFormChange}
                  placeholder=" "
                  required={authMode === "oidc"}
                />
              </Form.Group>

              <Form.Group className="inputbox">
                <Form.Label>Client Secret</Form.Label>
                <InputGroup>
                  <Form.Control
                    id="OIDC_CLIENT_SECRET"
                    name="OIDC_CLIENT_SECRET"
                    value={formValues.OIDC_CLIENT_SECRET || ""}
                    onChange={handleFormChange}
                    type={showPassword ? "text" : "password"}
                    placeholder=" "
                  />
                  <Button className="login-show-password" type="button" onClick={() => setShowPassword(!showPassword)}>
                    {showPassword ? <EyeFillIcon /> : <EyeOffFillIcon />}
                  </Button>
                </InputGroup>
              </Form.Group>

              <Form.Group className="inputbox">
                <Form.Label>Redirect URI</Form.Label>
                <Form.Control
                  id="OIDC_REDIRECT_URI"
                  name="OIDC_REDIRECT_URI"
                  value={formValues.OIDC_REDIRECT_URI || ""}
                  onChange={handleFormChange}
                  placeholder={`${window.location.origin}/auth/oidc/callback`}
                />
              </Form.Group>
            </>
          )}

          <Button type="submit" className="setup-button">
            {processing
              ? `${i18next.t("VALIDATING")}...`
              : authMode === "quick-connect"
                ? quickConnect?.code
                  ? "Get New Quick Connect Code"
                  : "Start Jellyfin Quick Connect"
                : authMode === "oidc"
                  ? "Test & Save OIDC"
                  : submitButtonText}
          </Button>
        </Form>
    </SetupShell>
  );
}

export default Signup;
