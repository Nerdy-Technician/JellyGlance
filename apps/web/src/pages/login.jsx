import { useState, useEffect } from "react";
import axios from "../lib/axios_instance";
import Config from "../lib/config";
import CryptoJS from "crypto-js";
import "./css/setup.css";
import Form from "react-bootstrap/Form";
import Button from "react-bootstrap/Button";
import { InputGroup } from "react-bootstrap";

import EyeFillIcon from "remixicon-react/EyeFillIcon";
import EyeOffFillIcon from "remixicon-react/EyeOffFillIcon";
import logo_dark from "./images/icon-b-512.png";
import projectText from "./images/project-text.png";
import AuthArtworkBackground from "./components/AuthArtworkBackground";

// import LibrarySync from "./components/settings/librarySync";

import Loading from "./components/general/loading";
import { Trans } from "react-i18next";
import i18next from "i18next";

function Login() {
  const [config, setConfig] = useState(null);
  const [setupInfo, setSetupInfo] = useState(null);
  const [formValues, setFormValues] = useState({});
  const [showPassword, setShowPassword] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [submitButtonText, setsubmitButtonText] = useState(i18next.t("LOGIN"));
  const [quickConnect, setQuickConnect] = useState(null);
  const [quickConnectStatus, setQuickConnectStatus] = useState("");
  const canQuickConnect = setupInfo?.auth?.mode === "quick-connect";

  function handleFormChange(event) {
    setFormValues({ ...formValues, [event.target.name]: event.target.value });
  }

  async function copyQuickConnectCode(code) {
    if (!code) {
      return false;
    }

    if (navigator.clipboard && window.isSecureContext) {
      try {
        await navigator.clipboard.writeText(code);
        return true;
      } catch {
        // Fall through to the selection based copy path below.
      }
    }

    const textarea = document.createElement("textarea");
    textarea.value = code;
    textarea.setAttribute("readonly", "");
    textarea.style.position = "fixed";
    textarea.style.top = "0";
    textarea.style.left = "0";
    textarea.style.width = "1px";
    textarea.style.height = "1px";
    textarea.style.opacity = "0";
    document.body.appendChild(textarea);
    textarea.focus();
    textarea.select();
    textarea.setSelectionRange(0, code.length);

    let copied = false;
    try {
      copied = document.execCommand("copy");
    } finally {
      document.body.removeChild(textarea);
    }

    return copied;
  }

  async function handleFormSubmit(event) {
    setProcessing(true);
    event.preventDefault();

    if (canQuickConnect) {
      startQuickConnect(true);
      return;
    }

    let hashedPassword = CryptoJS.SHA3(formValues.JS_PASSWORD).toString();

    beginLogin(formValues.JS_USERNAME, hashedPassword);
  }

  async function finishQuickConnect(secret) {
    try {
      setProcessing(true);
      setQuickConnectStatus("Approved. Opening JellyGlance...");
      const response = await axios.post(
        "/auth/jellyfin-quick-connect/complete",
        { secret },
        {
          headers: {
            "Content-Type": "application/json",
          },
        }
      );

      localStorage.setItem("token", response.data.token);
      localStorage.removeItem("jellyglance_logged_out");
      await Config.setConfig();
      window.location.reload();
    } catch (error) {
      const errorMessage = error.response?.data?.errorMessage || `Error : ${error.response?.status || "Unknown"}`;
      setQuickConnectStatus(errorMessage);
      setProcessing(false);
    }
  }

  async function startQuickConnect(openJellyfin = false) {
    try {
      setQuickConnect(null);
      setQuickConnectStatus("Requesting a Jellyfin Quick Connect code...");
      const response = await axios.post("/auth/jellyfin-quick-connect/initiate");
      const copied = await copyQuickConnectCode(response.data.code);

      setQuickConnect(response.data);
      setQuickConnectStatus(
        copied
          ? "Code copied. Paste it into Jellyfin Quick Connect to approve this browser."
          : "Enter this code in Jellyfin Quick Connect to approve this browser."
      );

      if (openJellyfin && response.data.quickConnectUrl) {
        window.open(response.data.quickConnectUrl, "_blank", "noopener,noreferrer");
      }

      setProcessing(false);
    } catch (error) {
      const errorMessage = error.response?.data?.errorMessage || `Error : ${error.response?.status || "Unknown"}`;
      setQuickConnectStatus(errorMessage);
      setProcessing(false);
    }
  }

  async function beginLogin(JS_USERNAME, hashedPassword) {
    axios
      .post(
        "/auth/login",
        {
          username: JS_USERNAME,
          password: hashedPassword,
        },
        {
          headers: {
            "Content-Type": "application/json",
          },
        }
      )
      .then(async (response) => {
        localStorage.setItem("token", response.data.token);
        localStorage.removeItem("jellyglance_logged_out");
        setProcessing(false);
        if (JS_USERNAME || response.data.token) {
          await Config.setConfig();
          setsubmitButtonText(i18next.t("SUCCESS"));
          window.location.reload();
          return;
        }
      })
      .catch((error) => {
        let errorMessage = `Error : ${error.response?.status || "Unknown"}`;
        if (error.code === "ERR_NETWORK") {
          errorMessage = i18next.t("ERROR_MESSAGES.NETWORK_ERROR");
        } else if (error.response?.status === 401) {
          errorMessage = i18next.t("ERROR_MESSAGES.INVALID_LOGIN");
        } else if (error.response?.status === 404) {
          errorMessage = i18next.t("ERROR_MESSAGES.INVALID_URL").replace("{STATUS}", error.response.status);
        }
        if (JS_USERNAME) {
          setsubmitButtonText(errorMessage);
        }

        setProcessing(false);
      });
  }

  useEffect(() => {
    const fetchConfig = async () => {
      try {
        const newConfig = await Config.setConfig();
        setConfig(newConfig);
      } catch (error) {
        if (error.code === "ERR_NETWORK") {
          if (error.response.status !== 401 && error.response.status !== 403) {
            // console.log(error);
          }
        }
      }
    };

    const fetchSetupInfo = async () => {
      try {
        const response = await axios.get("/auth/isConfigured");
        setSetupInfo(response.data);
        setConfig({});
      } catch (error) {
        console.log(error);
        setConfig({});
      }
    };

    if (!config) {
      fetchSetupInfo();
      if (localStorage.getItem("token")) {
        fetchConfig();
      }
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

  if (!config || config.token) {
    return <Loading />;
  }

  return (
    <section className="auth-page">
      <AuthArtworkBackground />
      <div className="form-box d-flex flex-column">
        <div className="login-brand">
          <img src={logo_dark} className="login-logo" alt="" />
          <img src={projectText} className="login-wordmark" alt="JellyGlance" />
        </div>

        <Form onSubmit={handleFormSubmit} className="setup-form login-form">
          {canQuickConnect ? (
            <div className="setup-auth-summary quick-connect-intro">
              <strong>Jellyfin Quick Connect</strong>
              <small>Use Jellyfin Quick Connect to approve this browser with your Jellyfin admin account.</small>
              {!quickConnect?.code && quickConnectStatus && <small className="quick-connect-status">{quickConnectStatus}</small>}
            </div>
          ) : (
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
                  />
                  <Button className="login-show-password" type="button" onClick={() => setShowPassword(!showPassword)}>
                    {showPassword ? <EyeFillIcon /> : <EyeOffFillIcon />}
                  </Button>
                </InputGroup>
              </Form.Group>
            </>
          )}

          {canQuickConnect && quickConnect?.code ? (
            <>
              <Button type="button" className="setup-button quick-connect-open-button" disabled={processing} onClick={() => startQuickConnect(true)}>
                Jellyfin Login
              </Button>

              <div className="quick-connect-code-panel">
                <span className="quick-connect-code">{quickConnect.code}</span>
                <small>Enter this code in Jellyfin Quick Connect. JellyGlance will continue automatically.</small>
                {quickConnectStatus && <small className="quick-connect-status">{quickConnectStatus}</small>}
                <Button type="submit" className="quick-connect-refresh-button" disabled={processing}>
                  {processing ? `${i18next.t("VALIDATING")}...` : "Get New Code"}
                </Button>
              </div>
            </>
          ) : (
            <Button type="submit" className="setup-button">
              {processing
                ? `${i18next.t("VALIDATING")}...`
                : canQuickConnect
                  ? "Jellyfin Login"
                  : submitButtonText}
            </Button>
          )}
        </Form>
      </div>
    </section>
  );
}

export default Login;
