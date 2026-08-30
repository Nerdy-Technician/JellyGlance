const db = require("../db");
const { axios } = require("./axios");
const { getIntegrations } = require("./integration-store");

const PROVIDER_SEERR = "seerr";
const PROVIDER_MANUAL = "manual";

const PIPELINE_STAGES = [
  { id: "requested", label: "Requested", statuses: ["pending", "requested"] },
  { id: "approved", label: "Approved", statuses: ["approved", "processing"] },
  { id: "grabbed", label: "Grabbed", statuses: ["available_partial", "partially available", "downloading"] },
  { id: "available", label: "Available", statuses: ["available", "completed"] },
  { id: "declined", label: "Declined", statuses: ["declined", "rejected", "failed"] },
];

const DEFAULT_REQUEST_PREFS = {
  provider: PROVIDER_SEERR,
  is4k: false,
  preferOwnRequestsFirst: true,
  defaultServerId: null,
  defaultProfileId: null,
  defaultRootFolder: null,
  defaultLanguageProfileId: null,
  defaultTags: [],
};

function normalizeStatus(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[_-]+/g, " ");
}

function getPipelineStage(request = {}) {
  const candidates = [
    request.pipelineStatus,
    request.status,
    request.mediaStatus,
    request.mediaInfo?.status,
    request.availability?.status,
  ]
    .map(normalizeStatus)
    .filter(Boolean);

  for (const stage of PIPELINE_STAGES) {
    if (candidates.some((status) => stage.statuses.includes(status) || stage.statuses.some((item) => status.includes(item)))) {
      return stage;
    }
  }

  if (request.availability?.available || request.mediaInfo?.mediaAddedAt) {
    return PIPELINE_STAGES.find((stage) => stage.id === "available");
  }

  return PIPELINE_STAGES[0];
}

function buildRequestTimeline(request = {}) {
  const current = getPipelineStage(request);
  const declined = current.id === "declined";
  return PIPELINE_STAGES.filter((stage) => stage.id !== "declined" || declined).map((stage) => {
    const currentIndex = PIPELINE_STAGES.findIndex((item) => item.id === current.id);
    const stageIndex = PIPELINE_STAGES.findIndex((item) => item.id === stage.id);
    let state = "upcoming";
    if (declined && stage.id === "declined") state = "current";
    else if (!declined && stageIndex < currentIndex) state = "complete";
    else if (!declined && stageIndex === currentIndex) state = "current";
    return {
      id: stage.id,
      label: stage.label,
      state,
    };
  });
}

function enrichRequest(request = {}) {
  const stage = getPipelineStage(request);
  return {
    ...request,
    provider: request.provider || PROVIDER_SEERR,
    pipelineStatus: stage.id,
    pipelineLabel: stage.label,
    timeline: buildRequestTimeline({ ...request, pipelineStatus: stage.id }),
  };
}

function enrichRequestPayload(payload = {}) {
  const requests = Array.isArray(payload.requests) ? payload.requests.map(enrichRequest) : [];
  const byStage = PIPELINE_STAGES.reduce((acc, stage) => {
    acc[stage.id] = requests.filter((request) => request.pipelineStatus === stage.id).length;
    return acc;
  }, {});

  return {
    ...payload,
    requests,
    pipeline: {
      stages: PIPELINE_STAGES.map((stage) => ({
        id: stage.id,
        label: stage.label,
        count: byStage[stage.id] || 0,
      })),
    },
  };
}

async function getRequestPreferences() {
  const { rows } = await db.query('SELECT settings FROM app_config where "ID"=1');
  const settings = rows[0]?.settings || {};
  return {
    ...DEFAULT_REQUEST_PREFS,
    ...(settings.RequestPreferences || {}),
  };
}

async function saveRequestPreferences(nextPrefs = {}) {
  const { rows } = await db.query('SELECT settings FROM app_config where "ID"=1');
  const settings = rows[0]?.settings || {};
  const merged = {
    ...DEFAULT_REQUEST_PREFS,
    ...(settings.RequestPreferences || {}),
    ...nextPrefs,
    defaultTags: Array.isArray(nextPrefs.defaultTags)
      ? nextPrefs.defaultTags
      : Array.isArray(settings.RequestPreferences?.defaultTags)
        ? settings.RequestPreferences.defaultTags
        : [],
  };
  settings.RequestPreferences = merged;
  await db.query('UPDATE app_config SET settings=$1 where "ID"=1', [settings]);
  return merged;
}

function listProviders() {
  return [
    {
      id: PROVIDER_SEERR,
      name: "Seerr / Jellyseerr",
      enabled: true,
      capabilities: ["search", "create", "approve", "edit", "status"],
    },
    {
      id: PROVIDER_MANUAL,
      name: "Manual (admin)",
      enabled: true,
      capabilities: ["create", "status"],
      note: "Manual entries can be tracked in JellyGlance without Seerr.",
    },
  ];
}

function emptyUserFolders() {
  return {
    movieRootFolder: "",
    movieServerId: null,
    movieSourceId: null,
    tvRootFolder: "",
    tvServerId: null,
    tvSourceId: null,
  };
}

function normalizeFolderValue(value) {
  return String(value || "").trim();
}

function normalizeUserFolders(input = {}) {
  const movieRootFolder = normalizeFolderValue(input.movieRootFolder);
  const tvRootFolder = normalizeFolderValue(input.tvRootFolder);
  return {
    movieRootFolder,
    movieServerId: movieRootFolder && input.movieServerId != null && input.movieServerId !== "" ? Number(input.movieServerId) : null,
    movieSourceId: movieRootFolder ? input.movieSourceId || null : null,
    tvRootFolder,
    tvServerId: tvRootFolder && input.tvServerId != null && input.tvServerId !== "" ? Number(input.tvServerId) : null,
    tvSourceId: tvRootFolder ? input.tvSourceId || null : null,
  };
}

function userFolderKeys(user = {}) {
  if (!user || user === "internal") return [];
  const keys = [
    user.jellyfinUser?.id,
    user.jellyfinUser?.Id,
    user.authMode === "quick-connect" ? user.id : null,
    user.authMode === "local" && user.id && user.id !== 1 ? `local-${user.id}` : null,
    user.authMode === "local" && user.username ? `local-primary-${user.username}` : null,
  ];
  return [...new Set(keys.map((value) => (value == null ? "" : String(value).trim())).filter(Boolean))];
}

async function getUserRequestFoldersMap() {
  const { rows } = await db.query('SELECT settings FROM app_config where "ID"=1');
  const settings = rows[0]?.settings || {};
  return settings.UserRequestFolders && typeof settings.UserRequestFolders === "object" ? settings.UserRequestFolders : {};
}

async function getUserRequestFolders(userOrKey) {
  const map = await getUserRequestFoldersMap();
  if (typeof userOrKey === "string" && userOrKey) {
    return normalizeUserFolders(map[userOrKey] || emptyUserFolders());
  }
  for (const key of userFolderKeys(userOrKey)) {
    if (map[key]) return normalizeUserFolders(map[key]);
  }
  return emptyUserFolders();
}

async function saveUserRequestFolders(userKey, nextFolders = {}) {
  const key = String(userKey || "").trim();
  if (!key) {
    const error = new Error("User is required");
    error.statusCode = 400;
    throw error;
  }

  const { rows } = await db.query('SELECT settings FROM app_config where "ID"=1');
  const settings = rows[0]?.settings || {};
  const map = settings.UserRequestFolders && typeof settings.UserRequestFolders === "object" ? { ...settings.UserRequestFolders } : {};
  const normalized = normalizeUserFolders(nextFolders);
  const isEmpty = !normalized.movieRootFolder && !normalized.tvRootFolder;
  if (isEmpty) delete map[key];
  else map[key] = normalized;
  settings.UserRequestFolders = map;
  await db.query('UPDATE app_config SET settings=$1 where "ID"=1', [settings]);
  return normalized;
}

function applyUserFolderOverride(folders, mediaType, { sourceId, serverId, rootFolder } = {}) {
  const type = String(mediaType || "").toLowerCase();
  const overrideFolder = type === "tv" ? folders?.tvRootFolder : folders?.movieRootFolder;
  const overrideServerId = type === "tv" ? folders?.tvServerId : folders?.movieServerId;
  const overrideSourceId = type === "tv" ? folders?.tvSourceId : folders?.movieSourceId;
  if (!overrideFolder) {
    return { sourceId, serverId, rootFolder, applied: false };
  }
  if (overrideSourceId && sourceId && String(overrideSourceId) !== String(sourceId)) {
    return { sourceId, serverId, rootFolder, applied: false };
  }
  return {
    sourceId: overrideSourceId || sourceId,
    serverId: overrideServerId != null ? overrideServerId : serverId,
    rootFolder: overrideFolder,
    applied: true,
  };
}

function seasonNumbersFromRequest(request = {}) {
  const seasons = request.requestedSeasons || request.seasons || [];
  return (Array.isArray(seasons) ? seasons : [])
    .map((season) => (typeof season === "number" ? season : Number(season?.seasonNumber ?? season?.season_number)))
    .filter((season) => Number.isFinite(season) && season > 0);
}

async function resolveFoldersForRequester(request = {}) {
  const map = await getUserRequestFoldersMap();
  const jellyfinId = request.requester?.jellyfinUserId || request.requester?.id;
  if (jellyfinId && map[String(jellyfinId)]) {
    return normalizeUserFolders(map[String(jellyfinId)]);
  }

  const keys = Object.keys(map);
  if (!keys.length) return emptyUserFolders();

  const { rows } = await db.query('SELECT "Id", lower("Name") AS name FROM jf_users WHERE "Id" = ANY($1)', [keys]).catch(() => ({ rows: [] }));
  const nameById = new Map(rows.map((row) => [String(row.Id), row.name]));
  const requesterNames = [request.requestedBy, request.requester?.name, request.requester?.username, request.requester?.email]
    .map((value) => String(value || "").trim().toLowerCase())
    .filter(Boolean);

  for (const key of keys) {
    const userName = nameById.get(String(key));
    if (userName && requesterNames.includes(userName)) {
      return normalizeUserFolders(map[key]);
    }
  }

  return emptyUserFolders();
}

async function applyStoredFolderOverrideToRequest({ requestId, sourceId, updateRequest, fetchRequest }) {
  if (!requestId || !sourceId || typeof updateRequest !== "function" || typeof fetchRequest !== "function") {
    return { applied: false };
  }

  const request = await fetchRequest({ requestId, sourceId });
  const folders = await resolveFoldersForRequester(request);
  const override = applyUserFolderOverride(folders, request.mediaType, {
    sourceId,
    serverId: request.serverId,
    rootFolder: request.rootFolder,
  });
  if (!override.applied) return { applied: false };

  const sameFolder = String(override.rootFolder || "") === String(request.rootFolder || "");
  const sameServer =
    override.serverId == null || request.serverId == null || Number(override.serverId) === Number(request.serverId);
  if (sameFolder && sameServer) return { applied: false, alreadyMatched: true };

  const seasons = seasonNumbersFromRequest(request);
  if (String(request.mediaType || "").toLowerCase() === "tv" && !seasons.length) {
    return { applied: false, reason: "missing seasons" };
  }

  await updateRequest({
    requestId,
    sourceId,
    serverId: override.serverId,
    rootFolder: override.rootFolder,
    mediaType: request.mediaType,
    seasons,
    profileId: request.profileId,
    languageProfileId: request.languageProfileId,
    tags: request.tags,
    is4k: request.is4k,
  });
  return { applied: true, rootFolder: override.rootFolder, serverId: override.serverId };
}

function getNestedRequesterValue(requester = {}, paths = []) {
  for (const path of paths) {
    const value = path.split(".").reduce((current, key) => (current == null ? undefined : current[key]), requester);
    if (value != null && value !== "") return value;
  }
  return null;
}

function basenamePath(fullPath = "") {
  const parts = String(fullPath || "")
    .replace(/\/+$/, "")
    .split("/")
    .filter(Boolean);
  return parts[parts.length - 1] || "";
}

async function findArrAppForMedia(mediaType) {
  const integrations = await getIntegrations();
  const needle = String(mediaType || "").toLowerCase() === "tv" ? "sonarr" : "radarr";
  return (
    (integrations.arrApps || []).find(
      (app) =>
        app.connected &&
        String(app.name || app.slug || "")
          .toLowerCase()
          .includes(needle) &&
        app.values?.url &&
        app.values?.secret
    ) || null
  );
}

/**
 * Seerr rootFolder updates do not move titles already added in Radarr/Sonarr.
 * Push the linked Arr item onto the override root folder when present.
 */
async function ensureArrRootFolderForSeerrItem(item, rootFolder) {
  const media = item?.media || {};
  const mediaType = String(media.mediaType || item?.type || item?.mediaType || "").toLowerCase();
  const externalId = media.externalServiceId ?? media.externalId;
  const targetRoot = String(rootFolder || "").replace(/\/+$/, "");
  if (!targetRoot || externalId == null || externalId === "") {
    return { updated: false, reason: "missing arr link" };
  }

  const app = await findArrAppForMedia(mediaType);
  if (!app) return { updated: false, reason: "no arr app" };

  const url = cleanIntegrationUrl(app.values.url);
  const apiKey = app.values.secret;
  const isTv = mediaType === "tv";
  const resource = isTv ? "series" : "movie";
  const headers = { "X-Api-Key": apiKey };

  try {
    const { data: entity } = await axios.get(`${url}/api/v3/${resource}/${encodeURIComponent(externalId)}`, {
      timeout: 15000,
      headers,
    });
    const currentRoot = String(entity.rootFolderPath || "").replace(/\/+$/, "");
    if (currentRoot === targetRoot) {
      return { updated: false, alreadyMatched: true };
    }

    const leaf = basenamePath(entity.path) || entity.titleSlug || basenamePath(entity.title);
    if (!leaf) return { updated: false, reason: "missing path leaf" };

    const newPath = `${targetRoot}/${leaf}`;
    const hasFiles = isTv ? Number(entity.statistics?.episodeFileCount || 0) > 0 : Boolean(entity.hasFile || entity.movieFile);
    const payload = { ...entity, path: newPath, rootFolderPath: targetRoot };

    await axios.put(`${url}/api/v3/${resource}/${encodeURIComponent(entity.id)}?moveFiles=${hasFiles ? "true" : "false"}`, payload, {
      timeout: 30000,
      headers: { ...headers, "Content-Type": "application/json" },
    });
    console.log(`[REQUESTS] Moved ${app.name} ${resource} ${entity.id} -> ${targetRoot}`);
    return { updated: true, path: newPath, rootFolderPath: targetRoot, app: app.name };
  } catch (error) {
    const message = error.response?.data?.message || error.response?.data?.[0]?.errorMessage || error.message;
    console.log(`[REQUESTS] Arr folder update failed for ${resource} ${externalId}:`, message);
    return { updated: false, reason: message };
  }
}

async function updateSeerrItemFolder(url, apiKey, item, override) {
  const mediaType = String(item.media?.mediaType || item.type || item.mediaType || "").toLowerCase();
  const payload = {
    mediaType,
    rootFolder: override.rootFolder,
  };
  if (override.serverId !== undefined && override.serverId !== null && override.serverId !== "") {
    payload.serverId = Number(override.serverId);
  }
  if (item.profileId != null && item.profileId !== "") payload.profileId = Number(item.profileId);
  if (item.languageProfileId != null && item.languageProfileId !== "") payload.languageProfileId = Number(item.languageProfileId);
  if (Array.isArray(item.tags)) payload.tags = item.tags.map(Number).filter((tag) => Number.isFinite(tag));
  if (item.is4k != null) payload.is4k = Boolean(item.is4k);
  if (mediaType === "tv") {
    const seasons = (Array.isArray(item.seasons) ? item.seasons : [])
      .map((season) => (typeof season === "number" ? season : Number(season?.seasonNumber)))
      .filter((season) => Number.isFinite(season) && season > 0);
    if (!seasons.length) {
      return { updated: false, reason: "missing seasons" };
    }
    payload.seasons = seasons;
  }

  const seerrAlreadyMatched = String(item.rootFolder || "") === String(override.rootFolder || "");
  if (!seerrAlreadyMatched) {
    await axios.put(`${url}/api/v1/request/${encodeURIComponent(item.id)}`, payload, {
      timeout: 10000,
      headers: { "X-Api-Key": apiKey },
    });

    // Re-push to Radarr/Sonarr when the request was already approved or previously failed.
    if ([2, 4].includes(Number(item.status))) {
      try {
        await axios.post(
          `${url}/api/v1/request/${encodeURIComponent(item.id)}/retry`,
          {},
          {
            timeout: 15000,
            headers: { "X-Api-Key": apiKey },
          }
        );
      } catch (error) {
        console.log(`[REQUESTS] Retry after folder update failed for ${item.id}:`, error.response?.status || error.message);
      }
    }

    item.rootFolder = override.rootFolder;
    if (payload.serverId !== undefined) item.serverId = payload.serverId;
  }

  const arr = await ensureArrRootFolderForSeerrItem(item, override.rootFolder);
  if (!seerrAlreadyMatched || arr.updated) {
    return { updated: true, rootFolder: override.rootFolder, arr };
  }
  return { updated: false, alreadyMatched: true, arr };
}

async function repairSeerrRequestFolders(app, items = []) {
  const map = await getUserRequestFoldersMap();
  if (!Object.keys(map).length || !items.length) {
    return { updated: 0, skipped: items.length, errors: [] };
  }

  const url = cleanIntegrationUrl(app.values?.url);
  const apiKey = app.values?.secret;
  if (!url || !apiKey) {
    return { updated: 0, skipped: items.length, errors: [{ source: app.name, message: "Missing Seerr URL or API key" }] };
  }

  const keys = Object.keys(map);
  const { rows } = await db.query('SELECT "Id", lower("Name") AS name FROM jf_users WHERE "Id" = ANY($1)', [keys]).catch(() => ({ rows: [] }));
  const nameById = new Map(rows.map((row) => [String(row.Id), row.name]));

  let updated = 0;
  let skipped = 0;
  const errors = [];

  for (const item of items) {
    if (!requestNeedsFolderSync(item.status)) {
      skipped += 1;
      continue;
    }

    const requester = item.requestedBy || {};
    const jellyfinId = getNestedRequesterValue(requester, [
      "jellyfinUserId",
      "jellyfinUserID",
      "jellyfinId",
      "jellyfinUser.id",
      "jellyfinUser.Id",
      "settings.jellyfinUserId",
    ]);
    let folders = null;
    if (jellyfinId && map[String(jellyfinId)]) {
      folders = normalizeUserFolders(map[String(jellyfinId)]);
    } else {
      const requesterNames = [requester.displayName, requester.username, requester.jellyfinUsername, requester.email]
        .map((value) => String(value || "").trim().toLowerCase())
        .filter(Boolean);
      for (const key of keys) {
        const userName = nameById.get(String(key));
        if (userName && requesterNames.includes(userName)) {
          folders = normalizeUserFolders(map[key]);
          break;
        }
      }
    }

    if (!folders || (!folders.movieRootFolder && !folders.tvRootFolder)) {
      skipped += 1;
      continue;
    }

    const mediaType = String(item.media?.mediaType || item.type || item.mediaType || "").toLowerCase();
    const override = applyUserFolderOverride(folders, mediaType, {
      sourceId: app.instanceId,
      serverId: item.serverId,
      rootFolder: item.rootFolder,
    });
    if (!override.applied) {
      skipped += 1;
      continue;
    }

    try {
      const result = await updateSeerrItemFolder(url, apiKey, item, override);
      if (result.updated) {
        updated += 1;
        console.log(`[REQUESTS] Auto-repaired Seerr request ${item.id} -> ${override.rootFolder}`);
      } else {
        skipped += 1;
      }
      if (result.arr?.updated === false && result.arr?.reason && result.arr.reason !== "missing arr link" && !result.arr.alreadyMatched) {
        errors.push({ source: app.name, requestId: item.id, message: `Arr: ${result.arr.reason}` });
      }
    } catch (error) {
      errors.push({
        source: app.name,
        requestId: item.id,
        message: error.response?.data?.message || error.message || "Unable to update request",
      });
    }
  }

  return { updated, skipped, errors };
}

async function fetchSeerrRequestPages(url, apiKey, { take = 50, maxPages = 10 } = {}) {
  const rows = [];
  for (let page = 0; page < maxPages; page += 1) {
    const response = await axios.get(`${url}/api/v1/request`, {
      timeout: 20000,
      headers: { "X-Api-Key": apiKey },
      params: { take, skip: page * take, filter: "all", sort: "added" },
    });
    const batch = Array.isArray(response.data?.results) ? response.data.results : Array.isArray(response.data) ? response.data : [];
    rows.push(...batch);
    const pageInfo = response.data?.pageInfo;
    if (!batch.length) break;
    if (pageInfo?.pages && page + 1 >= Number(pageInfo.pages)) break;
    if (batch.length < take) break;
  }
  return rows;
}

function requestNeedsFolderSync(status) {
  // 1 pending, 2 approved, 4 failed — skip declined (3) and available (5)
  return [1, 2, 4].includes(Number(status));
}

async function syncUserFolderOverridesToSeerr(userKey, foldersInput) {
  const folders = normalizeUserFolders(foldersInput || (await getUserRequestFolders(String(userKey))));
  if (!folders.movieRootFolder && !folders.tvRootFolder) {
    return { updated: 0, skipped: 0, errors: [] };
  }

  const integrations = await getIntegrations();
  const apps = (integrations.arrApps || []).filter((integration) => integration.connected && isSeerrIntegration(integration));
  if (!apps.length) {
    return { updated: 0, skipped: 0, errors: [{ source: "Seerr", message: "No connected Jellyseerr or Overseerr source" }] };
  }

  const { rows } = await db.query('SELECT "Id", "Name" FROM jf_users WHERE "Id"=$1', [String(userKey)]).catch(() => ({ rows: [] }));
  const matchValues = new Set(
    [userKey, rows[0]?.Id, rows[0]?.Name]
      .map((value) => String(value || "").trim().toLowerCase())
      .filter(Boolean)
  );

  let updated = 0;
  let skipped = 0;
  const errors = [];

  for (const app of apps) {
    const url = cleanIntegrationUrl(app.values?.url);
    const apiKey = app.values?.secret;
    if (!url || !apiKey) {
      errors.push({ source: app.name || "Seerr", message: "Missing Seerr URL or API key" });
      continue;
    }

    let rowsList = [];
    try {
      rowsList = await fetchSeerrRequestPages(url, apiKey);
    } catch (error) {
      errors.push({ source: app.name, message: error.response?.data?.message || error.message || "Unable to list Seerr requests" });
      continue;
    }

    for (const item of rowsList) {
      if (!requestNeedsFolderSync(item.status)) {
        skipped += 1;
        continue;
      }

      const requester = item.requestedBy || {};
      const jellyfinId = getNestedRequesterValue(requester, [
        "jellyfinUserId",
        "jellyfinUserID",
        "jellyfinId",
        "jellyfinUser.id",
        "jellyfinUser.Id",
        "settings.jellyfinUserId",
      ]);
      const requesterValues = [jellyfinId, requester.displayName, requester.username, requester.jellyfinUsername, requester.email]
        .map((value) => String(value || "").trim().toLowerCase())
        .filter(Boolean);
      if (!requesterValues.some((value) => matchValues.has(value))) {
        skipped += 1;
        continue;
      }

      const mediaType = String(item.media?.mediaType || item.type || item.mediaType || "").toLowerCase();
      const override = applyUserFolderOverride(folders, mediaType, {
        sourceId: app.instanceId,
        serverId: item.serverId,
        rootFolder: item.rootFolder,
      });
      if (!override.applied) {
        skipped += 1;
        continue;
      }

      try {
        const result = await updateSeerrItemFolder(url, apiKey, item, override);
        if (result.updated) {
          updated += 1;
          console.log(`[REQUESTS] Updated Seerr request ${item.id} for ${userKey} -> ${override.rootFolder}`);
        } else {
          skipped += 1;
        }
        if (result.arr?.updated === false && result.arr?.reason && result.arr.reason !== "missing arr link" && !result.arr.alreadyMatched) {
          errors.push({ source: app.name, requestId: item.id, message: `Arr: ${result.arr.reason}` });
        }
      } catch (error) {
        errors.push({
          source: app.name,
          requestId: item.id,
          message: error.response?.data?.message || error.message || "Unable to update request",
        });
      }
    }
  }

  return { updated, skipped, errors };
}

function cleanIntegrationUrl(url = "") {
  return String(url).trim().replace(/\/+$/, "");
}

function isSeerrIntegration(integration) {
  const name = String(integration?.name || integration?.slug || "").toLowerCase();
  return name === "seerr" || name.includes("jellyseerr") || name.includes("overseerr");
}

async function listRequestFolderOptions() {
  const integrations = await getIntegrations();
  const apps = (integrations.arrApps || []).filter((integration) => integration.connected && isSeerrIntegration(integration));
  const movie = [];
  const tv = [];

  for (const app of apps) {
    const url = cleanIntegrationUrl(app.values?.url);
    const apiKey = app.values?.secret;
    if (!url || !apiKey) continue;

    for (const mediaType of ["movie", "tv"]) {
      const serviceType = mediaType === "movie" ? "radarr" : "sonarr";
      const target = mediaType === "movie" ? movie : tv;
      try {
        const listResponse = await axios.get(`${url}/api/v1/service/${serviceType}`, {
          timeout: 10000,
          headers: { "X-Api-Key": apiKey },
        });
        const servers = Array.isArray(listResponse.data) ? listResponse.data : [];
        for (const server of servers) {
          try {
            const detailResponse = await axios.get(`${url}/api/v1/service/${serviceType}/${encodeURIComponent(server.id)}`, {
              timeout: 10000,
              headers: { "X-Api-Key": apiKey },
            });
            const folders = detailResponse.data?.rootFolders || [];
            for (const folder of folders) {
              if (!folder?.path) continue;
              target.push({
                sourceId: app.instanceId,
                source: app.name,
                serverId: server.id,
                serverName: server.name || `Server ${server.id}`,
                path: folder.path,
                label: `${folder.path}${server.name ? ` · ${server.name}` : ""}${apps.length > 1 ? ` · ${app.name}` : ""}`,
              });
            }
          } catch (error) {
            console.log(`[REQUESTS] ${app.name} ${serviceType} ${server.id} folders failed:`, error.response?.status || error.message);
          }
        }
      } catch (error) {
        console.log(`[REQUESTS] ${app.name} ${serviceType} list failed:`, error.response?.status || error.message);
      }
    }
  }

  return { movie, tv };
}

module.exports = {
  PROVIDER_SEERR,
  PROVIDER_MANUAL,
  PIPELINE_STAGES,
  enrichRequest,
  enrichRequestPayload,
  getPipelineStage,
  buildRequestTimeline,
  getRequestPreferences,
  saveRequestPreferences,
  listProviders,
  emptyUserFolders,
  userFolderKeys,
  getUserRequestFoldersMap,
  getUserRequestFolders,
  saveUserRequestFolders,
  applyUserFolderOverride,
  applyStoredFolderOverrideToRequest,
  repairSeerrRequestFolders,
  syncUserFolderOverridesToSeerr,
  listRequestFolderOptions,
};
