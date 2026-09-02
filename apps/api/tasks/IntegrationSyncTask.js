const { parentPort } = require("worker_threads");
const { axios } = require("../classes/axios");
const { getIntegrations, getIntegrationData, saveIntegrationData } = require("../classes/integration-store");
const { fetchClientQueue } = require("../classes/download-client");
const { fetchAutobrrHits } = require("../classes/command-center");
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
  } else if (service === "readarr" && (item.bookId || item.book?.id)) {
    apiPath = `/api/v1/book/${item.bookId || item.book.id}`;
  } else if (service === "readarr" && (item.authorId || item.author?.id)) {
    apiPath = `/api/v1/author/${item.authorId || item.author.id}`;
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
  const baseMedia = item.movie || item.series || item.artist || item.book || item.author || item;
  const mediaDetails = Array.isArray(baseMedia?.images) && baseMedia.images.length ? null : await fetchMediaDetails(app, item);
  const media = mediaDetails || baseMedia;
  const title = media?.title || item.artist?.artistName || item.book?.title || item.author?.authorName || item.title || "Untitled release";
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

  const isV1Calendar = ["lidarr", "readarr"].includes(String(app.name).toLowerCase());
  const apiPath = isV1Calendar ? "/api/v1/calendar" : "/api/v3/calendar";
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

function isWizarrIntegration(integration) {
  const name = String(integration?.name || integration?.slug || "").toLowerCase();
  return name === "wizarr" || name.includes("wizarr");
}

function getWizarrHeaders(integration) {
  const apiKey = integration?.values?.secret;
  return {
    Accept: "application/json",
    ...(apiKey ? { "X-API-Key": apiKey } : {}),
  };
}

function normalizeInviteUrl(value, sourceUrl, code) {
  const raw = value || (code ? `/j/${encodeURIComponent(code)}` : "");
  if (!raw) return "";
  const text = String(raw).trim();
  if (/^https?:\/\//i.test(text)) return text;
  const baseUrl = cleanUrl(sourceUrl);
  if (!baseUrl) return text;

  try {
    return new URL(text.startsWith("/") ? text : `/${text}`, `${baseUrl}/`).toString();
  } catch {
    return `${baseUrl}/${text.replace(/^\/+/, "")}`;
  }
}

function normalizeInvite(integration, invitation) {
  const url = cleanUrl(integration.values?.url);
  const code = invitation.code || invitation.token || invitation.invite_code || "";
  const status = String(invitation.status || (invitation.used_at || invitation.used ? "used" : "pending")).toLowerCase();
  return {
    id: `${integration.instanceId || integration.name}-${invitation.id || code}`,
    sourceId: integration.instanceId,
    sourceName: integration.name || "Wizarr",
    code,
    url: normalizeInviteUrl(invitation.url || invitation.invite_url || invitation.link, url, code),
    status,
    created: invitation.created || invitation.created_at || null,
    expires: invitation.expires || invitation.expires_at || null,
  };
}

async function fetchInviteLinks(integration) {
  const url = cleanUrl(integration.values?.url);
  const apiKey = integration.values?.secret;
  if (!url || !apiKey || !isWizarrIntegration(integration)) {
    return { items: [], error: integration.connected ? "Invite polling not available for this integration" : "Needs setup" };
  }

  const response = await axios.get(`${url}/api/invitations`, {
    timeout: 12000,
    headers: getWizarrHeaders(integration),
  });
  const invitations = Array.isArray(response.data?.invitations) ? response.data.invitations : Array.isArray(response.data) ? response.data : [];
  return { items: invitations.map((invite) => normalizeInvite(integration, invite)) };
}

async function runIntegrationSyncTask() {
  try {
    const integrations = await getIntegrations();
    const integrationData = await getIntegrationData();
    const sources = (integrations.arrApps || []).filter((app) => {
      const name = String(app.name || app.slug || "").toLowerCase();
      return app.connected && (name.includes("sonarr") || name.includes("radarr") || name.includes("lidarr") || name.includes("readarr"));
    });
    const connectedClients = (integrations.clients || []).filter((client) => client.connected);
    const inviteIntegrations = (integrations.thirdParty || []).filter((integration) => integration.connected && isWizarrIntegration(integration));
    const calendarResults = await Promise.allSettled(sources.map((app) => fetchArrCalendar(app)));
    const queueResults = await Promise.allSettled(connectedClients.map((client) => fetchClientQueue(client)));
    const inviteResults = await Promise.allSettled(inviteIntegrations.map((integration) => fetchInviteLinks(integration)));
    const releases = calendarResults
      .flatMap((result) => (result.status === "fulfilled" ? result.value : []))
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    const syncedDownloadItems = queueResults.flatMap((result) => (result.status === "fulfilled" ? result.value.items || [] : []));
    const syncedInviteItems = inviteResults.flatMap((result) => (result.status === "fulfilled" ? result.value.items || [] : []));
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
    const inviteSources = inviteIntegrations.map((integration, index) => {
      const result = inviteResults[index];
      const inviteData = result?.status === "fulfilled" ? result.value : null;
      const sourceItems = inviteData?.items || [];
      return {
        name: integration.name || "Wizarr",
        slug: integration.slug,
        instanceId: integration.instanceId,
        connected: result?.status === "fulfilled" && !inviteData?.error,
        itemCount: sourceItems.length,
        activeCount: sourceItems.filter((invite) => invite.status !== "used" && invite.status !== "expired").length,
        message: inviteData?.error || (result?.status === "fulfilled" ? "Online" : result?.reason?.message || "Invite sync failed"),
      };
    });

    const autobrrHits = await fetchAutobrrHits().catch(() => []);

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
      invites: {
        ...integrationData.invites,
        items: syncedInviteItems,
        sources: inviteSources,
        syncedAt: new Date().toISOString(),
      },
      autobrr: {
        hits: autobrrHits,
        syncedAt: new Date().toISOString(),
      },
    });

    const webhookManager = new WebhookManager();
    await webhookManager.triggerEventWebhooks("calendar_refreshed", {
      taskKey: "IntegrationSync",
      taskName: "Integration Sync",
      integrationEvent: "Calendar synced",
      releaseCount: releases.length,
      sourceCount: sources.length,
      failedSources,
      message: `Calendar synced · ${releases.length} release${releases.length === 1 ? "" : "s"}.`,
    });
    if (connectedClients.length) {
      await webhookManager.triggerEventWebhooks("download_queue_refreshed", {
        taskKey: "IntegrationSync",
        taskName: "Integration Sync",
        integrationEvent: "Download queue synced",
        clientCount: clients.length,
        activeCount: syncedDownloadItems.filter((item) => Number(item.progress || 0) < 100).length,
        message: "Download queue synced.",
      });
    }
    if (inviteIntegrations.length) {
      await webhookManager.triggerEventWebhooks("invite_links_refreshed", {
        taskKey: "IntegrationSync",
        taskName: "Integration Sync",
        integrationEvent: "Invites synced",
        sourceCount: inviteIntegrations.length,
        inviteCount: syncedInviteItems.length,
        activeCount: syncedInviteItems.filter((invite) => invite.status !== "used" && invite.status !== "expired").length,
        message: `Invites synced · ${syncedInviteItems.length} link${syncedInviteItems.length === 1 ? "" : "s"}.`,
      });
    }
    await webhookManager.flushCoalescedWebhooks();

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
