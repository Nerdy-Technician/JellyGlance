const { axios } = require("./axios");
const { getIntegrations, getIntegrationData, saveIntegrationData } = require("./integration-store");

function cleanUrl(url = "") {
  return String(url).trim().replace(/\/+$/, "");
}

function normalizeName(value = "") {
  return String(value).toLowerCase().replace(/[^a-z0-9]/g, "");
}

function clientKind(client) {
  const name = normalizeName(client?.name || client?.slug || "");
  if (name.includes("qbittorrent") || name === "bittorrent") return "qbittorrent";
  if (name.includes("sabnzbd")) return "sabnzbd";
  return "unknown";
}

function torrentHash(item) {
  if (item?.hash) return item.hash;
  const match = String(item?.id || "").match(/([a-f0-9]{40})$/i);
  return match ? match[1] : null;
}

function nzoId(item) {
  if (item?.nzoId) return item.nzoId;
  const match = String(item?.id || "").match(/(SABnzbd_nzo_[A-Za-z0-9]+)$/i);
  return match ? match[1] : null;
}

function findClient(integrations, item) {
  const clients = integrations.clients || [];
  return (
    clients.find((client) => client.instanceId && String(item.id || "").startsWith(`${client.instanceId}-`)) ||
    clients.find((client) => client.name === item.client) ||
    clients.find((client) => normalizeName(client.name) === normalizeName(item.client))
  );
}

async function qbittorrentCookie(client) {
  const url = cleanUrl(client.values?.url);
  const username = client.values?.username;
  const password = client.values?.secret;
  if (!url || !username || !password) {
    throw Object.assign(new Error("Missing qBittorrent URL, username, or password"), { statusCode: 400 });
  }

  const login = await axios.post(`${url}/api/v2/auth/login`, new URLSearchParams({ username, password }), {
    timeout: 15000,
    headers: { "Content-Type": "application/x-www-form-urlencoded", Referer: `${url}/` },
    validateStatus: () => true,
  });

  if (login.status >= 400 || String(login.data).toLowerCase().includes("fails")) {
    throw Object.assign(new Error("qBittorrent login failed"), { statusCode: 502 });
  }

  return { url, cookie: login.headers["set-cookie"]?.join("; ") || "" };
}

async function qbittorrentPost(client, path, params) {
  const { url, cookie } = await qbittorrentCookie(client);
  const response = await axios.post(`${url}${path}`, new URLSearchParams(params), {
    timeout: 15000,
    headers: { Cookie: cookie, "Content-Type": "application/x-www-form-urlencoded", Referer: `${url}/` },
    validateStatus: () => true,
  });
  if (response.status >= 400 || String(response.data || "").toLowerCase().includes("fails.")) {
    throw Object.assign(new Error(`qBittorrent request failed (${response.status})`), { statusCode: 502 });
  }
  return response;
}

async function getDownloadItem(id) {
  const integrations = await getIntegrations();
  const data = await getIntegrationData();
  const item = (data.downloads?.items || []).find((row) => row.id === id);
  if (!item) {
    throw Object.assign(new Error("Download not found"), { statusCode: 404 });
  }
  const client = findClient(integrations, item);
  if (!client) {
    throw Object.assign(new Error("Download client not found"), { statusCode: 404 });
  }
  return { item, client, data };
}

async function removeStoredItem(data, id) {
  await saveIntegrationData({
    downloads: {
      ...data.downloads,
      items: (data.downloads?.items || []).filter((row) => row.id !== id),
      syncedAt: new Date().toISOString(),
    },
  });
}

async function addDownload({ instanceId, client: clientName, value }) {
  const integrations = await getIntegrations();
  const clients = integrations.clients || [];
  const client =
    clients.find((item) => item.instanceId && item.instanceId === instanceId) ||
    clients.find((item) => item.name === clientName) ||
    clients.find((item) => normalizeName(item.name) === normalizeName(clientName));

  if (!client) {
    throw Object.assign(new Error("Download client not found"), { statusCode: 404 });
  }

  const source = String(value || "").trim();
  if (!source) {
    throw Object.assign(new Error("Use a magnet link or a .torrent URL"), { statusCode: 400 });
  }

  const kind = clientKind(client);
  if (kind === "qbittorrent") {
    await qbittorrentPost(client, "/api/v2/torrents/add", { urls: source });
    return { ok: true, client: client.name };
  }

  if (kind === "sabnzbd") {
    const url = cleanUrl(client.values?.url);
    const apiKey = client.values?.secret;
    if (!url || !apiKey) {
      throw Object.assign(new Error("Missing SABnzbd URL or API key"), { statusCode: 400 });
    }
    await axios.get(`${url}/api`, {
      timeout: 15000,
      params: { mode: "addurl", name: source, output: "json", apikey: apiKey },
    });
    return { ok: true, client: client.name };
  }

  throw Object.assign(new Error("Add is not supported for this client yet"), { statusCode: 400 });
}

async function deleteDownload(id, { deleteFiles = false } = {}) {
  const { item, client, data } = await getDownloadItem(id);
  const kind = clientKind(client);

  if (kind === "qbittorrent") {
    const hash = torrentHash(item);
    if (!hash) {
      await removeStoredItem(data, id);
      return { ok: true, item, localOnly: true };
    }
    await qbittorrentPost(client, "/api/v2/torrents/delete", {
      hashes: hash,
      deleteFiles: deleteFiles ? "true" : "false",
    });
  } else if (kind === "sabnzbd") {
    const idValue = nzoId(item);
    if (!idValue) {
      await removeStoredItem(data, id);
      return { ok: true, item, localOnly: true };
    }
    await axios.get(`${cleanUrl(client.values.url)}/api`, {
      timeout: 15000,
      params: { mode: "queue", name: "delete", value: idValue, del_files: deleteFiles ? 1 : 0, apikey: client.values.secret },
    });
  } else {
    await removeStoredItem(data, id);
    return { ok: true, item, localOnly: true };
  }

  await removeStoredItem(data, id);
  return { ok: true, item };
}

async function setDownloadPaused(id, paused) {
  const { item, client } = await getDownloadItem(id);
  const kind = clientKind(client);

  if (kind === "qbittorrent") {
    const hash = torrentHash(item);
    if (!hash) throw Object.assign(new Error("Missing torrent hash"), { statusCode: 400 });
    const paths = paused
      ? ["/api/v2/torrents/pause", "/api/v2/torrents/stop"]
      : ["/api/v2/torrents/resume", "/api/v2/torrents/start"];
    let lastError;
    for (const path of paths) {
      try {
        await qbittorrentPost(client, path, { hashes: hash });
        return { ok: true, item, paused };
      } catch (error) {
        lastError = error;
      }
    }
    throw lastError;
  }

  if (kind === "sabnzbd") {
    const idValue = nzoId(item);
    if (!idValue) throw Object.assign(new Error("Missing SABnzbd job id"), { statusCode: 400 });
    await axios.get(`${cleanUrl(client.values.url)}/api`, {
      timeout: 15000,
      params: { mode: "queue", name: paused ? "pause" : "resume", value: idValue, apikey: client.values.secret },
    });
    return { ok: true, item, paused };
  }

  throw Object.assign(new Error("Pause is not supported for this client yet"), { statusCode: 400 });
}

module.exports = {
  addDownload,
  deleteDownload,
  setDownloadPaused,
};
