const { parentPort } = require("worker_threads");
const { axios } = require("../classes/axios");
const { getIntegrations, getIntegrationData, saveIntegrationData } = require("../classes/integration-store");
const WebhookManager = require("../classes/webhook-manager");

function cleanUrl(url = "") {
  return String(url).trim().replace(/\/+$/, "");
}

function normalizeName(value = "") {
  return String(value).toLowerCase().replace(/[^a-z0-9]/g, "");
}

function formatBytes(bytes = 0) {
  const value = Number(bytes || 0);
  if (!value) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  const index = Math.min(Math.floor(Math.log(value) / Math.log(1024)), units.length - 1);
  return `${(value / 1024 ** index).toFixed(index === 0 ? 0 : 1)} ${units[index]}`;
}

function formatSpeed(bytes = 0) {
  return `${formatBytes(bytes)}/s`;
}

function sourceFromCategory(category = "") {
  const normalized = normalizeName(category);
  if (normalized.includes("sonarr") || normalized.includes("tv")) return "Sonarr";
  if (normalized.includes("radarr") || normalized.includes("movie")) return "Radarr";
  if (normalized.includes("lidarr") || normalized.includes("music")) return "Lidarr";
  return "Other";
}

function addDays(date, days) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

async function fetchMediaDetails(app, item) {
  const service = String(app.name || "").toLowerCase();
  const baseUrl = cleanUrl(app.values?.url);
  const apiKey = app.values?.secret;

  if (!baseUrl || !apiKey) {
    return null;
  }

  let apiPath = null;
  if (service === "radarr" && (item.movieId || item.movie?.id)) {
    apiPath = `/api/v3/movie/${item.movieId || item.movie.id}`;
  } else if (service === "sonarr" && (item.seriesId || item.series?.id)) {
    apiPath = `/api/v3/series/${item.seriesId || item.series.id}`;
  } else if (service === "lidarr" && (item.artistId || item.artist?.id)) {
    apiPath = `/api/v1/artist/${item.artistId || item.artist.id}`;
  }

  if (!apiPath) {
    return null;
  }

  try {
    const response = await axios.get(`${baseUrl}${apiPath}`, {
      timeout: 15000,
      headers: { "X-Api-Key": apiKey },
    });
    return response.data;
  } catch (error) {
    console.log(`[IntegrationSync] Unable to fetch media details from ${app.name}: ${error.message}`);
    return null;
  }
}

async function normalizeRelease(app, item) {
  const isMovie = Boolean(item.movie || item.movieId || item.tmdbId);
  const baseMedia = item.movie || item.series || item.artist || item;
  const mediaDetails = Array.isArray(baseMedia?.images) && baseMedia.images.length ? null : await fetchMediaDetails(app, item);
  const media = mediaDetails || baseMedia;
  const title = media?.title || item.artist?.artistName || item.title || "Untitled release";
  const episode = item.episodeNumber || item.absoluteEpisodeNumber;
  const season = item.seasonNumber;
  const episodeTitle = !isMovie && season && episode ? item.title || item.episode?.title || "" : "";
  const imageSource = Array.isArray(media?.images) ? media.images : [];
  const posterImage = imageSource.find((image) => image.coverType === "poster") || imageSource[0];
  const backdropImage = imageSource.find((image) => image.coverType === "fanart" || image.coverType === "banner") || posterImage;
  const baseUrl = cleanUrl(app.values?.url);
  const apiKey = app.values?.secret;
  const toImageUrl = (image) => {
    const imageUrl = image?.url || image?.remoteUrl;
    if (!imageUrl) return null;
    if (imageUrl.startsWith("http") && !imageUrl.startsWith(baseUrl)) {
      return imageUrl;
    }
    const path = imageUrl.startsWith("http") ? imageUrl : `${baseUrl}${imageUrl.startsWith("/") ? "" : "/"}${imageUrl}`;
    return `${path}${path.includes("?") ? "&" : "?"}apikey=${encodeURIComponent(apiKey)}`;
  };
  const subtitle =
    season && episode
      ? `S${String(season).padStart(2, "0")}E${String(episode).padStart(2, "0")}${episodeTitle ? ` - ${episodeTitle}` : ""}`
      : isMovie
        ? "Movie release"
        : item.album?.title || item.overview || "Upcoming release";
  const overview = !isMovie && item.overview ? item.overview : media?.overview || item.overview || "";

  return {
    id: `${app.instanceId || app.name}-${item.id || item.episodeId || item.movieId || item.airDateUtc || item.releaseDate}`,
    type: isMovie ? "movie" : "tv",
    title,
    episodeTitle,
    subtitle,
    date: item.airDateUtc || item.releaseDate || item.inCinemas || item.digitalRelease || new Date().toISOString(),
    service: app.name,
    monitored: item.monitored !== false,
    hasFile: Boolean(item.hasFile || item.episodeFileId || item.movieFile),
    posterUrl: toImageUrl(posterImage),
    backdropUrl: toImageUrl(backdropImage),
    overview,
  };
}

async function fetchArrCalendar(app) {
  const url = cleanUrl(app.values?.url);
  const apiKey = app.values?.secret;

  if (!url || !apiKey) {
    return [];
  }

  const isLidarr = String(app.name).toLowerCase() === "lidarr";
  const apiPath = isLidarr ? "/api/v1/calendar" : "/api/v3/calendar";
  const start = new Date();
  const end = addDays(start, 90);
  const response = await axios.get(`${url}${apiPath}`, {
    timeout: 15000,
    headers: { "X-Api-Key": apiKey },
    params: {
      start: start.toISOString(),
      end: end.toISOString(),
      includeSeries: true,
      includeEpisode: true,
      includeMovie: true,
    },
  });

  return Array.isArray(response.data) ? await Promise.all(response.data.map((item) => normalizeRelease(app, item))) : [];
}

function normalizeQbittorrentTorrent(client, torrent) {
  const downloaded = Number(torrent.downloaded || torrent.completed || 0);
  const size = Number(torrent.size || torrent.total_size || 0);
  const progress = Math.round(Number(torrent.progress || 0) * 100);

  return {
    id: `${client.instanceId || client.name}-${torrent.hash || torrent.name}`,
    name: torrent.name || "qBittorrent download",
    client: client.name,
    source: sourceFromCategory(torrent.category),
    state: torrent.state || "unknown",
    progress: Number.isFinite(progress) ? Math.min(Math.max(progress, 0), 100) : 0,
    size: `${formatBytes(downloaded)} / ${formatBytes(size)}`,
    down: formatSpeed(torrent.dlspeed),
    up: formatSpeed(torrent.upspeed),
    addedAt: torrent.added_on ? new Date(Number(torrent.added_on) * 1000).toISOString() : new Date().toISOString(),
  };
}

async function fetchQbittorrentQueue(client) {
  const url = cleanUrl(client.values?.url);
  const username = client.values?.username;
  const password = client.values?.secret;

  if (!url || !username || !password) {
    return { items: [], error: "Missing qBittorrent URL, username, or password" };
  }

  const login = await axios.post(`${url}/api/v2/auth/login`, new URLSearchParams({ username, password }), {
    timeout: 15000,
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    validateStatus: () => true,
  });

  if (login.status >= 400 || String(login.data).toLowerCase().includes("fails")) {
    return { items: [], error: "qBittorrent login failed" };
  }

  const response = await axios.get(`${url}/api/v2/torrents/info`, {
    timeout: 15000,
    headers: { Cookie: login.headers["set-cookie"]?.join("; ") || "" },
    params: { filter: "all" },
  });

  const torrents = Array.isArray(response.data) ? response.data : [];
  return { items: torrents.map((torrent) => normalizeQbittorrentTorrent(client, torrent)) };
}

async function fetchClientQueue(client) {
  const name = normalizeName(client.name);
  if (name.includes("qbittorrent") || name === "bittorrent") {
    return fetchQbittorrentQueue(client);
  }

  return { items: [], error: client.connected ? "Queue polling not implemented for this client yet" : "Needs setup" };
}

async function runIntegrationSyncTask() {
  try {
    const integrations = await getIntegrations();
    const integrationData = await getIntegrationData();
    const sources = (integrations.arrApps || []).filter((app) => app.connected);
    const connectedClients = (integrations.clients || []).filter((client) => client.connected);
    const calendarResults = await Promise.allSettled(sources.map((app) => fetchArrCalendar(app)));
    const queueResults = await Promise.allSettled(connectedClients.map((client) => fetchClientQueue(client)));
    const releases = calendarResults
      .flatMap((result) => (result.status === "fulfilled" ? result.value : []))
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    const syncedDownloadItems = queueResults.flatMap((result) => (result.status === "fulfilled" ? result.value.items || [] : []));
    const failedSources = calendarResults
      .map((result, index) => (result.status === "rejected" ? sources[index]?.name : null))
      .filter(Boolean);
    const clients = (integrations.clients || []).map((client) => {
      const resultIndex = connectedClients.findIndex((item) => item.instanceId === client.instanceId);
      const result = resultIndex >= 0 ? queueResults[resultIndex] : null;
      const queueData = result?.status === "fulfilled" ? result.value : null;
      const itemCount = syncedDownloadItems.filter((item) => item.client === client.name).length;
      return {
        name: client.name,
        slug: client.slug,
        protocol: client.protocol,
        instanceId: client.instanceId,
        connected: Boolean(client.connected && result?.status !== "rejected" && !queueData?.error),
        itemCount,
        message: queueData?.error || (client.connected ? "Online" : "Needs setup"),
      };
    });

    await saveIntegrationData({
      calendar: {
        releases,
        sources: sources.map((source) => ({
          name: source.name,
          slug: source.slug,
          instanceId: source.instanceId,
          connected: !failedSources.includes(source.name),
        })),
        syncedAt: new Date().toISOString(),
        errors: failedSources,
      },
      downloads: {
        ...integrationData.downloads,
        items: syncedDownloadItems,
        clients,
        syncedAt: new Date().toISOString(),
      },
    });

    const webhookManager = new WebhookManager();
    await webhookManager.triggerEventWebhooks("calendar_refreshed", {
      integrationEvent: "calendar refreshed",
      releaseCount: releases.length,
      sourceCount: sources.length,
      failedSources,
      message: `Integration sync refreshed ${releases.length} calendar releases.`,
    });
    await webhookManager.triggerEventWebhooks("download_queue_refreshed", {
      integrationEvent: "download queue refreshed",
      clientCount: clients.length,
      activeCount: syncedDownloadItems.filter((item) => Number(item.progress || 0) < 100).length,
      message: "Integration sync refreshed download queues.",
    });

    parentPort.postMessage({ status: "complete" });
  } catch (error) {
    parentPort.postMessage({ status: "error", message: error.message });
  }
}

parentPort.on("message", async (message) => {
  if (message.command === "start") {
    await runIntegrationSyncTask(message.triggertype);
    process.exit(0);
  }
});
