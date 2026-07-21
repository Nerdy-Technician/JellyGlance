// api.js
const express = require("express");

const db = require("../db");
const dbHelper = require("../classes/db-helper");

const pgp = require("pg-promise")();
const { randomUUID } = require("crypto");

const configClass = require("../classes/config");
const { checkForUpdates } = require("../version-control");
const API = require("../classes/api-loader");
const { sendUpdate } = require("../ws");
const { tables } = require("../global/backup_tables");
const TaskScheduler = require("../classes/task-scheduler-singleton");
const TaskManager = require("../classes/task-manager-singleton.js");
const WebhookManager = require("../classes/webhook-manager");
const { axios } = require("../classes/axios");
const triggertype = require("../logging/triggertype");
const {
  getIntegrations,
  saveIntegrations,
  getIntegrationData,
  saveIntegrationData,
} = require("../classes/integration-store");

const dayjs = require("dayjs");

const router = express.Router();
const DEFAULT_ACCESS_ROLES = ["Owner", "Admin", "Manager", "Viewer", "Disabled"];
const DEFAULT_ROLE_PERMISSIONS = {
  Owner: { dashboard: true, users: true, settings: true, apiKeys: true },
  Admin: { dashboard: true, users: true, settings: true, apiKeys: true },
  Manager: { dashboard: true, users: true, settings: false, apiKeys: false },
  Viewer: { dashboard: true, users: false, settings: false, apiKeys: false },
  Disabled: { dashboard: false, users: false, settings: false, apiKeys: false },
};

function normalizeIssuerUrl(url) {
  return url?.trim()?.replace(/\/+$/, "");
}

function cleanIntegrationUrl(url = "") {
  return String(url).trim().replace(/\/+$/, "");
}

function getAxiosErrorMessage(error) {
  if (error?.response?.status) {
    return `Request failed with status ${error.response.status}`;
  }
  return error?.message || "Connection test failed";
}

function extractIntegrationVersion(data) {
  if (typeof data === "string") {
    return data.trim();
  }

  return (
    data?.version ||
    data?.appVersion ||
    data?.bazarr_version ||
    data?.package_version ||
    data?.data?.version ||
    data?.data?.appVersion ||
    data?.data?.bazarr_version ||
    data?.data?.package_version ||
    ""
  );
}

async function testArrIntegration(integration) {
  const url = cleanIntegrationUrl(integration.values?.url);
  const apiKey = integration.values?.secret;
  const name = String(integration.name).toLowerCase();
  const isBazarr = name === "bazarr";
  const isLidarr = name === "lidarr";
  const apiPaths = isBazarr
    ? ["/api/system/status", "/api/system/status?apikey=:apiKey"]
    : [isLidarr ? "/api/v1/system/status" : "/api/v3/system/status"];

  if (!url || !apiKey) {
    return { ok: false, error: "URL and API key are required" };
  }

  let lastError = null;
  for (const path of apiPaths) {
    try {
      const apiPath = path.replace(":apiKey", encodeURIComponent(apiKey));
      const response = await axios.get(`${url}${apiPath}`, {
        timeout: 10000,
        headers: { "X-Api-Key": apiKey },
      });
      const version = extractIntegrationVersion(response.data);

      if (version) {
        return {
          ok: true,
          version,
          message: `Connected to ${version}`,
        };
      }

      lastError = new Error("Connected, but no version was returned by the service");
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError || new Error("Connection test failed");
}

async function testDownloadIntegration(integration) {
  const url = cleanIntegrationUrl(integration.values?.url);
  const secret = integration.values?.secret;
  const username = integration.values?.username;
  const name = String(integration.name).toLowerCase();

  if (!url || !secret) {
    return { ok: false, error: "URL and password/API key are required" };
  }

  if ((name.includes("qbittorrent") || name === "bittorrent") && username) {
    const login = await axios.post(`${url}/api/v2/auth/login`, new URLSearchParams({ username, password: secret }), {
      timeout: 10000,
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      validateStatus: () => true,
    });
    if (login.status >= 400 || String(login.data).toLowerCase().includes("fails")) {
      return { ok: false, error: "qBittorrent login failed" };
    }
    const response = await axios.get(`${url}/api/v2/app/version`, {
      timeout: 10000,
      headers: { Cookie: login.headers["set-cookie"]?.join("; ") || "" },
    });
    return { ok: true, version: response.data, message: `Connected to ${response.data}` };
  }

  if (name.includes("sab")) {
    const response = await axios.get(`${url}/api`, {
      timeout: 10000,
      params: { mode: "version", apikey: secret, output: "json" },
    });
    const version = extractIntegrationVersion(response.data) || "unknown version";
    return { ok: true, version, message: `Connected to ${version}` };
  }

  return {
    ok: true,
    version: "saved credentials",
    message: "Connected to saved credentials",
  };
}

async function testOidcDiscovery(issuerUrl) {
  const normalizedIssuer = normalizeIssuerUrl(issuerUrl);
  if (!normalizedIssuer) {
    return { isValid: false, errorMessage: "OIDC issuer URL is required" };
  }

  try {
    const response = await axios.get(`${normalizedIssuer}/.well-known/openid-configuration`, { timeout: 8000 });
    const discovery = response?.data || {};
    const hasRequiredEndpoints = discovery.authorization_endpoint && discovery.token_endpoint && discovery.issuer;

    if (!hasRequiredEndpoints) {
      return { isValid: false, errorMessage: "OIDC discovery document is missing required endpoints" };
    }

    return {
      isValid: true,
      issuerUrl: normalizedIssuer,
      discovery: {
        issuer: discovery.issuer,
        authorization_endpoint: discovery.authorization_endpoint,
        token_endpoint: discovery.token_endpoint,
        userinfo_endpoint: discovery.userinfo_endpoint,
        jwks_uri: discovery.jwks_uri,
      },
    };
  } catch (error) {
    return {
      isValid: false,
      errorMessage: `Unable to reach OIDC discovery: ${error?.response?.status || error.message}`,
    };
  }
}

function firstProviderId(providerIds, names) {
  const normalized = providerIds || {};
  const entries = Object.entries(normalized);
  for (const name of names) {
    const direct = normalized[name];
    if (direct) return direct;
    const match = entries.find(([key]) => key.toLowerCase() === name.toLowerCase());
    if (match?.[1]) return match[1];
  }
  return null;
}

async function getLiveItem(itemId) {
  if (!itemId) return null;
  try {
    const items = await API.getItemsByID({ ids: itemId, params: { limit: 1, recursive: true } });
    return Array.isArray(items) ? items[0] || null : null;
  } catch (error) {
    console.log("[ITEM-DETAILS] Jellyfin enrichment failed:", error?.message || error);
    return null;
  }
}

async function getArrItemByProvider(app, providerType, providerId) {
  const url = cleanIntegrationUrl(app?.values?.url);
  const apiKey = app?.values?.secret;
  if (!url || !apiKey || !providerId) return null;

  const apiPath = providerType === "movie" ? "/api/v3/movie" : "/api/v3/series";
  const providerKey = providerType === "movie" ? "tmdbId" : "tvdbId";

  try {
    const direct = await axios.get(`${url}${apiPath}`, {
      timeout: 10000,
      headers: { "X-Api-Key": apiKey },
      params: { [providerKey]: providerId },
    });
    const directData = Array.isArray(direct.data) ? direct.data[0] : direct.data;
    if (directData?.titleSlug || directData?.id) return directData;
  } catch (error) {
    if (!error?.response || error.response.status >= 500) {
      console.log(`[ITEM-DETAILS] ${app.name} direct lookup failed:`, error?.message || error);
    }
  }

  try {
    const response = await axios.get(`${url}${apiPath}`, {
      timeout: 10000,
      headers: { "X-Api-Key": apiKey },
    });
    const allItems = Array.isArray(response.data) ? response.data : [];
    return allItems.find((item) => String(item?.[providerKey]) === String(providerId)) || null;
  } catch (error) {
    console.log(`[ITEM-DETAILS] ${app.name} library lookup failed:`, error?.message || error);
    return null;
  }
}

async function getArrLinks(item, liveItem, seriesLiveItem) {
  const integrations = await getIntegrations();
  const apps = integrations.arrApps?.filter((app) => app.connected) || [];
  const links = [];

  const radarr = apps.find((app) => String(app.slug || app.name).toLowerCase().includes("radarr"));
  const sonarr = apps.find((app) => String(app.slug || app.name).toLowerCase().includes("sonarr"));

  if (radarr && item.Type === "Movie") {
    const tmdbId = firstProviderId(liveItem?.ProviderIds, ["Tmdb", "TMDb", "TheMovieDb"]);
    const match = await getArrItemByProvider(radarr, "movie", tmdbId);
    const base = cleanIntegrationUrl(radarr.values?.url);
    links.push({
      name: "Radarr",
      type: "movie",
      url: match?.titleSlug ? `${base}/movie/${match.titleSlug}` : `${base}/add/new?term=${encodeURIComponent(tmdbId ? `tmdb:${tmdbId}` : item.Name || "")}`,
      matched: Boolean(match),
    });
  }

  if (sonarr && ["Series", "Season", "Episode"].includes(item.Type)) {
    const providerIds = seriesLiveItem?.ProviderIds || liveItem?.ProviderIds;
    const tvdbId = firstProviderId(providerIds, ["Tvdb", "TVDB", "TheTVDB"]);
    const match = await getArrItemByProvider(sonarr, "series", tvdbId);
    const base = cleanIntegrationUrl(sonarr.values?.url);
    links.push({
      name: "Sonarr",
      type: "series",
      url: match?.titleSlug ? `${base}/series/${match.titleSlug}` : `${base}/add/new?term=${encodeURIComponent(tvdbId ? `tvdb:${tvdbId}` : item.SeriesName || item.Name || "")}`,
      matched: Boolean(match),
    });
  }

  return links;
}

function buildJellyfinItemUrl(config, itemId) {
  const host = cleanIntegrationUrl(config?.settings?.EXTERNAL_URL || config?.JF_HOST || "");
  if (!host || !itemId) return null;
  const serverId = config?.settings?.ServerID ? `&serverId=${encodeURIComponent(config.settings.ServerID)}` : "";
  return `${host}/web/index.html#!/${config.IS_JELLYFIN ? "details" : "item"}?id=${encodeURIComponent(itemId)}${serverId}`;
}

async function enrichItemDetails(rows) {
  const config = await new configClass().getConfig();
  return Promise.all(
    rows.map(async (item) => {
      const itemId = item.EpisodeId || item.Id;
      const liveItem = await getLiveItem(itemId);
      const seriesLiveItem =
        item.SeriesId && item.SeriesId !== itemId && ["Episode", "Season"].includes(item.Type) ? await getLiveItem(item.SeriesId) : null;
      const providerIds = liveItem?.ProviderIds || {};
      const seriesProviderIds = seriesLiveItem?.ProviderIds || null;
      const arrLinks = await getArrLinks(item, liveItem, seriesLiveItem);

      return {
        ...item,
        Overview: liveItem?.Overview || seriesLiveItem?.Overview || item.Overview || null,
        ProviderIds: providerIds,
        SeriesProviderIds: seriesProviderIds,
        ExternalUrls: liveItem?.ExternalUrls || [],
        CriticRating: liveItem?.CriticRating ?? item.CriticRating ?? null,
        CommunityRating: liveItem?.CommunityRating ?? item.CommunityRating ?? null,
        OfficialRating: liveItem?.OfficialRating ?? item.OfficialRating ?? null,
        Studios: liveItem?.Studios || seriesLiveItem?.Studios || [],
        Tags: liveItem?.Tags || [],
        ArrLinks: arrLinks,
        JellyfinUrl: buildJellyfinItemUrl(config, itemId),
      };
    })
  );
}

//consts
const groupedSortMap = [
  { field: "UserName", column: "a.UserName" },
  { field: "RemoteEndPoint", column: "a.RemoteEndPoint" },
  { field: "NowPlayingItemName", column: "FullName" },
  { field: "Client", column: "a.Client" },
  { field: "DeviceName", column: "a.DeviceName" },
  { field: "ActivityDateInserted", column: "a.ActivityDateInserted" },
  { field: "PlaybackDuration", column: `COALESCE(ar."TotalDuration", a."PlaybackDuration")` },
  { field: "TotalPlays", column: `COALESCE("TotalPlays",1)` },
  { field: "PlayMethod", column: "a.PlayMethod" },
];

const unGroupedSortMap = [
  { field: "UserName", column: "a.UserName" },
  { field: "RemoteEndPoint", column: "a.RemoteEndPoint" },
  { field: "NowPlayingItemName", column: "FullName" },
  { field: "Client", column: "a.Client" },
  { field: "DeviceName", column: "a.DeviceName" },
  { field: "ActivityDateInserted", column: "a.ActivityDateInserted" },
  { field: "PlaybackDuration", column: "a.PlaybackDuration" },
  { field: "PlayMethod", column: "a.PlayMethod" },
];

const filterFields = [
  { field: "UserName", column: `LOWER(a."UserName")` },
  { field: "RemoteEndPoint", column: `LOWER(a."RemoteEndPoint")` },
  {
    field: "NowPlayingItemName",
    column: `LOWER(
          CASE 
            WHEN a."SeriesName" is null THEN a."NowPlayingItemName"
            ELSE CONCAT(a."SeriesName" , ' : S' , a."SeasonNumber" , 'E' , a."EpisodeNumber" , ' - ' , a."NowPlayingItemName")
          END 
          )`,
  },
  { field: "Client", column: `LOWER(a."Client")` },
  { field: "DeviceName", column: `LOWER(a."DeviceName")` },
  { field: "ActivityDateInserted", column: "a.ActivityDateInserted", isColumn: true },
  { field: "PlaybackDuration", column: `a.PlaybackDuration`, isColumn: true, applyToCTE: true },
  { field: "TotalPlays", column: `COALESCE("TotalPlays",1)` },
  { field: "PlayMethod", column: `LOWER(a."PlayMethod")` },
  { field: "ParentId", column: "a.ParentId", isColumn: true },
];

//Functions
function groupRecentlyAdded(rows) {
  const groupedResults = {};
  rows.forEach((row) => {
    if (row.Type != "Movie") {
      const key = row.SeriesId + row.SeasonId;
      if (groupedResults[key]) {
        groupedResults[key].NewEpisodeCount++;
      } else {
        groupedResults[key] = { ...row };
        if (row.Type != "Series" && row.Type != "Movie") {
          groupedResults[key].NewEpisodeCount = 1;
        }
      }
    } else {
      groupedResults[row.Id] = {
        ...row,
      };
    }
  });

  return Object.values(groupedResults);
}

async function purgeLibraryItems(id, withActivity, purgeAll = false) {
  let items_query = `select * from jf_library_items where "ParentId"=$1`;

  const { rows: items } = await db.query(items_query, [id]);
  let seasonIds = [];
  let episodeIds = [];

  for (const item of items) {
    let season_query = `select * from jf_library_seasons where "SeriesId"=$1`;
    if (!item.archived && !purgeAll) {
      season_query += " and archived=true";
    }
    const { rows: seasons } = await db.query(season_query, [item.Id]);
    seasonIds.push(...seasons.map((item) => item.Id));
    if (seasons.length > 0) {
      for (const season of seasons) {
        let episode_query = `select * from jf_library_episodes where "SeasonId"=$1`;
        if (!item.archived && !season.archived && !purgeAll) {
          episode_query += " and archived=true";
        }
        const { rows: episodes } = await db.query(episode_query, [season.Id]);
        episodeIds.push(...episodes.map((item) => item.Id));
      }
    } else {
      let episode_query = `select * from jf_library_episodes where "SeriesId"=$1`;
      if (!item.archived && !purgeAll) {
        episode_query += " and archived=true";
      }
      const { rows: episodes } = await db.query(episode_query, [item.Id]);
      episodeIds.push(...episodes.map((item) => item.Id));
    }
  }

  if (episodeIds.length > 0) {
    await db.deleteBulk("jf_library_episodes", episodeIds);
  }

  if (seasonIds.length > 0) {
    await db.deleteBulk("jf_library_seasons", seasonIds);
  }

  items_query = items_query.replace("select *", "delete");
  if (!purgeAll) {
    items_query += ` and archived=true`;
  }
  await db.query(items_query, [id]);

  if (withActivity) {
    const deleteQuery = {
      text: `DELETE FROM jf_playback_activity WHERE${
        episodeIds.length > 0 ? ` "EpisodeId" IN (${pgp.as.csv(episodeIds)})  OR` : ""
      }${seasonIds.length > 0 ? ` "SeasonId" IN (${pgp.as.csv(seasonIds)}) OR` : ""} "NowPlayingItemId"='${id}'`,
      refreshViews: true,
    };
    await db.query(deleteQuery);
  }
  for (const view of db.materializedViews) {
    await db.refreshMaterializedView(view);
  }
}

//////////////////////////////
router.get("/getconfig", async (req, res) => {
  try {
    const config = await new configClass().getConfig();
    if (config.error) {
      res.status(503);
      res.send({ error: config.error });
      return;
    }

    const settings = { ...(config.settings || {}) };
    const auth = { ...(settings.auth || {}) };
    if (req.user?.authMode === "quick-connect" && req.user?.jellyfinUser) {
      auth.mode = "quick-connect";
      auth.label = auth.label || "Jellyfin Quick Connect";
      auth.jellyfinUser = req.user.jellyfinUser;
      auth.role = req.user.role || "Viewer";
      auth.permissions = req.user.permissions || DEFAULT_ROLE_PERMISSIONS.Viewer;
      settings.auth = auth;
    } else if (req.user?.authMode) {
      auth.mode = req.user.authMode;
      auth.role = req.user.role;
      auth.permissions = req.user.permissions;
      settings.auth = auth;
    }

    const payload = {
      JF_HOST: config.JF_HOST,
      APP_USER: req.user?.username || config.APP_USER,
      settings,
      REQUIRE_LOGIN: config.REQUIRE_LOGIN,
      IS_JELLYFIN: config.IS_JELLYFIN,
    };

    res.send(payload);
  } catch (error) {
    console.log(error);
  }
});

router.get("/getLibraries", async (req, res) => {
  try {
    const libraries = await db.query("SELECT * FROM jf_libraries").then((res) => res.rows);
    res.send(libraries);
  } catch (error) {
    res.status(503);
    res.send(error);
  }
});

router.get("/getRecentlyAdded", async (req, res) => {
  try {
    const { libraryid, limit = 50, GroupResults = true } = req.query;

    const config = await new configClass().getConfig();
    const excluded_libraries = config.settings.ExcludedLibraries || [];

    let recentlyAddedFromJellyfin = await API.getRecentlyAdded({ libraryid: libraryid });

    let recentlyAddedFromJellyfinMapped = recentlyAddedFromJellyfin.map((item) => {
      return {
        Name: item.Name,
        SeriesName: item.SeriesName,
        Id: item.Id,
        SeriesId: item.SeriesId || null,
        SeasonId: item.SeasonId || null,
        EpisodeId: item.Type === "Episode" ? item.Id : null,

        SeasonNumber: item.ParentIndexNumber ?? null,
        EpisodeNumber: item.IndexNumber ?? null,
        PrimaryImageHash:
          item.ImageTags &&
          item.ImageTags.Primary &&
          item.ImageBlurHashes &&
          item.ImageBlurHashes.Primary &&
          item.ImageBlurHashes.Primary[item.ImageTags["Primary"]]
            ? item.ImageBlurHashes.Primary[item.ImageTags["Primary"]]
            : null,

        DateCreated: item.DateCreated ?? null,
        Type: item.Type,
      };
    });

    if (libraryid !== undefined) {
      const { rows: items } = await db.query(
        `SELECT i."Name", null "SeriesName", "Id", null "SeriesId", null "SeasonId", null "EpisodeId", null "SeasonNumber", null "EpisodeNumber",  "PrimaryImageHash",i."DateCreated", "Type", i."ParentId"
        FROM public.jf_library_items i
        where i.archived=false
          and i."Type" != 'Series'
          and i."ParentId"=$1
        order by "DateCreated" desc
        limit $2`,
        [libraryid, limit],
      );

      const { rows: episodes } = await db.query(
        `
        SELECT e."Name",  e."SeriesName",e."Id" , e."SeriesId", e."SeasonId", e."EpisodeId",  e."ParentIndexNumber"  "SeasonNumber",  e."IndexNumber" "EpisodeNumber", e."PrimaryImageHash", e."DateCreated", e."Type", i."ParentId"    
        FROM public.jf_library_episodes e
        JOIN public.jf_library_items i
              on i."Id"=e."SeriesId"
        where e."DateCreated" is not null
              and e.archived=false
               and i."ParentId"=$1
        order by e."DateCreated" desc
        limit $2`,
        [libraryid, limit],
      );

      let lastSynctedItemDate;
      if (items.length > 0 && items[0].DateCreated !== undefined && items[0].DateCreated !== null) {
        lastSynctedItemDate = dayjs(items[0].DateCreated, "YYYY-MM-DD HH:mm:ss.SSSZ");
      }

      if (episodes.length > 0 && episodes[0].DateCreated !== undefined && episodes[0].DateCreated !== null) {
        const newLastSynctedItemDate = dayjs(episodes[0].DateCreated, "YYYY-MM-DD HH:mm:ss.SSSZ");

        if (lastSynctedItemDate === undefined || newLastSynctedItemDate.isAfter(lastSynctedItemDate)) {
          lastSynctedItemDate = newLastSynctedItemDate;
        }
      }

      if (lastSynctedItemDate !== undefined) {
        recentlyAddedFromJellyfinMapped = recentlyAddedFromJellyfinMapped.filter((item) =>
          dayjs(item.DateCreated, "YYYY-MM-DD HH:mm:ss.SSSZ").isAfter(lastSynctedItemDate),
        );
      }

      const filteredDbRows = [
        ...items.filter((item) => !excluded_libraries.includes(item.ParentId)),
        ...episodes.filter((item) => !excluded_libraries.includes(item.ParentId)),
      ];

      const recentlyAdded = [...recentlyAddedFromJellyfinMapped, ...filteredDbRows];
      // Sort recentlyAdded by DateCreated in descending order
      recentlyAdded.sort(
        (a, b) => dayjs(b.DateCreated, "YYYY-MM-DD HH:mm:ss.SSSZ") - dayjs(a.DateCreated, "YYYY-MM-DD HH:mm:ss.SSSZ"),
      );

      res.send(recentlyAdded);
      return;
    }
    const { rows: items } = await db.query(
      `SELECT i."Name", null "SeriesName", "Id", null "SeriesId", null "SeasonId", null "EpisodeId", null "SeasonNumber" , null "EpisodeNumber" ,  "PrimaryImageHash",i."DateCreated", "Type", i."ParentId"
      FROM public.jf_library_items i
      where i.archived=false
      order by "DateCreated" desc
      limit $1`,
      [limit],
    );

    const { rows: episodes } = await db.query(
      `
      SELECT e."Name",  e."SeriesName",e."Id" , e."SeriesId", e."SeasonId", e."EpisodeId",  e."ParentIndexNumber"  "SeasonNumber",  e."IndexNumber" "EpisodeNumber", e."PrimaryImageHash", e."DateCreated", e."Type", i."ParentId"    
	    FROM public.jf_library_episodes e
	    JOIN public.jf_library_items i
            on i."Id"=e."SeriesId"
	    where e."DateCreated" is not null
	          and e.archived=false
      order by e."DateCreated" desc
      limit $1`,
      [limit],
    );
    let lastSynctedItemDate;
    if (items.length > 0 && items[0].DateCreated !== undefined && items[0].DateCreated !== null) {
      lastSynctedItemDate = dayjs(items[0].DateCreated, "YYYY-MM-DD HH:mm:ss.SSSZ");
    }

    if (episodes.length > 0 && episodes[0].DateCreated !== undefined && episodes[0].DateCreated !== null) {
      const newLastSynctedItemDate = dayjs(episodes[0].DateCreated, "YYYY-MM-DD HH:mm:ss.SSSZ");

      if (lastSynctedItemDate === undefined || newLastSynctedItemDate.isAfter(lastSynctedItemDate)) {
        lastSynctedItemDate = newLastSynctedItemDate;
      }
    }

    if (lastSynctedItemDate !== undefined) {
      recentlyAddedFromJellyfinMapped = recentlyAddedFromJellyfinMapped.filter((item) =>
        dayjs(item.DateCreated, "YYYY-MM-DD HH:mm:ss.SSSZ").isAfter(lastSynctedItemDate),
      );
    }

    const filteredDbRows = [
      ...items.filter((item) => !excluded_libraries.includes(item.ParentId)),
      ...episodes.filter((item) => !excluded_libraries.includes(item.ParentId)),
    ];

    let recentlyAdded = [...recentlyAddedFromJellyfinMapped, ...filteredDbRows];
    recentlyAdded = recentlyAdded.filter((item) => item.Type !== "Series");

    if (GroupResults == true) {
      recentlyAdded = groupRecentlyAdded(recentlyAdded);
    }

    // Sort recentlyAdded by DateCreated in descending order
    recentlyAdded.sort(
      (a, b) => dayjs(b.DateCreated, "YYYY-MM-DD HH:mm:ss.SSSZ") - dayjs(a.DateCreated, "YYYY-MM-DD HH:mm:ss.SSSZ"),
    );

    res.send(recentlyAdded);
    return;
  } catch (error) {
    res.status(503);
    res.send(error);
  }
});

router.get("/getRecentlyAddedShelves", async (req, res) => {
  try {
    const limit = Math.min(Math.max(Number(req.query.limit) || 24, 1), 60);
    const config = await new configClass().getConfig();
    const excludedLibraries = config.settings.ExcludedLibraries || [];

    const { rows } = await db.query(
      `
      WITH active_libraries AS (
        SELECT "Id", "Name", "CollectionType"
        FROM public.jf_libraries
        WHERE archived=false
          AND NOT ("Id" = ANY($2::text[]))
      ),
      recent_media AS (
        SELECT
          i."Name",
          NULL::text "SeriesName",
          i."Id",
          NULL::text "SeriesId",
          NULL::text "SeasonId",
          NULL::text "EpisodeId",
          NULL::integer "SeasonNumber",
          NULL::integer "EpisodeNumber",
          i."PrimaryImageHash",
          i."DateCreated",
          i."Type",
          i."ParentId"
        FROM public.jf_library_items i
        JOIN active_libraries l ON l."Id"=i."ParentId"
        WHERE i.archived=false
          AND i."Type" != 'Series'
          AND i."DateCreated" IS NOT NULL

        UNION ALL

        SELECT
          e."Name",
          e."SeriesName",
          e."EpisodeId" "Id",
          e."SeriesId",
          e."SeasonId",
          e."EpisodeId",
          e."ParentIndexNumber" "SeasonNumber",
          e."IndexNumber" "EpisodeNumber",
          e."PrimaryImageHash",
          e."DateCreated",
          e."Type",
          i."ParentId"
        FROM public.jf_library_episodes e
        JOIN public.jf_library_items i ON i."Id"=e."SeriesId"
        JOIN active_libraries l ON l."Id"=i."ParentId"
        WHERE e.archived=false
          AND e."DateCreated" IS NOT NULL
      ),
      ranked_media AS (
        SELECT recent_media.*,
          ROW_NUMBER() OVER (PARTITION BY "ParentId" ORDER BY "DateCreated" DESC) row_number
        FROM recent_media
      )
      SELECT
        l."Id" id,
        l."Name" name,
        l."CollectionType" type,
        COALESCE(
          JSON_AGG(
            JSON_BUILD_OBJECT(
              'Name', r."Name",
              'SeriesName', r."SeriesName",
              'Id', r."Id",
              'SeriesId', r."SeriesId",
              'SeasonId', r."SeasonId",
              'EpisodeId', r."EpisodeId",
              'SeasonNumber', r."SeasonNumber",
              'EpisodeNumber', r."EpisodeNumber",
              'PrimaryImageHash', r."PrimaryImageHash",
              'DateCreated', r."DateCreated",
              'Type', r."Type",
              'ParentId', r."ParentId"
            )
            ORDER BY r."DateCreated" DESC
          ) FILTER (WHERE r."Id" IS NOT NULL),
          '[]'::json
        ) items
      FROM active_libraries l
      LEFT JOIN ranked_media r ON r."ParentId"=l."Id" AND r.row_number <= $1
      GROUP BY l."Id", l."Name", l."CollectionType"
      ORDER BY l."Name" ASC
      `,
      [limit, excludedLibraries],
    );

    res.set("Cache-Control", "private, max-age=30");
    res.send(
      rows.map((shelf) => ({
        ...shelf,
        count: shelf.items.length,
      })),
    );
  } catch (error) {
    console.error("Failed to load recently added shelves:", error);
    res.status(503).send({ error: "Unable to load recently added shelves" });
  }
});

router.post("/setconfig", async (req, res) => {
  try {
    const { JF_HOST, JF_API_KEY } = req.body;

    if (JF_HOST === undefined && JF_API_KEY === undefined) {
      res.status(400);
      res.send("JF_HOST and JF_API_KEY are required for configuration");
      return;
    }

    var url = JF_HOST;

    const validation = await API.validateSettings(url, JF_API_KEY);
    if (validation.isValid === false) {
      res.status(validation.status);
      res.send(validation);
      return;
    }

    const { rows: getConfig } = await db.query('SELECT * FROM app_config where "ID"=1');

    let query = 'UPDATE app_config SET "JF_HOST"=$1, "JF_API_KEY"=$2 where "ID"=1';
    if (getConfig.length === 0) {
      query = 'INSERT INTO app_config ("ID","JF_HOST","JF_API_KEY","APP_USER","APP_PASSWORD") VALUES (1,$1,$2,null,null)';
    }

    const { rows } = await db.query(query, [validation.cleanedUrl, JF_API_KEY]);

    const systemInfo = await API.systemInfo();

    if (systemInfo && systemInfo != {}) {
      const settingsjson = await db.query('SELECT settings FROM app_config where "ID"=1').then((res) => res.rows);

      if (settingsjson.length > 0) {
        const settings = settingsjson[0].settings || {};

        settings.ServerID = systemInfo?.Id || null;

        const query = 'UPDATE app_config SET settings=$1 where "ID"=1';

        await db.query(query, [settings]);
      }
    }

    const admins = await API.getAdmins(true);
    const preferredAdmin = await new configClass().getPreferedAdmin();
    if (admins && admins.length > 0 && preferredAdmin && !admins.map((item) => item.Id).includes(preferredAdmin)) {
      const newAdmin = admins[0];
      const settingsjson = await db.query('SELECT settings FROM app_config where "ID"=1').then((res) => res.rows);

      if (settingsjson.length > 0) {
        const settings = settingsjson[0].settings || {};

        settings.preferred_admin = { userid: newAdmin.Id, username: newAdmin.Name };

        const query = 'UPDATE app_config SET settings=$1 where "ID"=1';

        await db.query(query, [settings]);
      }
    }
    res.send(rows);
  } catch (error) {
    console.log(error);
  }
});

router.post("/setExternalUrl", async (req, res) => {
  try {
    const { ExternalUrl } = req.body;

    if (ExternalUrl === undefined) {
      res.status(400);
      res.send("ExternalUrl is required for configuration");
      return;
    }

    const config = await new configClass().getConfig();
    const validation = await API.validateSettings(ExternalUrl, config.JF_API_KEY);
    if (validation.isValid === false) {
      res.status(validation.status);
      res.send(validation);
      return;
    }

    try {
      const settings = config.settings || {};
      settings.EXTERNAL_URL = ExternalUrl;

      const query = 'UPDATE app_config SET settings=$1 where "ID"=1';

      await db.query(query, [settings]);
      config.settings = settings;
      res.send(config);
    } catch (error) {
      res.status(503);
      res.send({ error: "Error: " + error });
    }
  } catch (error) {
    console.log(error);
    res.status(503);
    res.send({ error: "Error: " + error });
  }
});

router.post("/setPreferredAdmin", async (req, res) => {
  try {
    const { userid, username } = req.body;

    if (userid === undefined && username === undefined) {
      res.status(400);
      res.send("A valid userid and username is required for preferred admin");
      return;
    }

    const settingsjson = await db.query('SELECT settings FROM app_config where "ID"=1').then((res) => res.rows);

    if (settingsjson.length > 0) {
      const settings = settingsjson[0].settings || {};

      settings.preferred_admin = { userid: userid, username: username };

      let query = 'UPDATE app_config SET settings=$1 where "ID"=1';

      await db.query(query, [settings]);

      res.send("Settings updated succesfully");
    } else {
      res.status(404);
      res.send("Settings not found");
    }
  } catch (error) {
    console.log(error);
  }

  console.log(`ENDPOINT CALLED: /setconfig: `);
});

router.post("/setRequireLogin", async (req, res) => {
  try {
    const { REQUIRE_LOGIN } = req.body;

    if (REQUIRE_LOGIN === undefined || typeof REQUIRE_LOGIN !== "boolean") {
      res.status(400);
      res.send("A valid value(true/false) is required for REQUIRE_LOGIN");
      return;
    }

    let query = 'UPDATE app_config SET "REQUIRE_LOGIN"=$1 where "ID"=1';

    const { rows } = await db.query(query, [REQUIRE_LOGIN]);
    res.send(rows);
  } catch (error) {
    console.log(error);
  }
});

router.post("/setAuthMode", async (req, res) => {
  try {
    const { mode, username, password, issuerUrl, clientId, clientSecret, redirectUri } = req.body;
    const config = await new configClass().getConfig();

    if (config.error) {
      res.status(503).json({ errorMessage: config.error });
      return;
    }

    const settings = config.settings || {};
    const primaryLocalUser = ["jellyfin-quick-connect", "oidc", "local-auth"].includes(config.APP_USER) ? null : config.APP_USER;
    let query = "";
    let params = [];

    if (mode === "quick-connect") {
      settings.auth = {
        ...(settings.auth || {}),
        mode: "quick-connect",
        label: "Jellyfin Login / Quick Connect",
      };

      query = 'UPDATE app_config SET "APP_USER"=$1, "APP_PASSWORD"=$2, "REQUIRE_LOGIN"=$3, settings=$4 where "ID"=1';
      params = ["jellyfin-quick-connect", null, true, settings];
    } else if (mode === "local") {
      if (!(settings.localUsers || []).length && !primaryLocalUser) {
        res.status(400).json({ errorMessage: "Create a local admin user on the Users page before enabling local login" });
        return;
      }

      settings.auth = {
        mode: "local",
        label: "Local JellyGlance login",
      };

      query = 'UPDATE app_config SET "APP_USER"=$1, "REQUIRE_LOGIN"=$2, settings=$3 where "ID"=1';
      params = [primaryLocalUser || "local-auth", true, settings];
    } else if (mode === "oidc") {
      if (!clientId) {
        res.status(400).json({ errorMessage: "OIDC client ID is required" });
        return;
      }

      const oidcTest = await testOidcDiscovery(issuerUrl);
      if (!oidcTest.isValid) {
        res.status(400).json(oidcTest);
        return;
      }

      settings.auth = {
        mode: "oidc",
        label: "OIDC / Authentik",
        issuerUrl: oidcTest.issuerUrl,
        clientId,
        clientSecret: clientSecret || null,
        redirectUri: redirectUri || null,
        discovery: oidcTest.discovery,
      };

      query = 'UPDATE app_config SET "APP_USER"=$1, "APP_PASSWORD"=$2, "REQUIRE_LOGIN"=$3, settings=$4 where "ID"=1';
      params = ["oidc", null, true, settings];
    } else {
      res.status(400).json({ errorMessage: "Invalid authentication mode" });
      return;
    }

    await db.query(query, params);
    res.json({ isValid: true, mode, settings });
  } catch (error) {
    console.log(error);
    res.status(500).json({ errorMessage: "Unable to update authentication mode" });
  }
});

router.post("/updateCredentials", async (req, res) => {
  const { username, current_password, new_password } = req.body;
  const config = await new configClass().getConfig();

  let result = { isValid: true, errorMessage: "" };

  if (config.error) {
    result = { isValid: false, errorMessage: config.error };
    res.status(503);
    res.send(result);
    return;
  }
  if (username === undefined && current_password === undefined && new_password === undefined) {
    result.isValid = false;
    result.errorMessage = "Invalid Parameters";
    res.status(400);
    res.send(result);
    return;
  }

  if (username !== undefined && username === "") {
    result.isValid = false;
    result.errorMessage = "Username cannot be empty";
    res.status(400);
    res.send(result);
    return;
  }

  try {
    if (username !== undefined && config.APP_USER !== username) {
      await db.query(`UPDATE app_config SET "APP_USER"=$1 where "ID"=1`, [username]);
    }

    if (current_password === undefined && new_password === undefined) {
      res.send(result);
      return;
    }

    if (config.APP_PASSWORD === current_password) {
      if (config.APP_PASSWORD === new_password) {
        result.isValid = false;
        result.errorMessage = "New Password cannot be the same as Old Password";
      } else {
        await db.query(`UPDATE app_config SET "APP_PASSWORD"=$1 where "ID"=1 AND "APP_PASSWORD"=$2`, [
          new_password,
          current_password,
        ]);
      }
    } else {
      result.isValid = false;
      result.errorMessage = "Old Password is Invalid";
    }
  } catch (error) {
    console.log(error);
    result.errorMessage = error;
  }
  if (!result.isValid) {
    res.status(400);
  }
  res.send(result);
});

router.get("/userAccess", async (req, res) => {
  try {
    const config = await new configClass().getConfig();
    if (config.error) {
      res.status(503).json({ errorMessage: config.error });
      return;
    }

    const settings = config.settings || {};
    const localUsers = (settings.localUsers || []).map(({ password, ...user }) => user);
    const primaryLocalUser = ["jellyfin-quick-connect", "oidc", "local-auth"].includes(config.APP_USER) ? null : config.APP_USER;
    res.json({
      roles: settings.roles || DEFAULT_ACCESS_ROLES,
      rolePermissions: { ...DEFAULT_ROLE_PERMISSIONS, ...(settings.rolePermissions || {}) },
      jellyfinRoles: settings.userRoles || {},
      localUsers,
      primaryLocalUser,
      authMode: settings.auth?.mode || (config.REQUIRE_LOGIN ? "local" : "quick-connect"),
      oidcLabel: settings.auth?.label,
    });
  } catch (error) {
    console.log(error);
    res.status(500).json({ errorMessage: "Unable to load user access settings" });
  }
});

router.post("/roles", async (req, res) => {
  try {
    const { role } = req.body;
    const cleanRole = role?.toString().trim();

    if (!cleanRole) {
      res.status(400).json({ errorMessage: "Role name is required" });
      return;
    }

    const config = await new configClass().getConfig();
    const settings = config.settings || {};
    const roles = settings.roles || DEFAULT_ACCESS_ROLES;

    if (roles.some((existingRole) => existingRole.toLowerCase() === cleanRole.toLowerCase())) {
      res.status(409).json({ errorMessage: "That role already exists" });
      return;
    }

    settings.roles = [...roles, cleanRole];
    settings.rolePermissions = {
      ...(settings.rolePermissions || {}),
      [cleanRole]: { dashboard: true, users: false, settings: false, apiKeys: false },
    };
    await db.query('UPDATE app_config SET settings=$1 where "ID"=1', [settings]);
    res.status(201).json({ roles: settings.roles, rolePermissions: { ...DEFAULT_ROLE_PERMISSIONS, ...settings.rolePermissions } });
  } catch (error) {
    console.log(error);
    res.status(500).json({ errorMessage: "Unable to add role" });
  }
});

router.delete("/roles/:role", async (req, res) => {
  try {
    const role = decodeURIComponent(req.params.role);

    if (DEFAULT_ACCESS_ROLES.includes(role)) {
      res.status(400).json({ errorMessage: "Built-in roles cannot be removed" });
      return;
    }

    const config = await new configClass().getConfig();
    const settings = config.settings || {};
    const roles = settings.roles || DEFAULT_ACCESS_ROLES;
    settings.roles = roles.filter((existingRole) => existingRole !== role);
    settings.rolePermissions = { ...(settings.rolePermissions || {}) };
    delete settings.rolePermissions[role];

    settings.userRoles = Object.fromEntries(
      Object.entries(settings.userRoles || {}).map(([userid, assignedRole]) => [userid, assignedRole === role ? "Viewer" : assignedRole])
    );
    settings.localUsers = (settings.localUsers || []).map((user) => ({
      ...user,
      role: user.role === role ? "Viewer" : user.role,
      updatedAt: user.role === role ? new Date().toISOString() : user.updatedAt,
    }));

    await db.query('UPDATE app_config SET settings=$1 where "ID"=1', [settings]);
    res.json({ roles: settings.roles, rolePermissions: { ...DEFAULT_ROLE_PERMISSIONS, ...settings.rolePermissions } });
  } catch (error) {
    console.log(error);
    res.status(500).json({ errorMessage: "Unable to remove role" });
  }
});

router.patch("/roles/:role/permissions", async (req, res) => {
  try {
    const role = decodeURIComponent(req.params.role);
    const { permissions } = req.body;

    if (!role || !permissions || typeof permissions !== "object") {
      res.status(400).json({ errorMessage: "Role and permissions are required" });
      return;
    }

    const config = await new configClass().getConfig();
    const settings = config.settings || {};
    const roles = settings.roles || DEFAULT_ACCESS_ROLES;

    if (!roles.includes(role)) {
      res.status(404).json({ errorMessage: "Role not found" });
      return;
    }

    settings.rolePermissions = {
      ...(settings.rolePermissions || {}),
      [role]: {
        ...DEFAULT_ROLE_PERMISSIONS[role],
        ...(settings.rolePermissions || {})[role],
        dashboard: Boolean(permissions.dashboard),
        users: Boolean(permissions.users),
        settings: Boolean(permissions.settings),
        apiKeys: Boolean(permissions.apiKeys),
      },
    };

    await db.query('UPDATE app_config SET settings=$1 where "ID"=1', [settings]);
    res.json({ role, permissions: settings.rolePermissions[role] });
  } catch (error) {
    console.log(error);
    res.status(500).json({ errorMessage: "Unable to update role permissions" });
  }
});

router.post("/localUsers", async (req, res) => {
  try {
    const { username, password, role } = req.body;
    if (!username || !password) {
      res.status(400).json({ errorMessage: "Username and password are required" });
      return;
    }

    const config = await new configClass().getConfig();
    const settings = config.settings || {};
    const localUsers = settings.localUsers || [];

    if (config.APP_USER === username || localUsers.some((user) => user.username === username)) {
      res.status(409).json({ errorMessage: "A local user with that username already exists" });
      return;
    }

    const nextUser = {
      id: randomUUID(),
      username,
      password,
      role: role || "Viewer",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    settings.localUsers = [...localUsers, nextUser];
    await db.query('UPDATE app_config SET settings=$1 where "ID"=1', [settings]);
    res.status(201).json({ ...nextUser, password: undefined });
  } catch (error) {
    console.log(error);
    res.status(500).json({ errorMessage: "Unable to add local user" });
  }
});

router.patch("/localUsers/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { role, password } = req.body;
    const config = await new configClass().getConfig();
    const settings = config.settings || {};
    const localUsers = settings.localUsers || [];
    const userIndex = localUsers.findIndex((user) => user.id === id);

    if (userIndex === -1) {
      res.status(404).json({ errorMessage: "Local user not found" });
      return;
    }

    localUsers[userIndex] = {
      ...localUsers[userIndex],
      role: role || localUsers[userIndex].role,
      password: password || localUsers[userIndex].password,
      updatedAt: new Date().toISOString(),
    };

    settings.localUsers = localUsers;
    await db.query('UPDATE app_config SET settings=$1 where "ID"=1', [settings]);
    res.json({ ...localUsers[userIndex], password: undefined });
  } catch (error) {
    console.log(error);
    res.status(500).json({ errorMessage: "Unable to update local user" });
  }
});

router.patch("/primaryLocalPassword", async (req, res) => {
  try {
    const { password } = req.body;
    if (!password) {
      res.status(400).json({ errorMessage: "Password is required" });
      return;
    }

    await db.query('UPDATE app_config SET "APP_PASSWORD"=$1 where "ID"=1', [password]);
    res.json({ isValid: true });
  } catch (error) {
    console.log(error);
    res.status(500).json({ errorMessage: "Unable to reset primary local password" });
  }
});

router.delete("/localUsers/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const config = await new configClass().getConfig();
    const settings = config.settings || {};
    const localUsers = settings.localUsers || [];
    settings.localUsers = localUsers.filter((user) => user.id !== id);

    await db.query('UPDATE app_config SET settings=$1 where "ID"=1', [settings]);
    res.json({ isValid: true });
  } catch (error) {
    console.log(error);
    res.status(500).json({ errorMessage: "Unable to delete local user" });
  }
});

router.patch("/userRoles/:userid", async (req, res) => {
  try {
    const { userid } = req.params;
    const { role } = req.body;

    if (!userid || !role) {
      res.status(400).json({ errorMessage: "User ID and role are required" });
      return;
    }

    const config = await new configClass().getConfig();
    const settings = config.settings || {};
    settings.userRoles = {
      ...(settings.userRoles || {}),
      [userid]: role,
    };

    await db.query('UPDATE app_config SET settings=$1 where "ID"=1', [settings]);
    res.json({ userid, role });
  } catch (error) {
    console.log(error);
    res.status(500).json({ errorMessage: "Unable to update role" });
  }
});

router.post("/updatePassword", async (req, res) => {
  const { current_password, new_password } = req.body;

  let result = { isValid: true, errorMessage: "" };

  try {
    const { rows } = await db.query(
      `SELECT "JF_HOST","JF_API_KEY","APP_USER" FROM app_config where "ID"=1 AND "APP_PASSWORD"=$1 `,
      [current_password],
    );

    if (rows && rows.length > 0) {
      if (current_password === new_password) {
        result.isValid = false;
        result.errorMessage = "New Password cannot be the same as Old Password";
      } else {
        await db.query(`UPDATE app_config SET "APP_PASSWORD"=$1 where "ID"=1 AND "APP_PASSWORD"=$2`, [
          new_password,
          current_password,
        ]);
      }
    } else {
      result.isValid = false;
      result.errorMessage = "Old Password is Invalid";
    }
  } catch (error) {
    console.log(error);
    result.errorMessage = error;
  }

  res.send(result);
});

router.get("/TrackedLibraries", async (req, res) => {
  const config = await new configClass().getConfig();

  if (config.error) {
    res.send({ error: config.error });
    return;
  }

  try {
    const libraries = await API.getLibraries();

    const ExcludedLibraries = config.settings?.ExcludedLibraries || [];

    const librariesWithTrackedStatus = libraries.map((items) => ({
      ...items,
      ...{ Tracked: !ExcludedLibraries.includes(items.Id) },
    }));
    res.send(librariesWithTrackedStatus);
  } catch (error) {
    res.status(503);
    res.send({ error: "Error: " + error });
  }
});

router.post("/setExcludedLibraries", async (req, res) => {
  const { libraryID } = req.body;

  if (libraryID === undefined) {
    res.status(400);
    res.send("No Library Id provided");
    return;
  }

  const settingsjson = await db.query('SELECT settings FROM app_config where "ID"=1').then((res) => res.rows);

  if (settingsjson.length > 0) {
    const settings = settingsjson[0].settings || {};

    let libraries = settings.ExcludedLibraries || [];
    if (libraries.includes(libraryID)) {
      libraries = libraries.filter((item) => item !== libraryID);
    } else {
      libraries.push(libraryID);
    }
    settings.ExcludedLibraries = libraries;

    let query = 'UPDATE app_config SET settings=$1 where "ID"=1';

    await db.query(query, [settings]);

    res.send("Settings updated succesfully");
  } else {
    res.status(404);
    res.send("Settings not found");
  }
});

router.get("/UntrackedUsers", async (req, res) => {
  const config = await new configClass().getConfig();

  if (config.error) {
    res.send({ error: config.error });
    return;
  }

  try {
    const ExcludedUsers = config.settings?.ExcludedUsers || [];

    res.send(ExcludedUsers);
  } catch (error) {
    res.status(503);
    res.send({ error: "Error: " + error });
  }
});

router.post("/setUntrackedUsers", async (req, res) => {
  const { userId } = req.body;
  if (Array.isArray(userId) || userId === undefined) {
    res.status(400);
    return res.send("No Valid User ID provided");
  }

  const settingsjson = await db.query('SELECT settings FROM app_config where "ID"=1').then((res) => res.rows);

  if (settingsjson.length > 0) {
    const settings = settingsjson[0].settings || {};

    let excludedUsers = settings.ExcludedUsers || [];
    if (excludedUsers.includes(userId)) {
      excludedUsers = excludedUsers.filter((item) => item !== userId);
    } else {
      excludedUsers.push(userId);
    }
    settings.ExcludedUsers = excludedUsers;

    let query = 'UPDATE app_config SET settings=$1 where "ID"=1';

    await db.query(query, [settings]);

    res.send(excludedUsers);
  } else {
    res.status(404);
    res.send("Settings not found");
  }
});

router.get("/keys", async (req, res) => {
  const config = await new configClass().getConfig();

  res.send(config.api_keys || []);
});

router.delete("/keys", async (req, res) => {
  const { key } = req.body;
  const config = await new configClass().getConfig();

  if (!key) {
    res.status(400);
    res.send({ error: "No API key provided to remove" });
    return;
  }

  const keys = config.api_keys || [];
  const keyExists = keys.some((obj) => obj.key === key);
  if (keyExists) {
    const new_keys_array = keys.filter((obj) => obj.key !== key);
    let query = 'UPDATE app_config SET api_keys=$1 where "ID"=1';

    await db.query(query, [JSON.stringify(new_keys_array)]);
    return res.send("Key removed: " + key);
  } else {
    res.status(404);
    return res.send("API key does not exist");
  }
});

router.post("/keys", async (req, res) => {
  const { name } = req.body;

  if (name === undefined) {
    res.status(400);
    res.send("Key Name is required to generate a key");
    return;
  }

  const config = await new configClass().getConfig();

  if (!name) {
    res.status(400);
    res.send({ error: "A Name is required to generate a key" });
    return;
  }

  let keys = config.api_keys || [];

  const uuid = randomUUID();
  const new_key = { name: name, key: uuid };

  keys.push(new_key);

  let query = 'UPDATE app_config SET api_keys=$1 where "ID"=1';

  await db.query(query, [JSON.stringify(keys)]);
  res.send(keys);
});

router.get("/getTaskSettings", async (req, res) => {
  try {
    const settingsjson = await db.query('SELECT settings FROM app_config where "ID"=1').then((res) => res.rows);

    if (settingsjson.length > 0) {
      const settings = settingsjson[0].settings || {};

      let tasksettings = settings.Tasks || {};
      res.send(tasksettings);
    } else {
      res.status(404);
      res.send({ error: "Task Settings Not Found" });
    }
  } catch (error) {
    res.status(503);
    res.send({ error: "Error: " + error });
  }
});

router.post("/setTaskSettings", async (req, res) => {
  const { taskname, Interval } = req.body;

  if (taskname === undefined || Interval === undefined) {
    res.status(400);
    res.send("Task Name and Interval are required");
    return;
  }

  if (!Number.isInteger(Interval) && Interval <= 0) {
    res.status(400);
    res.send("A valid Interval(int) which is > 0 minutes is required");
    return;
  }

  try {
    const settingsjson = await db.query('SELECT settings FROM app_config where "ID"=1').then((res) => res.rows);

    if (settingsjson.length > 0) {
      const settings = settingsjson[0].settings || {};
      if (!settings.Tasks) {
        settings.Tasks = {};
      }

      let tasksettings = settings.Tasks;
      if (!tasksettings[taskname]) {
        tasksettings[taskname] = {};
      }
      tasksettings[taskname].Interval = Interval;

      settings.Tasks = tasksettings;

      let query = 'UPDATE app_config SET settings=$1 where "ID"=1';

      await db.query(query, [settings]);
      const taskScheduler = new TaskScheduler().getInstance();
      await taskScheduler.updateIntervalsFromDB();
      await taskScheduler.getTaskHistory();
      res.status(200);
      res.send(tasksettings);
    } else {
      res.status(404);
      res.send({ error: "Task Settings Not Found" });
    }
  } catch (error) {
    res.status(503);
    res.send({ error: "Error: " + error });
  }
});

// Get Activity Monitor Polling Settings
router.get("/getActivityMonitorSettings", async (req, res) => {
  try {
    const settingsjson = await db.query('SELECT settings FROM app_config where "ID"=1').then((res) => res.rows);

    if (settingsjson.length > 0) {
      const settings = settingsjson[0].settings || {};
      console.log(settings);
      const pollingSettings = settings.ActivityMonitorPolling || {
        activeSessionsInterval: 1000,
        idleInterval: 5000,
      };
      res.send(pollingSettings);
    } else {
      res.status(404);
      res.send({ error: "Settings Not Found" });
    }
  } catch (error) {
    res.status(503);
    res.send({ error: "Error: " + error });
  }
});

// Set Activity Monitor Polling Settings
router.post("/setActivityMonitorSettings", async (req, res) => {
  const { activeSessionsInterval, idleInterval } = req.body;

  if (activeSessionsInterval === undefined || idleInterval === undefined) {
    res.status(400);
    res.send("activeSessionsInterval and idleInterval are required");
    return;
  }

  if (!Number.isInteger(activeSessionsInterval) || activeSessionsInterval <= 0) {
    res.status(400);
    res.send("A valid activeSessionsInterval(int) which is > 0 milliseconds is required");
    return;
  }

  if (!Number.isInteger(idleInterval) || idleInterval <= 0) {
    res.status(400);
    res.send("A valid idleInterval(int) which is > 0 milliseconds is required");
    return;
  }

  if (activeSessionsInterval > idleInterval) {
    res.status(400);
    res.send("activeSessionsInterval should be <= idleInterval for optimal performance");
    return;
  }

  try {
    const settingsjson = await db.query('SELECT settings FROM app_config where "ID"=1').then((res) => res.rows);

    if (settingsjson.length > 0) {
      const settings = settingsjson[0].settings || {};

      settings.ActivityMonitorPolling = {
        activeSessionsInterval: activeSessionsInterval,
        idleInterval: idleInterval,
      };

      let query = 'UPDATE app_config SET settings=$1 where "ID"=1';
      await db.query(query, [settings]);

      res.status(200);
      res.send(settings.ActivityMonitorPolling);
    } else {
      res.status(404);
      res.send({ error: "Settings Not Found" });
    }
  } catch (error) {
    res.status(503);
    res.send({ error: "Error: " + error });
  }
});

//JellyGlance app functions
router.get("/CheckForUpdates", async (req, res) => {
  try {
    let result = await checkForUpdates();
    res.send(result);
  } catch (error) {
    console.log(error);
  }
});

//DB Queries
router.post("/getUserDetails", async (req, res) => {
  try {
    const { userid } = req.body;

    if (userid === undefined) {
      res.status(400);
      res.send("No User Id provided");
      return;
    }

    const { rows } = await db.query(`select * from jf_users where "Id"=$1`, [userid]);
    res.send(rows[0]);
  } catch (error) {
    console.log(error);
    res.status(503);
    res.send(error);
  }
});

router.get("/getLibraries", async (req, res) => {
  try {
    const { rows } = await db.query(`SELECT * FROM jf_libraries`);
    res.send(rows);
  } catch (error) {
    console.log(error);
  }
});

router.post("/getLibrary", async (req, res) => {
  try {
    const { libraryid } = req.body;

    if (libraryid === undefined) {
      res.status(400);
      res.send("No Library Id provided");
      return;
    }

    const { rows } = await db.query(`select * from jf_libraries where "Id"=$1`, [libraryid]);
    res.send(rows[0]);
  } catch (error) {
    console.log(error);
    res.status(503);
    res.send(error);
  }
});

router.post("/getLibraryItems", async (req, res) => {
  try {
    const { libraryid } = req.body;

    if (libraryid === undefined) {
      res.status(400);
      res.send("No Library Id provided");
      return;
    }

    const { rows } = await db.query(`SELECT * FROM jf_library_items where "ParentId"=$1`, [libraryid]);
    res.send(rows);
  } catch (error) {
    console.log(error);
  }
});

router.post("/getSeasons", async (req, res) => {
  try {
    const { Id } = req.body;

    if (Id === undefined) {
      res.status(400);
      res.send("No Season Id provided");
      return;
    }

    const { rows } = await db.query(
      `SELECT s.*, i."PrimaryImageHash", (select count(e.*) "Episodes" from jf_library_episodes e  where e."SeasonId"=s."Id") ,(select sum(ii."Size") "Size" from jf_library_episodes e join jf_item_info ii on ii."Id"=e."EpisodeId" where e."SeasonId"=s."Id") FROM jf_library_seasons s left join jf_library_items i on i."Id"=s."SeriesId" where "SeriesId"=$1`,
      [Id],
    );
    res.send(rows);
  } catch (error) {
    console.log(error);
  }
});

router.post("/getEpisodes", async (req, res) => {
  try {
    const { Id } = req.body;

    if (Id === undefined) {
      res.status(400);
      res.send("No Episode Id provided");
      return;
    }

    const { rows } = await db.query(
      `SELECT e.*, i."PrimaryImageHash", ii."Size" FROM jf_library_episodes e left join jf_library_items i on i."Id"=e."SeriesId" join jf_item_info ii on ii."Id"=e."EpisodeId" where "SeasonId"=$1`,
      [Id],
    );
    res.send(rows);
  } catch (error) {
    console.log(error);
  }
});

router.post("/getItemDetails", async (req, res) => {
  try {
    const { Id } = req.body;
    if (Id === undefined) {
      res.status(400);
      res.send("No ID provided");
      return;
    }
    // let query = `SELECT im."Name" "FileName",im.*,i.* FROM jf_library_items i left join jf_item_info im on i."Id" = im."Id" where i."Id"=$1`;
    let query = `SELECT im."Name" "FileName",im."Id",im."Path",im."Name",im."Bitrate",im."MediaStreams",im."Type",  COALESCE(im."Size" ,(SELECT SUM(im."Size") FROM jf_library_seasons s JOIN jf_library_episodes e on s."Id"=e."SeasonId" JOIN jf_item_info im ON im."Id" = e."EpisodeId" WHERE s."SeriesId" = i."Id")) "Size",i.*, (select "Name" from jf_libraries l where l."Id"=i."ParentId") "LibraryName" FROM jf_library_items i left join jf_item_info im on i."Id" = im."Id" where i."Id"=$1`;
    let maxActivityQuery = `SELECT  MAX("ActivityDateInserted") "LastActivityDate" FROM public.jf_playback_activity`;
    let activityCountQuery = `SELECT  Count("ActivityDateInserted") "times_played",  SUM("PlaybackDuration") "total_play_time" FROM public.jf_playback_activity`;

    const { rows: items } = await db.query(query, [Id]);

    if (items.length === 0) {
      // query = `SELECT im."Name" "FileName",im.*,s.*, s.archived, i."PrimaryImageHash"  FROM jf_library_seasons s left join jf_item_info im on s."Id" = im."Id" left join jf_library_items i on i."Id"=s."SeriesId"  where s."Id"=$1`;
      query = `SELECT s."Name", (SELECT SUM(im."Size") FROM jf_library_episodes e JOIN jf_item_info im ON im."Id" = e."EpisodeId" WHERE s."Id" = e."SeasonId") AS "Size", s.*, i."PrimaryImageHash", i."ParentId",(select "Name" from jf_libraries l where l."Id"=i."ParentId") "LibraryName" FROM jf_library_seasons s LEFT JOIN jf_library_items i ON i."Id"=s."SeriesId" WHERE s."Id"=$1`;
      const { rows: seasons } = await db.query(query, [Id]);

      if (seasons.length === 0) {
        query = `SELECT im."Name" "FileName",im.*,e.*, e.archived , i."PrimaryImageHash", i."ParentId",(select "Name" from jf_libraries l where l."Id"=i."ParentId") "LibraryName"  FROM jf_library_episodes e join jf_item_info im on e."EpisodeId" = im."Id" left join jf_library_items i on i."Id"=e."SeriesId" where e."EpisodeId"=$1`;
        const { rows: episodes } = await db.query(query, [Id]);

        if (episodes.length !== 0) {
          maxActivityQuery = `${maxActivityQuery} where "EpisodeId"=$1`;
          activityCountQuery = `${activityCountQuery} where "EpisodeId"=$1`;
          const LastActivityDate = await db.querySingle(maxActivityQuery, [Id]);
          const TimesPlayed = await db.querySingle(activityCountQuery, [Id]);

          episodes.forEach((episode) => {
            episode.LastActivityDate = LastActivityDate.LastActivityDate ?? null;
            episode.times_played = TimesPlayed.times_played ?? null;
            episode.total_play_time = TimesPlayed.total_play_time ?? null;
          });
          res.send(await enrichItemDetails(episodes));
        } else {
          res.status(404).send("Item not found");
        }
      } else {
        maxActivityQuery = `${maxActivityQuery} where "SeasonId"=$1`;
        activityCountQuery = `${activityCountQuery} where "SeasonId"=$1`;
        const LastActivityDate = await db.querySingle(maxActivityQuery, [Id]);
        const TimesPlayed = await db.querySingle(activityCountQuery, [Id]);
        seasons.forEach((season) => {
          season.LastActivityDate = LastActivityDate.LastActivityDate ?? null;
          season.times_played = TimesPlayed.times_played ?? null;
          season.total_play_time = TimesPlayed.total_play_time ?? null;
        });
        res.send(await enrichItemDetails(seasons));
      }
    } else {
      maxActivityQuery = `${maxActivityQuery} where "NowPlayingItemId"=$1`;
      activityCountQuery = `${activityCountQuery} where "NowPlayingItemId"=$1`;
      const LastActivityDate = await db.querySingle(maxActivityQuery, [Id]);
      const TimesPlayed = await db.querySingle(activityCountQuery, [Id]);

      items.forEach((item) => {
        item.LastActivityDate = LastActivityDate.LastActivityDate ?? null;
        item.times_played = TimesPlayed.times_played ?? null;
        item.total_play_time = TimesPlayed.total_play_time ?? null;
      });

      res.send(await enrichItemDetails(items));
    }
  } catch (error) {
    console.log(error);
  }
});

router.delete("/item/purge", async (req, res) => {
  try {
    const { id, withActivity } = req.body;

    if (id === undefined) {
      res.status(400);
      res.send("No Item ID provided");
      return;
    }
    const { rows: items } = await db.query(`select * from jf_library_items where "Id"=$1`, [id]);
    const { rows: seasons } = await db.query(`select * from jf_library_seasons where "SeriesId"=$1 or "Id"=$1`, [id]);
    if (seasons.length > 0) {
      for (const season of seasons) {
        let delete_season_episodes_query = 'delete from jf_library_episodes where "SeasonId"=$1';
        if (!season.archived && (items.length > 0 ? !items[0].archived : true)) {
          delete_season_episodes_query += " and archived=true";
        }
        await db.query(delete_season_episodes_query, [season.Id]);
        if (season.archived || (items.length > 0 && items[0].archived)) {
          await db.query(`delete from jf_library_seasons where "Id"=$1`, [season.Id]);
        }
      }
    } else {
      const { rows: episodes } = await db.query(`select * from jf_library_episodes where "EpisodeId"=$1 and archived=true`, [id]);
      if (episodes.length > 0) {
        await db.query(`delete from jf_library_episodes where "EpisodeId"=$1 and archived=true`, [id]);
      }
      if (items.length > 0 && items[0].archived) {
        await db.query(`delete from jf_library_episodes where "SeriesId"=$1`, [id]);
        await db.query(`delete from jf_library_seasons where "SeriesId"=$1`, [id]);
        await db.query(`delete from jf_library_items where "Id"=$1`, [id]);
      }
      if (withActivity) {
        const deleteQuery = {
          text: `DELETE FROM jf_playback_activity WHERE${
            episodes.length > 0 ? ` "EpisodeId" IN (${pgp.as.csv(episodes.map((item) => item.EpisodeId))})  OR` : ""
          }${
            seasons.length > 0 ? ` "SeasonId" IN (${pgp.as.csv(seasons.map((item) => item.SeasonId))}) OR` : ""
          } "NowPlayingItemId"='${id}'`,
          refreshViews: true,
        };
        await db.query(deleteQuery);
      }
    }

    for (const view of db.materializedViews) {
      await db.refreshMaterializedView(view);
    }

    sendUpdate("GeneralAlert", {
      type: "Success",
      message: `Item ${withActivity ? "with Playback Activity" : ""} has been Purged`,
    });
    res.send("Item purged succesfully");
  } catch (error) {
    console.log(error);
    sendUpdate("GeneralAlert", { type: "Error", message: `There was an error Purging the Data` });

    res.status(503);
    res.send(error);
  }
});

router.delete("/library/purge", async (req, res) => {
  try {
    const { id, withActivity } = req.body;

    if (id === undefined) {
      res.status(400);
      res.send("No Library ID provided");
      return;
    }

    await purgeLibraryItems(id, withActivity, true);

    await db.query(`delete from jf_libraries where "Id"=$1`, [id]);

    sendUpdate("GeneralAlert", {
      type: "Success",
      message: `Library ${withActivity ? "with Playback Activity" : ""} has been Purged`,
    });
    res.send("Item purged succesfully");
  } catch (error) {
    console.log(error);
    sendUpdate("GeneralAlert", { type: "Error", message: `There was an error Purging the Data` });

    res.status(503);
    res.send(error);
  }
});

router.delete("/libraryItems/purge", async (req, res) => {
  try {
    const { id, withActivity } = req.body;
    if (id === undefined) {
      res.status(400);
      res.send("No Library ID provided");
      return;
    }

    await purgeLibraryItems(id, withActivity);

    sendUpdate("GeneralAlert", {
      type: "Success",
      message: `Library Items ${withActivity ? "with Playback Activity" : ""} has been Purged`,
    });
    res.send("Item purged succesfully");
  } catch (error) {
    console.log(error);
    sendUpdate("GeneralAlert", { type: "Error", message: `There was an error Purging the Data` });

    res.status(503);
    res.send(error);
  }
});

router.get("/getBackupTables", async (req, res) => {
  try {
    const config = await new configClass().getConfig();
    const excluded_tables = config.settings.ExcludedTables || [];

    let backupTables = tables.map((table) => {
      return {
        ...table,
        Excluded: excluded_tables.includes(table.value),
      };
    });

    res.send(backupTables);
    return;
  } catch (error) {
    res.status(503);
    res.send(error);
  }
});

router.post("/setExcludedBackupTable", async (req, res) => {
  const { table } = req.body;
  if (table === undefined || tables.map((item) => item.value).indexOf(table) === -1) {
    res.status(400);
    res.send("Invalid table provided");
    return;
  }

  const settingsjson = await db.query('SELECT settings FROM app_config where "ID"=1').then((res) => res.rows);

  if (settingsjson.length > 0) {
    const settings = settingsjson[0].settings || {};

    let excludedTables = settings.ExcludedTables || [];
    if (excludedTables.includes(table)) {
      excludedTables = excludedTables.filter((item) => item !== table);
    } else {
      excludedTables.push(table);
    }
    settings.ExcludedTables = excludedTables;

    let query = 'UPDATE app_config SET settings=$1 where "ID"=1';

    await db.query(query, [settings]);

    let backupTables = tables.map((table) => {
      return {
        ...table,
        Excluded: settings.ExcludedTables.includes(table.value),
      };
    });

    res.send(backupTables);
  } else {
    res.status(404);
    res.send("Settings not found");
  }
});

//DB Queries - History
router.get("/getHistory", async (req, res) => {
  const { size = 50, page = 1, search, sort = "ActivityDateInserted", desc = true, filters } = req.query;

  let filtersArray = [];
  if (filters) {
    try {
      filtersArray = JSON.parse(filters);
    } catch (error) {
      return res.status(400).json({
        error: "Invalid filters parameter",
        example: [
          {
            field: "ActivityDateInserted",
            min: "2024-12-31T22:00:00.000Z",
            max: "2024-12-31T22:00:00.000Z",
          },
          {
            field: "PlaybackDuration",
            min: "1",
            max: "10",
          },
          {
            field: "TotalPlays",
            min: "1",
            max: "10",
          },
          {
            field: "DeviceName",
            value: "test",
          },
          {
            field: "Client",
            value: "test",
          },
          {
            field: "NowPlayingItemName",
            value: "test",
          },
          {
            field: "RemoteEndPoint",
            value: "127.0.0.1",
          },
          {
            field: "UserName",
            value: "test",
          },
        ],
      });
    }
  }

  const sortField = groupedSortMap.find((item) => item.field === sort)?.column || "a.ActivityDateInserted";

  const values = [];

  try {
    const cte = {
      cteAlias: "activity_results",
      select: [
        "a.NowPlayingItemId",
        `COALESCE(a."EpisodeId", '1') as "EpisodeId"`,
        "a.UserId",
        `json_agg(row_to_json(a) ORDER BY "ActivityDateInserted" DESC) as results`,
        `COUNT(a.*) as "TotalPlays"`,
        `SUM(a."PlaybackDuration") as "TotalDuration"`,
      ],
      table: "jf_playback_activity_with_metadata",
      alias: "a",
      group_by: ["a.NowPlayingItemId", `COALESCE(a."EpisodeId", '1')`, "a.UserId"],
    };

    const query = {
      cte: cte,
      select: [
        "a.*",
        "a.EpisodeNumber",
        "a.SeasonNumber",
        "a.ParentId",
        "ar.results",
        "ar.TotalPlays",
        "ar.TotalDuration",
        `
        CASE 
          WHEN a."SeriesName" is null THEN a."NowPlayingItemName"
          ELSE CONCAT(a."SeriesName" , ' : S' , a."SeasonNumber" , 'E' , a."EpisodeNumber" , ' - ' , a."NowPlayingItemName")
        END AS "FullName"
        `,
      ],
      table: "js_latest_playback_activity",
      alias: "a",
      joins: [
        {
          type: "left",
          table: "activity_results",
          alias: "ar",
          conditions: [
            { first: "a.NowPlayingItemId", operator: "=", second: "ar.NowPlayingItemId" },
            { first: "a.EpisodeId", operator: "=", second: "ar.EpisodeId", type: "and" },
            { first: "a.UserId", operator: "=", second: "ar.UserId", type: "and" },
          ],
        },
      ],

      order_by: sortField,
      sort_order: desc ? "desc" : "asc",
      pageNumber: page,
      pageSize: size,
    };

    if (search && search.length > 0) {
      query.where = [
        {
          field: `LOWER(
          CASE 
            WHEN a."SeriesName" is null THEN a."NowPlayingItemName"
            ELSE CONCAT(a."SeriesName" , ' : S' , a."SeasonNumber" , 'E' , a."EpisodeNumber" , ' - ' , a."NowPlayingItemName")
          END 
          )`,
          operator: "LIKE",
          value: `$${values.length + 1}`,
        },
      ];

      values.push(`%${search.toLowerCase()}%`);
    }

    query.values = values;

    dbHelper.buildFilterList(query, filtersArray, filterFields);
    const result = await dbHelper.query(query);

    result.results = result.results.map((item) => ({
      ...item,
      PlaybackDuration: item.TotalDuration ? item.TotalDuration : item.PlaybackDuration,
    }));
    const response = { current_page: page, pages: result.pages, size: size, sort: sort, desc: desc, results: result.results };
    if (search && search.length > 0) {
      response.search = search;
    }

    if (filtersArray.length > 0) {
      response.filters = filtersArray;
    }

    res.send(response);
  } catch (error) {
    console.log(error);
  }
});

router.post("/getLibraryHistory", async (req, res) => {
  try {
    const { size = 50, page = 1, search, sort = "ActivityDateInserted", desc = true, filters } = req.query;

    let filtersArray = [];
    if (filters) {
      try {
        filtersArray = JSON.parse(filters);
      } catch (error) {
        return res.status(400).json({
          error: "Invalid filters parameter",
          example: [
            {
              field: "ActivityDateInserted",
              min: "2024-12-31T22:00:00.000Z",
              max: "2024-12-31T22:00:00.000Z",
            },
            {
              field: "PlaybackDuration",
              min: "1",
              max: "10",
            },
            {
              field: "TotalPlays",
              min: "1",
              max: "10",
            },
            {
              field: "DeviceName",
              value: "test",
            },
            {
              field: "Client",
              value: "test",
            },
            {
              field: "NowPlayingItemName",
              value: "test",
            },
            {
              field: "RemoteEndPoint",
              value: "127.0.0.1",
            },
            {
              field: "UserName",
              value: "test",
            },
          ],
        });
      }
    }
    const { libraryid } = req.body;

    if (libraryid === undefined) {
      res.status(400);
      res.send("No Library ID provided");
      return;
    }

    const sortField = groupedSortMap.find((item) => item.field === sort)?.column || "a.ActivityDateInserted";
    const values = [];

    const cte = {
      cteAlias: "activity_results",
      select: [
        "a.NowPlayingItemId",
        `COALESCE(a."EpisodeId", '1') as "EpisodeId"`,
        "a.UserId",
        `json_agg(row_to_json(a) ORDER BY "ActivityDateInserted" DESC) as results`,
        `COUNT(a.*) as "TotalPlays"`,
        `SUM(a."PlaybackDuration") as "TotalDuration"`,
      ],
      table: "jf_playback_activity_with_metadata",
      alias: "a",
      group_by: ["a.NowPlayingItemId", `COALESCE(a."EpisodeId", '1')`, "a.UserId"],
    };

    const query = {
      cte: cte,
      select: [
        "a.*",
        "a.EpisodeNumber",
        "a.SeasonNumber",
        "a.ParentId",
        "ar.results",
        "ar.TotalPlays",
        "ar.TotalDuration",
        `
        CASE 
          WHEN a."SeriesName" is null THEN a."NowPlayingItemName"
          ELSE CONCAT(a."SeriesName" , ' : S' , a."SeasonNumber" , 'E' , a."EpisodeNumber" , ' - ' , a."NowPlayingItemName")
        END AS "FullName"
        `,
      ],
      table: "js_latest_playback_activity",
      alias: "a",
      joins: [
        {
          type: "inner",
          table: "jf_library_items",
          alias: "i",
          conditions: [
            { first: "i.Id", operator: "=", second: "a.NowPlayingItemId" },
            { first: "i.ParentId", operator: "=", value: `$${values.length + 1}` },
          ],
        },
        {
          type: "left",
          table: "activity_results",
          alias: "ar",
          conditions: [
            { first: "a.NowPlayingItemId", operator: "=", second: "ar.NowPlayingItemId" },
            { first: "a.EpisodeId", operator: "=", second: "ar.EpisodeId", type: "and" },
            { first: "a.UserId", operator: "=", second: "ar.UserId", type: "and" },
          ],
        },
      ],

      order_by: sortField,
      sort_order: desc ? "desc" : "asc",
      pageNumber: page,
      pageSize: size,
    };

    values.push(libraryid);

    if (search && search.length > 0) {
      query.where = [
        {
          field: `LOWER(
          CASE 
            WHEN a."SeriesName" is null THEN a."NowPlayingItemName"
            ELSE CONCAT(a."SeriesName" , ' : S' , a."SeasonNumber" , 'E' , a."EpisodeNumber" , ' - ' , a."NowPlayingItemName")
          END 
          )`,
          operator: "LIKE",
          value: `$${values.length + 1}`,
        },
      ];

      values.push(`%${search.toLowerCase()}%`);
    }

    query.values = values;

    dbHelper.buildFilterList(query, filtersArray, filterFields);

    const result = await dbHelper.query(query);

    result.results = result.results.map((item) => ({
      ...item,
      PlaybackDuration: item.TotalDuration ? item.TotalDuration : item.PlaybackDuration,
    }));

    const response = { current_page: page, pages: result.pages, size: size, sort: sort, desc: desc, results: result.results };
    if (search && search.length > 0) {
      response.search = search;
    }
    if (filtersArray.length > 0) {
      response.filters = filtersArray;
    }
    res.send(response);
  } catch (error) {
    console.log(error);
    res.status(503);
    res.send(error);
  }
});

router.post("/getItemHistory", async (req, res) => {
  try {
    const { size = 50, page = 1, search, sort = "ActivityDateInserted", desc = true, filters } = req.query;
    const { itemid } = req.body;

    if (itemid === undefined) {
      res.status(400);
      res.send("No Item ID provided");
      return;
    }

    let filtersArray = [];
    if (filters) {
      try {
        filtersArray = JSON.parse(filters);
        filtersArray = filtersArray.filter((filter) => filter.field !== "TotalPlays");
      } catch (error) {
        return res.status(400).json({
          error: "Invalid filters parameter",
          example: [
            {
              field: "ActivityDateInserted",
              min: "2024-12-31T22:00:00.000Z",
              max: "2024-12-31T22:00:00.000Z",
            },
            {
              field: "PlaybackDuration",
              min: "1",
              max: "10",
            },
            {
              field: "TotalPlays",
              min: "1",
              max: "10",
            },
            {
              field: "DeviceName",
              value: "test",
            },
            {
              field: "Client",
              value: "test",
            },
            {
              field: "NowPlayingItemName",
              value: "test",
            },
            {
              field: "RemoteEndPoint",
              value: "127.0.0.1",
            },
            {
              field: "UserName",
              value: "test",
            },
          ],
        });
      }
    }

    const sortField = unGroupedSortMap.find((item) => item.field === sort)?.column || "a.ActivityDateInserted";
    const values = [];
    const query = {
      select: [
        "a.*",
        "a.EpisodeNumber",
        "a.SeasonNumber",
        "a.ParentId",
        `
        CASE 
          WHEN a."SeriesName" is null THEN a."NowPlayingItemName"
          ELSE CONCAT(a."SeriesName" , ' : S' , a."SeasonNumber" , 'E' , a."EpisodeNumber" , ' - ' , a."NowPlayingItemName")
        END AS "FullName"
        `,
      ],
      table: "jf_playback_activity_with_metadata",
      alias: "a",
      where: [
        [
          { column: "a.EpisodeId", operator: "=", value: `$${values.length + 1}` },
          { column: "a.SeasonId", operator: "=", value: `$${values.length + 2}`, type: "or" },
          { column: "a.NowPlayingItemId", operator: "=", value: `$${values.length + 3}`, type: "or" },
        ],
      ],
      order_by: sortField,
      sort_order: desc ? "desc" : "asc",
      pageNumber: page,
      pageSize: size,
    };

    values.push(itemid);
    values.push(itemid);
    values.push(itemid);

    if (search && search.length > 0) {
      query.where = [
        {
          field: `LOWER(
          CASE 
            WHEN a."SeriesName" is null THEN a."NowPlayingItemName"
            ELSE CONCAT(a."SeriesName" , ' : S' , a."SeasonNumber" , 'E' , a."EpisodeNumber" , ' - ' , a."NowPlayingItemName")
          END 
          )`,
          operator: "LIKE",
          value: `$${values.length + 1}`,
        },
      ];
      values.push(`%${search.toLowerCase()}%`);
    }

    query.values = values;
    dbHelper.buildFilterList(query, filtersArray, filterFields);
    const result = await dbHelper.query(query);

    const response = { current_page: page, pages: result.pages, size: size, sort: sort, desc: desc, results: result.results };
    if (search && search.length > 0) {
      response.search = search;
    }

    if (filters) {
      response.filters = JSON.parse(filters);
    }

    res.send(response);
  } catch (error) {
    console.log(error);
    res.status(503);
    res.send(error);
  }
});

router.post("/getUserHistory", async (req, res) => {
  try {
    const { size = 50, page = 1, search, sort = "ActivityDateInserted", desc = true, filters } = req.query;

    let filtersArray = [];
    if (filters) {
      try {
        filtersArray = JSON.parse(filters);
        filtersArray = filtersArray.filter((filter) => filter.field !== "TotalPlays");
      } catch (error) {
        return res.status(400).json({
          error: "Invalid filters parameter",
          example: [
            {
              field: "ActivityDateInserted",
              min: "2024-12-31T22:00:00.000Z",
              max: "2024-12-31T22:00:00.000Z",
            },
            {
              field: "PlaybackDuration",
              min: "1",
              max: "10",
            },
            {
              field: "TotalPlays",
              min: "1",
              max: "10",
            },
            {
              field: "DeviceName",
              value: "test",
            },
            {
              field: "Client",
              value: "test",
            },
            {
              field: "NowPlayingItemName",
              value: "test",
            },
            {
              field: "RemoteEndPoint",
              value: "127.0.0.1",
            },
            {
              field: "UserName",
              value: "test",
            },
          ],
        });
      }
    }
    const { userid } = req.body;

    if (userid === undefined) {
      res.status(400);
      res.send("No User ID provided");
      return;
    }

    const sortField = unGroupedSortMap.find((item) => item.field === sort)?.column || "a.ActivityDateInserted";

    const values = [];
    const query = {
      select: [
        "a.*",
        "a.EpisodeNumber",
        "a.SeasonNumber",
        "a.ParentId",
        `
        CASE 
          WHEN a."SeriesName" is null THEN a."NowPlayingItemName"
          ELSE CONCAT(a."SeriesName" , ' : S' , a."SeasonNumber" , 'E' , a."EpisodeNumber" , ' - ' , a."NowPlayingItemName")
        END AS "FullName"
        `,
      ],
      table: "jf_playback_activity_with_metadata",
      alias: "a",
      where: [[{ column: "a.UserId", operator: "=", value: `$${values.length + 1}` }]],
      order_by: sortField,
      sort_order: desc ? "desc" : "asc",
      pageNumber: page,
      pageSize: size,
    };

    values.push(userid);

    if (search && search.length > 0) {
      query.where = [
        {
          field: `LOWER(
          CASE 
            WHEN a."SeriesName" is null THEN a."NowPlayingItemName"
            ELSE CONCAT(a."SeriesName" , ' : S' , a."SeasonNumber" , 'E' , a."EpisodeNumber" , ' - ' , a."NowPlayingItemName")
          END 
          )`,
          operator: "LIKE",
          value: `$${values.length + 1}`,
        },
      ];
      values.push(`%${search.toLowerCase()}%`);
    }

    query.values = values;

    dbHelper.buildFilterList(query, filtersArray, filterFields);

    const result = await dbHelper.query(query);

    const response = { current_page: page, pages: result.pages, size: size, sort: sort, desc: desc, results: result.results };

    if (search && search.length > 0) {
      response.search = search;
    }

    if (filters) {
      response.filters = JSON.parse(filters);
    }

    res.send(response);
  } catch (error) {
    console.log(error);
    res.status(503);
    res.send(error);
  }
});

router.post("/deletePlaybackActivity", async (req, res) => {
  try {
    const { ids } = req.body;

    if (ids === undefined || !Array.isArray(ids)) {
      res.status(400);
      res.send("A list of IDs is required. EG: [1,2,3]");
      return;
    }

    await db.query(`DELETE from jf_playback_activity where "Id" = ANY($1)`, [ids], true);
    res.send(`${ids.length} Records Deleted`);
  } catch (error) {
    console.log(error);
    res.status(503);
    res.send(error);
  }
});

router.post("/getActivityTimeLine", async (req, res) => {
  try {
    const { userId, libraries } = req.body;

    if (libraries === undefined || !Array.isArray(libraries)) {
      res.status(400);
      res.send("A list of IDs is required. EG: [1,2,3]");
      return;
    }

    if (userId === undefined) {
      res.status(400);
      res.send("A userId is required.");
      return;
    }

    const { rows } = await db.query(`SELECT * FROM fs_get_user_activity($1, $2);`, [userId, libraries]);
    res.send(rows);
  } catch (error) {
    console.log(error);
    res.status(503);
    res.send(error);
  }
});

// Downloads

router.get("/integrations", async (req, res) => {
  try {
    res.send(await getIntegrations());
  } catch (error) {
    console.error("Get integrations failed:", error);
    res.status(503).send({ error: "Unable to load integrations" });
  }
});

router.post("/integrations", async (req, res) => {
  try {
    res.send(await saveIntegrations(req.body || {}));
  } catch (error) {
    console.error("Save integrations failed:", error);
    res.status(503).send({ error: "Unable to save integrations" });
  }
});

router.post("/integrations/test", async (req, res) => {
  const { integration, type } = req.body || {};

  if (!integration) {
    return res.status(400).send({ ok: false, error: "Integration is required" });
  }

  try {
    const result = type === "download" ? await testDownloadIntegration(integration) : await testArrIntegration(integration);
    if (!result.ok) {
      return res.status(400).send(result);
    }
    return res.send(result);
  } catch (error) {
    return res.status(503).send({
      ok: false,
      error: getAxiosErrorMessage(error),
    });
  }
});

router.get("/integrations/calendar", async (req, res) => {
  try {
    const data = await getIntegrationData();
    res.send(data.calendar);
  } catch (error) {
    console.error("Get calendar integration data failed:", error);
    res.status(503).send({ error: "Unable to load calendar data" });
  }
});

router.get("/integrations/downloads", async (req, res) => {
  try {
    const data = await getIntegrationData();
    res.send(data.downloads);
  } catch (error) {
    console.error("Get download integration data failed:", error);
    res.status(503).send({ error: "Unable to load download data" });
  }
});

router.post("/downloads/add", async (req, res) => {
  const { client, value, fileName } = req.body || {};
  const downloadName = fileName || value?.trim();

  if (!client) {
    return res.status(400).send({ error: "Download client is required" });
  }

  if (!downloadName) {
    return res.status(400).send({ error: "Torrent URL, magnet link, or torrent file is required" });
  }

  const isMagnet = typeof value === "string" && value.trim().startsWith("magnet:");
  const isTorrentUrl = typeof value === "string" && /^https?:\/\/.+\.torrent(\?.*)?$/i.test(value.trim());

  if (!fileName && !isMagnet && !isTorrentUrl) {
    return res.status(400).send({ error: "Use a magnet link, a .torrent URL, or upload a .torrent file" });
  }

  try {
    const integrationData = await getIntegrationData();
    const nextItem = {
      id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
      name: downloadName,
      client,
      source: "Other",
      state: "Queued",
      progress: 0,
      size: "Queued",
      down: "0 B/s",
      up: "0 B/s",
      addedAt: new Date().toISOString(),
    };

    await saveIntegrationData({
      downloads: {
        ...integrationData.downloads,
        items: [nextItem, ...(integrationData.downloads.items || [])],
        syncedAt: new Date().toISOString(),
      },
    });

    const webhookManager = new WebhookManager();
    await webhookManager.triggerEventWebhooks("download_added", {
      integrationEvent: "download added",
      client,
      downloadName,
      sourceType: fileName ? "torrent_file" : isMagnet ? "magnet" : "torrent_url",
      message: `${downloadName} queued for ${client}.`,
    });

    sendUpdate("GeneralAlert", { type: "Success", message: `${downloadName} queued for ${client}` });
    return res.send({ ok: true, downloadName, item: nextItem });
  } catch (error) {
    console.error("Download add event failed:", error);
    return res.status(500).send({ error: "Unable to queue download event" });
  }
});

//Tasks

router.get("/stopTask", async (req, res) => {
  const { task } = req.query;

  if (task === undefined) {
    res.status(400);
    res.send("No Task provided");
    return;
  }
  const taskManager = new TaskManager().getInstance();
  if (taskManager.taskList[task] === undefined) {
    res.status(404);
    res.send("Task not found");
    return;
  }

  const _task = taskManager.taskList[task];

  if (taskManager.isTaskRunning(_task.name)) {
    taskManager.stopTask(_task);
    res.send("Task Stopped");
    return;
  } else {
    res.status(400);
    res.send("Task is not running");
    return;
  }
});

router.get("/startTask", async (req, res) => {
  const { task } = req.query;

  if (task === undefined) {
    res.status(400).send("No Task provided");
    return;
  }

  const taskManager = new TaskManager().getInstance();
  const taskScheduler = new TaskScheduler().getInstance();
  const taskConfig = taskManager.taskList[task];

  if (taskConfig === undefined) {
    res.status(404).send("Task not found");
    return;
  }

  const success = taskManager.addTask({
    task: taskConfig,
    onComplete: async () => {
      await taskScheduler.getTaskHistory();
      sendUpdate("GeneralAlert", { type: "Success", message: `${taskConfig.name} completed` });
    },
    onError: async (error) => {
      await taskScheduler.getTaskHistory();
      console.error(error);
      sendUpdate("TaskError", { type: "Error", message: `${taskConfig.name} failed` });
    },
    onExit: async () => {
      await taskScheduler.getTaskHistory();
      sendUpdate("TaskError", { type: "Error", message: `${taskConfig.name} stopped` });
    },
  });

  if (!success) {
    res.status(409).send(`${taskConfig.name} is already running`);
    sendUpdate("TaskError", { type: "Error", message: `${taskConfig.name} is already running` });
    return;
  }

  taskManager.startTask(taskConfig, triggertype.Manual);
  res.send(`${taskConfig.name} started`);
});

// Handle other routes
router.use((req, res) => {
  res.status(404).send({ error: "Not Found" });
});

module.exports = router;
