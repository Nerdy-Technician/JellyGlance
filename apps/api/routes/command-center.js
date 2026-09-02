const express = require("express");
const JellyfinAPI = require("../classes/jellyfin-api");
const { getAuditLog, mergeSettings, addAuditEntry } = require("../classes/admin-history");
const { getUserPreferences, saveUserTheme } = require("../classes/user-preferences");
const Config = require("../classes/config");
const {
  buildItemGlance,
  stitchDownloads,
  buildLibraryStorage,
  buildOpsDigest,
  buildHomepageWidgets,
  fetchAutobrrHits,
  retryFailedGrab,
  getJellyfinStatus,
} = require("../classes/command-center");

const router = express.Router();
const API = new JellyfinAPI();

router.get("/item-glance/:id", async (req, res) => {
  try {
    const glance = await buildItemGlance(req.params.id);
    if (!glance) return res.status(404).send({ error: "Item not found" });
    res.send(glance);
  } catch (error) {
    console.error("Item glance failed:", error);
    res.status(503).send({ error: "Unable to load item glance" });
  }
});

router.get("/downloads/stitched", async (req, res) => {
  try {
    res.send({ items: await stitchDownloads() });
  } catch (error) {
    console.error("Download stitch failed:", error);
    res.status(503).send({ error: "Unable to stitch downloads" });
  }
});

router.get("/ops-digest", async (req, res) => {
  try {
    res.send(await buildOpsDigest());
  } catch (error) {
    console.error("Ops digest failed:", error);
    res.status(503).send({ error: "Unable to load ops digest" });
  }
});

router.get("/library-storage", async (req, res) => {
  try {
    res.send(await buildLibraryStorage());
  } catch (error) {
    console.error("Library storage failed:", error);
    res.status(503).send({ error: "Unable to load library storage" });
  }
});

router.get("/widgets/homepage", async (req, res) => {
  try {
    res.send(await buildHomepageWidgets());
  } catch (error) {
    console.error("Homepage widget failed:", error);
    res.status(503).send({ error: "Unable to load widget" });
  }
});

router.get("/admin-audit/export", async (req, res) => {
  try {
    const rows = await getAuditLog();
    res.setHeader("Content-Type", "application/json");
    res.setHeader("Content-Disposition", "attachment; filename=jellyglance-audit.json");
    res.send(JSON.stringify(rows, null, 2));
  } catch (error) {
    res.status(503).send({ error: "Unable to export audit log" });
  }
});

router.post("/admin-audit/retention", async (req, res) => {
  try {
    const retention = Math.min(2000, Math.max(20, Number(req.body?.retention || 100)));
    await mergeSettings({ AdminAuditRetention: retention });
    res.send({ ok: true, retention });
  } catch (error) {
    res.status(500).send({ error: "Unable to save retention" });
  }
});

router.post("/setBackupDestination", async (req, res) => {
  try {
    const dest = req.body || {};
    await mergeSettings({
      BackupDestination: {
        kind: String(dest.kind || "local").toLowerCase(),
        url: String(dest.url || "").trim(),
        username: String(dest.username || "").trim(),
        secret: String(dest.secret || "").trim(),
        bucket: String(dest.bucket || "").trim(),
        region: String(dest.region || "us-east-1").trim(),
        prefix: String(dest.prefix || "").trim(),
      },
    });
    res.send({ ok: true });
  } catch (error) {
    res.status(500).send({ error: "Unable to save backup destination" });
  }
});

router.get("/autobrr/hits", async (req, res) => {
  try {
    const { getIntegrationData } = require("../classes/integration-store");
    const live = await fetchAutobrrHits();
    if (live.length) {
      res.send({ items: live });
      return;
    }
    const cached = await getIntegrationData();
    res.send({ items: cached.autobrr?.hits || [] });
  } catch (error) {
    console.error("autobrr hits failed:", error);
    res.status(503).send({ error: "Unable to load autobrr hits" });
  }
});

router.post("/retry-grab", async (req, res) => {
  try {
    const result = await retryFailedGrab(req.body || {});
    if (!result.ok) {
      res.status(502).send({ error: "Unable to retry grab", ...result });
      return;
    }
    res.send(result);
  } catch (error) {
    console.error("Retry grab failed:", error);
    res.status(503).send({ error: error.message || "Unable to retry grab" });
  }
});

router.get("/preferences", async (req, res) => {
  try {
    res.send(await getUserPreferences(req.user));
  } catch (error) {
    res.status(error.statusCode || 503).send({ error: error.message || "Unable to load preferences" });
  }
});

router.put("/preferences", async (req, res) => {
  try {
    const theme = await saveUserTheme(req.user, req.body?.theme || req.body || {});
    new Config().clearCache();
    res.send({ theme });
  } catch (error) {
    res.status(error.statusCode || 503).send({ error: error.message || "Unable to save preferences" });
  }
});

router.get("/jellyfin/status", async (req, res) => {
  try {
    res.send(await getJellyfinStatus());
  } catch (error) {
    res.status(503).send({ ok: false, error: error.message || "Unable to reach Jellyfin" });
  }
});

router.post("/jellyfin/refresh-item", async (req, res) => {
  try {
    const itemId = String(req.body?.itemId || "").trim();
    if (!itemId) {
      res.status(400).send({ error: "itemId is required" });
      return;
    }
    await API.refreshItem(itemId, { recursive: req.body?.recursive !== false });
    await addAuditEntry(req, "jellyfin.refresh-item", { itemId });
    res.send({ ok: true });
  } catch (error) {
    console.error("Jellyfin item refresh failed:", error);
    res.status(error.statusCode || 503).send({ error: error.message || "Unable to refresh item" });
  }
});

router.post("/jellyfin/refresh-library", async (req, res) => {
  try {
    await API.refreshLibrary();
    await addAuditEntry(req, "jellyfin.refresh-library", {});
    res.send({ ok: true });
  } catch (error) {
    console.error("Jellyfin library scan failed:", error);
    res.status(error.statusCode || 503).send({ error: error.message || "Unable to scan libraries" });
  }
});

module.exports = router;
