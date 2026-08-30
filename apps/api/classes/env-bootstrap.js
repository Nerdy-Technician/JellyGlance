const { randomUUID } = require("crypto");
const CryptoJS = require("crypto-js");
const db = require("../db");
const JellyfinAPI = require("./jellyfin-api");
const TaskManager = require("./task-manager-singleton");
const triggertype = require("../logging/triggertype");

function envFlag(name) {
  return String(process.env[name] || "")
    .trim()
    .toLowerCase() === "true";
}

function hashLocalPassword(password) {
  return CryptoJS.SHA3(String(password || "")).toString();
}

async function readAppConfigRow() {
  const { rows } = await db.query('SELECT * FROM app_config where "ID"=1');
  return rows[0] || null;
}

function getConfigState(row) {
  if (!row) return 0;
  const hasJellyfinApiKey =
    row.JF_API_KEY !== null && !(typeof row.JF_API_KEY === "string" && row.JF_API_KEY.trim() === "");
  const hasAdminUser = row.APP_USER !== null && row.APP_USER !== "";
  if (hasJellyfinApiKey && hasAdminUser) return 2;
  if (hasJellyfinApiKey) return 1;
  return 0;
}

async function bootstrapJellyfinFromEnv(row) {
  const host = String(process.env.JF_HOST || "").trim();
  const apiKey = String(process.env.JF_API_KEY || "").trim();
  if (!host || !apiKey) {
    return { applied: false, reason: "JF_HOST and JF_API_KEY are required to skip Jellyfin setup" };
  }

  const API = new JellyfinAPI();
  const validation = await API.validateSettings(host, apiKey);
  if (!validation?.isValid) {
    throw new Error(validation?.errorMessage || "Unable to validate Jellyfin connection from env");
  }

  const cleanedUrl = validation.cleanedUrl || host;
  if (!row) {
    await db.query(
      'INSERT INTO app_config ("ID","JF_HOST","JF_API_KEY","APP_USER","APP_PASSWORD") VALUES (1,$1,$2,null,null)',
      [cleanedUrl, apiKey]
    );
  } else {
    await db.query('UPDATE app_config SET "JF_HOST"=$1, "JF_API_KEY"=$2 where "ID"=1', [cleanedUrl, apiKey]);
  }

  try {
    const systemInfo = await API.systemInfo();
    if (systemInfo && Object.keys(systemInfo).length > 0) {
      const current = (await readAppConfigRow()) || {};
      const settings = {
        ...(current.settings || {}),
        Tasks: systemInfo.Id || (current.settings || {}).Tasks,
      };
      await db.query('UPDATE app_config SET settings=$1 where "ID"=1', [settings]);
    }
  } catch (error) {
    console.warn("[BOOTSTRAP] Unable to store Jellyfin system info:", error.message);
  }

  return { applied: true };
}

async function bootstrapLocalAuthFromEnv(row) {
  const mode = String(process.env.JS_AUTH_MODE || "").trim().toLowerCase();
  if (mode && mode !== "local") {
    return { applied: false, reason: `JS_AUTH_MODE=${mode} is not supported for env bootstrap yet` };
  }

  const username = String(process.env.JS_USER || "").trim();
  const rawPassword = process.env.JS_PASSWORD;
  if (!username || rawPassword === undefined || rawPassword === null || String(rawPassword) === "") {
    return { applied: false, reason: "JS_USER and JS_PASSWORD are required for local auth bootstrap" };
  }

  const password = hashLocalPassword(rawPassword);
  if (password === hashLocalPassword("")) {
    return { applied: false, reason: "JS_PASSWORD cannot be empty" };
  }

  const settings = {
    ...(row?.settings || {}),
    auth: {
      mode: "local",
      label: "Local JellyGlance login",
    },
    firstRunExtrasPending: true,
    localUsers: [
      ...((row?.settings || {}).localUsers || []).filter((user) => user.username !== username),
      {
        id: randomUUID(),
        username,
        password,
        role: "Admin",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ],
  };

  await db.query(
    'UPDATE app_config SET "APP_USER"=$1, "APP_PASSWORD"=$2, "REQUIRE_LOGIN"=$3, settings=$4 where "ID"=1',
    ["local-auth", null, true, settings]
  );

  return { applied: true };
}

async function skipFirstRunExtras() {
  const row = await readAppConfigRow();
  if (!row) return { applied: false };

  const completedAt = new Date().toISOString();
  const settings = {
    ...(row.settings || {}),
    firstRunExtrasPending: false,
    firstRunExtrasCompleted: true,
    firstRunExtrasCompletedAt: completedAt,
  };

  if (envFlag("JS_AUTO_START_SYNC")) {
    settings.firstRunSyncStartedAt = completedAt;
  }

  await db.query('UPDATE app_config SET settings=$1 where "ID"=1', [settings]);
  return { applied: true, completedAt };
}

function queueFirstRunJellyfinTasks() {
  const taskManager = new TaskManager().getInstance();
  const taskQueue = ["JellyfinSync", "PartialJellyfinSync", "JellyfinPlaybackReportingPluginSync", "RefreshDashboardStats"];
  let index = 0;

  const startNextTask = () => {
    const taskKey = taskQueue[index];
    index += 1;
    if (!taskKey) return;

    const task = taskManager.taskList[taskKey];
    if (!task || taskManager.isTaskRunning(task.name)) {
      startNextTask();
      return;
    }

    const added = taskManager.addTask({
      task,
      onComplete: startNextTask,
      onError: (error) => {
        console.log(`[BOOTSTRAP] ${task.name} failed: ${error.message}`);
        startNextTask();
      },
      onExit: startNextTask,
    });

    if (!added) {
      startNextTask();
      return;
    }

    taskManager.startTask(task, triggertype.Automatic);
  };

  startNextTask();
}

/**
 * Seed app_config from environment so Docker/Compose can skip the first-run wizard.
 * Safe to call repeatedly — only writes when state is incomplete and required env is present.
 */
async function bootstrapFromEnv({ afterTaskManager = false } = {}) {
  const row = await readAppConfigRow();
  let state = getConfigState(row);
  const summary = { stateBefore: state, jellyfin: false, auth: false, skipFirstRun: false, autoSync: false };

  if (state < 1) {
    const jellyfin = await bootstrapJellyfinFromEnv(row);
    summary.jellyfin = Boolean(jellyfin.applied);
    if (jellyfin.applied) {
      console.log("[BOOTSTRAP] Jellyfin connection seeded from JF_HOST / JF_API_KEY");
    } else if (process.env.JF_HOST || process.env.JF_API_KEY) {
      console.warn(`[BOOTSTRAP] ${jellyfin.reason}`);
    }
  }

  const refreshed = await readAppConfigRow();
  state = getConfigState(refreshed);

  if (state === 1 && (process.env.JS_AUTH_MODE || process.env.JS_USER || process.env.JS_PASSWORD)) {
    const auth = await bootstrapLocalAuthFromEnv(refreshed);
    summary.auth = Boolean(auth.applied);
    if (auth.applied) {
      console.log("[BOOTSTRAP] Local admin auth seeded from JS_USER / JS_PASSWORD");
    } else if (auth.reason) {
      console.warn(`[BOOTSTRAP] ${auth.reason}`);
    }
  }

  const finalRow = await readAppConfigRow();
  state = getConfigState(finalRow);
  summary.stateAfter = state;

  if (afterTaskManager && state === 2 && envFlag("JS_SKIP_FIRST_RUN")) {
    const extras = await skipFirstRunExtras();
    summary.skipFirstRun = Boolean(extras.applied);
    if (extras.applied) {
      console.log("[BOOTSTRAP] First-run extras marked complete (JS_SKIP_FIRST_RUN)");
    }
    if (envFlag("JS_AUTO_START_SYNC")) {
      queueFirstRunJellyfinTasks();
      summary.autoSync = true;
      console.log("[BOOTSTRAP] Queued first-run Jellyfin sync tasks (JS_AUTO_START_SYNC)");
    }
  }

  return summary;
}

module.exports = {
  bootstrapFromEnv,
  queueFirstRunJellyfinTasks,
};
