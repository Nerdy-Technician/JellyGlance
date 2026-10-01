// Audiobookshelf integration: listening now, recent sessions, recently added and
// library totals. Uses an Audiobookshelf API token (Settings > Users > API token);
// an admin token also unlocks who is listening and recent sessions.
const { safeHttpGet, stripTrailingSlashes, toSafeHttpUrl } = require("../utils/security");
const { getIntegrations } = require("./integration-store");

const ITEM_ID = /^[A-Za-z0-9_-]{1,64}$/;

function isAudiobookshelfIntegration(integration) {
  const name = String(integration?.slug || integration?.name || "").toLowerCase();
  return name === "audiobookshelf" || name.includes("audiobookshelf");
}

function baseUrl(integration) {
  try {
    const trimmed = stripTrailingSlashes(integration?.values?.url || "");
    return trimmed ? stripTrailingSlashes(toSafeHttpUrl(trimmed)) : "";
  } catch {
    return "";
  }
}

function headers(integration) {
  const token = String(integration?.values?.secret || "")
    .trim()
    .replace(/^bearer\s+/i, "");
  return { Accept: "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) };
}

async function get(integration, path, options = {}) {
  const response = await safeHttpGet(baseUrl(integration), path, { timeout: 12000, headers: headers(integration), ...options });
  return response.data;
}

async function optional(integration, path) {
  try {
    return await get(integration, path);
  } catch {
    return null;
  }
}

async function getConnectedAudiobookshelf() {
  const integrations = await getIntegrations();
  return (integrations.thirdParty || []).find((integration) => integration.connected && isAudiobookshelfIntegration(integration) && baseUrl(integration));
}

async function testAudiobookshelf(integration) {
  if (!baseUrl(integration)) return { ok: false, error: "URL is required" };
  if (!integration?.values?.secret) return { ok: false, error: "API token is required" };
  const [status, libraries] = await Promise.all([optional(integration, "/status"), get(integration, "/api/libraries")]);
  const count = (libraries?.libraries || []).length;
  return {
    ok: true,
    version: status?.serverVersion ? `Audiobookshelf ${status.serverVersion}` : "Audiobookshelf API",
    message: `Connected · ${count} ${count === 1 ? "library" : "libraries"}`,
  };
}

function authorOf(metadata = {}) {
  if (metadata.authorName) return metadata.authorName;
  if (Array.isArray(metadata.authors)) return metadata.authors.map((author) => author?.name).filter(Boolean).join(", ");
  return "";
}

function normalizeItem(item = {}) {
  const metadata = item.media?.metadata || {};
  return {
    id: item.id,
    libraryId: item.libraryId,
    title: metadata.title || item.relPath || "Untitled",
    author: authorOf(metadata),
    narrator: metadata.narratorName || "",
    mediaType: item.mediaType || "book",
    duration: Number(item.media?.duration || 0),
    addedAt: item.addedAt || null,
    hasCover: Boolean(item.media?.coverPath),
  };
}

function normalizeSession(session = {}, userNames = new Map()) {
  return {
    id: session.id,
    itemId: session.libraryItemId || null,
    title: session.displayTitle || session.mediaMetadata?.title || "Unknown title",
    author: session.displayAuthor || "",
    user: userNames.get(session.userId) || session.user?.username || "Unknown user",
    currentTime: Number(session.currentTime || 0),
    duration: Number(session.duration || 0),
    timeListening: Number(session.timeListening || 0),
    playMethod: session.playMethod,
    client: session.mediaPlayer || session.deviceInfo?.clientName || "",
    device: session.deviceInfo?.deviceName || session.deviceInfo?.osName || session.deviceInfo?.browserName || "",
    updatedAt: session.updatedAt || session.startedAt || null,
  };
}

async function fetchAudiobookshelfBundle(integration) {
  const [status, librariesResponse, usersResponse, onlineResponse, sessionsResponse] = await Promise.all([
    optional(integration, "/status"),
    get(integration, "/api/libraries"),
    optional(integration, "/api/users"),
    optional(integration, "/api/users/online"),
    optional(integration, "/api/sessions?itemsPerPage=12&page=0"),
  ]);

  const libraries = librariesResponse?.libraries || [];
  const perLibrary = await Promise.all(
    libraries.map(async (library) => {
      const [stats, recent] = await Promise.all([
        optional(integration, `/api/libraries/${encodeURIComponent(library.id)}/stats`),
        optional(integration, `/api/libraries/${encodeURIComponent(library.id)}/items?sort=addedAt&desc=1&limit=12&minified=1`),
      ]);
      return {
        library: {
          id: library.id,
          name: library.name,
          mediaType: library.mediaType,
          items: Number(stats?.totalItems || 0),
          authors: Number(stats?.totalAuthors || 0),
          durationSeconds: Number(stats?.totalDuration || 0),
          sizeBytes: Number(stats?.totalSize || 0),
        },
        recent: (recent?.results || []).map(normalizeItem),
      };
    })
  );

  const userNames = new Map((usersResponse?.users || []).map((user) => [user.id, user.username]));
  const listeningNow = (onlineResponse?.openSessions || []).map((session) => normalizeSession(session, userNames));
  const recentSessions = (sessionsResponse?.sessions || []).map((session) => normalizeSession(session, userNames));
  const recentlyAdded = perLibrary
    .flatMap((entry) => entry.recent)
    .sort((a, b) => Number(b.addedAt || 0) - Number(a.addedAt || 0))
    .slice(0, 12);

  return {
    version: status?.serverVersion || null,
    admin: Boolean(usersResponse || onlineResponse),
    libraries: perLibrary.map((entry) => entry.library),
    totals: perLibrary.reduce(
      (sum, { library }) => ({
        items: sum.items + library.items,
        authors: sum.authors + library.authors,
        durationSeconds: sum.durationSeconds + library.durationSeconds,
        sizeBytes: sum.sizeBytes + library.sizeBytes,
      }),
      { items: 0, authors: 0, durationSeconds: 0, sizeBytes: 0 }
    ),
    users: userNames.size,
    listeningNow,
    recentSessions,
    recentlyAdded,
  };
}

// Covers are fetched server-side so the browser never needs the Audiobookshelf token.
async function fetchAudiobookshelfCover(integration, itemId, width = 300) {
  if (!ITEM_ID.test(String(itemId || ""))) throw Object.assign(new Error("Invalid item id"), { statusCode: 400 });
  const size = Math.min(800, Math.max(60, Number.parseInt(width, 10) || 300));
  const response = await safeHttpGet(baseUrl(integration), `/api/items/${itemId}/cover?width=${size}&format=webp`, {
    timeout: 12000,
    headers: { ...headers(integration), Accept: "image/*" },
    responseType: "arraybuffer",
  });
  return { data: response.data, contentType: String(response.headers?.["content-type"] || "image/webp") };
}

module.exports = {
  isAudiobookshelfIntegration,
  getConnectedAudiobookshelf,
  testAudiobookshelf,
  fetchAudiobookshelfBundle,
  fetchAudiobookshelfCover,
};
