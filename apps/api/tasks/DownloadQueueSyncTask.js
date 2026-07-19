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

async function runDownloadQueueSyncTask() {
  try {
    const integrations = await getIntegrations();
    const integrationData = await getIntegrationData();
    const connectedClients = (integrations.clients || []).filter((client) => client.connected);
    const queueResults = await Promise.allSettled(connectedClients.map((client) => fetchClientQueue(client)));
    const syncedItems = queueResults.flatMap((result) => (result.status === "fulfilled" ? result.value.items || [] : []));
    const clients = (integrations.clients || []).map((client) => {
      const resultIndex = connectedClients.findIndex((item) => item.instanceId === client.instanceId);
      const result = resultIndex >= 0 ? queueResults[resultIndex] : null;
      const queueData = result?.status === "fulfilled" ? result.value : null;
      const itemCount = syncedItems.filter((item) => item.client === client.name).length;
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
      downloads: {
        ...integrationData.downloads,
        items: syncedItems,
        clients,
        syncedAt: new Date().toISOString(),
      },
    });

    const webhookManager = new WebhookManager();
    await webhookManager.triggerEventWebhooks("download_queue_refreshed", {
      integrationEvent: "download queue refreshed",
      source: "Download clients",
      clientCount: clients.length,
      activeCount: syncedItems.filter((item) => Number(item.progress || 0) < 100).length,
      message: "Download client queue sync completed.",
    });
    parentPort.postMessage({ status: "complete" });
  } catch (error) {
    parentPort.postMessage({ status: "error", message: error.message });
  }
}

parentPort.on("message", async (message) => {
  if (message.command === "start") {
    await runDownloadQueueSyncTask(message.triggertype);
    process.exit(0);
  }
});
