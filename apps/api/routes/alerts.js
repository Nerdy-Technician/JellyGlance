const express = require("express");
const alerts = require("../classes/threshold-alerts");

const router = express.Router();

router.get("/settings", async (req, res) => {
  try {
    res.json({ settings: await alerts.getAlertSettings(), log: (await alerts.getAlertLog()).slice(0, 25) });
  } catch (error) {
    res.status(503).json({ error: error.message || "Unable to load alert settings" });
  }
});

router.put("/settings", async (req, res) => {
  try {
    res.json({ settings: await alerts.saveAlertSettings(req.body || {}) });
  } catch (error) {
    res.status(400).json({ error: error.message || "Unable to save alert settings" });
  }
});

router.post("/test", async (req, res) => {
  try {
    await alerts.sendTestAlert();
    res.json({ ok: true });
  } catch (error) {
    res.status(503).json({ error: error.message || "Unable to send a test alert" });
  }
});

router.post("/run", async (req, res) => {
  try {
    res.json(await alerts.runChecks({ force: true }));
  } catch (error) {
    res.status(503).json({ error: error.message || "Unable to run alert checks" });
  }
});

module.exports = router;
