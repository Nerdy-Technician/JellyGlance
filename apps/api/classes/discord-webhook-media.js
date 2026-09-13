const fs = require("fs");
const os = require("os");
const path = require("path");
const { pathToFileURL } = require("url");
const { randomUUID } = require("crypto");

const CARD_FONT = "JellyGlanceCard";
const BUNDLED_FONT_DIR = path.join(__dirname, "..", "assets", "fonts");
const SYSTEM_FONT_DIRS = [
  "/usr/share/fonts/truetype/dejavu",
  "/usr/share/fonts/TTF",
  "/usr/local/share/fonts",
];

function firstExistingFile(candidates) {
  for (const candidate of candidates) {
    if (candidate && fs.existsSync(candidate)) return candidate;
  }
  return null;
}

function resolveCardFonts() {
  const regular = firstExistingFile([
    path.join(BUNDLED_FONT_DIR, "DejaVuSans.ttf"),
    ...SYSTEM_FONT_DIRS.map((dir) => path.join(dir, "DejaVuSans.ttf")),
  ]);
  const bold = firstExistingFile([
    path.join(BUNDLED_FONT_DIR, "DejaVuSans-Bold.ttf"),
    ...SYSTEM_FONT_DIRS.map((dir) => path.join(dir, "DejaVuSans-Bold.ttf")),
    regular,
  ]);
  return { regular, bold };
}

function escapeFontconfigXml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function ensureCardFontconfig({ regular, bold }) {
  const fontDirs = new Set();
  for (const file of [regular, bold]) {
    if (file) fontDirs.add(path.dirname(file));
  }
  if (!fontDirs.size) return;

  const confDir = path.join(os.tmpdir(), "jellyglance-fontconfig");
  fs.mkdirSync(confDir, { recursive: true });
  const confPath = path.join(confDir, "fonts.conf");
  const dirXml = [...fontDirs].map((dir) => `  <dir>${escapeFontconfigXml(dir)}</dir>`).join("\n");
  fs.writeFileSync(
    confPath,
    `<?xml version="1.0"?>
<!DOCTYPE fontconfig SYSTEM "urn:fontconfig:fonts.dtd">
<fontconfig>
  <include ignore_missing="yes">/etc/fonts/fonts.conf</include>
${dirXml}
  <alias>
    <family>${CARD_FONT}</family>
    <prefer><family>DejaVu Sans</family></prefer>
  </alias>
</fontconfig>
`
  );
  process.env.FONTCONFIG_FILE = confPath;
}

function cardFontFaceCss() {
  const fonts = resolveCardFonts();
  ensureCardFontconfig(fonts);
  const faces = [];
  if (fonts.regular) {
    faces.push(
      `@font-face{font-family:'${CARD_FONT}';font-weight:400;font-style:normal;src:url('${pathToFileURL(fonts.regular).href}') format('truetype');}`
    );
  }
  if (fonts.bold) {
    faces.push(
      `@font-face{font-family:'${CARD_FONT}';font-weight:700;font-style:normal;src:url('${pathToFileURL(fonts.bold).href}') format('truetype');}`
    );
  }
  if (!faces.length) return "";
  return `<defs><style type="text/css">${faces.join("")}</style></defs>`;
}

const CARD_FONT_FACE = cardFontFaceCss();

const FormData = require("form-data");
const sharp = require("sharp");
const { axios } = require("./axios");
const configClass = require("./config");
const db = require("../db");
const { getIntegrations, getIntegrationData } = require("./integration-store");
const { getConfigDir } = require("../utils/storage-paths");
const { getSettings } = require("./admin-history");
const { renderClientIconBadge } = require("./client-icons");
const { DEFAULT_THEME, resolveCardUiTheme } = require("./user-preferences");

const CARD_THEMES = ["match", "glance", "jellyfin", "midnight", "compact"];

function normalizeCardSettings(value = {}) {
  return {
    theme: CARD_THEMES.includes(value.theme) ? value.theme : "glance",
    showClientIcon: value.showClientIcon !== false,
  };
}

async function getCardSettings() {
  const settings = await getSettings().catch(() => ({}));
  return normalizeCardSettings(settings.WebhookCardSettings);
}

function rgbFromHex(hex, fallback = { r: 17, g: 24, b: 39 }) {
  const value = String(hex || "").replace("#", "");
  if (!/^[0-9a-f]{6}$/i.test(value)) return fallback;
  return {
    r: Number.parseInt(value.slice(0, 2), 16),
    g: Number.parseInt(value.slice(2, 4), 16),
    b: Number.parseInt(value.slice(4, 6), 16),
  };
}

function mixHex(hex, other, amount = 0.5) {
  const left = rgbFromHex(hex);
  const right = rgbFromHex(other, { r: 255, g: 255, b: 255 });
  const mix = (from, to) => Math.round(from + (to - from) * amount);
  return `#${[mix(left.r, right.r), mix(left.g, right.g), mix(left.b, right.b)]
    .map((channel) => channel.toString(16).padStart(2, "0"))
    .join("")}`;
}

function canvasBackground(palette) {
  return rgbFromHex(palette.canvas, { r: 17, g: 24, b: 39 });
}

function themePalette(theme, accent, uiTheme) {
  const rgb = colorToRgb(accent);
  if (theme === "match") {
    const colors = uiTheme || DEFAULT_THEME;
    return {
      panel: colors.surface,
      kicker: mixHex(colors.secondary, "#ffffff", 0.28),
      name: "#f8fafc",
      title: "#ffffff",
      subtitle: mixHex(colors.secondary, "#f8fafc", 0.42),
      details: colors.secondary,
      accent: rgbFromHex(colors.primary),
      iconBg: colors.background,
      canvas: colors.background,
      width: 560,
      height: 252,
      posterWidth: 168,
      iconSize: 36,
    };
  }
  if (theme === "jellyfin") {
    return {
      panel: "#1a1024",
      kicker: "#d8b4fe",
      name: "#f8fafc",
      title: "#ffffff",
      subtitle: "#e9d5ff",
      details: "#c4b5fd",
      accent: { r: 170, g: 92, b: 195 },
      iconBg: "#2e1065",
      canvas: "#1a1024",
      width: 560,
      height: 252,
      posterWidth: 168,
      iconSize: 36,
    };
  }
  if (theme === "midnight") {
    return {
      panel: "#080a10",
      panelOpacity: 0.84,
      kicker: "#7dd3fc",
      name: "#f8fafc",
      title: "#ffffff",
      subtitle: "#cbd5e1",
      details: "#94a3b8",
      accent: rgb,
      iconBg: "#0f172a",
      canvas: "#080a10",
      width: 600,
      height: 280,
      posterWidth: 176,
      iconSize: 38,
    };
  }
  if (theme === "compact") {
    return {
      panel: "#111827",
      kicker: "#94a3b8",
      name: "#f8fafc",
      title: "#ffffff",
      subtitle: "#cbd5e1",
      details: "#94a3b8",
      accent: rgb,
      iconBg: "#1f2937",
      canvas: "#111827",
      width: 560,
      height: 188,
      posterWidth: 126,
      iconSize: 28,
    };
  }
  return {
    panel: "#111827",
    kicker: "#94a3b8",
    name: "#f8fafc",
    title: "#ffffff",
    subtitle: "#cbd5e1",
    details: "#94a3b8",
    accent: rgb,
    iconBg: "#1f2937",
    canvas: "#111827",
    width: 560,
    height: 252,
    posterWidth: 168,
    iconSize: 36,
  };
}

const PLAYBACK_EVENTS = new Set(["playback_started", "playback_ended"]);
const DOWNLOAD_EVENTS = new Set(["download_added", "download_started", "download_completed", "download_failed"]);
const OPERATIONAL_EVENTS = new Set([
  "task_started",
  "task_completed",
  "task_failed",
  "download_queue_refreshed",
  "calendar_refreshed",
  "invite_links_refreshed",
  "media_recently_added",
  "invite_created",
  "invite_deleted",
  "integration_health_warning",
  "ops_digest",
  "playback_digest",
]);
const EVENT_COLORS = {
  playback_started: 5763719,
  playback_ended: 15548997,
  playback_digest: 5763719,
  download_added: 3447003,
  download_started: 3447003,
  download_completed: 5763719,
  download_failed: 15548997,
  task_started: 3901635,
  task_completed: 3514227,
  task_failed: 14037546,
  download_queue_refreshed: 3901635,
  calendar_refreshed: 3901635,
  invite_links_refreshed: 3901635,
  media_recently_added: 3514227,
  invite_created: 3514227,
  invite_deleted: 14037546,
  integration_health_warning: 14922250,
};

function jellyfinHeaders(config) {
  return {
    Authorization: `MediaBrowser Token="${config.JF_API_KEY}"`,
    "X-Emby-Authorization": `MediaBrowser Token="${config.JF_API_KEY}"`,
    "X-MediaBrowser-Token": config.JF_API_KEY,
  };
}

function normalizeTitle(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/\[[^\]]*]/g, " ")
    .replace(/\([^)]*\)/g, " ")
    .replace(/s\d{1,2}e\d{1,2}.*$/i, " ")
    .replace(/\b(1080p|720p|2160p|4k|web[-.]?dl|bluray|remux|proper|extended|internal)\b/gi, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

async function fetchImageBuffer(url, headers = {}) {
  if (!url || !/^https?:\/\//i.test(url)) return null;
  try {
    const response = await axios.get(url, {
      responseType: "arraybuffer",
      headers,
      timeout: 8000,
      maxContentLength: 8 * 1024 * 1024,
    });
    const contentType = String(response.headers["content-type"] || "");
    if (!contentType.startsWith("image/") || !response.data?.length) return null;
    return { buffer: Buffer.from(response.data), contentType: contentType.split(";")[0] };
  } catch {
    return null;
  }
}

async function fetchJellyfinImage(path) {
  const config = await new configClass().getConfig();
  if (config.error || !config.JF_HOST) return null;
  return fetchImageBuffer(`${String(config.JF_HOST).replace(/\/+$/, "")}${path}`, jellyfinHeaders(config));
}

async function fetchPlaybackArtwork(data) {
  const files = [];
  const userId = data.UserId || data.userData?.userId;
  const posterId = data.mediaInfo?.posterItemId || data.SeriesId || data.ItemId || data.mediaInfo?.itemId;
  const userTag = data.userData?.userImageTag ? `&tag=${encodeURIComponent(data.userData.userImageTag)}` : "";

  if (posterId) {
    const poster = await fetchJellyfinImage(`/Items/${encodeURIComponent(posterId)}/Images/Primary?fillWidth=480&fillHeight=720&quality=90`);
    if (poster) files.push({ name: "poster.jpg", ...poster });
  }

  if (userId) {
    let avatar = await fetchJellyfinImage(`/Users/${encodeURIComponent(userId)}/Images/Primary?fillWidth=128&quality=90${userTag}`);
    if (!avatar) {
      const { rows } = await db.query('SELECT "PrimaryImageTag" FROM jf_users WHERE "Id"=$1', [userId]).catch(() => ({ rows: [] }));
      const tag = rows[0]?.PrimaryImageTag;
      if (tag) {
        avatar = await fetchJellyfinImage(
          `/Users/${encodeURIComponent(userId)}/Images/Primary?fillWidth=128&quality=90&tag=${encodeURIComponent(tag)}`
        );
      }
    }
    if (avatar) files.push({ name: "user.jpg", ...avatar });
  }

  return files;
}

async function fetchDownloadArtwork(data) {
  const files = [];
  const itemName = data.itemName || data.item?.name || data.message || "";
  const wanted = normalizeTitle(itemName);
  if (!wanted) return files;

  const integrationData = await getIntegrationData().catch(() => null);
  const releases = integrationData?.calendar?.releases || [];
  const calendarMatch = releases.find((release) => {
    const title = normalizeTitle(release.title);
    return title && (wanted.includes(title) || title.includes(wanted));
  });

  let posterUrl = calendarMatch?.posterUrl || null;

  if (!posterUrl) {
    const integrations = await getIntegrations().catch(() => ({ arrApps: [] }));
    for (const app of integrations.arrApps || []) {
      if (!app.connected || !app.values?.url || !app.values?.secret) continue;
      const isRadarr = String(app.name || app.slug || "").toLowerCase().includes("radarr");
      const parsePath = isRadarr ? "/api/v3/parse" : "/api/v3/parse";
      try {
        const response = await axios.get(`${String(app.values.url).replace(/\/+$/, "")}${parsePath}`, {
          timeout: 8000,
          headers: { "X-Api-Key": app.values.secret },
          params: { title: itemName },
        });
        const media = response.data?.movie || response.data?.series || response.data?.parsedMovieInfo?.movieTitle;
        const images = media?.images || [];
        const poster = images.find((image) => image.coverType === "poster") || images[0];
        posterUrl = poster?.remoteUrl || poster?.url || null;
        if (posterUrl) break;
      } catch {
        // Try the next *arr app.
      }
    }
  }

  if (posterUrl) {
    const poster = await fetchImageBuffer(posterUrl);
    if (poster) files.push({ name: "poster.jpg", ...poster });
  }

  return files;
}

function episodeLabel(data) {
  const season = data.mediaInfo?.seasonNumber ?? data.SeasonNumber;
  const episode = data.mediaInfo?.episodeNumber ?? data.EpisodeNumber;
  if (season == null || episode == null) return data.ItemName || data.mediaInfo?.mediaName || "";
  return `S${String(season).padStart(2, "0")}E${String(episode).padStart(2, "0")} · ${data.ItemName || data.mediaInfo?.mediaName || "Episode"}`;
}

function escapeXml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function truncate(value, max) {
  const text = String(value || "").trim();
  if (text.length <= max) return text;
  return `${text.slice(0, Math.max(0, max - 1)).trimEnd()}…`;
}

function wrapLines(value, maxChars, maxLines = 2) {
  const words = String(value || "").trim().split(/\s+/).filter(Boolean);
  if (!words.length) return [];
  const lines = [];
  let current = "";
  for (const word of words) {
    const next = current ? `${current} ${word}` : word;
    if (next.length > maxChars && current) {
      lines.push(current);
      current = word;
      if (lines.length === maxLines - 1) {
        const rest = [word, ...words.slice(words.indexOf(word) + 1)].join(" ");
        lines.push(truncate(rest, maxChars));
        return lines;
      }
    } else {
      current = next;
    }
  }
  if (current) lines.push(current);
  return lines;
}

function colorToRgb(color) {
  const hex = Number(color || 3447003)
    .toString(16)
    .padStart(6, "0");
  return {
    r: Number.parseInt(hex.slice(0, 2), 16),
    g: Number.parseInt(hex.slice(2, 4), 16),
    b: Number.parseInt(hex.slice(4, 6), 16),
  };
}

async function roundedImage(buffer, size) {
  const mask = Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}"><circle cx="${size / 2}" cy="${size / 2}" r="${size / 2}" fill="#fff"/></svg>`
  );
  return sharp(buffer)
    .resize(size, size, { fit: "cover" })
    .png()
    .composite([{ input: mask, blend: "dest-in" }])
    .toBuffer();
}

async function composeLandscapeCard({ poster, avatar, accent, kicker, username, title, subtitle, details, theme = "glance", clientIcon = null, uiTheme = null }) {
  const palette = themePalette(theme, accent, uiTheme);
  const { width, height, posterWidth, iconSize } = palette;
  const panelWidth = width - posterWidth;
  const textLeft = posterWidth + 22;
  const compact = theme === "compact";
  const titleLines = wrapLines(title, compact ? 32 : 28, compact ? 1 : 2);
  const subtitleLines = wrapLines(subtitle, compact ? 38 : 36, compact ? 1 : 2);
  const hasAvatar = Boolean(avatar?.buffer);
  const hasIcon = Boolean(clientIcon?.buffer);
  const avatarSize = compact ? 28 : 36;
  const nameLeft = hasAvatar ? textLeft + avatarSize + 10 : textLeft;
  let cursor = compact ? (hasAvatar ? 78 : 70) : hasAvatar ? 86 : 78;
  const titleSize = compact ? 18 : 22;
  const titleSvg = titleLines
    .map((line, index) => {
      const y = cursor + index * (compact ? 22 : 28);
      return `<text x="${textLeft}" y="${y}" fill="${palette.title}" font-size="${titleSize}" font-family="${CARD_FONT}" font-weight="700">${escapeXml(line)}</text>`;
    })
    .join("");
  cursor += titleLines.length * (compact ? 22 : 28) + (compact ? 4 : 6);
  const subtitleSvg = subtitleLines
    .map((line, index) => {
      const y = cursor + index * (compact ? 18 : 20);
      return `<text x="${textLeft}" y="${y}" fill="${palette.subtitle}" font-size="${compact ? 13 : 15}" font-family="${CARD_FONT}" font-weight="400">${escapeXml(line)}</text>`;
    })
    .join("");
  const detailY = height - 18;
  const detailMax = hasIcon ? 34 : 42;
  const panelOpacity = palette.panelOpacity != null ? ` fill-opacity="${palette.panelOpacity}"` : "";

  const layers = [];
  if (theme === "midnight" && poster?.buffer) {
    layers.push({
      input: await sharp(poster.buffer).resize(width, height, { fit: "cover" }).blur(16).modulate({ brightness: 0.42 }).png().toBuffer(),
      left: 0,
      top: 0,
    });
  }
  if (poster?.buffer) {
    layers.push({
      input: await sharp(poster.buffer).resize(posterWidth, height, { fit: "cover" }).png().toBuffer(),
      left: 0,
      top: 0,
    });
  }

  const svg = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
    ${CARD_FONT_FACE}
    <rect x="${posterWidth}" y="0" width="${panelWidth}" height="${height}" fill="${palette.panel}"${panelOpacity}/>
    <rect x="${posterWidth}" y="0" width="5" height="${height}" fill="rgb(${palette.accent.r},${palette.accent.g},${palette.accent.b})"/>
    <text x="${nameLeft}" y="${compact ? 28 : 32}" fill="${palette.kicker}" font-size="12" font-family="${CARD_FONT}" font-weight="700">${escapeXml(truncate(kicker, 28).toUpperCase())}</text>
    <text x="${nameLeft}" y="${compact ? 48 : 54}" fill="${palette.name}" font-size="${compact ? 14 : 16}" font-family="${CARD_FONT}" font-weight="700">${escapeXml(truncate(username, 22))}</text>
    ${titleSvg}
    ${subtitleSvg}
    <text x="${textLeft}" y="${detailY}" fill="${palette.details}" font-size="13" font-family="${CARD_FONT}" font-weight="400">${escapeXml(truncate(details, detailMax))}</text>
  </svg>`);

  layers.push({ input: svg, left: 0, top: 0 });

  if (hasAvatar) {
    layers.push({
      input: await roundedImage(avatar.buffer, avatarSize),
      left: textLeft,
      top: compact ? 14 : 18,
    });
  }

  if (hasIcon) {
    const icon = await sharp(clientIcon.buffer).resize(iconSize, iconSize).png().toBuffer();
    const iconLeft = theme === "jellyfin" || compact ? width - iconSize - 16 : width - iconSize - 14;
    const iconTop = theme === "jellyfin" || compact ? 14 : height - iconSize - 14;
    layers.push({ input: icon, left: iconLeft, top: iconTop });
  }

  const buffer = await sharp({
    create: { width, height, channels: 3, background: canvasBackground(palette) },
  })
    .composite(layers)
    .jpeg({ quality: 88 })
    .toBuffer();

  return { name: "card.jpg", buffer, contentType: "image/jpeg" };
}

function playbackCopy(data) {
  const started = data.event === "playback_started";
  const username = data.UserName || data.userData?.username || "A user";
  const seriesName = data.SeriesName || data.mediaInfo?.seriesName;
  const title = seriesName || data.ItemName || data.mediaInfo?.mediaName || "Media";
  const subtitle = seriesName ? episodeLabel(data) : started ? "Movie" : "Movie";
  const details = [data.ClientName || data.sessionInfo?.clientName, data.DeviceName || data.sessionInfo?.deviceName, data.PlayMethod || data.sessionInfo?.playMethod]
    .filter(Boolean)
    .join("  ·  ");
  return {
    started,
    username,
    title,
    subtitle: seriesName ? subtitle : started ? "Started watching" : "Stopped watching",
    details,
    kicker: started ? "Now playing" : "Stopped",
  };
}

function downloadCopy(data) {
  return {
    username: data.client || data.source || "Download client",
    title: data.integrationEvent || "Download update",
    subtitle: data.itemName || data.item?.name || "",
    details: [data.item?.state, data.item?.progress != null ? `${data.item.progress}%` : null, data.item?.size].filter(Boolean).join("  ·  "),
    kicker: "Download",
  };
}

function formatCount(value, singular, plural) {
  if (value == null || value === "") return null;
  const count = Number(value);
  if (!Number.isFinite(count)) return null;
  return `${count} ${count === 1 ? singular : plural}`;
}

function formatDuration(ms) {
  const value = Number(ms);
  if (!Number.isFinite(value) || value < 0) return null;
  if (value < 1000) return `${value}ms`;
  if (value < 10000) return `${(value / 1000).toFixed(1)}s`;
  return `${Math.round(value / 1000)}s`;
}

function operationalCopy(data) {
  const event = data.event || "";
  const events = Array.isArray(data.coalescedEvents) && data.coalescedEvents.length ? data.coalescedEvents : [event];
  const hasQueue = events.includes("download_queue_refreshed") || data.clientCount != null;
  const hasCalendar = events.includes("calendar_refreshed") || data.releaseCount != null;
  const hasInvites = events.includes("invite_links_refreshed") || data.inviteCount != null;

  let kicker = "JellyGlance";
  if (event.startsWith("task_")) kicker = "Task";
  if (hasInvites) kicker = "Invites";
  if (hasCalendar) kicker = "Calendar";
  if (hasQueue) kicker = "Downloads";
  if ((hasQueue && hasCalendar) || (hasQueue && hasInvites) || (hasCalendar && hasInvites)) kicker = "Integrations";
  if (event === "media_recently_added") kicker = "Library";
  if (event === "integration_health_warning") kicker = "Health";
  if (event === "invite_created" || event === "invite_deleted") kicker = "Invites";

  const title =
    data.taskName ||
    (hasQueue ? "Download queue" : null) ||
    (hasCalendar ? "Calendar" : null) ||
    (hasInvites ? "Invites" : null) ||
    (event === "media_recently_added" ? "Library sync" : null) ||
    (event === "integration_health_warning" ? "Integration health" : null) ||
    "JellyGlance";

  let subtitle = "Updated";
  let railLabel = "SYNC";
  if (event === "task_started") {
    subtitle = "Started";
    railLabel = "START";
  } else if (event === "task_failed") {
    subtitle = data.error ? `Failed · ${truncate(data.error, 72)}` : "Failed";
    railLabel = "FAIL";
  } else if (event === "task_completed") {
    subtitle = "Completed";
    railLabel = "DONE";
  } else if (String(event).endsWith("_refreshed")) {
    subtitle = "Synced";
    railLabel = "SYNC";
  } else if (event === "media_recently_added") {
    subtitle = "New media";
    railLabel = "NEW";
  } else if (event === "invite_created") {
    subtitle = data.code ? `Created ${data.code}` : "Invite created";
    railLabel = "NEW";
  } else if (event === "invite_deleted") {
    subtitle = "Invite removed";
    railLabel = "GONE";
  } else if (event === "integration_health_warning") {
    subtitle = data.message || "A connected client failed its health check";
    railLabel = "WARN";
  }

  const details = [
    formatCount(data.clientCount, "client", "clients"),
    formatCount(data.downloadActiveCount ?? (hasQueue ? data.activeCount : null), "active", "active"),
    formatCount(data.releaseCount, "release", "releases"),
    formatCount(data.inviteCount, "invite", "invites"),
    !hasQueue ? formatCount(data.inviteActiveCount ?? data.activeCount, "active", "active") : null,
    formatCount(data.count, "item", "items"),
    formatCount(data.sourceCount, "source", "sources"),
    formatDuration(data.durationMs),
  ]
    .filter(Boolean)
    .filter((item, index, list) => list.indexOf(item) === index)
    .join("  ·  ");

  return {
    kicker,
    title,
    subtitle,
    details,
    color: EVENT_COLORS[event] || 3901635,
    railLabel,
  };
}

async function composeStatusCard({ color, kicker, title, subtitle, details, railLabel, theme = "glance", clientIcon = null, uiTheme = null }) {
  const palette = themePalette(theme, color, uiTheme);
  const width = theme === "compact" ? 520 : 560;
  const height = theme === "compact" ? 140 : 168;
  const rail = theme === "jellyfin" ? 88 : 92;
  const titleLines = wrapLines(title, 26, theme === "compact" ? 1 : 2);
  const titleSvg = titleLines
    .map((line, index) => `<text x="${rail + 22}" y="${(theme === "compact" ? 58 : 68) + index * 28}" fill="${palette.title}" font-size="${theme === "compact" ? 18 : 22}" font-family="${CARD_FONT}" font-weight="700">${escapeXml(line)}</text>`)
    .join("");
  const subtitleY = (theme === "compact" ? 58 : 68) + titleLines.length * (theme === "compact" ? 22 : 28) + 4;
  const hasIcon = Boolean(clientIcon?.buffer);
  const svg = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
    ${CARD_FONT_FACE}
    <rect width="${width}" height="${height}" fill="${palette.panel}"/>
    <rect width="${rail}" height="${height}" fill="rgb(${palette.accent.r},${palette.accent.g},${palette.accent.b})"/>
    <text x="${rail / 2}" y="${Math.round(height / 2) + 6}" text-anchor="middle" fill="#ffffff" font-size="16" font-family="${CARD_FONT}" font-weight="700">${escapeXml(truncate(railLabel, 8))}</text>
    <text x="${rail + 22}" y="36" fill="${palette.kicker}" font-size="12" font-family="${CARD_FONT}" font-weight="700">${escapeXml(truncate(kicker, 22).toUpperCase())}</text>
    ${titleSvg}
    <text x="${rail + 22}" y="${subtitleY}" fill="${palette.subtitle}" font-size="14" font-family="${CARD_FONT}" font-weight="400">${escapeXml(truncate(subtitle, 40))}</text>
    <text x="${rail + 22}" y="${height - 18}" fill="${palette.details}" font-size="13" font-family="${CARD_FONT}" font-weight="400">${escapeXml(truncate(details, hasIcon ? 36 : 44))}</text>
  </svg>`);

  const layers = [{ input: svg, left: 0, top: 0 }];
  if (hasIcon) {
    const iconSize = 32;
    layers.push({
      input: await sharp(clientIcon.buffer).resize(iconSize, iconSize).png().toBuffer(),
      left: width - iconSize - 16,
      top: 14,
    });
  }

  const buffer = await sharp({
    create: { width, height, channels: 3, background: canvasBackground(palette) },
  })
    .composite(layers)
    .jpeg({ quality: 90 })
    .toBuffer();
  return { name: "card.jpg", buffer, contentType: "image/jpeg" };
}

function playbackEmbed(data, files) {
  const copy = playbackCopy(data);
  const card = files.find((file) => file.name === "card.jpg");
  const poster = files.find((file) => file.name === "poster.jpg");
  const avatar = files.find((file) => file.name === "user.jpg");
  return {
    color: EVENT_COLORS[data.event] || 3447003,
    ...(card
      ? { image: { url: "attachment://card.jpg" } }
      : {
          author: {
            name: copy.username,
            ...(avatar ? { icon_url: "attachment://user.jpg" } : {}),
          },
          title: copy.title,
          description: copy.subtitle,
          ...(poster ? { thumbnail: { url: "attachment://poster.jpg" } } : {}),
        }),
    timestamp: data.triggeredAt || new Date().toISOString(),
  };
}

function downloadEmbed(data, files) {
  const copy = downloadCopy(data);
  const card = files.find((file) => file.name === "card.jpg");
  const poster = files.find((file) => file.name === "poster.jpg");
  return {
    color: EVENT_COLORS[data.event] || 3447003,
    ...(card
      ? { image: { url: "attachment://card.jpg" } }
      : {
          author: { name: copy.username },
          title: copy.title,
          description: copy.subtitle,
          ...(poster ? { thumbnail: { url: "attachment://poster.jpg" } } : {}),
        }),
    timestamp: data.triggeredAt || new Date().toISOString(),
  };
}

function operationalEmbed(data, files) {
  const copy = operationalCopy(data);
  const card = files.find((file) => file.name === "card.jpg");
  return {
    color: copy.color,
    ...(card
      ? { image: { url: "attachment://card.jpg" } }
      : {
          author: { name: copy.kicker },
          title: copy.title,
          description: [copy.subtitle, copy.details].filter(Boolean).join("\n"),
        }),
    timestamp: data.triggeredAt || new Date().toISOString(),
  };
}

function shouldAttachMedia(data = {}) {
  return PLAYBACK_EVENTS.has(data.event) || DOWNLOAD_EVENTS.has(data.event) || OPERATIONAL_EVENTS.has(data.event);
}

function webhookCardDir() {
  const dir = path.join(getConfigDir(), "webhook-cards");
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function pruneWebhookCards() {
  const cutoff = Date.now() - 20 * 60 * 1000;
  try {
    for (const name of fs.readdirSync(webhookCardDir())) {
      const full = path.join(webhookCardDir(), name);
      if (fs.statSync(full).mtimeMs < cutoff) fs.unlinkSync(full);
    }
  } catch {
    // Directory may not exist yet.
  }
}

function putWebhookCard(buffer) {
  pruneWebhookCards();
  const id = randomUUID().replace(/-/g, "");
  fs.writeFileSync(path.join(webhookCardDir(), `${id}.jpg`), buffer);
  return id;
}

function getWebhookCard(id) {
  if (!/^[a-f0-9]{32}$/i.test(String(id || ""))) return null;
  try {
    return { buffer: fs.readFileSync(path.join(webhookCardDir(), `${id}.jpg`)), contentType: "image/jpeg" };
  } catch {
    return null;
  }
}

function publicCardUrl(id) {
  const base = String(process.env.JS_PUBLIC_URL || process.env.JS_EXTERNAL_URL || "").trim().replace(/\/+$/, "");
  if (!base) return null;
  let prefix = String(process.env.JS_BASE_URL || "").trim();
  if (prefix && !prefix.startsWith("/")) prefix = `/${prefix}`;
  prefix = prefix.replace(/\/+$/, "");
  return `${base}${prefix}/webhook-cards/${id}.jpg`;
}

function clientLabel(data = {}) {
  return {
    client: data.ClientName || data.sessionInfo?.clientName || data.client || data.source || data.item?.client || "",
    device: data.DeviceName || data.sessionInfo?.deviceName || "",
  };
}

async function resolveCardIcon(data, cardSettings, background) {
  if (!cardSettings.showClientIcon) return null;
  const { client, device } = clientLabel(data);
  if (!client && !device) return null;
  return renderClientIconBadge(client, device, { background });
}

async function renderEventCard(data = {}, overrides = {}) {
  const isPlayback = PLAYBACK_EVENTS.has(data.event);
  const isDownloadItem = DOWNLOAD_EVENTS.has(data.event);
  const isOperational = OPERATIONAL_EVENTS.has(data.event);
  const copy = isPlayback ? playbackCopy(data) : isDownloadItem ? downloadCopy(data) : operationalCopy(data);
  const cardSettings = normalizeCardSettings({ ...(await getCardSettings()), ...overrides });
  const uiTheme = cardSettings.theme === "match"
    ? overrides.uiTheme || await resolveCardUiTheme({
        jellyfinUserId: data.UserId || data.userData?.userId,
        user: overrides.user,
      })
    : null;
  const palette = themePalette(cardSettings.theme, EVENT_COLORS[data.event] || copy.color || 3447003, uiTheme);
  let file = null;
  try {
    const clientIcon = await resolveCardIcon(data, cardSettings, palette.iconBg);
    if (isPlayback || isDownloadItem) {
      const files = Array.isArray(data.previewArtwork)
        ? data.previewArtwork
        : isPlayback
          ? await fetchPlaybackArtwork(data)
          : await fetchDownloadArtwork(data);
      file = await composeLandscapeCard({
        poster: files.find((item) => item.name === "poster.jpg"),
        avatar: files.find((item) => item.name === "user.jpg"),
        accent: EVENT_COLORS[data.event] || 3447003,
        kicker: copy.kicker,
        username: copy.username || copy.kicker,
        title: copy.title,
        subtitle: copy.subtitle,
        details: copy.details,
        theme: cardSettings.theme,
        clientIcon,
        uiTheme,
      });
    } else {
      file = await composeStatusCard({ ...copy, theme: cardSettings.theme, clientIcon, uiTheme });
    }
  } catch (error) {
    console.warn("[WEBHOOK] Unable to render notification card:", error.message);
  }
  return { copy, file, isPlayback, isDownloadItem, isOperational };
}

async function samplePoster() {
  return sharp({
    create: { width: 336, height: 504, channels: 3, background: { r: 76, g: 29, b: 149 } },
  })
    .composite([
      {
        input: Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="336" height="504">
          <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#7c3aed"/><stop offset="1" stop-color="#0f172a"/></linearGradient></defs>
          <rect width="336" height="504" fill="url(#g)"/>
        </svg>`),
      },
    ])
    .jpeg({ quality: 80 })
    .toBuffer();
}

async function previewWebhookCard(overrides = {}) {
  const poster = await samplePoster();
  const sample = {
    event: "playback_started",
    UserName: "Nerdy",
    ItemName: "The Watcher",
    SeriesName: "Night Shift",
    SeasonNumber: 1,
    EpisodeNumber: 4,
    ClientName: overrides.clientName || "Infuse",
    DeviceName: overrides.deviceName || "Apple TV",
    PlayMethod: "DirectPlay",
    mediaInfo: { seasonNumber: 1, episodeNumber: 4, mediaName: "The Watcher", seriesName: "Night Shift" },
    previewArtwork: [{ name: "poster.jpg", buffer: poster, contentType: "image/jpeg" }],
  };
  const { file } = await renderEventCard(sample, {
    theme: overrides.theme,
    showClientIcon: overrides.showClientIcon,
    user: overrides.user,
    uiTheme: overrides.uiTheme,
  });
  return file;
}

function gotifyPriority(event) {
  if (String(event || "").includes("fail") || event === "integration_health_warning") return 8;
  if (event === "playback_started" || event === "download_added") return 5;
  if (event === "playback_ended") return 4;
  return 3;
}

async function enrichGotifyPayload(templatePayload = {}, data = {}) {
  const { copy, file } = await renderEventCard(data);
  let imageUrl = null;
  if (file?.buffer) {
    const id = putWebhookCard(file.buffer);
    imageUrl = publicCardUrl(id);
    if (!imageUrl && file.buffer.length <= 40 * 1024) {
      imageUrl = `data:image/jpeg;base64,${file.buffer.toString("base64")}`;
    }
    if (!imageUrl) {
      const compact = await sharp(file.buffer).resize({ width: 640 }).jpeg({ quality: 70 }).toBuffer();
      if (compact.length <= 28 * 1024) {
        imageUrl = `data:image/jpeg;base64,${compact.toString("base64")}`;
      }
    }
  }

  if (imageUrl) {
    return {
      title: " ",
      message: `![](${imageUrl})`,
      priority: templatePayload.priority ?? gotifyPriority(data.event),
      extras: {
        ...(templatePayload.extras || {}),
        "client::display": { contentType: "text/markdown" },
        ...(imageUrl.startsWith("data:") ? {} : { "client::notification": { bigImageUrl: imageUrl } }),
      },
    };
  }

  return {
    title: truncate([copy.username, copy.title].filter(Boolean).join(" · ") || copy.kicker || "JellyGlance", 80),
    message: [copy.kicker, copy.subtitle, copy.details].filter(Boolean).join("\n"),
    priority: templatePayload.priority ?? gotifyPriority(data.event),
    extras: templatePayload.extras || {},
  };
}

function sanitizeDiscordPayload(payload = {}) {
  const { taskFilters, rows, groupKey, events, ...rest } = payload;
  return rest;
}

async function enrichDiscordPayload(templatePayload, data) {
  const { file, isPlayback, isDownloadItem, isOperational } = await renderEventCard(data);

  if (!isPlayback && !isDownloadItem && !isOperational) {
    const payload = sanitizeDiscordPayload({ ...templatePayload });
    if (!payload.content && (!Array.isArray(payload.embeds) || payload.embeds.length === 0)) {
      payload.embeds = [operationalEmbed(data, [])];
    }
    return { payload, files: [] };
  }

  const files = file ? [file] : [];
  const embed = isPlayback ? playbackEmbed(data, files) : isDownloadItem ? downloadEmbed(data, files) : operationalEmbed(data, files);
  const payload = sanitizeDiscordPayload({ ...templatePayload });

  if (!Array.isArray(payload.embeds) || payload.embeds.length === 0) {
    payload.embeds = [embed];
    if (!payload.content) delete payload.content;
  } else {
    const first = { ...payload.embeds[0] };
    if (!first.image && embed.image) first.image = embed.image;
    if (!first.thumbnail && embed.image) first.thumbnail = { url: embed.image.url };
    if (!first.author && embed.author) first.author = embed.author;
    if (embed.author?.icon_url && !first.author?.icon_url) {
      first.author = { ...(first.author || {}), icon_url: embed.author.icon_url, name: first.author?.name || embed.author.name };
    }
    payload.embeds = [first, ...payload.embeds.slice(1)];
  }

  return { payload, files };
}

async function postDiscordWebhook(url, payload, files = []) {
  const body = sanitizeDiscordPayload(payload);

  if (!files.length) {
    return axios.post(url, body, {
      headers: { "Content-Type": "application/json" },
      timeout: 15000,
    });
  }

  try {
    const form = new FormData();
    form.append("payload_json", JSON.stringify(body));
    files.forEach((file, index) => {
      form.append(`files[${index}]`, file.buffer, {
        filename: file.name,
        contentType: file.contentType || "image/jpeg",
      });
    });

    return await axios.post(url, form, {
      headers: form.getHeaders(),
      timeout: 20000,
      maxBodyLength: Infinity,
      maxContentLength: Infinity,
    });
  } catch (error) {
    console.warn("[WEBHOOK] Discord attachment upload failed, retrying without artwork:", error.response?.status || error.message);
    const fallback = JSON.parse(JSON.stringify(body));
    if (Array.isArray(fallback.embeds)) {
      fallback.embeds = fallback.embeds.map((embed) => {
        const next = { ...embed };
        if (next.image?.url?.startsWith("attachment://")) delete next.image;
        if (next.thumbnail?.url?.startsWith("attachment://")) delete next.thumbnail;
        if (next.author?.icon_url?.startsWith("attachment://")) {
          const { icon_url, ...author } = next.author;
          next.author = author;
        }
        return next;
      });
    }
    return axios.post(url, fallback, {
      headers: { "Content-Type": "application/json" },
      timeout: 15000,
    });
  }
}

module.exports = {
  enrichDiscordPayload,
  enrichGotifyPayload,
  postDiscordWebhook,
  shouldAttachMedia,
  getWebhookCard,
  getCardSettings,
  normalizeCardSettings,
  previewWebhookCard,
  CARD_THEMES,
};
