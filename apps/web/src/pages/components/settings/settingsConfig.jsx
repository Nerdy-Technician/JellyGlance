import { useState, useEffect } from "react";
import axios from "../../../lib/axios_instance";
import Config from "../../../lib/config";
import Loading from "../general/loading";
import Form from "react-bootstrap/Form";
import Row from "react-bootstrap/Row";
import Col from "react-bootstrap/Col";
import Button from "react-bootstrap/Button";
import Alert from "react-bootstrap/Alert";
import ArrowDownSLineIcon from "remixicon-react/ArrowDownSLineIcon";
import ArrowUpSLineIcon from "remixicon-react/ArrowUpSLineIcon";
import DragMove2LineIcon from "remixicon-react/DragMove2LineIcon";
import EyeLineIcon from "remixicon-react/EyeLineIcon";
import EyeOffLineIcon from "remixicon-react/EyeOffLineIcon";
import ExternalLinkLineIcon from "remixicon-react/ExternalLinkLineIcon";
import LockLineIcon from "remixicon-react/LockLineIcon";

import "../../css/settings/settings.css";
import { Trans } from "react-i18next";
import { FONT_WEIGHT_OPTIONS, getStoredFontWeight, saveFontWeightPreference } from "../../../lib/appearance";
import { languages } from "../../../lib/languages";
import { navData } from "../../../lib/navdata";
import { DEFAULT_THEME, THEME_PRESETS, getStoredTheme, resetTheme, saveTheme } from "../../../lib/theme";
import {
  applyNavOrder,
  getStoredHiddenNavLinks,
  getStoredNavOrder,
  LOCKED_NAV_LINKS,
  resetHiddenNavLinks,
  resetNavOrder,
  saveHiddenNavLinks,
  saveNavOrder,
} from "../../../lib/nav-order";

function getNavLabel(item) {
  if (typeof item.text === "string") return item.text;
  if (item.link === "") return "Home";
  return item.link
    .split("-")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

const THEME_COLOR_FIELDS = [
  { key: "primary", label: "Primary" },
  { key: "secondary", label: "Secondary" },
  { key: "background", label: "Background" },
  { key: "surface", label: "Surface" },
];
const HEX_COLOR_PATTERN = /^#[0-9a-f]{6}$/i;

function NavigationOrderSettings() {
  const [navOrder, setNavOrder] = useState(() => getStoredNavOrder(navData));
  const [hiddenLinks, setHiddenLinks] = useState(() => getStoredHiddenNavLinks(navData));
  const [draggedLink, setDraggedLink] = useState("");
  const orderedItems = applyNavOrder(navData, navOrder);
  const lockedItems = orderedItems.filter((item) => LOCKED_NAV_LINKS.has(item.link));
  const reorderableItems = orderedItems.filter((item) => !LOCKED_NAV_LINKS.has(item.link));

  function commitOrder(nextOrder) {
    setNavOrder(saveNavOrder(nextOrder, navData));
  }

  function moveLink(link, direction) {
    const currentIndex = navOrder.indexOf(link);
    const targetIndex = currentIndex + direction;
    if (currentIndex < 0 || targetIndex < 0 || targetIndex >= navOrder.length) return;
    const nextOrder = [...navOrder];
    const [movedLink] = nextOrder.splice(currentIndex, 1);
    nextOrder.splice(targetIndex, 0, movedLink);
    commitOrder(nextOrder);
  }

  function moveDraggedLink(targetLink) {
    if (!draggedLink || draggedLink === targetLink) return;
    const nextOrder = navOrder.filter((link) => link !== draggedLink);
    const targetIndex = nextOrder.indexOf(targetLink);
    nextOrder.splice(targetIndex < 0 ? nextOrder.length : targetIndex, 0, draggedLink);
    commitOrder(nextOrder);
  }

  function handleReset() {
    resetNavOrder();
    resetHiddenNavLinks();
    setNavOrder(getStoredNavOrder(navData));
    setHiddenLinks(getStoredHiddenNavLinks(navData));
  }

  function toggleHidden(link) {
    const nextHiddenLinks = hiddenLinks.includes(link) ? hiddenLinks.filter((hiddenLink) => hiddenLink !== link) : [...hiddenLinks, link];
    setHiddenLinks(saveHiddenNavLinks(nextHiddenLinks, navData));
  }

  return (
    <section className="settings-form nav-order-settings" aria-labelledby="nav-order-heading">
      <div className="nav-order-header">
        <div>
          <h2 id="nav-order-heading">Navbar order</h2>
          <p>Drag the unlocked items into the order you want. Home, Settings, and About stay fixed.</p>
        </div>
        <Button type="button" variant="outline-secondary" onClick={handleReset}>
          Reset
        </Button>
      </div>

      <div className="nav-order-locked" aria-label="Locked navigation items">
        {lockedItems.map((item) => (
          <span key={item.link || "home"}>
            <LockLineIcon size={14} />
            {getNavLabel(item)}
          </span>
        ))}
      </div>

      <div className="nav-order-list">
        {reorderableItems.map((item, index) => {
          const isHidden = hiddenLinks.includes(item.link);
          const label = getNavLabel(item);

          return (
            <div
              key={item.link}
              className={`nav-order-row${draggedLink === item.link ? " is-dragging" : ""}${isHidden ? " is-hidden" : ""}`}
              draggable
              onDragStart={(event) => {
                setDraggedLink(item.link);
                event.dataTransfer.effectAllowed = "move";
                event.dataTransfer.setData("text/plain", item.link);
              }}
              onDragOver={(event) => {
                event.preventDefault();
                event.dataTransfer.dropEffect = "move";
              }}
              onDrop={(event) => {
                event.preventDefault();
                moveDraggedLink(item.link);
                setDraggedLink("");
              }}
              onDragEnd={() => setDraggedLink("")}
            >
              <span className="nav-order-drag" aria-hidden="true">
                <DragMove2LineIcon size={18} />
              </span>
              <span className="nav-order-icon">{item.icon}</span>
              <strong>{label}</strong>
              <button
                type="button"
                className="nav-order-visibility"
                onClick={() => toggleHidden(item.link)}
                aria-pressed={!isHidden}
                aria-label={isHidden ? `Show ${label} in navbar` : `Hide ${label} from navbar`}
                title={isHidden ? "Show tab" : "Hide tab"}
              >
                {isHidden ? <EyeOffLineIcon size={18} /> : <EyeLineIcon size={18} />}
              </button>
              <div className="nav-order-actions">
                <button type="button" onClick={() => moveLink(item.link, -1)} disabled={index === 0} aria-label={`Move ${label} up`}>
                  <ArrowUpSLineIcon size={18} />
                </button>
                <button type="button" onClick={() => moveLink(item.link, 1)} disabled={index === reorderableItems.length - 1} aria-label={`Move ${label} down`}>
                  <ArrowDownSLineIcon size={18} />
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function ThemePresetPreview({ label, theme }) {
  return (
    <div
      className="general-theme-preview"
      style={{
        "--preview-primary": theme.primary,
        "--preview-secondary": theme.secondary,
        "--preview-background": theme.background,
        "--preview-surface": theme.surface,
      }}
    >
      <div className="general-theme-preview-sidebar">
        <span />
        <i />
        <i />
        <i />
      </div>
      <div className="general-theme-preview-main">
        <div className="general-theme-preview-top">
          <strong>{label}</strong>
          <span>Live preview</span>
        </div>
        <div className="general-theme-preview-card">
          <div>
            <b>Active Sessions</b>
            <small>2 streams running</small>
          </div>
          <button type="button" tabIndex={-1}>
            Sync
          </button>
        </div>
        <div className="general-theme-preview-list">
          <span />
          <span />
          <span />
        </div>
      </div>
    </div>
  );
}

export default function SettingsConfig() {
  const [config, setConfig] = useState(null);
  const [selectedLanguage, setSelectedLanguage] = useState(localStorage.getItem("i18nextLng") ?? "en-US");
  const [formValuesExternal, setFormValuesExternal] = useState({});
  const [isSubmittedExternal, setisSubmittedExternal] = useState("");
  const [loadSate, setloadSate] = useState("Loading");
  const [submissionMessage, setsubmissionMessage] = useState("");
  const [submissionMessageExternal, setsubmissionMessageExternal] = useState("");
  const [twelve_hr, set12hr] = useState(localStorage.getItem("12hr") === "true");
  const [fontWeight, setFontWeight] = useState(() => getStoredFontWeight());
  const [theme, setTheme] = useState(() => getStoredTheme());
  const [themeDraft, setThemeDraft] = useState(() => getStoredTheme());

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
    setTheme(saveTheme(themeDraft));

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
    const languageCode = event.target.value;
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

  function updateFontWeight(nextFontWeight) {
    setFontWeight(saveFontWeightPreference(nextFontWeight));
  }

  function updateThemePreset(presetName) {
    if (presetName === "custom") return;
    const preset = THEME_PRESETS.find((item) => item.name === presetName);
    if (!preset) return;
    setThemeDraft(preset);
  }

  function updateThemeDraftColor(key, value) {
    if (!HEX_COLOR_PATTERN.test(value)) return;
    setThemeDraft((currentTheme) => ({
      ...currentTheme,
      [key]: value,
    }));
  }

  function restoreTheme() {
    const restoredTheme = resetTheme();
    setTheme(restoredTheme);
    setThemeDraft(restoredTheme);
  }

  const activeThemePreset = THEME_PRESETS.find(
    (preset) =>
      themeDraft.primary === preset.primary &&
      themeDraft.secondary === preset.secondary &&
      themeDraft.background === preset.background &&
      themeDraft.surface === preset.surface
  );
  const externalUrl = formValuesExternal.ExternalUrl || "";
  const selectedThemeName = activeThemePreset?.name || "custom";
  const previewTheme = activeThemePreset || themeDraft;
  const previewThemeName = activeThemePreset?.name || "Custom";
  const hasThemeChanges = JSON.stringify(themeDraft) !== JSON.stringify(theme);

  return (
    <div className="general-settings-page">
      <div className="general-settings-content">
        <Form onSubmit={handleFormSubmitExternal} className="settings-form general-settings-card is-single-form">
          <div className="general-settings-card-head">
            <div>
              <h3>Core preferences</h3>
              <p>Set server access, display behaviour, theme, language, and navigation layout.</p>
            </div>
            <ExternalLinkLineIcon />
          </div>
          <div className="general-form-section">
            <h4>Server access</h4>
            <Form.Group as={Row} className="mb-3">
              <Form.Label column>
                <Trans i18nKey={"SETTINGS_PAGE.EXTERNAL_URL"} />
              </Form.Label>
              <Col sm="10">
                <Form.Control id="ExternalUrl" name="ExternalUrl" value={externalUrl} onChange={handleFormChangeExternal} placeholder="https://jellyglance.example.com" />
              </Col>
            </Form.Group>
          </div>

          {isSubmittedExternal !== "" ? (
            <Alert bg="dark" data-bs-theme="dark" variant={isSubmittedExternal === "Failed" ? "danger" : "success"}>
              {submissionMessageExternal}
            </Alert>
          ) : null}
          <div className="general-form-section">
            <h4>Display preferences</h4>
            <Form.Group as={Row} className="mb-3">
              <Form.Label column>
                <Trans i18nKey={"SETTINGS_PAGE.HOUR_FORMAT"} />
              </Form.Label>
              <Col sm="10">
                <Form.Select value={twelve_hr ? "12" : "24"} onChange={(event) => toggle12Hr(event.target.value === "12")}>
                  <option value="24">
                    <Trans i18nKey={"SETTINGS_PAGE.HOUR_FORMAT_24"} />
                  </option>
                  <option value="12">
                    <Trans i18nKey={"SETTINGS_PAGE.HOUR_FORMAT_12"} />
                  </option>
                </Form.Select>
              </Col>
            </Form.Group>
            <Form.Group as={Row} className="mb-3">
              <Form.Label column>
                <Trans i18nKey={"SETTINGS_PAGE.LANGUAGE"} />
              </Form.Label>
              <Col sm="10">
                <Form.Select value={selectedLanguage} onChange={updateLanguage}>
                  {languages
                    .slice()
                    .sort((a, b) => a.description.localeCompare(b.description))
                    .map((language) => (
                      <option value={language.id} key={language.id}>
                        {language.description}
                      </option>
                    ))}
                </Form.Select>
              </Col>
            </Form.Group>
            <Form.Group as={Row} className="mb-0">
              <Form.Label column>Font weight</Form.Label>
              <Col sm="10">
                <Form.Select value={fontWeight} onChange={(event) => updateFontWeight(event.target.value)}>
                  {FONT_WEIGHT_OPTIONS.map((option) => (
                    <option key={option.id} value={option.id}>
                      {option.label}
                    </option>
                  ))}
                </Form.Select>
              </Col>
            </Form.Group>
          </div>
          <div className="general-form-section">
            <h4>Theme preset</h4>
            <Form.Group as={Row} className="mb-3">
              <Form.Label column>Theme</Form.Label>
              <Col sm="10">
                <Form.Select value={selectedThemeName} onChange={(event) => updateThemePreset(event.target.value)}>
                  <option value="custom">Custom</option>
                  {THEME_PRESETS.map((preset) => (
                    <option key={preset.name} value={preset.name}>
                      {preset.name}
                    </option>
                  ))}
                </Form.Select>
              </Col>
            </Form.Group>
            <div className="general-theme-selected">
              <div>
                <span className="general-theme-swatches" aria-hidden="true">
                  <i style={{ backgroundColor: previewTheme.primary }} />
                  <i style={{ backgroundColor: previewTheme.secondary }} />
                  <i style={{ backgroundColor: previewTheme.background }} />
                  <i style={{ backgroundColor: previewTheme.surface }} />
                </span>
                <strong>{previewThemeName}</strong>
              </div>
              <div className="general-theme-custom-grid">
                {THEME_COLOR_FIELDS.map((field) => (
                  <label key={field.key} className="general-theme-custom-control">
                    <span>{field.label}</span>
                    <div>
                      <input
                        type="color"
                        value={themeDraft[field.key]}
                        onChange={(event) => updateThemeDraftColor(field.key, event.target.value)}
                        aria-label={`${field.label} colour`}
                      />
                      <input
                        type="text"
                        value={themeDraft[field.key]}
                        onChange={(event) => updateThemeDraftColor(field.key, event.target.value)}
                        aria-label={`${field.label} hex colour`}
                        maxLength={7}
                      />
                    </div>
                  </label>
                ))}
              </div>
              <ThemePresetPreview label={previewThemeName} theme={previewTheme} />
            </div>
          </div>
          <div className="general-settings-actions">
            <Button variant="outline-success" type="submit">
              <Trans i18nKey={"SETTINGS_PAGE.UPDATE"} />
            </Button>
            <Button
              variant="outline-secondary"
              type="button"
              onClick={restoreTheme}
              disabled={JSON.stringify(theme) === JSON.stringify(DEFAULT_THEME) && JSON.stringify(themeDraft) === JSON.stringify(DEFAULT_THEME)}
            >
              Reset theme
            </Button>
            {hasThemeChanges ? <span className="general-settings-pending">Theme preview not applied</span> : null}
          </div>
        </Form>

        <NavigationOrderSettings />
      </div>
    </div>
  );
}
