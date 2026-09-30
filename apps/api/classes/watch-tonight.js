const db = require("../db");
const configClass = require("./config");
const { axios } = require("./axios");
const API = require("./api-loader");
const { version: APP_VERSION } = require("../package.json");

const WATCH_TONIGHT_TTL_MS = 3 * 60 * 1000;
let watchTonightCache = { at: 0, key: "", items: [] };

function cleanUrl(url = "") {
  return String(url || "").trim().replace(/\/+$/, "");
}

function normalizeJellyfinMediaItem(item) {
  const mediaType = item.Type === "Series" ? "Series" : item.Type === "Episode" ? "Episode" : item.Type === "Movie" ? "Movie" : item.Type || "Media";
  const playbackTicks = Number(item.UserData?.PlaybackPositionTicks || 0);
  const runtimeTicks = Number(item.RunTimeTicks || 0);
  const progress = runtimeTicks > 0 ? Math.min(100, Math.round((playbackTicks / runtimeTicks) * 100)) : Number(item.UserData?.PlayedPercentage || 0);
  const imageId = mediaType === "Episode" && item.SeriesId ? item.SeriesId : item.Id;
  return {
    id: item.Id,
    name: item.Name || item.SeriesName || "Untitled",
    type: mediaType,
    seriesName: item.SeriesName || null,
    seriesId: item.SeriesId || null,
    progress,
    played: Boolean(item.UserData?.Played),
    imageId,
    primaryImageHash: item.ImageTags?.Primary || item.PrimaryImageTag || null,
  };
}

async function fetchJellyfinUserItems(userId, params = {}) {
  const config = await new configClass().getConfig();
  if (config.error) throw new Error(config.error);
  const response = await axios.get(`${cleanUrl(config.JF_HOST)}/Users/${encodeURIComponent(userId)}/Items`, {
    timeout: 12000,
    headers: {
      Authorization: `MediaBrowser Token="${config.JF_API_KEY}"`,
      "User-Agent": `JellyGlance/${APP_VERSION}`,
    },
    params: {
      Recursive: true,
      Limit: 24,
      Fields: "DateCreated,ProductionYear,SeriesName,ImageTags,PrimaryImageTag,SeriesPrimaryImageTag,RunTimeTicks,UserData",
      ExcludeLocationTypes: "Virtual",
      ...params,
    },
  });
  return Array.isArray(response.data?.Items) ? response.data.Items : [];
}

function linkId(item) {
  if (item.type === "Episode") return item.seriesId || item.id;
  return item.id;
}

function upsertCandidate(map, item, userName, flags = {}) {
  const id = linkId(item);
  if (!id) return;
  const current = map.get(id) || {
    itemId: id,
    name: item.seriesName || item.name,
    type: item.type === "Episode" ? "Series" : item.type,
    primaryImageHash: item.primaryImageHash || null,
    imageId: item.imageId || id,
    continueUsers: new Set(),
    watchlistUsers: new Set(),
    favouriteUsers: new Set(),
    startedUsers: new Set(),
    finishedUsers: new Set(),
    progress: 0,
  };
  if (flags.continueWatching) current.continueUsers.add(userName);
  if (flags.watchlist) current.watchlistUsers.add(userName);
  if (flags.favourite) current.favouriteUsers.add(userName);
  if (flags.started) current.startedUsers.add(userName);
  if (flags.finished) current.finishedUsers.add(userName);
  current.progress = Math.max(current.progress, Number(item.progress || 0));
  if (!current.primaryImageHash && item.primaryImageHash) current.primaryImageHash = item.primaryImageHash;
  map.set(id, current);
}

function scoreCandidate(row) {
  const continueCount = row.continueUsers.size;
  const interestUsers = new Set([...row.watchlistUsers, ...row.favouriteUsers]);
  const unfinished = row.startedUsers.size > 0 && row.finishedUsers.size === 0;
  let score = 0;
  if (continueCount) score += 100 + continueCount * 10;
  if (interestUsers.size > 1) score += 80 + (interestUsers.size - 1) * 8;
  else if (interestUsers.size === 1) score += 8;
  if (unfinished) score += 60 + row.startedUsers.size * 5;
  return score;
}

function reasonsFor(row) {
  const reasons = [];
  if (row.continueUsers.size) reasons.push("continue");
  if (row.watchlistUsers.size > 1) reasons.push("shared-watchlist");
  else if (row.favouriteUsers.size > 1) reasons.push("shared-favourite");
  if (row.startedUsers.size > 0 && row.finishedUsers.size === 0) reasons.push("unfinished");
  return reasons;
}

async function fetchUnfinishedFromActivity(excludedUserIds = []) {
  const params = [];
  const excludedClause = excludedUserIds.length ? `AND a."UserId" <> ALL($1)` : "";
  if (excludedUserIds.length) params.push(excludedUserIds);
  const { rows } = await db
    .query(
      `
      SELECT
        a."NowPlayingItemId" AS "ItemId",
        COALESCE(NULLIF(a."SeriesName", ''), NULLIF(a."NowPlayingItemName", ''), 'Unknown') AS "Name",
        array_agg(DISTINCT a."UserName") AS "Users",
        max(i."PrimaryImageHash") AS "PrimaryImageHash",
        max(i."RunTimeTicks") AS "RunTimeTicks",
        max(a."PlaybackDuration") AS "MaxDuration"
      FROM jf_playback_activity a
      LEFT JOIN jf_library_items i ON i."Id" = a."NowPlayingItemId"
      WHERE a."ActivityDateInserted" >= now() - interval '90 days'
        AND a."NowPlayingItemId" IS NOT NULL
        ${excludedClause}
      GROUP BY a."NowPlayingItemId", COALESCE(NULLIF(a."SeriesName", ''), NULLIF(a."NowPlayingItemName", ''), 'Unknown')
      HAVING max(a."PlaybackDuration") * 10000000.0 < COALESCE(NULLIF(max(i."RunTimeTicks"), 0), 1) * 0.9
      ORDER BY count(DISTINCT a."UserId") DESC
      LIMIT 24
      `,
      params
    )
    .catch(() => ({ rows: [] }));
  return rows;
}

async function fetchHouseholdWatchTonight(excludedUserIds = []) {
  const key = [...excludedUserIds].sort().join(",");
  if (watchTonightCache.items && watchTonightCache.key === key && Date.now() - watchTonightCache.at < WATCH_TONIGHT_TTL_MS) {
    return watchTonightCache.items;
  }

  const excluded = new Set((excludedUserIds || []).map(String));
  const users = (await API.getUsers(true).catch(() => [])).filter((user) => user?.Id && !excluded.has(String(user.Id)));
  const map = new Map();

  await Promise.all(
    users.map(async (user) => {
      const name = user.Name || user.Id;
      const [continueWatching, favourites, likes] = await Promise.all([
        fetchJellyfinUserItems(user.Id, {
          Filters: "IsResumable",
          IncludeItemTypes: "Movie,Episode",
          SortBy: "DatePlayed",
          SortOrder: "Descending",
          Limit: 24,
        }).catch(() => []),
        fetchJellyfinUserItems(user.Id, {
          Filters: "IsFavorite",
          IncludeItemTypes: "Movie,Series",
          Limit: 24,
        }).catch(() => []),
        fetchJellyfinUserItems(user.Id, {
          Filters: "Likes",
          IncludeItemTypes: "Movie,Series",
          Limit: 48,
        }).catch(() => []),
      ]);
      continueWatching.map(normalizeJellyfinMediaItem).forEach((item) => {
        upsertCandidate(map, item, name, { continueWatching: true, started: true, finished: item.played });
      });
      favourites.map(normalizeJellyfinMediaItem).forEach((item) => upsertCandidate(map, item, name, { favourite: true }));
      likes.map(normalizeJellyfinMediaItem).forEach((item) => upsertCandidate(map, item, name, { watchlist: true }));
    })
  );

  const unfinished = await fetchUnfinishedFromActivity(excludedUserIds);
  for (const row of unfinished) {
    const names = Array.isArray(row.Users) ? row.Users : [];
    upsertCandidate(
      map,
      {
        id: row.ItemId,
        name: row.Name,
        type: "Movie",
        seriesName: row.Name,
        seriesId: row.ItemId,
        progress: 0,
        played: false,
        imageId: row.ItemId,
        primaryImageHash: row.PrimaryImageHash,
      },
      names[0] || "Household",
      { started: true }
    );
    const current = map.get(row.ItemId);
    if (current) {
      names.forEach((name) => current.startedUsers.add(name));
    }
  }

  const items = [...map.values()]
    .map((row) => {
      const users = [...new Set([...row.continueUsers, ...row.watchlistUsers, ...row.favouriteUsers, ...row.startedUsers])];
      const finishedByHousehold = users.length > 0 && users.every((name) => row.finishedUsers.has(name));
      if (finishedByHousehold) return null;
      const score = scoreCandidate(row);
      if (!score) return null;
      return {
        itemId: row.itemId,
        name: row.name,
        type: row.type,
        primaryImageHash: row.primaryImageHash,
        imageId: row.imageId,
        score,
        reasons: reasonsFor(row),
        users,
        progress: row.progress,
      };
    })
    .filter(Boolean)
    .sort((left, right) => right.score - left.score || right.users.length - left.users.length)
    .slice(0, 8);

  watchTonightCache = { at: Date.now(), key, items };
  return items;
}

module.exports = {
  fetchJellyfinUserItems,
  normalizeJellyfinMediaItem,
  fetchHouseholdWatchTonight,
};
