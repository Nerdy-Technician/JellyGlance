const express = require("express");
const {
  enrichRequest,
  enrichRequestPayload,
  getRequestPreferences,
  saveRequestPreferences,
  listProviders,
  getUserRequestFolders,
  getUserRequestFoldersMap,
  saveUserRequestFolders,
  listRequestFolderOptions,
  syncUserFolderOverridesToSeerr,
} = require("../classes/request-provider");

/**
 * Extra request endpoints (preferences, home summary, providers).
 * Core Seerr CRUD remains on api.js /api/requests* for compatibility.
 */
const router = express.Router();

router.get("/requests/preferences", async (req, res) => {
  try {
    res.send({
      preferences: await getRequestPreferences(),
      providers: listProviders(),
      userFolders: await getUserRequestFolders(req.user),
    });
  } catch (error) {
    console.error("Get request preferences failed:", error);
    res.status(503).send({ error: "Unable to load request preferences" });
  }
});

router.put("/requests/preferences", async (req, res) => {
  try {
    const preferences = await saveRequestPreferences(req.body || {});
    res.send({ preferences, providers: listProviders() });
  } catch (error) {
    console.error("Save request preferences failed:", error);
    res.status(503).send({ error: "Unable to save request preferences" });
  }
});

router.get("/requests/providers", async (_req, res) => {
  try {
    res.send({ providers: listProviders() });
  } catch (error) {
    res.status(503).send({ error: "Unable to list request providers" });
  }
});

router.get("/requests/folder-options", async (_req, res) => {
  try {
    res.send(await listRequestFolderOptions());
  } catch (error) {
    console.error("List request folder options failed:", error);
    res.status(503).send({ error: "Unable to load Seerr root folders" });
  }
});

router.get("/requests/user-folders", async (_req, res) => {
  try {
    res.send({ folders: await getUserRequestFoldersMap() });
  } catch (error) {
    console.error("Get user request folders failed:", error);
    res.status(503).send({ error: "Unable to load user request folders" });
  }
});

router.put("/requests/user-folders/:userId", async (req, res) => {
  try {
    const folders = await saveUserRequestFolders(req.params.userId, req.body || {});
    const sync = await syncUserFolderOverridesToSeerr(req.params.userId, folders);
    res.send({ userId: req.params.userId, folders, sync });
  } catch (error) {
    console.error("Save user request folders failed:", error);
    res.status(error.statusCode || 503).send({ error: error.message || "Unable to save user request folders" });
  }
});

module.exports = {
  router,
  enrichRequest,
  enrichRequestPayload,
};
