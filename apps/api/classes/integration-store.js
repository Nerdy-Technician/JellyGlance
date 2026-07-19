const db = require("../db");

const defaultIntegrations = {
  arrApps: [],
  clients: [],
};

const defaultData = {
  calendar: {
    releases: [],
    sources: [],
    syncedAt: null,
  },
  downloads: {
    items: [],
    clients: [],
    syncedAt: null,
  },
};

async function getSettings() {
  const rows = await db.query('SELECT settings FROM app_config where "ID"=1').then((res) => res.rows);
  const settings = rows[0]?.settings || {};
  return settings;
}

async function saveSettings(settings) {
  await db.query('UPDATE app_config SET settings=$1 where "ID"=1', [settings]);
}

async function getIntegrations() {
  const settings = await getSettings();
  return {
    ...defaultIntegrations,
    ...(settings.Integrations || {}),
  };
}

async function saveIntegrations(integrations) {
  const settings = await getSettings();
  settings.Integrations = {
    ...defaultIntegrations,
    ...(integrations || {}),
  };
  await saveSettings(settings);
  return settings.Integrations;
}

async function getIntegrationData() {
  const settings = await getSettings();
  return {
    calendar: {
      ...defaultData.calendar,
      ...(settings.IntegrationData?.calendar || {}),
    },
    downloads: {
      ...defaultData.downloads,
      ...(settings.IntegrationData?.downloads || {}),
    },
  };
}

async function saveIntegrationData(partialData) {
  const settings = await getSettings();
  settings.IntegrationData = {
    ...defaultData,
    ...(settings.IntegrationData || {}),
    ...(partialData || {}),
  };
  await saveSettings(settings);
  return settings.IntegrationData;
}

module.exports = {
  getIntegrations,
  saveIntegrations,
  getIntegrationData,
  saveIntegrationData,
};
