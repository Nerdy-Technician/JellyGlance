import { useEffect, useState } from "react";
import axios from "../../../lib/axios_instance";
import Form from "react-bootstrap/Form";
import Row from "react-bootstrap/Row";
import Col from "react-bootstrap/Col";
import Button from "react-bootstrap/Button";
import Alert from "react-bootstrap/Alert";
import Spinner from "react-bootstrap/Spinner";
import EyeFillIcon from "remixicon-react/EyeFillIcon";
import EyeOffFillIcon from "remixicon-react/EyeOffFillIcon";
import LoginCircleLineIcon from "remixicon-react/LoginCircleLineIcon";
import ShieldKeyholeLineIcon from "remixicon-react/ShieldKeyholeLineIcon";
import UserSettingsLineIcon from "remixicon-react/UserSettingsLineIcon";
import { Link } from "react-router-dom";

import Config from "../../../lib/config";

import "../../css/settings/settings.css";
import { InputGroup } from "react-bootstrap";

const authModes = [
  {
    id: "quick-connect",
    title: "Jellyfin Login / Quick Connect",
    text: "Use Jellyfin Quick Connect for account access.",
    Icon: LoginCircleLineIcon,
  },
  {
    id: "oidc",
    title: "OIDC / Authentik",
    text: "Use an external identity provider.",
    Icon: ShieldKeyholeLineIcon,
  },
  {
    id: "local",
    title: "Local",
    text: "Use a JellyGlance username and password.",
    Icon: UserSettingsLineIcon,
  },
];

export default function SecuritySettings() {
  const [authMode, setAuthMode] = useState("quick-connect");
  const [showOidcSecret, setShowOidcSecret] = useState(false);
  const [oidcValues, setOidcValues] = useState({});
  const [saving, setSaving] = useState(false);
  const [isSubmitted, setisSubmitted] = useState("");
  const [submissionMessage, setsubmissionMessage] = useState("");
  const token = localStorage.getItem("token");

  useEffect(() => {
    const fetchConfig = async () => {
      try {
        const newConfig = await Config.getConfig(true);
        const nextAuth = newConfig.settings?.auth || {};
        const nextMode = nextAuth.mode || (newConfig.requireLogin ? "local" : "quick-connect");

        setAuthMode(nextMode);
        setOidcValues({
          issuerUrl: nextAuth.issuerUrl || "",
          clientId: nextAuth.clientId || "",
          clientSecret: nextAuth.clientSecret || "",
          redirectUri: nextAuth.redirectUri || `${window.location.origin}/auth/oidc/callback`,
        });
      } catch (error) {
        console.log(error);
      }
    };

    fetchConfig();

    const intervalId = setInterval(fetchConfig, 60000 * 5);
    return () => clearInterval(intervalId);
  }, []);

  async function saveAuthMode(payload) {
    const result = await axios
      .post("/api/setAuthMode", payload, {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      })
      .catch((error) => error.response);

    if (result?.status >= 400) {
      return { isValid: false, errorMessage: result?.data?.errorMessage || "Unable to update authentication mode" };
    }

    await Config.setConfig();
    return { isValid: true };
  }

  async function handleAuthSubmit(event) {
    event.preventDefault();
    setSaving(true);
    setisSubmitted("");

    let result;

    if (authMode === "quick-connect") {
      result = await saveAuthMode({ mode: "quick-connect" });
    }

    if (authMode === "oidc") {
      result = await saveAuthMode({ mode: "oidc", ...oidcValues });
    }

    if (authMode === "local") {
      result = await saveAuthMode({ mode: "local" });
    }

    setSaving(false);
    if (result?.isValid) {
      setisSubmitted("Success");
      setsubmissionMessage("Authentication settings updated.");
      return;
    }

    setisSubmitted("Failed");
    setsubmissionMessage(result?.errorMessage || "Unable to update authentication settings.");
  }

  function handleOidcChange(event) {
    setOidcValues({ ...oidcValues, [event.target.name]: event.target.value });
  }

  return (
    <div>
      <h1>Security</h1>

      <Form onSubmit={handleAuthSubmit} className="settings-form security-auth-form">
        <div className="security-auth-header">
          <div>
            <h2>Authentication</h2>
            <p>Choose how JellyGlance signs users in after Jellyfin setup.</p>
          </div>
          <strong>{authModes.find((mode) => mode.id === authMode)?.title}</strong>
        </div>

        <div className="security-auth-grid" role="radiogroup" aria-label="Authentication mode">
          {authModes.map(({ id, title, text, Icon }) => (
            <button
              key={id}
              type="button"
              className={`security-auth-card ${authMode === id ? "is-active" : ""}`}
              onClick={() => setAuthMode(id)}
            >
              <Icon size={22} />
              <span>
                <strong>{title}</strong>
                <small>{text}</small>
              </span>
            </button>
          ))}
        </div>

        {authMode === "quick-connect" && (
          <div className="security-auth-panel">
            <strong>Jellyfin Login / Quick Connect selected</strong>
            <p>
              JellyGlance will send users through Jellyfin Quick Connect. No local admin username or password is needed for
              this mode.
            </p>
          </div>
        )}

        {authMode === "oidc" && (
          <div className="security-auth-panel">
            <Form.Group as={Row} className="mb-3">
              <Form.Label column>Issuer URL</Form.Label>
              <Col>
                <Form.Control
                  name="issuerUrl"
                  value={oidcValues.issuerUrl || ""}
                  onChange={handleOidcChange}
                  placeholder="https://auth.example.com/application/o/jellyglance/"
                  required={authMode === "oidc"}
                />
              </Col>
            </Form.Group>

            <Form.Group as={Row} className="mb-3">
              <Form.Label column>Client ID</Form.Label>
              <Col>
                <Form.Control name="clientId" value={oidcValues.clientId || ""} onChange={handleOidcChange} required={authMode === "oidc"} />
              </Col>
            </Form.Group>

            <Form.Group as={Row} className="mb-3">
              <Form.Label column>Client Secret</Form.Label>
              <Col>
                <InputGroup>
                  <Form.Control
                    name="clientSecret"
                    value={oidcValues.clientSecret || ""}
                    onChange={handleOidcChange}
                    type={showOidcSecret ? "text" : "password"}
                    autoComplete="off"
                  />
                  <Button variant="outline-primary" type="button" onClick={() => setShowOidcSecret(!showOidcSecret)}>
                    {showOidcSecret ? <EyeFillIcon /> : <EyeOffFillIcon />}
                  </Button>
                </InputGroup>
              </Col>
            </Form.Group>

            <Form.Group as={Row} className="mb-3">
              <Form.Label column>Redirect URI</Form.Label>
              <Col>
                <Form.Control name="redirectUri" value={oidcValues.redirectUri || ""} onChange={handleOidcChange} />
              </Col>
            </Form.Group>
          </div>
        )}

        {authMode === "local" && (
          <div className="security-auth-panel">
            <strong>Local login selected</strong>
            <p>
              Local JellyGlance accounts are created and managed on the Users page. Add users there, assign them Admin,
              Manager, Viewer, or Disabled roles, and reset passwords without changing the authentication mode here.
            </p>
            <Link className="security-users-link" to="/users">
              Manage local users
            </Link>
          </div>
        )}

        {isSubmitted !== "" ? (
          isSubmitted === "Failed" ? (
            <Alert bg="dark" data-bs-theme="dark" variant="danger">
              {submissionMessage}
            </Alert>
          ) : (
            <Alert bg="dark" data-bs-theme="dark" variant="success">
              {submissionMessage}
            </Alert>
          )
        ) : null}

        <div className="d-flex flex-column flex-md-row justify-content-end align-items-md-center">
          <Button variant="outline-success" type="submit" disabled={saving}>
            {saving ? <Spinner animation="border" size="sm" /> : authMode === "oidc" ? "Test & Save" : "Save Authentication"}
          </Button>
        </div>
      </Form>
    </div>
  );
}
