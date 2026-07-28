const express = require("express");
const fs = require("fs");
const path = require("path");
const { execFile } = require("child_process");
const { randomUUID } = require("crypto");
const multer = require("multer");

const db = require("../db");

const router = express.Router();
const DEFAULT_TAUTULLI_DIR = process.env.JS_TAUTULLI_BACKUP_DIR || "/mnt/Archive/Docker/Media/Tautulli";
const UPLOAD_DIR = path.join(__dirname, "..", "backup-data", "tautulli-uploads");
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

function getBackupTimestamp(fileName) {
  const match = fileName.match(/tautulli\.backup-(\d{14})/i);
  if (!match) return null;
  const value = match[1];
  return new Date(
    Date.UTC(
      Number(value.slice(0, 4)),
      Number(value.slice(4, 6)) - 1,
      Number(value.slice(6, 8)),
      Number(value.slice(8, 10)),
      Number(value.slice(10, 12)),
      Number(value.slice(12, 14))
    )
  );
}

function isTautulliBackup(fileName) {
  return /\.(db|db\.zip|zip)$/i.test(fileName);
}

fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const upload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => cb(null, UPLOAD_DIR),
    filename: (req, file, cb) => {
      const lowerName = file.originalname.toLowerCase();
      const extension = lowerName.endsWith(".db.zip") ? ".db.zip" : path.extname(file.originalname).toLowerCase();
      cb(null, `${randomUUID()}${extension || ".db"}`);
    },
  }),
  limits: { fileSize: 1024 * 1024 * 512 },
  fileFilter: (req, file, cb) => {
    if (!isTautulliBackup(file.originalname)) {
      cb(new Error("Upload a Tautulli .db, .db.zip, or .zip backup file."));
      return;
    }
    cb(null, true);
  },
});

function listTautulliBackups(sourceDir = DEFAULT_TAUTULLI_DIR) {
  const resolvedDir = path.resolve(sourceDir);
  const entries = fs.readdirSync(resolvedDir, { withFileTypes: true });
  return entries
    .filter((entry) => entry.isFile() && isTautulliBackup(entry.name))
    .map((entry) => {
      const filePath = path.join(resolvedDir, entry.name);
      const stat = fs.statSync(filePath);
      const timestamp = getBackupTimestamp(entry.name);
      return {
        name: entry.name,
        path: filePath,
        size: stat.size,
        modifiedAt: stat.mtime.toISOString(),
        backupDate: timestamp ? timestamp.toISOString() : stat.mtime.toISOString(),
      };
    })
    .sort((a, b) => new Date(b.backupDate) - new Date(a.backupDate));
}

function resolveBackupPath(sourcePath) {
  const target = sourcePath || listTautulliBackups()[0]?.path;
  if (!target) {
    throw new Error("No Tautulli backup files found.");
  }

  const resolved = path.resolve(target);
  if (!fs.existsSync(resolved)) {
    throw new Error("Tautulli backup file not found.");
  }

  if (!isTautulliBackup(path.basename(resolved))) {
    throw new Error("Expected a Tautulli backup .db or .db.zip file.");
  }

  return resolved;
}

function resolveUploadedBackup(uploadId) {
  if (!uploadId) {
    throw new Error("No uploaded Tautulli backup selected.");
  }

  const fileName = path.basename(uploadId);
  if (fileName !== uploadId || !isTautulliBackup(fileName)) {
    throw new Error("Invalid uploaded Tautulli backup reference.");
  }

  const filePath = path.join(UPLOAD_DIR, fileName);
  if (!fs.existsSync(filePath)) {
    throw new Error("Uploaded Tautulli backup has expired or was removed.");
  }

  return filePath;
}

function resolveImportSource(body = {}) {
  if (body.uploadId) {
    return resolveUploadedBackup(body.uploadId);
  }
  return resolveBackupPath(body.path);
}

function runTautulliExport(sourcePath, summary = false) {
  const scriptPath = path.join(__dirname, "..", "scripts", "tautulli_history_export.py");
  const args = [scriptPath, sourcePath];
  if (summary) args.push("--summary");

  return new Promise((resolve, reject) => {
    execFile("python3", args, { maxBuffer: 1024 * 1024 * 64 }, (error, stdout, stderr) => {
      if (error) {
        error.message = stderr || error.message;
        reject(error);
        return;
      }

      try {
        resolve(JSON.parse(stdout));
      } catch (parseError) {
        parseError.message = `Unable to parse Tautulli export output: ${parseError.message}`;
        reject(parseError);
      }
    });
  });
}

async function mapUsersByName(rows) {
  const userResult = await db.query('SELECT "Id", "Name" FROM jf_users');
  const users = userResult?.rows || [];
  const userMap = new Map(users.map((user) => [String(user.Name || "").trim().toLowerCase(), user]));

  return rows.map((row) => {
    const jellyfinUser = userMap.get(String(row.UserName || "").trim().toLowerCase());
    if (!jellyfinUser) return row;
    return { ...row, UserId: jellyfinUser.Id, UserName: jellyfinUser.Name };
  });
}

function normalizeMediaTitle(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

function addLookupEntry(map, key, value) {
  if (key && !map.has(key)) {
    map.set(key, value);
  }
}

async function mapMediaByJellyfinLibrary(rows) {
  const [episodesResult, itemsResult] = await Promise.all([
    db.query(`
      SELECT "EpisodeId", "SeasonId", "SeriesId", "Name", "SeriesName", "IndexNumber", "ParentIndexNumber"
      FROM jf_library_episodes
      WHERE COALESCE(archived, false) = false
    `),
    db.query(`
      SELECT "Id", "Name", "Type", "ProductionYear"
      FROM jf_library_items
      WHERE COALESCE(archived, false) = false
      AND "Type" IN ('Movie', 'Series')
    `),
  ]);

  const episodeLookup = new Map();
  (episodesResult?.rows || []).forEach((episode) => {
    const seriesName = normalizeMediaTitle(episode.SeriesName);
    const episodeName = normalizeMediaTitle(episode.Name);
    const seasonNumber = Number(episode.ParentIndexNumber);
    const episodeNumber = Number(episode.IndexNumber);
    addLookupEntry(episodeLookup, `${seriesName}|${seasonNumber}|${episodeNumber}`, episode);
    addLookupEntry(episodeLookup, `${seriesName}|${episodeName}`, episode);
  });

  const itemLookup = new Map();
  (itemsResult?.rows || []).forEach((item) => {
    const title = normalizeMediaTitle(item.Name);
    const year = Number(item.ProductionYear || 0);
    addLookupEntry(itemLookup, `${item.Type}|${title}|${year || ""}`, item);
    addLookupEntry(itemLookup, `${item.Type}|${title}`, item);
  });

  let matchedRows = 0;
  const mappedRows = rows.map((row) => {
    const mediaType = String(row.TautulliMediaType || "").toLowerCase();
    if (mediaType === "episode") {
      const seriesName = normalizeMediaTitle(row.SeriesName || row.TautulliFullTitle);
      const episodeName = normalizeMediaTitle(row.NowPlayingItemName);
      const seasonNumber = Number(row.TautulliSeasonNumber);
      const episodeNumber = Number(row.TautulliEpisodeNumber);
      const match =
        episodeLookup.get(`${seriesName}|${seasonNumber}|${episodeNumber}`) ||
        episodeLookup.get(`${seriesName}|${episodeName}`);

      if (match?.EpisodeId && match?.SeriesId) {
        matchedRows += 1;
        return {
          ...row,
          NowPlayingItemId: match.SeriesId,
          EpisodeId: match.EpisodeId,
          SeasonId: match.SeasonId,
          SeriesName: match.SeriesName || row.SeriesName,
          NowPlayingItemName: match.Name || row.NowPlayingItemName,
        };
      }
    }

    const type = mediaType === "show" || mediaType === "season" ? "Series" : "Movie";
    const title = normalizeMediaTitle(row.NowPlayingItemName || row.TautulliFullTitle);
    const year = Number(row.TautulliYear || 0);
    const match = itemLookup.get(`${type}|${title}|${year || ""}`) || itemLookup.get(`${type}|${title}`);
    if (match?.Id) {
      matchedRows += 1;
      return {
        ...row,
        NowPlayingItemId: match.Id,
        NowPlayingItemName: match.Name || row.NowPlayingItemName,
      };
    }

    return row;
  });

  return { rows: mappedRows, matchedRows };
}

async function repairExistingImportedMediaMatches(rows) {
  const matchedRows = rows.filter((row) => !String(row.NowPlayingItemId || "").startsWith("tautulli:"));
  if (!matchedRows.length) return 0;

  let repairedRows = 0;
  const batchSize = 500;
  for (let index = 0; index < matchedRows.length; index += batchSize) {
    const payload = JSON.stringify(
      matchedRows.slice(index, index + batchSize).map((row) => ({
        Id: row.Id,
        NowPlayingItemId: row.NowPlayingItemId,
        NowPlayingItemName: row.NowPlayingItemName,
        EpisodeId: row.EpisodeId,
        SeasonId: row.SeasonId,
        SeriesName: row.SeriesName,
      }))
    );

    const result = await db.pool.query(
      `
        WITH payload AS (
          SELECT *
          FROM jsonb_to_recordset($1::jsonb) AS x(
            "Id" text,
            "NowPlayingItemId" text,
            "NowPlayingItemName" text,
            "EpisodeId" text,
            "SeasonId" text,
            "SeriesName" text
          )
        )
        UPDATE jf_playback_activity a
        SET
          "NowPlayingItemId" = p."NowPlayingItemId",
          "NowPlayingItemName" = p."NowPlayingItemName",
          "EpisodeId" = p."EpisodeId",
          "SeasonId" = p."SeasonId",
          "SeriesName" = p."SeriesName"
        FROM payload p
        WHERE a."Id" = p."Id"
        AND a.imported = true
        AND a."Id" LIKE 'tautulli:%'
        AND a."NowPlayingItemId" LIKE 'tautulli:%'
      `,
      [payload]
    );
    repairedRows += result.rowCount;
  }

  return repairedRows;
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

router.get("/backups", async (req, res) => {
  try {
    res.json({ defaultPath: DEFAULT_TAUTULLI_DIR, files: listTautulliBackups(req.query.path || DEFAULT_TAUTULLI_DIR) });
  } catch (error) {
    res.status(503).json({ error: error.message || "Unable to list Tautulli backups" });
  }
});

router.post("/preview", async (req, res) => {
  try {
    const sourcePath = resolveImportSource(req.body);
    const [summary, importedCount] = await Promise.all([
      runTautulliExport(sourcePath, true),
      db.query('SELECT count(*)::int AS "Count" FROM jf_playback_activity WHERE "Id" LIKE $1', ["tautulli:%"]),
    ]);

    res.json({
      ...summary,
      alreadyImportedRows: Number(importedCount.rows?.[0]?.Count || 0),
    });
  } catch (error) {
    res.status(503).json({ error: error.message || "Unable to preview Tautulli backup" });
  }
});

router.post("/upload-preview", (req, res) => {
  upload.single("file")(req, res, async (error) => {
    if (error) {
      res.status(400).json({ error: error.message || "Unable to upload Tautulli backup" });
      return;
    }
    if (!req.file) {
      res.status(400).json({ error: "No Tautulli backup uploaded" });
      return;
    }

    try {
      const [summary, importedCount] = await Promise.all([
        runTautulliExport(req.file.path, true),
        db.query('SELECT count(*)::int AS "Count" FROM jf_playback_activity WHERE "Id" LIKE $1', ["tautulli:%"]),
      ]);
      res.json({
        ...summary,
        uploadId: req.file.filename,
        originalName: req.file.originalname,
        size: req.file.size,
        alreadyImportedRows: Number(importedCount.rows?.[0]?.Count || 0),
      });
    } catch (previewError) {
      fs.rm(req.file.path, { force: true }, () => {});
      res.status(503).json({ error: previewError.message || "Unable to preview uploaded Tautulli backup" });
    }
  });
});

router.post("/import", async (req, res) => {
  try {
    const sourcePath = resolveImportSource(req.body);
    const exportData = await runTautulliExport(sourcePath);
    const userMappedRows = await mapUsersByName(exportData.rows || []);
    const mediaMapped = await mapMediaByJellyfinLibrary(userMappedRows);
    const insertedRows = await insertHistoryRows(mediaMapped.rows);
    const repairedRows = await repairExistingImportedMediaMatches(mediaMapped.rows);
    if (repairedRows > 0) {
      await Promise.all(db.materializedViews.map((view) => db.refreshMaterializedView(view)));
    }
    if (req.body?.uploadId) {
      fs.rm(sourcePath, { force: true }, () => {});
    }

    res.json({
      sourceFile: exportData.sourceFile,
      totalRows: exportData.totalRows,
      insertedRows,
      matchedJellyfinRows: mediaMapped.matchedRows,
      repairedRows,
      skippedRows: Math.max(0, Number(exportData.totalRows || 0) - insertedRows),
      firstActivityDate: exportData.firstActivityDate,
      lastActivityDate: exportData.lastActivityDate,
    });
  } catch (error) {
    console.error("Tautulli import failed:", error);
    res.status(503).json({ error: error.message || "Unable to import Tautulli history" });
  }
});

router.get("/unmatched", async (req, res) => {
  try {
    const limit = Math.min(Number(req.query.limit || 50), 200);
    const { rows } = await db.pool.query(
      `
        SELECT
          COALESCE("SeriesName", '') AS "SeriesName",
          "NowPlayingItemName",
          CASE WHEN "SeriesName" IS NULL THEN 'Movie' ELSE 'Episode' END AS "MediaType",
          count(*)::int AS "PlayCount",
          min("ActivityDateInserted") AS "FirstActivityDate",
          max("ActivityDateInserted") AS "LastActivityDate",
          array_agg("Id" ORDER BY "ActivityDateInserted" DESC) AS "Ids"
        FROM jf_playback_activity
        WHERE imported = true
        AND "Id" LIKE 'tautulli:%'
        AND "NowPlayingItemId" LIKE 'tautulli:%'
        GROUP BY COALESCE("SeriesName", ''), "NowPlayingItemName", CASE WHEN "SeriesName" IS NULL THEN 'Movie' ELSE 'Episode' END
        ORDER BY count(*) DESC, max("ActivityDateInserted") DESC
        LIMIT $1
      `,
      [limit]
    );
    res.json(rows);
  } catch (error) {
    res.status(503).json({ error: error.message || "Unable to load unmatched Tautulli rows" });
  }
});

router.get("/search-media", async (req, res) => {
  try {
    const search = String(req.query.search || "").trim().toLowerCase();
    if (search.length < 2) {
      return res.json([]);
    }

    const like = `%${search}%`;
    const { rows } = await db.pool.query(
      `
        SELECT *
        FROM (
          SELECT
            i."Id",
            i."Name",
            i."Type",
            i."ProductionYear",
            null::text AS "EpisodeId",
            null::text AS "SeasonId",
            null::text AS "SeriesId",
            null::text AS "SeriesName",
            null::int AS "SeasonNumber",
            null::int AS "EpisodeNumber"
          FROM jf_library_items i
          WHERE COALESCE(i.archived, false) = false
          AND i."Type" IN ('Movie', 'Series')
          AND lower(i."Name") LIKE $1

          UNION ALL

          SELECT
            e."SeriesId" AS "Id",
            e."Name",
            'Episode' AS "Type",
            e."ProductionYear",
            e."EpisodeId",
            e."SeasonId",
            e."SeriesId",
            e."SeriesName",
            e."ParentIndexNumber" AS "SeasonNumber",
            e."IndexNumber" AS "EpisodeNumber"
          FROM jf_library_episodes e
          WHERE COALESCE(e.archived, false) = false
          AND (
            lower(e."Name") LIKE $1
            OR lower(e."SeriesName") LIKE $1
            OR lower(concat(e."SeriesName", ' ', e."Name")) LIKE $1
          )
        ) results
        ORDER BY
          CASE "Type" WHEN 'Movie' THEN 0 WHEN 'Series' THEN 1 ELSE 2 END,
          "SeriesName" NULLS LAST,
          "Name"
        LIMIT 40
      `,
      [like]
    );

    res.json(rows);
  } catch (error) {
    res.status(503).json({ error: error.message || "Unable to search Jellyfin media" });
  }
});

router.post("/link-media", async (req, res) => {
  try {
    const ids = Array.isArray(req.body?.ids) ? req.body.ids.filter((id) => String(id).startsWith("tautulli:")) : [];
    const target = req.body?.target || {};
    if (!ids.length) {
      return res.status(400).json({ error: "No unmatched Tautulli rows selected" });
    }
    if (!target.Id && !target.id) {
      return res.status(400).json({ error: "No Jellyfin media target selected" });
    }

    const targetType = target.Type || target.type;
    const values = {
      NowPlayingItemId: target.SeriesId || target.Id || target.id,
      NowPlayingItemName: target.Name || target.name,
      EpisodeId: targetType === "Episode" ? target.EpisodeId : null,
      SeasonId: targetType === "Episode" ? target.SeasonId : null,
      SeriesName: targetType === "Episode" ? target.SeriesName : null,
    };

    const result = await db.pool.query(
      `
        UPDATE jf_playback_activity
        SET
          "NowPlayingItemId" = $2,
          "NowPlayingItemName" = $3,
          "EpisodeId" = $4,
          "SeasonId" = $5,
          "SeriesName" = $6
        WHERE "Id" = ANY($1)
        AND imported = true
        AND "Id" LIKE 'tautulli:%'
        AND "NowPlayingItemId" LIKE 'tautulli:%'
      `,
      [ids, values.NowPlayingItemId, values.NowPlayingItemName, values.EpisodeId, values.SeasonId, values.SeriesName]
    );

    await Promise.all(db.materializedViews.map((view) => db.refreshMaterializedView(view)));
    res.json({ updatedRows: result.rowCount });
  } catch (error) {
    res.status(503).json({ error: error.message || "Unable to link Tautulli rows" });
  }
});

module.exports = router;
