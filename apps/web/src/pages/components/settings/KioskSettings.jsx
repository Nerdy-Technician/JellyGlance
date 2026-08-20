import { useState } from "react";
import Button from "react-bootstrap/Button";
import ExternalLinkLineIcon from "remixicon-react/ExternalLinkLineIcon";
import EyeLineIcon from "remixicon-react/EyeLineIcon";
import EyeOffLineIcon from "remixicon-react/EyeOffLineIcon";
import RestartLineIcon from "remixicon-react/RestartLineIcon";
import {
  DEFAULT_HOME_ORDER,
  HOME_PRESETS,
  HOME_SECTION_DEFINITIONS,
  HOME_WIDGET_SIZE_LABELS,
  loadHomeSettings,
  normalizeHomeOrder,
  saveHomeSettings,
} from "../../../lib/home-settings";

const KIOSK_SCOPE = "kiosk";

export default function KioskSettings() {
  const [settings, setSettings] = useState(() => loadHomeSettings(KIOSK_SCOPE));
  const sectionLabels = HOME_SECTION_DEFINITIONS.reduce((labels, section) => ({ ...labels, [section.id]: section.label }), {});

  function updateSettings(updater) {
    const nextSettings = saveHomeSettings(typeof updater === "function" ? updater(settings) : { ...settings, ...updater }, KIOSK_SCOPE);
    setSettings(nextSettings);
  }

  function applyPreset(presetId) {
    const preset = HOME_PRESETS[presetId];
    if (!preset) return;
    updateSettings((current) => ({
      ...current,
      order: preset.order,
      hidden: preset.hidden,
      density: preset.density,
      sizes: preset.sizes || {},
      preset: presetId,
    }));
  }

  function resetKiosk() {
    const preset = HOME_PRESETS.kiosk;
    updateSettings({
      ...preset,
      title: "JellyGlance Kiosk",
      autoRotate: false,
      theme: "default",
      pinned: "",
      alertRules: { backupDays: 7, requestThreshold: 1, missingPosterThreshold: 1 },
      preset: "kiosk",
      sizes: preset.sizes || {},
    });
  }

  function toggleSection(sectionId) {
    updateSettings((current) => {
      const hidden = new Set(current.hidden || []);
      if (hidden.has(sectionId)) {
        hidden.delete(sectionId);
      } else {
        hidden.add(sectionId);
      }
      return { ...current, hidden: [...hidden], preset: "custom" };
    });
  }

  function updateWidgetSize(sectionId, size) {
    updateSettings((current) => ({
      ...current,
      sizes: { ...(current.sizes || {}), [sectionId]: size },
      preset: "custom",
    }));
  }

  function moveSection(sectionId, direction) {
    updateSettings((current) => {
      const nextOrder = normalizeHomeOrder(current.order);
      const index = nextOrder.indexOf(sectionId);
      const nextIndex = index + direction;
      if (index < 0 || nextIndex < 0 || nextIndex >= nextOrder.length) return current;
      [nextOrder[index], nextOrder[nextIndex]] = [nextOrder[nextIndex], nextOrder[index]];
      return { ...current, order: nextOrder, preset: "custom" };
    });
  }

  const orderedSections = normalizeHomeOrder(settings.order);
  const visibleSections = orderedSections.filter((sectionId) => !settings.hidden.includes(sectionId));
  const hiddenSections = orderedSections.filter((sectionId) => settings.hidden.includes(sectionId));

  function renderWidgetRow(sectionId, index, sourceSections) {
    const isHidden = settings.hidden.includes(sectionId);
    const orderIndex = orderedSections.indexOf(sectionId);

    return (
      <article key={sectionId} className={isHidden ? "is-hidden" : ""}>
        <span className="kiosk-widget-order">{isHidden ? "Hidden" : index + 1}</span>
        <button type="button" title={isHidden ? "Show widget" : "Hide widget"} onClick={() => toggleSection(sectionId)}>
          {isHidden ? <EyeOffLineIcon size={18} /> : <EyeLineIcon size={18} />}
        </button>
        <strong>{sectionLabels[sectionId] || sectionId}</strong>
        <select value={settings.sizes?.[sectionId] || "medium"} onChange={(event) => updateWidgetSize(sectionId, event.target.value)}>
          {Object.entries(HOME_WIDGET_SIZE_LABELS).map(([sizeId, label]) => (
            <option key={sizeId} value={sizeId}>
              {label}
            </option>
          ))}
        </select>
        <div>
          <button type="button" disabled={orderIndex === 0 || sourceSections.length < 2} onClick={() => moveSection(sectionId, -1)}>
            Up
          </button>
          <button type="button" disabled={orderIndex === DEFAULT_HOME_ORDER.length - 1 || sourceSections.length < 2} onClick={() => moveSection(sectionId, 1)}>
            Down
          </button>
        </div>
      </article>
    );
  }

  return (
    <div className="kiosk-settings-page">
      <header className="kiosk-settings-hero">
        <div>
          <span>Kiosk display</span>
          <h2>Customise Kiosk Page</h2>
          <p>Control the title, density, theme, visible widgets, widget sizes, and order used by the static kiosk view.</p>
        </div>
        <div className="kiosk-settings-actions">
          <Button as="a" href="/home/kiosk" target="_blank" rel="noreferrer" variant="outline-primary">
            <ExternalLinkLineIcon size={16} />
            Open kiosk
          </Button>
          <Button type="button" variant="outline-secondary" onClick={resetKiosk}>
            <RestartLineIcon size={16} />
            Reset
          </Button>
        </div>
      </header>

      <section className="kiosk-settings-panel">
        <div className="kiosk-settings-grid">
          <label>
            <span>Title</span>
            <input value={settings.title} placeholder="JellyGlance Kiosk" onChange={(event) => updateSettings({ title: event.target.value, preset: "custom" })} />
          </label>
          <label>
            <span>Preset</span>
            <select value={settings.preset} onChange={(event) => applyPreset(event.target.value)}>
              <option value="custom">Custom</option>
              {Object.entries(HOME_PRESETS).map(([presetId, preset]) => (
                <option key={presetId} value={presetId}>
                  {preset.label}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>Pinned widget</span>
            <select value={settings.pinned} onChange={(event) => updateSettings({ pinned: event.target.value, preset: "custom" })}>
              <option value="">None</option>
              {HOME_SECTION_DEFINITIONS.map((section) => (
                <option key={section.id} value={section.id}>
                  {section.label}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>Density</span>
            <select value={settings.density} onChange={(event) => updateSettings({ density: event.target.value, preset: "custom" })}>
              <option value="comfortable">Comfortable</option>
              <option value="compact">Compact</option>
            </select>
          </label>
          <label>
            <span>Theme</span>
            <select value={settings.theme} onChange={(event) => updateSettings({ theme: event.target.value, preset: "custom" })}>
              <option value="default">Default</option>
              <option value="darker">Darker</option>
              <option value="neon">Neon</option>
              <option value="highContrast">High contrast</option>
              <option value="wall">Wall display</option>
            </select>
          </label>
          <label className="kiosk-settings-toggle">
            <span>Refresh</span>
            <button type="button" className="is-enabled" disabled>
              Every 5 minutes
            </button>
          </label>
        </div>
      </section>

      <section className="kiosk-settings-panel">
        <div className="kiosk-widget-heading">
          <div>
            <span>Widgets</span>
            <h3>Order and visibility</h3>
          </div>
          <small>{orderedSections.length - settings.hidden.length} visible</small>
        </div>

        <div className="kiosk-widget-groups">
          <div className="kiosk-widget-group">
            <h4>Enabled order</h4>
            <div className="kiosk-widget-list">
              {visibleSections.length ? visibleSections.map((sectionId, index) => renderWidgetRow(sectionId, index, visibleSections)) : <p className="kiosk-widget-empty">No widgets enabled.</p>}
            </div>
          </div>

          <div className="kiosk-widget-group">
            <h4>Hidden widgets</h4>
            <div className="kiosk-widget-list">
              {hiddenSections.length ? hiddenSections.map((sectionId, index) => renderWidgetRow(sectionId, index, hiddenSections)) : <p className="kiosk-widget-empty">No hidden widgets.</p>}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
