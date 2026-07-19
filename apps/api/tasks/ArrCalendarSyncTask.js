const { parentPort } = require("worker_threads");
const { axios } = require("../classes/axios");
const { getIntegrations, saveIntegrationData } = require("../classes/integration-store");
const WebhookManager = require("../classes/webhook-manager");

function cleanUrl(url = "") {
  return String(url).trim().replace(/\/+$/, "");
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
    console.log(`[CalendarSync] Unable to fetch media details from ${app.name}: ${error.message}`);
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

async function runArrCalendarSyncTask() {
  try {
    const integrations = await getIntegrations();
    const sources = (integrations.arrApps || []).filter((app) => app.connected);
    const results = await Promise.allSettled(sources.map((app) => fetchArrCalendar(app)));
    const releases = results
      .flatMap((result) => (result.status === "fulfilled" ? result.value : []))
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    const failedSources = results
      .map((result, index) => (result.status === "rejected" ? sources[index]?.name : null))
      .filter(Boolean);

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
    });

    const webhookManager = new WebhookManager();
    await webhookManager.triggerEventWebhooks("calendar_refreshed", {
      integrationEvent: "calendar refreshed",
      source: "Arr apps",
      releaseCount: releases.length,
      sourceCount: sources.length,
      failedSources,
      message: `Arr calendar sync completed with ${releases.length} releases.`,
    });
    parentPort.postMessage({ status: "complete" });
  } catch (error) {
    parentPort.postMessage({ status: "error", message: error.message });
  }
}

parentPort.on("message", async (message) => {
  if (message.command === "start") {
    await runArrCalendarSyncTask(message.triggertype);
    process.exit(0);
  }
});
