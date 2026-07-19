export const INTEGRATIONS_STORAGE_KEY = "JELLYGLANCE_INTEGRATIONS";

export function loadSavedIntegrations(fallback = {}) {
  const saved = localStorage.getItem(INTEGRATIONS_STORAGE_KEY);
  if (!saved) return fallback;

  try {
    return {
      ...fallback,
      ...JSON.parse(saved),
    };
  } catch (error) {
    console.log("Unable to load saved integrations", error);
    return fallback;
  }
}

export function saveSavedIntegrations(integrations) {
  localStorage.setItem(INTEGRATIONS_STORAGE_KEY, JSON.stringify(integrations));
}

export function getConnectedIntegrations(items = []) {
  return items.filter((item) => item.connected);
}
