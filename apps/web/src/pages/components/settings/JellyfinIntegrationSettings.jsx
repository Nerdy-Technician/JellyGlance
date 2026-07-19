import { useEffect, useState } from "react";
import Alert from "react-bootstrap/Alert";
import Button from "react-bootstrap/Button";
import Col from "react-bootstrap/Col";
import Form from "react-bootstrap/Form";
import InputGroup from "react-bootstrap/InputGroup";
import Row from "react-bootstrap/Row";
import EyeFillIcon from "remixicon-react/EyeFillIcon";
import EyeOffFillIcon from "remixicon-react/EyeOffFillIcon";
import axios from "../../../lib/axios_instance";
import Config from "../../../lib/config";
import Loading from "../general/loading";

export default function JellyfinIntegrationSettings({ compact = false }) {
  const [config, setConfig] = useState(null);
  const [showKey, setKeyState] = useState(false);
  const [formValues, setFormValues] = useState({});
  const [isSubmitted, setIsSubmitted] = useState("");
  const [loadState, setLoadState] = useState("Loading");
  const [submissionMessage, setSubmissionMessage] = useState("");

  useEffect(() => {
    Config.getConfig()
      .then((nextConfig) => {
        setFormValues({ JF_HOST: nextConfig.hostUrl });
        setConfig(nextConfig);
        setLoadState("Loaded");
      })
      .catch((error) => {
        console.log("Error retrieving config:", error);
        setLoadState("Critical");
        setSubmissionMessage("Error retrieving configuration. Unable to contact backend server.");
      });
  }, []);

  function handleFormChange(event) {
    setFormValues({ ...formValues, [event.target.name]: event.target.value });
  }

  async function handleFormSubmit(event) {
    event.preventDefault();

    setIsSubmitted("");
    axios
      .post("/api/setconfig/", formValues, {
        headers: {
          Authorization: `Bearer ${config.token}`,
          "Content-Type": "application/json",
        },
      })
      .then((response) => {
        console.log("Config updated successfully:", response.data);
        setIsSubmitted("Success");
        setSubmissionMessage("Successfully updated Jellyfin connection");
        Config.setConfig();
      })
      .catch((error) => {
        const errorMessage = error.response?.data?.errorMessage || error.message;
        console.log("Error updating config:", errorMessage);
        setIsSubmitted("Failed");
        setSubmissionMessage(`Error updating Jellyfin connection: ${errorMessage}`);
      });
  }

  if (loadState === "Loading") {
    return <Loading />;
  }

  if (loadState === "Critical") {
    return <div className="submit critical">{submissionMessage}</div>;
  }

  return (
    <section className={`jellyfin-integration-card${compact ? " is-compact" : ""}`}>
      <div className="jellyfin-integration-header">
        <span className="integration-icon">
          <img src="https://cdn.jsdelivr.net/gh/selfhst/icons/svg/jellyfin.svg" alt="" loading="lazy" decoding="async" />
        </span>
        <div>
          <p>Media server</p>
          <h2>{config?.IS_JELLYFIN ? "Jellyfin" : "Emby"} Connection</h2>
          <span>Primary media server used for sessions, library scans, artwork, users, and statistics.</span>
        </div>
      </div>

      <Form onSubmit={handleFormSubmit} className="settings-form integration-settings-form">
        <Form.Group as={Row} className="mb-3">
          <Form.Label column>{config?.IS_JELLYFIN ? "Jellyfin URL" : "Emby URL"}</Form.Label>
          <Col sm="10">
            <Form.Control
              id="JF_HOST"
              name="JF_HOST"
              value={formValues.JF_HOST || ""}
              onChange={handleFormChange}
              placeholder="http://127.0.0.1:8096 or https://media.example.com"
              autoComplete="off"
            />
          </Col>
        </Form.Group>

        <Form.Group as={Row} className="mb-3">
          <Form.Label column>API Key</Form.Label>
          <Col sm="10">
            <InputGroup>
              <Form.Control
                id="JF_API_KEY"
                name="JF_API_KEY"
                value={formValues.JF_API_KEY || ""}
                onChange={handleFormChange}
                type={showKey ? "text" : "password"}
                autoComplete="off"
              />
              <Button variant="outline-primary" type="button" onClick={() => setKeyState(!showKey)}>
                {showKey ? <EyeFillIcon /> : <EyeOffFillIcon />}
              </Button>
            </InputGroup>
          </Col>
        </Form.Group>

        {isSubmitted !== "" ? (
          <Alert bg="dark" data-bs-theme="dark" variant={isSubmitted === "Failed" ? "danger" : "success"}>
            {submissionMessage}
          </Alert>
        ) : null}

        <div className="d-flex flex-column flex-md-row justify-content-end align-items-md-center">
          <Button variant="outline-success" type="submit">
            Update
          </Button>
        </div>
      </Form>
    </section>
  );
}
