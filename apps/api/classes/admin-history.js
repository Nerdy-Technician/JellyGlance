const db = require("../db");

const maxAuditEntries = 100;
const maxWebhookDeliveryEntries = 100;

function getActor(req) {
  const user = req?.user;
  if (!user) return "System";
  if (user.username) return user.username;
  if (user.name) return user.name;
  if (user.jellyfinUser?.name) return user.jellyfinUser.name;
  if (user.id) return `User ${user.id}`;
  return "Authenticated user";
}

async function getSettings() {
  const rows = await db.query('SELECT settings FROM app_config where "ID"=1').then((res) => res.rows);
  return rows[0]?.settings || {};
}

async function mergeSettings(settings) {
  await db.query(
    `
      UPDATE app_config
      SET settings = (COALESCE(settings, '{}'::json)::jsonb || $1::jsonb)::json
      WHERE "ID" = 1
    `,
    [settings]
  );
}

async function addAuditEntry(req, action, details = {}) {
  try {
    const settings = await getSettings();
    const current = Array.isArray(settings.AdminAuditLog) ? settings.AdminAuditLog : [];
    const entry = {
      action,
      actor: getActor(req),
      role: req?.user?.role || null,
      details,
      timestamp: new Date().toISOString(),
    };
    await mergeSettings({ AdminAuditLog: [entry, ...current].slice(0, maxAuditEntries) });
    return entry;
  } catch (error) {
    console.error("Unable to write admin audit log:", error.message);
    return null;
  }
}

async function getAuditLog() {
  const settings = await getSettings();
  return Array.isArray(settings.AdminAuditLog) ? settings.AdminAuditLog : [];
}

async function addWebhookDelivery(entry) {
  try {
    const settings = await getSettings();
    const current = Array.isArray(settings.WebhookDeliveryHistory) ? settings.WebhookDeliveryHistory : [];
    const destination = redactDestination(entry.destination);
    await mergeSettings({
      WebhookDeliveryHistory: [
        {
          ...entry,
          destination,
          timestamp: entry.timestamp || new Date().toISOString(),
        },
        ...current,
      ].slice(0, maxWebhookDeliveryEntries),
    });
  } catch (error) {
    console.error("Unable to write webhook delivery history:", error.message);
  }
}

function redactDestination(destination) {
  if (!destination || typeof destination !== "string") {
    return "";
  }

  try {
    const url = new URL(destination);
    for (const key of [...url.searchParams.keys()]) {
      if (/token|key|secret|password|apikey/i.test(key)) {
        url.searchParams.set(key, "redacted");
      }
    }
    const parts = url.pathname.split("/");
    url.pathname = parts.map((part, index) => (index > 2 && part.length > 12 ? "redacted" : part)).join("/");
    return url.toString();
  } catch {
    return destination.replace(/([?&](?:token|key|secret|password|apikey)=)[^&]+/gi, "$1redacted");
  }
}

async function getWebhookDeliveryHistory() {
  const settings = await getSettings();
  return Array.isArray(settings.WebhookDeliveryHistory) ? settings.WebhookDeliveryHistory : [];
}

module.exports = {
  addAuditEntry,
  addWebhookDelivery,
  getAuditLog,
  getWebhookDeliveryHistory,
};
