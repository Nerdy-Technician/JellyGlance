const { axios } = require("./axios");
const { getIntegrations } = require("./integration-store");

const ISSUE_TYPES = { 1: "Video", 2: "Audio", 3: "Subtitles", 4: "Other" };
const mediaTitleCache = new Map();
const MEDIA_CACHE_TTL_MS = 10 * 60 * 1000;

function cleanUrl(url = "") {
  return String(url).trim().replace(/\/+$/, "");
}

function isSeerrIntegration(integration) {
  const name = String(integration?.name || integration?.slug || "").toLowerCase();
  return name === "seerr" || name.includes("jellyseerr") || name.includes("overseerr");
}

function issueStatusLabel(status) {
  const value = String(status ?? "").toLowerCase();
  if (status === 2 || value === "resolved" || value === "2") return "Resolved";
  return "Open";
}

function issueTypeLabel(type) {
  if (ISSUE_TYPES[type]) return ISSUE_TYPES[type];
  const value = String(type || "").toLowerCase();
  if (value.includes("video")) return "Video";
  if (value.includes("audio")) return "Audio";
  if (value.includes("sub")) return "Subtitles";
  return "Other";
}

function buildImageUrl(imagePath, size = "w342") {
  if (!imagePath) return null;
  const normalizedPath = String(imagePath).startsWith("/") ? imagePath : `/${imagePath}`;
  return `https://image.tmdb.org/t/p/${size}${normalizedPath}`;
}

async function mapPool(items, limit, mapper) {
  const results = new Array(items.length);
  let index = 0;
  async function worker() {
    while (index < items.length) {
      const current = index++;
      results[current] = await mapper(items[current], current);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) || 1 }, () => worker()));
  return results;
}

async function fetchMediaDetails(app, mediaType, tmdbId) {
  const type = String(mediaType || "").toLowerCase();
  if (!tmdbId || !["movie", "tv"].includes(type)) return {};

  const cacheKey = `${app.instanceId || app.name}:${type}:${tmdbId}`;
  const cached = mediaTitleCache.get(cacheKey);
  if (cached?.expiresAt > Date.now()) return cached.data;

  try {
    const response = await axios.get(`${cleanUrl(app.values?.url)}/api/v1/${type}/${encodeURIComponent(tmdbId)}`, {
      timeout: 10000,
      headers: { "X-Api-Key": app.values?.secret },
    });
    const data = response.data || {};
    mediaTitleCache.set(cacheKey, { data, expiresAt: Date.now() + MEDIA_CACHE_TTL_MS });
    return data;
  } catch (error) {
    console.log(`[REQUESTS] ${app.name} issue media lookup failed for ${type}:${tmdbId}:`, error.response?.status || error.message);
    return {};
  }
}

function normalizeIssue(app, issue, mediaDetails = {}) {
  const media = issue.media || {};
  const createdBy = issue.createdBy || {};
  const comments = Array.isArray(issue.comments) ? issue.comments : [];
  const firstComment = comments.find((comment) => comment?.message)?.message || "";
  const mediaType = media.mediaType || issue.mediaType || mediaDetails.mediaType || "";
  const tmdbId = media.tmdbId || issue.tmdbId || mediaDetails.id;
  const url = cleanUrl(app.values?.url);
  const title =
    mediaDetails.title ||
    mediaDetails.name ||
    media.title ||
    media.name ||
    issue.mediaTitle ||
    firstComment ||
    `${mediaType || "Media"} issue`;
  const posterPath = mediaDetails.posterPath || mediaDetails.poster_path || media.posterPath;
  return {
    id: issue.id,
    sourceId: app.instanceId,
    source: app.name,
    issueType: issueTypeLabel(issue.issueType ?? issue.problemType),
    status: issueStatusLabel(issue.status),
    title,
    mediaType,
    tmdbId,
    season: issue.problemSeason,
    episode: issue.problemEpisode,
    message: firstComment,
    posterUrl: buildImageUrl(posterPath, "w342"),
    posterUrls: posterPath ? ["w342", "w500"].map((size) => buildImageUrl(posterPath, size)) : [],
    comments: comments.map((comment) => ({
      id: comment.id,
      message: comment.message,
      user: comment.user?.displayName || comment.user?.email || "",
      createdAt: comment.createdAt,
    })),
    createdBy: createdBy.displayName || createdBy.email || createdBy.username || "User",
    createdAt: issue.createdAt,
    openUrl: url && tmdbId && ["movie", "tv"].includes(String(mediaType).toLowerCase())
      ? `${url}/${String(mediaType).toLowerCase()}/${encodeURIComponent(tmdbId)}`
      : url ? `${url}/issues` : null,
  };
}

async function connectedSeerrApps() {
  const integrations = await getIntegrations();
  return (integrations.arrApps || []).filter((integration) => integration.connected && isSeerrIntegration(integration));
}

function getApp(apps, sourceId) {
  return apps.find((app) => app.instanceId === sourceId);
}

async function fetchSeerrIssues() {
  const apps = await connectedSeerrApps();
  const issues = [];
  const errors = [];

  if (!apps.length) {
    return { issues: [], errors: [{ source: "Seerr", message: "No connected Jellyseerr or Overseerr source" }], syncedAt: new Date().toISOString() };
  }

  for (const app of apps) {
    const url = cleanUrl(app.values?.url);
    const apiKey = app.values?.secret;
    if (!url || !apiKey) {
      errors.push({ source: app.name, message: "Missing Seerr URL or API key" });
      continue;
    }
    try {
      const response = await axios.get(`${url}/api/v1/issue`, {
        timeout: 15000,
        headers: { "X-Api-Key": apiKey },
        params: { take: 100, skip: 0, filter: "all", sort: "added" },
      });
      const rows = Array.isArray(response.data?.results)
        ? response.data.results
        : Array.isArray(response.data)
          ? response.data
          : [];
      const normalized = await mapPool(rows, 4, async (issue) => {
        const media = issue.media || {};
        const mediaType = media.mediaType || issue.mediaType || "";
        const tmdbId = media.tmdbId || issue.tmdbId;
        const details = await fetchMediaDetails(app, mediaType, tmdbId);
        return normalizeIssue(app, issue, details);
      });
      issues.push(...normalized);
    } catch (error) {
      const message = error.response?.data?.message || error.message || "Issue list failed";
      console.log(`[REQUESTS] ${app.name} issue list failed:`, error.response?.status || error.message);
      errors.push({ source: app.name, message });
    }
  }

  issues.sort((first, second) => new Date(second.createdAt || 0) - new Date(first.createdAt || 0));
  return { issues, errors, syncedAt: new Date().toISOString() };
}

async function runSeerrIssueAction({ issueId, sourceId, action, comment }) {
  const apps = await connectedSeerrApps();
  const app = getApp(apps, sourceId);
  if (!app) {
    throw Object.assign(new Error("Seerr source not found"), { statusCode: 404 });
  }

  const url = cleanUrl(app.values?.url);
  const headers = { "X-Api-Key": app.values?.secret };
  const id = encodeURIComponent(issueId);

  if (action === "comment") {
    if (!String(comment || "").trim()) {
      throw Object.assign(new Error("Comment is required"), { statusCode: 400 });
    }
    await axios.post(`${url}/api/v1/issue/${id}/comment`, { message: comment }, { timeout: 10000, headers });
    return { ok: true, action };
  }

  if (action === "resolve") {
    await axios.post(`${url}/api/v1/issue/${id}/resolved`, {}, { timeout: 10000, headers });
    return { ok: true, action };
  }

  if (action === "reopen") {
    await axios.post(`${url}/api/v1/issue/${id}/open`, {}, { timeout: 10000, headers });
    return { ok: true, action };
  }

  if (action === "delete") {
    await axios.delete(`${url}/api/v1/issue/${id}`, { timeout: 10000, headers });
    return { ok: true, action };
  }

  throw Object.assign(new Error("Unsupported issue action"), { statusCode: 400 });
}

module.exports = {
  fetchSeerrIssues,
  runSeerrIssueAction,
};
