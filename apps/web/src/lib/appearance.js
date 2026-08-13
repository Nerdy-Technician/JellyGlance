export const FONT_WEIGHT_STORAGE_KEY = "jellyglance_font_weight";

export const FONT_WEIGHT_OPTIONS = [
  {
    id: "default",
    label: "Default",
    description: "Keep JellyGlance's current bold display style.",
  },
  {
    id: "comfortable",
    label: "Comfortable",
    description: "Softer headings while keeping labels easy to scan.",
  },
  {
    id: "light",
    label: "Light",
    description: "A thinner interface for a calmer dashboard.",
  },
];

export function getStoredFontWeight() {
  const storedValue = localStorage.getItem(FONT_WEIGHT_STORAGE_KEY);
  return FONT_WEIGHT_OPTIONS.some((option) => option.id === storedValue) ? storedValue : "default";
}

export function applyFontWeightPreference(preference = getStoredFontWeight()) {
  const nextPreference = FONT_WEIGHT_OPTIONS.some((option) => option.id === preference) ? preference : "default";
  document.documentElement.dataset.fontWeight = nextPreference;
  return nextPreference;
}

export function saveFontWeightPreference(preference) {
  const nextPreference = applyFontWeightPreference(preference);
  localStorage.setItem(FONT_WEIGHT_STORAGE_KEY, nextPreference);
  window.dispatchEvent(new CustomEvent("jellyglance-font-weight-updated", { detail: nextPreference }));
  return nextPreference;
}
