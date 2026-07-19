import { useState } from "react";
import axios from "../lib/axios_instance";
import Form from "react-bootstrap/Form";
import Button from "react-bootstrap/Button";
import { InputGroup } from "react-bootstrap";

import EyeFillIcon from "remixicon-react/EyeFillIcon";
import EyeOffFillIcon from "remixicon-react/EyeOffFillIcon";
import jellyfinLogo from "./images/jellyfin.svg";

import "./css/setup.css";
import i18next from "i18next";
import { Trans } from "react-i18next";
import SetupShell from "./components/setup/SetupShell";

function Setup() {
  const [formValues, setFormValues] = useState({});
  const [processing, setProcessing] = useState(false);
  const [submitButtonText, setsubmitButtonText] = useState(i18next.t("SAVE_JELLYFIN_DETAILS"));
  const [showPassword, setShowPassword] = useState(false);
  const [connectionTest, setConnectionTest] = useState({ status: "idle", message: "" });

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

    // Send a POST request to /api/setconfig/ with the updated configuration
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

  return (
    <SetupShell
      step={1}
      eyebrow="Media server connection"
      title="Connect Jellyfin"
      description="Add your Jellyfin URL and API key. JellyGlance will validate the connection, save the settings, and start the first sync."
    >
        <div className="setup-jellyfin-logo" aria-hidden="true">
          <img src={jellyfinLogo} alt="" />
        </div>
        <Form onSubmit={handleFormSubmit} className="setup-form">
          <Form.Group className="inputbox">
            <Form.Label>URL</Form.Label>
            <Form.Control
              id="JF_HOST"
              name="JF_HOST"
              value={formValues.JF_HOST || ""}
              onChange={handleFormChange}
              placeholder=" "
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
                placeholder=" "
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
              {processing ? `${i18next.t("VALIDATING")}...` : submitButtonText}
            </Button>
          </div>
        </Form>
    </SetupShell>
  );
}

export default Setup;
