const express = require("express");
const { Pool } = require("pg");
const fs = require("fs");
const path = require("path");
const { randomUUID } = require("crypto");
const multer = require("multer");
const jwt = require("jsonwebtoken");

const Logging = require("../classes/logging");
const triggertype = require("../logging/triggertype");
const taskstate = require("../logging/taskstate");
const taskName = require("../logging/taskName");
const sanitizeFilename = require("../utils/sanitizer");
const { getBackupDir } = require("../utils/storage-paths");
const db = require("../db");
const { addAuditEntry } = require("../classes/admin-history");
const { tables } = require("../global/backup_tables");

const { sendUpdate } = require("../ws");

const router = express.Router();
const TaskManager = require("../classes/task-manager-singleton");
const TaskScheduler = require("../classes/task-scheduler-singleton");
const restorableTables = new Set(tables.map((table) => table.value));

// Database connection parameters
const postgresUser = process.env.POSTGRES_USER;
const postgresPassword = process.env.POSTGRES_PASSWORD;
const postgresIp = process.env.POSTGRES_IP;
const postgresPort = process.env.POSTGRES_PORT;
const postgresDatabase = process.env.POSTGRES_DB || "jellyglance";
const postgresSslRejectUnauthorized = process.env.POSTGRES_SSL_REJECT_UNAUTHORIZED === undefined ? true : process.env.POSTGRES_SSL_REJECT_UNAUTHORIZED === "true";
const jwtSecret = process.env.JWT_SECRET;

// Restore function

function readFile(path) {
  return new Promise((resolve, reject) => {
    fs.readFile(path, "utf8", (err, data) => {
      if (err) {
        reject(err);
        return;
      }
      const json = JSON.parse(data);
      resolve(json);
    });
  });
}

function getBirthtimeFallback(fileStats, fileName) {
  // Try to get birthtime metadata
  if (fileStats.birthtime && fileStats.birthtime.getTime() > 0) {
    return fileStats.birthtime;
  }

  // Fallback to changetime
  if (fileStats.ctime && fileStats.ctime.getTime() > 0) {
    return fileStats.ctime;
  }

  // Fallback to modified time
  if (fileStats.mtime && fileStats.mtime.getTime() > 0) {
    return fileStats.mtime;
  }

  // Fallback to filename parsing
  // format is 4digits-2digis-2digits(' ' or '_' or 'T')
  // 2digits('-' or ':')2digits('-' or ':')2digits
  const regexp = /(\d{4})-(\d{2})-(\d{2})[ _T](\d{2})[-:](\d{2})[-:](\d{2})/;
  const matches = fileName.match(regexp);
  if (!matches)
    return null;

  // Verify that each regex match is a valid number
  for (var i=1; i<7; i++) {
    if (Number.isNaN(Number(matches[i])))
      return null;
  }

  return new Date(matches[1], matches[2]-1, matches[3], matches[4], matches[5], matches[6]);
}

function quoteIdentifier(identifier) {
  return `"${identifier.replace(/"/g, '""')}"`;
}

async function getTableColumns(pool, tableName) {
  const { rows } = await pool.query(
    `
      SELECT column_name
      FROM information_schema.columns
      WHERE table_schema = 'public'
      AND table_name = $1
    `,
    [tableName]
  );

  return new Set(rows.map((row) => row.column_name));
}

function getBackupTableEntry(table) {
  if (!table || typeof table !== "object" || Array.isArray(table)) {
    return null;
  }

  const keys = Object.keys(table);
  if (keys.length !== 1) {
    return null;
  }

  const tableName = keys[0];
  const data = table[tableName];

  if (!Array.isArray(data)) {
    return null;
  }

  return { tableName, data };
}

async function restore(file, refLog) {
  refLog.logData.push({ color: "lawngreen", Message: "Starting Restore" });
  refLog.logData.push({
    color: "yellow",
    Message: "Restoring from Backup: " + file,
  });

  let jsonData;

  try {
    // Use await to wait for the Promise to resolve
    jsonData = await readFile(file);
  } catch (err) {
    refLog.logData.push({
      color: "red",
      Message: `Failed to read backup file`,
    });
    Logging.updateLog(refLog.uuid, refLog.logData, taskstate.FAILED);
    console.error(err);
    throw err;
  }

  // console.log(jsonData);
  if (!jsonData) {
    console.log("No Data");
    return;
  }

  if (!Array.isArray(jsonData)) {
    throw new Error("Backup file must be a JSON array of table exports");
  }

  const restoredTables = [];
  const skippedTables = [];
  const skippedColumns = {};
  let restoredRows = 0;

  const pool = new Pool({
    user: postgresUser,
    password: postgresPassword,
    host: postgresIp,
    port: postgresPort,
    database: postgresDatabase,
    ...(process.env.POSTGRES_SSL_ENABLED === "true"
      ? { ssl: { rejectUnauthorized: postgresSslRejectUnauthorized } }
      : {}),
  });

  try {
    for (let table of jsonData) {
      const tableEntry = getBackupTableEntry(table);

      if (!tableEntry) {
        refLog.logData.push({
          color: "yellow",
          Message: "Skipping invalid backup table entry",
        });
        continue;
      }

      const { data, tableName } = tableEntry;

      if (!restorableTables.has(tableName)) {
        skippedTables.push(tableName);
        refLog.logData.push({
          color: "yellow",
          key: tableName,
          Message: `Skipping unsupported table ${tableName}`,
        });
        continue;
      }

      const tableColumns = await getTableColumns(pool, tableName);
      restoredTables.push(tableName);
      refLog.logData.push({
        color: "dodgerblue",
        key: tableName,
        Message: `Restoring ${tableName}`,
      });
      for (let index in data) {
        const row = data[index];

        if (!row || typeof row !== "object" || Array.isArray(row)) {
          continue;
        }

        const rowKeys = Object.keys(row);
        const filteredKeys = rowKeys.filter((key) => tableColumns.has(key));
        const ignoredKeys = rowKeys.filter((key) => !tableColumns.has(key));

        if (ignoredKeys.length > 0) {
          skippedColumns[tableName] = Array.from(new Set([...(skippedColumns[tableName] || []), ...ignoredKeys]));
        }

        if (filteredKeys.length === 0) {
          continue;
        }

        const keyString = filteredKeys.map(quoteIdentifier).join(", ");
        const placeholders = filteredKeys.map((_, keyIndex) => `$${keyIndex + 1}`).join(", ");
        const values = filteredKeys.map((key) => {
          const value = row[key];
          return value && typeof value === "object" ? JSON.stringify(value) : value;
        });

        const query = `INSERT INTO ${quoteIdentifier(tableName)} (${keyString}) VALUES(${placeholders}) ON CONFLICT DO NOTHING`;
        const result = await pool.query(query, values);
        restoredRows += result.rowCount;
      }
    }

    for (const view of db.materializedViews) {
      const refresh = await db.refreshMaterializedView(view);
      refLog.logData.push({
        color: refresh.Result === "SUCCESS" ? "lawngreen" : "red",
        Message: refresh.message,
      });
    }

    refLog.logData.push({ color: "lawngreen", Message: "Restore Complete" });

    return {
      restoredRows,
      restoredTables,
      skippedTables,
      skippedColumns,
      refreshedViews: db.materializedViews,
    };
  } finally {
    await pool.end();
  }
}

// Route handler for backup endpoint
router.get("/beginBackup", async (req, res) => {
  try {
    const taskManager = new TaskManager().getInstance();
    const taskScheduler = new TaskScheduler().getInstance();
    const success = taskManager.addTask({
      task: taskManager.taskList.Backup,
      onComplete: async () => {
        console.log("Backup completed successfully");
        await taskScheduler.getTaskHistory();
        res.send("Backup completed successfully");
      },
      onError: (error) => {
        console.error(error);
        res.status(500).send("Backup failed");
        sendUpdate("BackupTask", { type: "Error", message: "Error: Backup failed" });
      },
    });
    if (!success) {
      res.status(500).send("Backup already running");
      sendUpdate("BackupTask", { type: "Error", message: "Backup is already running" });
      return;
    }

    taskManager.startTask(taskManager.taskList.Backup, triggertype.Manual);
  } catch (error) {
    console.error(error);
    res.status(500).send("Backup failed");
  }
});

router.get("/restore/:filename", async (req, res) => {
  const uuid = randomUUID();
  let refLog = { logData: [], uuid: uuid };

  try {
    Logging.insertLog(uuid, triggertype.Manual, taskName.restore);

    const filename = sanitizeFilename(req.params.filename);
    const filePath = path.join(getBackupDir(), filename);

    const restoreResult = await restore(filePath, refLog);
    Logging.updateLog(uuid, refLog.logData, taskstate.SUCCESS);
    await addAuditEntry(req, "backup.restored", { filename, restoredRows: restoreResult?.restoredRows || 0 });

    res.json({
      message: "Restore completed successfully",
      ...restoreResult,
    });
    sendUpdate("GeneralAlert", { type: "Success", message: "Restore completed successfully. Dashboard data refreshed." });
    sendUpdate("BackupRestore", { type: "Success", message: "Restore completed successfully", ...restoreResult });
  } catch (error) {
    console.error(error);
    refLog.logData.push({ color: "red", Message: `Restore failed: ${error.message}` });
    Logging.updateLog(uuid, refLog.logData, taskstate.FAILED);
    res.status(500).send(error.message || "Restore failed");
  }
});

router.get("/files", (req, res) => {
  try {
    const directoryPath = getBackupDir();
    if (!fs.existsSync(directoryPath)) {
      fs.mkdirSync(directoryPath, { recursive: true });
    }
    fs.readdir(directoryPath, (err, files) => {
      if (err) {
        res.status(500).send("Unable to read directory");
      } else {
        const fileData = files
          .filter((file) => file.endsWith(".json"))
          .map((file) => {
            const filePath = path.join(directoryPath, file);
            const stats = fs.statSync(filePath);
            return {
              name: file,
              size: stats.size,
              datecreated: getBirthtimeFallback(stats, file),
            };
          });
        res.json(fileData);
      }
    });
  } catch (error) {
    console.log(error);
  }
});

router.get("/summary", (req, res) => {
  try {
    const directoryPath = getBackupDir();
    if (!fs.existsSync(directoryPath)) {
      fs.mkdirSync(directoryPath, { recursive: true });
    }

    fs.readdir(directoryPath, (err, files) => {
      if (err) {
        res.status(500).send("Unable to read directory");
        return;
      }

      const backupFiles = files
        .filter((file) => file.endsWith(".json"))
        .map((file) => {
          const filePath = path.join(directoryPath, file);
          const stats = fs.statSync(filePath);
          return {
            name: file,
            size: stats.size,
            datecreated: getBirthtimeFallback(stats, file),
          };
        })
        .sort((a, b) => new Date(b.datecreated) - new Date(a.datecreated));

      res.json({
        count: backupFiles.length,
        latestBackup: backupFiles[0] || null,
      });
    });
  } catch (error) {
    console.error(error);
    res.status(500).send("Unable to read backup summary");
  }
});

router.get("/files/:filename/ticket", (req, res) => {
  try {
    const filename = sanitizeFilename(req.params.filename);
    const filePath = path.join(getBackupDir(), filename);

    if (!fs.existsSync(filePath)) {
      res.status(404).send("Backup file not found");
      return;
    }

    const ticket = jwt.sign(
      {
        purpose: "backup-download",
        filename,
      },
      jwtSecret,
      { expiresIn: "2m" }
    );

    res.json({
      url: `/backup-download/${encodeURIComponent(filename)}?ticket=${encodeURIComponent(ticket)}`,
      expiresInSeconds: 120,
    });
  } catch (error) {
    console.error(error);
    res.status(500).send("Unable to create backup download link");
  }
});

//download backup file
router.get("/files/:filename", (req, res) => {
  try {
    const filename = sanitizeFilename(req.params.filename);
    const filePath = path.join(getBackupDir(), filename);

    if (!fs.existsSync(filePath)) {
      res.status(404).send("Backup file not found");
      return;
    }

    res.download(filePath, filename, (error) => {
      if (error && !res.headersSent) {
        console.error(error);
        res.status(500).send("Unable to download backup file");
      }
    });
  } catch (error) {
    console.error(error);
    res.status(500).send("Unable to download backup file");
  }
});

//delete backup
router.delete("/files/:filename", (req, res) => {
  try {
    const filename = sanitizeFilename(req.params.filename);
    const filePath = path.join(getBackupDir(), filename);

    fs.unlink(filePath, (err) => {
      if (err) {
        console.error(err);
        res.status(500).send("An error occurred while deleting the file.");
        return;
      }

      console.log(`${filePath} has been deleted.`);
      res.status(200).send(`${filePath} has been deleted.`);
    });
  } catch (error) {
    res.status(500).send("An error occurred while deleting the file.");
  }
});

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const destination = getBackupDir();
    if (!fs.existsSync(destination)) {
      fs.mkdirSync(destination, { recursive: true });
    }
    cb(null, destination);
  },
  filename: function (req, file, cb) {
    cb(null, sanitizeFilename(file.originalname));
  },
});

const upload = multer({
  storage: storage,
  fileFilter: function (req, file, cb) {
    const safeName = sanitizeFilename(file.originalname);
    if (!safeName.endsWith(".json")) {
      cb(new Error("Only JSON backup files can be uploaded"));
      return;
    }
    cb(null, true);
  },
  limits: { fileSize: 1024 * 1024 * 512 },
});

router.post("/upload", (req, res) => {
  upload.single("file")(req, res, (error) => {
    if (error) {
      res.status(400).send(error.message);
      return;
    }

    if (!req.file) {
      res.status(400).send("No backup file uploaded");
      return;
    }

    res.json({
      fileName: req.file.filename,
      filePath: req.file.path,
    });
  });
});

// Handle other routes
router.use((req, res) => {
  res.status(404).send({ error: "Not Found" });
});

module.exports = router;
