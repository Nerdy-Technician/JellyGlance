import { useState, useEffect } from "react";
import axios from "../../../lib/axios_instance";
import Config from "../../../lib/config";
import Loading from "../general/loading";
import Form from "react-bootstrap/Form";
import Row from "react-bootstrap/Row";
import Col from "react-bootstrap/Col";
import Button from "react-bootstrap/Button";
import Alert from "react-bootstrap/Alert";
import ToggleButton from "react-bootstrap/ToggleButton";
import ToggleButtonGroup from "react-bootstrap/ToggleButtonGroup";
import Dropdown from "react-bootstrap/Dropdown";

import "../../css/settings/settings.css";
import { Trans } from "react-i18next";
import { languages } from "../../../lib/languages";

export default function SettingsConfig() {
  const [config, setConfig] = useState(null);
  const [selectedLanguage, setSelectedLanguage] = useState(localStorage.getItem("i18nextLng") ?? "en-US");
  const [formValuesExternal, setFormValuesExternal] = useState({});
  const [isSubmittedExternal, setisSubmittedExternal] = useState("");
  const [loadSate, setloadSate] = useState("Loading");
  const [submissionMessage, setsubmissionMessage] = useState("");
  const [submissionMessageExternal, setsubmissionMessageExternal] = useState("");
  const [twelve_hr, set12hr] = useState(localStorage.getItem("12hr") === "true");

  const storage_12hr = localStorage.getItem("12hr");

  if (storage_12hr === null) {
    localStorage.setItem("12hr", false);
    set12hr(false);
  } else if (twelve_hr === null) {
    set12hr(Boolean(storage_12hr));
  }

  useEffect(() => {
    Config.getConfig()
      .then((config) => {
        setFormValuesExternal({ ExternalUrl: config.settings?.EXTERNAL_URL });
        setConfig(config);
        setloadSate("Loaded");
      })
      .catch((error) => {
        console.log("Error updating config:", error);
        setloadSate("Critical");
        setsubmissionMessage("Error Retrieving Configuration. Unable to contact Backend Server");
      });
  }, []);

  async function handleFormSubmitExternal(event) {
    event.preventDefault();

    setisSubmittedExternal("");
    axios
      .post("/api/setExternalUrl/", formValuesExternal, {
        headers: {
          Authorization: `Bearer ${config.token}`,
          "Content-Type": "application/json",
        },
      })
      .then((response) => {
        console.log("Config updated successfully:", response.data);
        setisSubmittedExternal("Success");
        setsubmissionMessageExternal("Successfully updated configuration");
      })
      .catch((error) => {
        let errorMessage = error.response.data.errorMessage;
        console.log("Error updating config:", errorMessage);
        setisSubmittedExternal("Failed");
        setsubmissionMessageExternal(`Error Updating Configuration: ${errorMessage}`);
      });
    Config.setConfig();
  }

  function handleFormChangeExternal(event) {
    setFormValuesExternal({ ...formValuesExternal, [event.target.name]: event.target.value });
  }

  function updateLanguage(event) {
    const languageCode = event.target.getAttribute("value");
    setSelectedLanguage(languageCode);
    localStorage.setItem("i18nextLng", languageCode);
  }

  if (loadSate === "Loading") {
    return <Loading />;
  }

  if (loadSate === "Critical") {
    return <div className="submit critical">{submissionMessage}</div>;
  }

  function toggle12Hr(is_12_hr) {
    set12hr(is_12_hr);
    localStorage.setItem("12hr", is_12_hr);
  }

  return (
    <div>
      <h1>
        <Trans i18nKey={"SETTINGS_PAGE.SETTINGS"} />
      </h1>
      <Form onSubmit={handleFormSubmitExternal} className="settings-form">
        <Form.Group as={Row} className="mb-3">
          <Form.Label column className="">
            <Trans i18nKey={"SETTINGS_PAGE.EXTERNAL_URL"} />
          </Form.Label>
          <Col sm="10">
            <Form.Control
              id="ExternalUrl"
              name="ExternalUrl"
              value={formValuesExternal.ExternalUrl || ""}
              onChange={handleFormChangeExternal}
              placeholder="http://example.jellyfin.server"
            />
          </Col>
        </Form.Group>

        {isSubmittedExternal !== "" ? (
          isSubmittedExternal === "Failed" ? (
            <Alert bg="dark" data-bs-theme="dark" variant="danger">
              {submissionMessageExternal}
            </Alert>
          ) : (
            <Alert bg="dark" data-bs-theme="dark" variant="success">
              {submissionMessageExternal}
            </Alert>
          )
        ) : (
          <></>
        )}
        <div className="d-flex flex-column flex-md-row justify-content-end align-items-md-center">
          <Button variant="outline-success" type="submit">
            <Trans i18nKey={"SETTINGS_PAGE.UPDATE"} />
          </Button>
        </div>
      </Form>

      <Form className="settings-form">
        <Form.Group as={Row} className="mb-3">
          <Form.Label column className="">
            <Trans i18nKey={"SETTINGS_PAGE.HOUR_FORMAT"} />
          </Form.Label>
          <Col>
            <ToggleButtonGroup type="checkbox" className="d-flex">
              <ToggleButton
                variant="outline-primary"
                active={twelve_hr}
                onClick={() => {
                  toggle12Hr(true);
                }}
              >
                <Trans i18nKey={"SETTINGS_PAGE.HOUR_FORMAT_12"} />
              </ToggleButton>
              <ToggleButton
                variant="outline-primary"
                active={!twelve_hr}
                onClick={() => {
                  toggle12Hr(false);
                }}
              >
                <Trans i18nKey={"SETTINGS_PAGE.HOUR_FORMAT_24"} />
              </ToggleButton>
            </ToggleButtonGroup>
          </Col>
        </Form.Group>
      </Form>
      <Form className="settings-form">
        <Form.Group as={Row} className="mb-3">
          <Form.Label column className="">
            <Trans i18nKey={"SETTINGS_PAGE.LANGUAGE"} />
          </Form.Label>
          <Col>
            <Dropdown className="w-100">
              <Dropdown.Toggle variant="outline-primary" className="w-100 dropdown-basic">
                {languages.find((language) => language.id === selectedLanguage)?.description || "English"}
              </Dropdown.Toggle>

              <Dropdown.Menu className="w-100">
                {languages &&
                  languages
                    .sort((a, b) => a.description - b.description)
                    .map((language) => (
                      <Dropdown.Item onClick={updateLanguage} value={language.id} key={language.id}>
                        {language.description}
                      </Dropdown.Item>
                    ))}
              </Dropdown.Menu>
            </Dropdown>
          </Col>
        </Form.Group>
      </Form>
    </div>
  );
}
