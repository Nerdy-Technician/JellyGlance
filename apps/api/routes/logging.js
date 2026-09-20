const db = require("../db");
const { sendSafeError } = require("../utils/security");

const express = require("express");
const router = express.Router();
// #swagger.tags = ['Logs']
router.get("/getLogs", async (req, res) => {
  try {
    const { rows } = await db.query(`SELECT * FROM jf_logging order by "TimeRun" desc LIMIT 50 `);
    res.json(rows);
  } catch (error) {
    sendSafeError(res, error, { message: "Unable to load logs" });
  }
});

// Handle other routes
router.use((req, res) => {
  res.status(404).send({ error: "Not Found" });
});

module.exports = router;
