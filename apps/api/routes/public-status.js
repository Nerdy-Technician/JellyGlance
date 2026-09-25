// Public, read-only status page. Off by default; an admin builds and enables it in Settings > Status Page.
const express = require("express");
const axios = require("axios");
const configClass = require("../classes/config");
const statusPage = require("../classes/status-page");

const CACHE_MS = 60 * 1000;
let cache = { at: 0, payload: null };
const allowedPosters = new Map(); // posterId -> expiry

function allowPosters(ids) {
  const expires = Date.now() + 30 * 60 * 1000;
  ids.forEach((id) => allowedPosters.set(id, expires));
  if (allowedPosters.size > 500) {
    for (const [id, until] of allowedPosters) if (until < Date.now()) allowedPosters.delete(id);
  }
}

async function currentStatus() {
  const config = await statusPage.getStatusConfig();
  if (!config.enabled) return null;
  if (cache.payload && Date.now() - cache.at < CACHE_MS) return cache.payload;
  const built = await statusPage.buildStatusPayload(config);
  allowPosters(built.posterIds);
  cache = { at: Date.now(), payload: built.payload };
  return built.payload;
}

const publicRouter = express.Router();

publicRouter.get("/", async (req, res) => {
  try {
    const status = await currentStatus();
    if (!status) return res.status(404).json({ enabled: false });
    res.set("Cache-Control", "no-store");
    res.json(status);
  } catch {
    res.status(503).json({ enabled: true, error: "Status is unavailable right now." });
  }
});

publicRouter.get("/poster/:id", async (req, res) => {
  try {
    const id = String(req.params.id || "");
    // Only serve posters for items currently shown on the status page (or its admin preview).
    if (!((allowedPosters.get(id) || 0) > Date.now())) return res.status(404).end();
    const config = await new configClass().getConfig();
    const response = await axios.get(`${config.JF_HOST}/Items/${encodeURIComponent(id)}/Images/Primary?fillWidth=300&quality=90`, {
      responseType: "arraybuffer",
      timeout: 8000,
      headers: { Authorization: `MediaBrowser Token="${config.JF_API_KEY}"`, "User-Agent": "JellyGlance" },
    });
    if (!String(response.headers["content-type"] || "").startsWith("image/")) return res.status(404).end();
    res.set("Content-Type", response.headers["content-type"]);
    res.set("Cache-Control", "public, max-age=3600");
    res.send(response.data);
  } catch {
    res.status(404).end();
  }
});

const adminRouter = express.Router();

adminRouter.get("/settings", async (req, res) => {
  try {
    const services = (await statusPage.configuredServices().catch(() => [])).map(({ id, name }) => ({ id, name }));
    res.json({ settings: await statusPage.getStatusConfig(), services });
  } catch (error) {
    res.status(503).json({ error: error.message || "Unable to load status page settings" });
  }
});

adminRouter.put("/settings", async (req, res) => {
  try {
    const settings = await statusPage.saveStatusConfig(req.body || {});
    cache = { at: 0, payload: null };
    res.json({ settings });
  } catch (error) {
    res.status(400).json({ error: error.message || "Unable to save status page settings" });
  }
});

adminRouter.post("/preview", async (req, res) => {
  try {
    const draft = statusPage.normalizeConfig({ ...(req.body || {}), maintenanceSince: new Date().toISOString() });
    const built = await statusPage.buildStatusPayload(draft);
    allowPosters(built.posterIds);
    res.json(built.payload);
  } catch (error) {
    res.status(503).json({ error: error.message || "Unable to build a preview" });
  }
});

adminRouter.post("/check", async (req, res) => {
  try {
    res.json({ checked: await statusPage.runStatusChecks() });
  } catch (error) {
    res.status(503).json({ error: error.message || "Unable to run status checks" });
  }
});

module.exports = { publicRouter, adminRouter };
