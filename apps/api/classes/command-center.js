const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const db = require("../db");
const { axios } = require("./axios");
const { getIntegrations, getIntegrationData } = require("./integration-store");
const configClass = require("./config");
const JellyfinAPI = require("./jellyfin-api");
const WebhookManager = require("./webhook-manager");
const { getAuditLog, getWebhookDeliveryHistory, mergeSettings, getSettings } = require("./admin-history");

const jellyfinApi = new JellyfinAPI();
let lastJellyfinSeenWrite = 0;

function cleanUrl(url = "") {
  return String(url).trim().replace(/\/+$/, "");
}

function tokens(value = "") {
  return String(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .split(" ")
    .filter((part) => part.length > 2);
}

function scoreOverlap(left, right) {
  const a = new Set(tokens(left));
  const b = new Set(tokens(right));
  if (!a.size || !b.size) return 0;
  let hits = 0;
  for (const token of a) if (b.has(token)) hits += 1;
  return hits / Math.max(a.size, b.size);
}

function bestMatch(name, items, getName) {
  let winner = null;
  let best = 0.42;
  for (const item of items) {
    const score = scoreOverlap(name, getName(item));
    if (score > best) {
      best = score;
      winner = item;
    }
  }
  return winner;
}

function formatBytes(bytes = 0) {
  const value = Number(bytes || 0);
  if (!value) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  const index = Math.min(Math.floor(Math.log(value) / Math.log(1024)), units.length - 1);
  return `${(value / 1024 ** index).toFixed(index === 0 ? 0 : 1)} ${units[index]}`;
}

async function loadItem(id) {
  const result = await db
    .query(
      `SELECT i.*, l."Name" AS "LibraryName"
       FROM jf_library_items i
       LEFT JOIN jf_libraries l ON l."Id" = i."ParentId"
       WHERE i."Id" = $1
       LIMIT 1`,
      [id]
    )
    .then((res) => res.rows[0]);
  if (result) return result;
  const episode = await db
    .query(
      `SELECT e.*, i."Name" AS "SeriesName", i."ParentId"
       FROM jf_library_episodes e
       LEFT JOIN jf_library_items i ON i."Id" = e."SeriesId"
       WHERE e."EpisodeId" = $1 OR e."Id" = $1
       LIMIT 1`,
      [id]
    )
    .then((res) => res.rows[0]);
  return episode || null;
}

async function fetchSeerrSnapshot() {
  const integrations = await getIntegrations();
  const seerrApps = (integrations.arrApps || []).filter((app) => {
    const name = String(app.name || app.slug || "").toLowerCase();
    return app.connected && (name.includes("jellyseerr") || name.includes("overseerr") || name === "seerr");
  });
  const requests = [];
  for (const app of seerrApps) {
    try {
      const response = await axios.get(`${cleanUrl(app.values.url)}/api/v1/request`, {
        timeout: 12000,
        headers: { "X-Api-Key": app.values.secret },
        params: { take: 100, skip: 0, sort: "added", skipCount: "false" },
      });
      const rows = response.data?.results || response.data || [];
      for (const row of Array.isArray(rows) ? rows : []) {
        const media = row.media || {};
        requests.push({
          id: row.id,
          title: media.title || media.name || row.title || "Request",
          status: row.status,
          mediaType: media.mediaType || row.type,
          tmdb: media.tmdbId,
          tvdb: media.tvdbId,
          requestedBy: row.requestedBy?.displayName || row.requestedBy?.jellyfinUsername || row.user?.jellyfinUsername || "",
          jellyfinItemId: media.jellyfinItemId || media.jellyfinMediaId,
          openUrl: `${cleanUrl(app.values.url)}/${media.mediaType === "tv" ? "tv" : "movie"}/${media.tmdbId || media.tvdbId || ""}`,
          source: app.name,
        });
      }
    } catch (error) {
      console.warn("[command-center] Seerr snapshot failed:", error.message);
    }
  }
  return requests;
}

function stitchName(item) {
  return item.Name || item.SeriesName || item.title || item.name || "";
}

async function buildItemGlance(itemId) {
  const item = await loadItem(itemId);
  if (!item) return null;
  const name = stitchName(item);
  const [requests, integrationData, integrations] = await Promise.all([
    fetchSeerrSnapshot(),
    getIntegrationData(),
    getIntegrations(),
  ]);
  const downloads = integrationData.downloads?.items || [];
  const request = requests.find((row) => String(row.jellyfinItemId || "") === String(itemId)) || bestMatch(name, requests, (row) => row.title);
  const download = bestMatch(name, downloads, (row) => row.name);
  const calendarHit = bestMatch(name, integrationData.calendar?.releases || [], (row) => row.title);
  const thirdParty = integrations.thirdParty || [];
  const tdarr = thirdParty.find((app) => String(app.name || "").toLowerCase().includes("tdarr"));
  const maintainerr = thirdParty.find((app) => String(app.name || "").toLowerCase().includes("maintainerr"));
  const kometa = thirdParty.find((app) => String(app.name || "").toLowerCase().includes("kometa"));
  const unpackerr = thirdParty.find((app) => String(app.name || "").toLowerCase().includes("unpackerr"));

  return {
    item: {
      id: item.Id || item.EpisodeId || itemId,
      name,
      type: item.Type,
      year: item.ProductionYear,
      library: item.LibraryName,
    },
    jellyfin: { available: true, id: item.Id || item.EpisodeId || itemId },
    request: request
      ? {
          id: request.id,
          title: request.title,
          status: request.status,
          source: request.source,
          openUrl: request.openUrl,
          mediaType: request.mediaType,
          tmdb: request.tmdb,
          tvdb: request.tvdb,
        }
      : null,
    download: download
      ? { id: download.id, name: download.name, client: download.client, state: download.state, progress: download.progress }
      : null,
    arr: calendarHit
      ? {
          title: calendarHit.title,
          service: calendarHit.service,
          date: calendarHit.date,
          hasFile: calendarHit.hasFile,
          tmdb: calendarHit.tmdbId || calendarHit.tmdb,
          tvdb: calendarHit.tvdbId || calendarHit.tvdb,
        }
      : null,
    tdarr: tdarr ? { connected: Boolean(tdarr.connected), name: tdarr.name } : null,
    maintainerr: maintainerr ? { connected: Boolean(maintainerr.connected), name: maintainerr.name } : null,
    kometa: kometa ? { connected: Boolean(kometa.connected), name: kometa.name } : null,
    unpackerr: unpackerr ? { connected: Boolean(unpackerr.connected), name: unpackerr.name } : null,
  };
}

async function stitchDownloads() {
  const [requests, integrationData] = await Promise.all([fetchSeerrSnapshot(), getIntegrationData()]);
  const downloads = integrationData.downloads?.items || [];
  return downloads.map((item) => {
    const request = bestMatch(item.name, requests, (row) => row.title);
    return {
      ...item,
      request: request
        ? {
            id: request.id,
            title: request.title,
            status: request.status,
            source: request.source,
            requestedBy: request.requestedBy,
            jellyfinItemId: request.jellyfinItemId,
          }
        : null,
    };
  });
}

async function buildLibraryStorage() {
  const libraries = await db
    .query(
      `SELECT l."Id", l."Name",
              COALESCE(SUM(info."Size"), 0)::bigint AS "Size",
              COUNT(i."Id")::int AS "Items"
       FROM jf_libraries l
       LEFT JOIN jf_library_items i ON i."ParentId" = l."Id" AND i.archived = false
       LEFT JOIN jf_item_info info ON info."Id" = i."Id"
       GROUP BY l."Id", l."Name"
       ORDER BY COALESCE(SUM(info."Size"), 0) DESC`
    )
    .then((res) => res.rows);
  const calendar = (await getIntegrationData()).calendar?.releases || [];
  const upcomingBytes = calendar.filter((row) => !row.hasFile).length * 1.4 * 1024 * 1024 * 1024;
  return {
    libraries: libraries.map((row) => ({
      id: row.Id,
      name: row.Name,
      bytes: Number(row.Size || 0),
      size: formatBytes(row.Size),
      items: row.Items,
    })),
    totalBytes: libraries.reduce((sum, row) => sum + Number(row.Size || 0), 0),
    totalLabel: formatBytes(libraries.reduce((sum, row) => sum + Number(row.Size || 0), 0)),
    upcomingEstimate: formatBytes(upcomingBytes),
    upcomingCount: calendar.filter((row) => !row.hasFile).length,
  };
}

async function buildOpsDigest() {
  const [healthRow, integrationData, deliveries, audit] = await Promise.all([
    db.query('SELECT settings FROM app_config WHERE "ID"=1').then((res) => res.rows[0]?.settings || {}),
    getIntegrationData(),
    getWebhookDeliveryHistory(),
    getAuditLog(),
  ]);
  const downloads = integrationData.downloads?.items || [];
  const stuck = downloads.filter((item) => {
    const state = String(item.state || "").toLowerCase();
    return item.stalled || state.includes("fail") || state.includes("error") || state.includes("stall") || (Number(item.progress) > 0 && Number(item.progress) < 100 && state.includes("paus"));
  });
  const webhookFails = (deliveries || []).filter((row) => !row.ok).slice(0, 8);
  const recentFails = (audit || []).filter((row) => String(row.action || "").includes("fail")).slice(0, 6);
  const items = [
    ...stuck.map((item) => ({ type: "download", label: item.stalledReason ? `${item.name}: ${item.stalledReason}` : `${item.name} is ${item.state}`, to: "/downloads" })),
    ...webhookFails.map((row) => ({ type: "webhook", label: `${row.name || "Webhook"} delivery failed`, to: "/settings/webhooks" })),
    ...recentFails.map((row) => ({ type: "audit", label: row.action, to: "/settings/health" })),
  ];
  return {
    ok: items.length === 0,
    count: items.length,
    items: items.slice(0, 12),
    generatedAt: new Date().toISOString(),
    backupAgeHint: healthRow?.lastBackup || null,
  };
}

async function buildHomepageWidgets() {
  const [sessionsResult, digest, storage, integrationData] = await Promise.all([
    db.query(`SELECT count(*)::int AS count FROM jf_playback_activity WHERE "ActivityDateInserted" > NOW() - INTERVAL '15 minutes'`).catch(() => ({ rows: [{ count: 0 }] })),
    buildOpsDigest(),
    buildLibraryStorage(),
    getIntegrationData(),
  ]);
  return {
    jellyglance: true,
    sessionsRecent: sessionsResult.rows[0]?.count || 0,
    downloads: (integrationData.downloads?.items || []).filter((item) => Number(item.progress || 0) < 100).length,
    digest: digest.count,
    storage: storage.totalLabel,
    updatedAt: new Date().toISOString(),
  };
}

async function rememberDevices(devices = []) {
  const config = await new configClass().getConfig();
  const known = Array.isArray(config.settings?.KnownJellyfinDevices) ? config.settings.KnownJellyfinDevices : [];
  const knownSet = new Set(known);
  const fresh = devices.filter((device) => device.id && !knownSet.has(device.id));
  if (!fresh.length) return { fresh: [], known: known.length };
  const next = [...known, ...fresh.map((device) => device.id)].slice(-400);
  await mergeSettings({ KnownJellyfinDevices: next });
  const webhookManager = new WebhookManager();
  for (const device of fresh.slice(0, 8)) {
    await webhookManager.triggerEventWebhooks("device_authorized", {
      integrationEvent: "New Jellyfin client",
      deviceName: device.name,
      appName: device.appName,
      lastUserName: device.lastUserName,
      message: `${device.name || device.appName || "New device"} appeared on Jellyfin`,
    });
  }
  return { fresh, known: next.length };
}

async function getJellyfinStatus() {
  const lastSeen = (await getSettings().catch(() => ({}))).JellyfinLastSeen || {};
  const checkedAt = new Date().toISOString();
  try {
    const info = await jellyfinApi.systemInfo();
    const ok = Boolean(info && (info.Id || info.Version));
    if (!ok) {
      return { ok: false, error: "Jellyfin did not return system info", lastSeen, checkedAt };
    }
    const seen = {
      name: info.ServerName || "Jellyfin",
      version: info.Version || "",
      at: checkedAt,
    };
    if (seen.version !== lastSeen.version || Date.now() - lastJellyfinSeenWrite > 60 * 60 * 1000) {
      await mergeSettings({ JellyfinLastSeen: seen });
      lastJellyfinSeenWrite = Date.now();
    }
    return { ok: true, name: seen.name, version: seen.version, lastSeen: seen, checkedAt };
  } catch (error) {
    return { ok: false, error: error.message || "Jellyfin unreachable", lastSeen, checkedAt };
  }
}

function hmacSha256(key, data) {
  return crypto.createHmac("sha256", key).update(data, "utf8").digest();
}

function sha256Hex(data) {
  return crypto.createHash("sha256").update(data).digest("hex");
}

async function putS3CompatibleObject(dest, filename, body) {
  const endpoint = cleanUrl(dest.url || dest.endpoint || "");
  const bucket = String(dest.bucket || "").trim();
  const region = String(dest.region || "us-east-1").trim() || "us-east-1";
  const accessKey = String(dest.username || dest.accessKey || "").trim();
  const secretKey = String(dest.secret || dest.secretKey || "").trim();
  const prefix = String(dest.prefix || "").replace(/^\/+|\/+$/g, "");
  const objectKey = [prefix, filename].filter(Boolean).join("/");
  if (!endpoint || !bucket || !accessKey || !secretKey) {
    throw new Error("S3 destination needs endpoint, bucket, access key, and secret");
  }

  const parsed = new URL(/^[a-z]+:\/\//i.test(endpoint) ? endpoint : `https://${endpoint}`);
  const now = new Date();
  const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, "");
  const dateStamp = amzDate.slice(0, 8);
  const payloadHash = sha256Hex(body);
  const hostIsAws = /\.amazonaws\.com$/i.test(parsed.host);
  const usePathStyle = dest.pathStyle === true || dest.pathStyle === "true" || !hostIsAws;
  const host = usePathStyle ? parsed.host : `${bucket}.${parsed.host}`;
  const encodedKey = objectKey
    .split("/")
    .map((part) => encodeURIComponent(part))
    .join("/");
  const basePath = parsed.pathname.replace(/\/+$/, "") || "";
  const canonicalUri = usePathStyle ? `${basePath}/${encodeURIComponent(bucket)}/${encodedKey}` : `${basePath}/${encodedKey}`;
  const canonicalHeaders = `host:${host}\nx-amz-content-sha256:${payloadHash}\nx-amz-date:${amzDate}\n`;
  const signedHeaders = "host;x-amz-content-sha256;x-amz-date";
  const canonicalRequest = ["PUT", canonicalUri || "/", "", canonicalHeaders, signedHeaders, payloadHash].join("\n");
  const credentialScope = `${dateStamp}/${region}/s3/aws4_request`;
  const stringToSign = ["AWS4-HMAC-SHA256", amzDate, credentialScope, sha256Hex(canonicalRequest)].join("\n");
  const kDate = hmacSha256(`AWS4${secretKey}`, dateStamp);
  const kRegion = hmacSha256(kDate, region);
  const kService = hmacSha256(kRegion, "s3");
  const kSigning = hmacSha256(kService, "aws4_request");
  const signature = crypto.createHmac("sha256", kSigning).update(stringToSign, "utf8").digest("hex");
  const target = `${parsed.protocol}//${host}${canonicalUri}`;
  await axios.put(target, body, {
    timeout: 120000,
    headers: {
      "Content-Type": "application/octet-stream",
      "x-amz-content-sha256": payloadHash,
      "x-amz-date": amzDate,
      Authorization: `AWS4-HMAC-SHA256 Credential=${accessKey}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`,
    },
    maxBodyLength: Infinity,
    maxContentLength: Infinity,
  });
}

async function uploadBackupRemote(filePath, refLog) {
  const config = await new configClass().getConfig();
  const dest = config.settings?.BackupDestination || {};
  const kind = String(dest.kind || "local").toLowerCase();
  if (kind === "local" || !dest.url) return;
  const body = fs.readFileSync(filePath);
  const filename = path.basename(filePath);
  try {
    if (kind === "webdav" || kind === "http") {
      const target = `${cleanUrl(dest.url)}/${encodeURIComponent(filename)}`;
      await axios.put(target, body, {
        timeout: 120000,
        auth: dest.username ? { username: dest.username, password: dest.secret || "" } : undefined,
        headers: {
          "Content-Type": "application/json",
          ...(dest.secret && !dest.username ? { Authorization: dest.secret } : {}),
        },
        maxBodyLength: Infinity,
        maxContentLength: Infinity,
      });
    } else if (kind === "s3") {
      await putS3CompatibleObject(dest, filename, body);
    }
    refLog?.logData?.push({ color: "lawngreen", Message: `Copied backup to ${kind}` });
  } catch (error) {
    refLog?.logData?.push({ color: "orange", Message: `Remote backup copy failed: ${error.message}` });
  }
}

function integrationSlug(integration) {
  return String(integration?.name || integration?.slug || "").toLowerCase();
}

async function pingNotifiarr(integration) {
  const url = cleanUrl(integration.values?.url) || "https://notifiarr.com";
  const secret = integration.values?.secret;
  if (!secret) return { ok: false, error: "API key required" };
  const paths = ["/api/v1/user/me", "/api/v1/user", "/api"];
  let lastError = "Unable to reach Notifiarr";
  for (const apiPath of paths) {
    try {
      const response = await axios.get(`${url}${apiPath}`, {
        timeout: 10000,
        headers: { "X-API-Key": secret, "X-Api-Key": secret },
        validateStatus: () => true,
      });
      if (response.status < 500) {
        const details = response.data?.details || response.data || {};
        return {
          ok: response.status < 400,
          version: details.username || details.user || "Notifiarr",
          message: response.status < 400 ? "Notifiarr API reachable" : `HTTP ${response.status}`,
        };
      }
      lastError = `HTTP ${response.status}`;
    } catch (error) {
      lastError = error.message;
    }
  }
  return { ok: false, error: lastError };
}

async function pingRecyclarr(integration) {
  const url = cleanUrl(integration.values?.url);
  if (!url) return { ok: false, error: "URL required" };
  try {
    const response = await axios.get(url, {
      timeout: 10000,
      headers: integration.values?.secret
        ? { Authorization: `Bearer ${integration.values.secret}`, "X-Api-Key": integration.values.secret }
        : {},
      validateStatus: () => true,
    });
    return {
      ok: response.status < 500,
      version: "Recyclarr",
      message: response.status < 400 ? "Health ping succeeded" : `HTTP ${response.status}`,
    };
  } catch (error) {
    return { ok: false, error: error.message };
  }
}

async function pingAutobrr(integration) {
  const url = cleanUrl(integration.values?.url);
  const secret = integration.values?.secret;
  if (!url || !secret) return { ok: false, error: "URL and API token required" };
  try {
    const response = await axios.get(`${url}/api/healthz/liveness`, {
      timeout: 10000,
      headers: { "X-API-Token": secret },
      validateStatus: () => true,
    });
    if (response.status < 400) {
      return { ok: true, version: "autobrr", message: "autobrr is live" };
    }
    const fallback = await axios.get(`${url}/api/config`, {
      timeout: 10000,
      headers: { "X-API-Token": secret },
      validateStatus: () => true,
    });
    return {
      ok: fallback.status < 400,
      version: "autobrr",
      message: fallback.status < 400 ? "autobrr API reachable" : `HTTP ${fallback.status}`,
    };
  } catch (error) {
    return { ok: false, error: error.message };
  }
}

async function fetchAutobrrHits() {
  const integrations = await getIntegrations();
  const apps = (integrations.thirdParty || []).filter((item) => item.connected && integrationSlug(item).includes("autobrr"));
  const hits = [];
  for (const app of apps) {
    const url = cleanUrl(app.values?.url);
    const secret = app.values?.secret;
    if (!url || !secret) continue;
    try {
      const response = await axios.get(`${url}/api/release`, {
        timeout: 12000,
        headers: { "X-API-Token": secret },
        params: { limit: 25, offset: 0 },
      });
      const rows = response.data?.data || response.data || [];
      for (const row of Array.isArray(rows) ? rows : []) {
        hits.push({
          id: `${app.instanceId}-${row.ID || row.id || row.Name}`,
          name: row.Name || row.name || row.TorrentName || "Release",
          filter: row.FilterName || row.filter || row.Filter || "",
          indexer: row.Indexer || row.indexer || "",
          action: row.ActionStatus || row.action || row.Status || "",
          size: row.Size || row.size || "",
          timestamp: row.Timestamp || row.timestamp || row.CreatedAt || null,
          source: app.name,
        });
      }
    } catch (error) {
      console.warn("[command-center] autobrr hits failed:", error.message);
    }
  }
  hits.sort((left, right) => new Date(right.timestamp || 0) - new Date(left.timestamp || 0));
  return hits.slice(0, 40);
}

async function pingThirdParty(integration) {
  const slug = integrationSlug(integration);
  if (slug.includes("notifiarr")) return pingNotifiarr(integration);
  if (slug.includes("recyclarr")) return pingRecyclarr(integration);
  if (slug.includes("autobrr")) return pingAutobrr(integration);
  const url = cleanUrl(integration.values?.url);
  if (!url) return { ok: false, error: "URL required" };
  try {
    const response = await axios.get(url, {
      timeout: 10000,
      headers: integration.values?.secret ? { "X-Api-Key": integration.values.secret, Authorization: `Bearer ${integration.values.secret}` } : {},
      validateStatus: () => true,
    });
    return { ok: response.status < 500, version: String(response.status), message: `HTTP ${response.status}` };
  } catch (error) {
    return { ok: false, error: error.message };
  }
}

function arrHeaders(app) {
  return { "X-Api-Key": app.values?.secret };
}

async function findArrMovie(app, { title, tmdb }) {
  const url = cleanUrl(app.values?.url);
  if (!url) return null;
  try {
    if (tmdb) {
      const response = await axios.get(`${url}/api/v3/movie`, { timeout: 12000, headers: arrHeaders(app), params: { tmdbId: tmdb } });
      const rows = Array.isArray(response.data) ? response.data : [];
      if (rows[0]) return rows[0];
    }
    const response = await axios.get(`${url}/api/v3/movie`, { timeout: 15000, headers: arrHeaders(app) });
    const rows = Array.isArray(response.data) ? response.data : [];
    return bestMatch(title, rows, (row) => row.title);
  } catch (error) {
    console.warn("[command-center] Radarr lookup failed:", error.message);
    return null;
  }
}

async function findArrSeries(app, { title, tvdb }) {
  const url = cleanUrl(app.values?.url);
  if (!url) return null;
  try {
    if (tvdb) {
      const response = await axios.get(`${url}/api/v3/series`, { timeout: 12000, headers: arrHeaders(app), params: { tvdbId: tvdb } });
      const rows = Array.isArray(response.data) ? response.data : [];
      if (rows[0]) return rows[0];
    }
    const response = await axios.get(`${url}/api/v3/series`, { timeout: 15000, headers: arrHeaders(app) });
    const rows = Array.isArray(response.data) ? response.data : [];
    return bestMatch(title, rows, (row) => row.title);
  } catch (error) {
    console.warn("[command-center] Sonarr lookup failed:", error.message);
    return null;
  }
}

async function retryFailedGrab(payload = {}) {
  const title = payload.title || payload.name || "";
  const mediaType = String(payload.mediaType || payload.type || "").toLowerCase();
  const tmdb = payload.tmdb || payload.tmdbId;
  const tvdb = payload.tvdb || payload.tvdbId;
  const requestId = payload.requestId || payload.request?.id;
  const sourceId = payload.sourceId || payload.request?.sourceId;
  const steps = [];
  const integrations = await getIntegrations();
  const arrApps = (integrations.arrApps || []).filter((app) => app.connected);

  if (requestId) {
    const seerrApps = arrApps.filter((app) => {
      const name = integrationSlug(app);
      return name.includes("jellyseerr") || name.includes("overseerr") || name === "seerr";
    });
    const seerr = sourceId ? seerrApps.find((app) => app.instanceId === sourceId) : seerrApps[0];
    if (seerr) {
      try {
        await axios.post(
          `${cleanUrl(seerr.values.url)}/api/v1/request/${encodeURIComponent(requestId)}/retry`,
          {},
          { timeout: 15000, headers: { "X-Api-Key": seerr.values.secret } }
        );
        steps.push({ ok: true, service: seerr.name, action: "seerr-retry" });
      } catch (error) {
        steps.push({ ok: false, service: seerr.name, action: "seerr-retry", error: error.message });
      }
    }
  }

  const wantMovie = mediaType.includes("movie") || Boolean(tmdb) || (!tvdb && !mediaType.includes("tv"));
  const wantSeries = mediaType.includes("tv") || mediaType.includes("series") || mediaType.includes("show") || Boolean(tvdb) || !wantMovie;

  for (const app of arrApps) {
    const slug = integrationSlug(app);
    if (wantMovie && slug.includes("radarr")) {
      const movie = await findArrMovie(app, { title, tmdb });
      if (movie?.id) {
        try {
          await axios.post(
            `${cleanUrl(app.values.url)}/api/v3/command`,
            { name: "MoviesSearch", movieIds: [movie.id] },
            { timeout: 15000, headers: arrHeaders(app) }
          );
          steps.push({ ok: true, service: app.name, action: "MoviesSearch", id: movie.id, title: movie.title });
        } catch (error) {
          steps.push({ ok: false, service: app.name, action: "MoviesSearch", error: error.message });
        }
      }
    }
    if (wantSeries && slug.includes("sonarr")) {
      const series = await findArrSeries(app, { title, tvdb });
      if (series?.id) {
        try {
          await axios.post(
            `${cleanUrl(app.values.url)}/api/v3/command`,
            { name: "MissingEpisodeSearch", seriesId: series.id },
            { timeout: 15000, headers: arrHeaders(app) }
          );
          steps.push({ ok: true, service: app.name, action: "MissingEpisodeSearch", id: series.id, title: series.title });
        } catch (error) {
          steps.push({ ok: false, service: app.name, action: "MissingEpisodeSearch", error: error.message });
        }
      }
    }
  }

  return { ok: steps.some((step) => step.ok), steps, title };
}

module.exports = {
  buildItemGlance,
  stitchDownloads,
  buildLibraryStorage,
  buildOpsDigest,
  buildHomepageWidgets,
  rememberDevices,
  uploadBackupRemote,
  pingThirdParty,
  fetchAutobrrHits,
  retryFailedGrab,
  getJellyfinStatus,
  formatBytes,
};
