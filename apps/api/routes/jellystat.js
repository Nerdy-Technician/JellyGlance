const express = require("express");
const fs = require("fs");
const path = require("path");
const { randomUUID } = require("crypto");
const multer = require("multer");

const db = require("../db");

const router = express.Router();
const UPLOAD_DIR = path.join(__dirname, "..", "backup-data", "jellystat-uploads");
const IMPORT_COLUMNS = [
  "Id",
  "IsPaused",
  "UserId",
  "UserName",
  "Client",
  "DeviceName",
  "DeviceId",
  "ApplicationVersion",
  "NowPlayingItemId",
  "NowPlayingItemName",
  "EpisodeId",
  "SeasonId",
  "SeriesName",
  "PlaybackDuration",
  "PlayMethod",
  "ActivityDateInserted",
  "MediaStreams",
  "TranscodingInfo",
  "PlayState",
  "OriginalContainer",
  "RemoteEndPoint",
  "ServerId",
  "imported",
];

fs.mkdirSync(UPLOAD_DIR, { recursive: true });

function isJellystatBackup(fileName) {
  return /\.json$/i.test(fileName);
}

const upload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => cb(null, UPLOAD_DIR),
    filename: (req, file, cb) => cb(null, `${randomUUID()}${path.extname(file.originalname).toLowerCase() || ".json"}`),
  }),
  limits: { fileSize: 1024 * 1024 * 512 },
  fileFilter: (req, file, cb) => {
    if (!isJellystatBackup(file.originalname)) {
      cb(new Error("Upload a Jellystat .json backup file."));
      return;
    }
    cb(null, true);
  },
});

function resolveUploadedBackup(uploadId) {
  if (!uploadId) {
    throw new Error("No uploaded Jellystat backup selected.");
  }

  const fileName = path.basename(uploadId);
  if (fileName !== uploadId || !isJellystatBackup(fileName)) {
    throw new Error("Invalid uploaded Jellystat backup reference.");
  }

  const filePath = path.join(UPLOAD_DIR, fileName);
  if (!fs.existsSync(filePath)) {
    throw new Error("Uploaded Jellystat backup has expired or was removed.");
  }

  return filePath;
}

function extractTableFromBackup(data, tableName) {
  if (Array.isArray(data)) {
    for (const table of data) {
      if (table && Array.isArray(table[tableName])) return table[tableName];
    }
  }

  if (Array.isArray(data?.[tableName])) return data[tableName];
  if (Array.isArray(data?.tables?.[tableName])) return data.tables[tableName];
  return [];
}

function loadJellystatRows(sourcePath) {
  const raw = fs.readFileSync(sourcePath, "utf8");
  const data = JSON.parse(raw);
  const activityRows = extractTableFromBackup(data, "jf_playback_activity");
  if (!activityRows.length) {
    throw new Error("No jf_playback_activity rows were found in this Jellystat backup.");
  }

  const rows = activityRows
    .map((row) => {
      const id = row.Id || row.id;
      const activityDate = row.ActivityDateInserted || row.activityDateInserted;
      const playbackDuration = Number(row.PlaybackDuration || row.playbackDuration || 0);
      const itemName = row.NowPlayingItemName || row.nowPlayingItemName;
      if (!id || !activityDate || !itemName || playbackDuration <= 0) return null;

      return {
        ...row,
        Id: `jellystat:${id}`,
        IsPaused: Boolean(row.IsPaused),
        UserId: row.UserId || row.userId || `jellystat-user:${row.UserName || row.userName || "unknown"}`,
        UserName: row.UserName || row.userName || "Jellystat User",
        NowPlayingItemId: row.NowPlayingItemId || row.nowPlayingItemId || null,
        NowPlayingItemName: itemName,
        EpisodeId: row.EpisodeId || row.episodeId || null,
        SeasonId: row.SeasonId || row.seasonId || null,
        SeriesName: row.SeriesName || row.seriesName || null,
        PlaybackDuration: playbackDuration,
        PlayMethod: row.PlayMethod || row.playMethod || "DirectPlay",
        ActivityDateInserted: activityDate,
        MediaStreams: row.MediaStreams || row.mediaStreams || null,
        TranscodingInfo: row.TranscodingInfo || row.transcodingInfo || null,
        PlayState: row.PlayState || row.playState || null,
        OriginalContainer: row.OriginalContainer || row.originalContainer || null,
        RemoteEndPoint: row.RemoteEndPoint || row.remoteEndPoint || null,
        ServerId: "jellystat",
        imported: true,
      };
    })
    .filter(Boolean);

  const dates = rows.map((row) => row.ActivityDateInserted).filter(Boolean);
  return {
    sourceFile: sourcePath,
    totalRows: rows.length,
    firstActivityDate: dates.length ? dates.sort()[0] : null,
    lastActivityDate: dates.length ? dates.sort()[dates.length - 1] : null,
    rows,
  };
}

async function mapUsersByName(rows) {
  const userResult = await db.query('SELECT "Id", "Name" FROM jf_users');
  const users = userResult?.rows || [];
  const userById = new Map(users.map((user) => [String(user.Id), user]));
  const userByName = new Map(users.map((user) => [String(user.Name || "").trim().toLowerCase(), user]));

  return rows.map((row) => {
    const existingUser = userById.get(String(row.UserId || ""));
    if (existingUser) {
      return { ...row, UserId: existingUser.Id, UserName: existingUser.Name };
    }

    const jellyfinUser = userByName.get(String(row.UserName || "").trim().toLowerCase());
    if (jellyfinUser) {
      return { ...row, UserId: jellyfinUser.Id, UserName: jellyfinUser.Name };
    }

    return {
      ...row,
      UserId: String(row.UserId || "").startsWith("jellystat-user:") ? row.UserId : `jellystat-user:${row.UserId || row.UserName || "unknown"}`,
    };
  });
}

async function insertHistoryRows(rows) {
  if (!rows.length) return 0;

  const placeholders = IMPORT_COLUMNS.map((column) => `"${column}"`).join(", ");
  const recordColumns = IMPORT_COLUMNS.map((column) => {
    if (["IsPaused", "imported"].includes(column)) return `"${column}" boolean`;
    if (["PlaybackDuration"].includes(column)) return `"${column}" bigint`;
    if (["ActivityDateInserted"].includes(column)) return `"${column}" timestamptz`;
    if (["MediaStreams", "TranscodingInfo", "PlayState"].includes(column)) return `"${column}" jsonb`;
    return `"${column}" text`;
  }).join(", ");

  let inserted = 0;
  const batchSize = 500;
  for (let index = 0; index < rows.length; index += batchSize) {
    const batch = rows.slice(index, index + batchSize);
    const payload = JSON.stringify(
      batch.map((row) =>
        IMPORT_COLUMNS.reduce((record, column) => {
          record[column] = row[column] ?? null;
          return record;
        }, {})
      )
    );

    const result = await db.pool.query(
      `
        WITH payload AS (
          SELECT *
          FROM jsonb_to_recordset($1::jsonb) AS x(${recordColumns})
        )
        INSERT INTO jf_playback_activity (${placeholders})
        SELECT ${placeholders}
        FROM payload p
        WHERE NOT EXISTS (
          SELECT 1
          FROM jf_playback_activity a
          WHERE a."Id" = p."Id"
          OR (
            COALESCE(a."UserId", '') = COALESCE(p."UserId", '')
            AND COALESCE(a."NowPlayingItemName", '') = COALESCE(p."NowPlayingItemName", '')
            AND ABS(EXTRACT(EPOCH FROM (a."ActivityDateInserted" - p."ActivityDateInserted"))) < 300
          )
        )
        ON CONFLICT ("Id") DO NOTHING
        RETURNING "Id"
      `,
      [payload]
    );
    inserted += result.rowCount;
  }

  await Promise.all(db.materializedViews.map((view) => db.refreshMaterializedView(view)));
  return inserted;
}

router.post("/upload-preview", (req, res) => {
  upload.single("file")(req, res, async (error) => {
    if (error) {
      res.status(400).json({ error: error.message || "Unable to upload Jellystat backup" });
      return;
    }
    if (!req.file) {
      res.status(400).json({ error: "No Jellystat backup uploaded" });
      return;
    }

    try {
      const [summary, importedCount] = await Promise.all([
        Promise.resolve(loadJellystatRows(req.file.path)),
        db.query('SELECT count(*)::int AS "Count" FROM jf_playback_activity WHERE "Id" LIKE $1', ["jellystat:%"]),
      ]);
      res.json({
        sourceFile: summary.sourceFile,
        totalRows: summary.totalRows,
        firstActivityDate: summary.firstActivityDate,
        lastActivityDate: summary.lastActivityDate,
        uploadId: req.file.filename,
        originalName: req.file.originalname,
        size: req.file.size,
        alreadyImportedRows: Number(importedCount.rows?.[0]?.Count || 0),
      });
    } catch (previewError) {
      fs.rm(req.file.path, { force: true }, () => {});
      res.status(503).json({ error: previewError.message || "Unable to preview uploaded Jellystat backup" });
    }
  });
});

router.post("/import", async (req, res) => {
  try {
    const sourcePath = resolveUploadedBackup(req.body?.uploadId);
    const exportData = loadJellystatRows(sourcePath);
    const userMappedRows = await mapUsersByName(exportData.rows || []);
    const insertedRows = await insertHistoryRows(userMappedRows);
    fs.rm(sourcePath, { force: true }, () => {});

    res.json({
      sourceFile: exportData.sourceFile,
      totalRows: exportData.totalRows,
      insertedRows,
      skippedRows: Math.max(0, Number(exportData.totalRows || 0) - insertedRows),
      firstActivityDate: exportData.firstActivityDate,
      lastActivityDate: exportData.lastActivityDate,
    });
  } catch (error) {
    console.error("Jellystat import failed:", error);
    res.status(503).json({ error: error.message || "Unable to import Jellystat history" });
  }
});

router.get("/unmatched-users", async (req, res) => {
  try {
    const [unmatchedResult, usersResult] = await Promise.all([
      db.pool.query(`
        SELECT
          "UserId",
          COALESCE("UserName", 'Jellystat User') AS "UserName",
          count(*)::int AS "PlayCount",
          min("ActivityDateInserted") AS "FirstActivityDate",
          max("ActivityDateInserted") AS "LastActivityDate"
        FROM jf_playback_activity
        WHERE imported = true
        AND "Id" LIKE 'jellystat:%'
        AND "UserId" LIKE 'jellystat-user:%'
        GROUP BY "UserId", COALESCE("UserName", 'Jellystat User')
        ORDER BY count(*) DESC, max("ActivityDateInserted") DESC
      `),
      db.query('SELECT "Id", "Name" FROM jf_users ORDER BY "Name"'),
    ]);

    res.json({
      unmatched: unmatchedResult.rows || [],
      users: usersResult.rows || [],
    });
  } catch (error) {
    res.status(503).json({ error: error.message || "Unable to load unmatched Jellystat users" });
  }
});

router.post("/link-user", async (req, res) => {
  try {
    const sourceUserId = String(req.body?.sourceUserId || "");
    const target = req.body?.target || {};

    if (!sourceUserId.startsWith("jellystat-user:")) {
      return res.status(400).json({ error: "No unmatched Jellystat user selected" });
    }

    if (!target.Id || !target.Name) {
      return res.status(400).json({ error: "No Jellyfin user target selected" });
    }

    const result = await db.pool.query(
      `
        UPDATE jf_playback_activity
        SET
          "UserId" = $2,
          "UserName" = $3
        WHERE imported = true
        AND "Id" LIKE 'jellystat:%'
        AND "UserId" = $1
      `,
      [sourceUserId, target.Id, target.Name]
    );

    await Promise.all(db.materializedViews.map((view) => db.refreshMaterializedView(view)));
    res.json({ updatedRows: result.rowCount });
  } catch (error) {
    res.status(503).json({ error: error.message || "Unable to link Jellystat user" });
  }
});

module.exports = router;
