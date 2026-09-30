const fs = require("fs");
const path = require("path");
const { pathToFileURL } = require("url");
const { randomUUID } = require("crypto");
const { assertPathInside, createSafeTempDir } = require("../utils/security");

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

let cardFontconfigDir = null;

function ensureCardFontconfig({ regular, bold }) {
  const fontDirs = new Set();
  for (const file of [regular, bold]) {
    if (file) fontDirs.add(path.dirname(file));
  }
  if (!fontDirs.size) return;

  if (!cardFontconfigDir) {
    cardFontconfigDir = createSafeTempDir("jellyglance-fontconfig-");
  }
  const confDir = cardFontconfigDir;
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
const CARD_STYLES = ["card", "text"];
const CARD_TOGGLES = [
  "showClientIcon",
  "showMediaDetails",
  "showPlayMethod",
  "showMetaLine",
  "showGenres",
  "showProgress",
  "showOverview",
  "showPoster",
  "showAvatar",
];

function normalizeAccentColor(value) {
  const text = String(value || "").trim();
  return /^#[0-9a-f]{6}$/i.test(text) ? text.toLowerCase() : "";
}

function normalizeCardSettings(value = {}) {
  const next = {
    style: CARD_STYLES.includes(value.style) ? value.style : "card",
    theme: CARD_THEMES.includes(value.theme) ? value.theme : "glance",
    accentColor: normalizeAccentColor(value.accentColor),
  };
  for (const key of CARD_TOGGLES) next[key] = value[key] !== false;
  return next;
}

function cardAccent(data, cardSettings, fallback) {
  if (cardSettings?.accentColor) return parseInt(cardSettings.accentColor.slice(1), 16);
  return EVENT_COLORS[data?.event] || fallback || 3447003;
}

function mediaForSettings(media, cardSettings) {
  if (!media || !cardSettings?.showMediaDetails) return null;
  return {
    ...media,
    playMethod: cardSettings.showPlayMethod ? media.playMethod : null,
    showMetaLine: cardSettings.showMetaLine,
    genres: cardSettings.showGenres ? media.genres || [] : [],
    progress: cardSettings.showProgress ? media.progress : null,
    position: cardSettings.showProgress ? media.position : null,
    overview: cardSettings.showOverview ? media.overview : null,
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
  "threshold_alert",
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
  threshold_alert: 15105570,
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
    .replace(/\[[^[\]]{0,200}]/g, " ")
    .replace(/\([^()]{0,200}\)/g, " ")
    .replace(/s\d{1,2}e\d{1,2}.{0,80}$/i, " ")
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

async function composeLandscapeCard({ poster, avatar, accent, kicker, username, title, subtitle, details, theme = "glance", clientIcon = null, uiTheme = null, media = null, showMediaDetails = false, detailsWithMedia = null }) {
  const palette = themePalette(theme, accent, uiTheme);
  const withMedia = Boolean(showMediaDetails && media);
  if (withMedia) palette.height += theme === "compact" ? 14 : 24;
  if (!poster?.buffer) {
    palette.width = Math.max(420, palette.width - palette.posterWidth + 12);
    palette.posterWidth = 0;
  }
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
  const detailMax = hasIcon && !(theme === "jellyfin" || theme === "compact") ? 40 : 50;
  const iconTopRight = hasIcon && (theme === "jellyfin" || compact);
  const iconBottomRight = hasIcon && !iconTopRight;
  const accentCss = `rgb(${palette.accent.r},${palette.accent.g},${palette.accent.b})`;
  const extras = [];
  let usernameMax = 22;
  if (withMedia) {
    if (media.playMethod) {
      const label = media.playMethod.toUpperCase();
      const color = playMethodColor(media.playMethod);
      const pillWidth = Math.round(label.length * 7.4 + 22);
      const pillRight = width - 16 - (iconTopRight ? iconSize + 10 : 0);
      const pillTop = compact ? 14 : 18;
      extras.push(`<rect x="${pillRight - pillWidth}" y="${pillTop}" width="${pillWidth}" height="22" rx="11" fill="${color}" fill-opacity="0.16" stroke="${color}" stroke-opacity="0.7"/>`);
      extras.push(`<text x="${pillRight - pillWidth / 2}" y="${pillTop + 15}" text-anchor="middle" fill="${color}" font-size="11" font-family="${CARD_FONT}" font-weight="700">${escapeXml(label)}</text>`);
      usernameMax = 16;
    }
    const lastSubtitleY = subtitleLines.length ? cursor + (subtitleLines.length - 1) * (compact ? 18 : 20) : cursor - (compact ? 18 : 20);
    let metaCursor = lastSubtitleY + (compact ? 20 : 22);
    const meta = media.showMetaLine === false ? null : playbackMetaLine(media);
    if (meta && metaCursor < detailY - (compact ? 34 : 38)) {
      extras.push(`<text x="${textLeft}" y="${metaCursor}" fill="${palette.details}" font-size="${compact ? 12 : 13}" font-family="${CARD_FONT}" font-weight="700">${escapeXml(truncate(meta, compact ? 50 : 46))}</text>`);
      metaCursor += 10;
    } else {
      metaCursor -= 12;
    }
    if (!compact && media.genres.length && metaCursor + 20 < detailY - 36) {
      let chipX = textLeft;
      for (const genre of media.genres) {
        const label = truncate(genre, 14);
        const chipWidth = Math.round(label.length * 6.6 + 18);
        if (chipX + chipWidth > width - 18) break;
        extras.push(`<rect x="${chipX}" y="${metaCursor}" width="${chipWidth}" height="20" rx="10" fill="${accentCss}" fill-opacity="0.2"/>`);
        extras.push(`<text x="${chipX + chipWidth / 2}" y="${metaCursor + 14}" text-anchor="middle" fill="${palette.subtitle}" font-size="11" font-family="${CARD_FONT}" font-weight="700">${escapeXml(label)}</text>`);
        chipX += chipWidth + 6;
      }
    }
    if (media.progress != null) {
      const barY = detailY - (compact ? 24 : 26);
      const barRight = width - 22 - (iconBottomRight ? iconSize + 12 : 0);
      const barWidth = Math.max(40, barRight - textLeft);
      const fill = Math.max(4, Math.round(barWidth * media.progress));
      extras.push(`<rect x="${textLeft}" y="${barY}" width="${barWidth}" height="5" rx="2.5" fill="${palette.details}" fill-opacity="0.25"/>`);
      extras.push(`<rect x="${textLeft}" y="${barY}" width="${fill}" height="5" rx="2.5" fill="${accentCss}"/>`);
    }
  }
  const detailText = withMedia && detailsWithMedia != null ? detailsWithMedia : details;
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
    <text x="${nameLeft}" y="${compact ? 48 : 54}" fill="${palette.name}" font-size="${compact ? 14 : 16}" font-family="${CARD_FONT}" font-weight="700">${escapeXml(truncate(username, usernameMax))}</text>
    ${titleSvg}
    ${subtitleSvg}
    ${extras.join("\n    ")}
    <text x="${textLeft}" y="${detailY}" fill="${palette.details}" font-size="13" font-family="${CARD_FONT}" font-weight="400">${escapeXml(truncate(detailText, detailMax))}</text>
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

function ticksToClock(ticks) {
  const total = Math.floor(Number(ticks) / 10000000);
  if (!Number.isFinite(total) || total <= 0) return null;
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;
  const pad = (value) => String(value).padStart(2, "0");
  return hours ? `${hours}:${pad(minutes)}:${pad(seconds)}` : `${minutes}:${pad(seconds)}`;
}

function ticksToRuntime(ticks) {
  const minutes = Math.round(Number(ticks) / 600000000);
  if (!Number.isFinite(minutes) || minutes <= 0) return null;
  if (minutes < 60) return `${minutes}m`;
  return `${Math.floor(minutes / 60)}h ${String(minutes % 60).padStart(2, "0")}m`;
}

function resolutionLabel(height) {
  const value = Number(height);
  if (!Number.isFinite(value) || value <= 0) return null;
  if (value >= 2000) return "4K";
  if (value >= 1400) return "1440p";
  if (value >= 1000) return "1080p";
  if (value >= 700) return "720p";
  if (value >= 560) return "576p";
  return `${value}p`;
}

function playMethodLabel(value) {
  const method = String(value || "").toLowerCase();
  if (!method) return null;
  if (method.includes("transcode")) return "Transcode";
  if (method.includes("stream")) return "Direct Stream";
  if (method.includes("direct")) return "Direct Play";
  return String(value);
}

function playMethodColor(label) {
  if (label === "Transcode") return "#f59e0b";
  if (label === "Direct Stream") return "#38bdf8";
  return "#22c55e";
}

function humanizeReason(reason) {
  return String(reason || "")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/\bNot Supported\b/i, "unsupported")
    .trim();
}

function playbackMedia(data = {}) {
  const info = data.mediaInfo || {};
  const session = data.sessionInfo || {};
  const playMethod = playMethodLabel(info.playMethod || session.playMethod || data.PlayMethod);
  const runTimeTicks = Number(info.runTimeTicks || data.RunTimeTicks) || null;
  const positionTicks = Number(info.positionTicks || data.PlaybackPositionTicks) || null;
  const progress = runTimeTicks && positionTicks ? Math.max(0, Math.min(1, positionTicks / runTimeTicks)) : null;
  const hdr = info.videoRange && !/^sdr$/i.test(info.videoRange) ? String(info.videoRange).replace(/^hdr10plus$/i, "HDR10+") : null;
  const resolution = resolutionLabel(info.videoHeight);
  const videoCodec = info.videoCodec ? String(info.videoCodec).toUpperCase() : null;
  const audio = info.audioCodec
    ? `${String(info.audioCodec).toUpperCase()}${info.audioChannels ? ` ${info.audioChannels >= 6 ? `${info.audioChannels - 1}.1` : info.audioChannels === 2 ? "Stereo" : `${info.audioChannels}ch`}` : ""}`
    : null;
  const rating = Number(info.communityRating) ? `★ ${Number(info.communityRating).toFixed(1)}` : null;
  return {
    playMethod,
    year: info.productionYear ? String(info.productionYear) : null,
    officialRating: info.officialRating || null,
    rating,
    runtime: ticksToRuntime(runTimeTicks),
    resolution,
    videoCodec,
    hdr,
    audio,
    quality: [resolution, videoCodec, hdr].filter(Boolean).join(" "),
    genres: Array.isArray(info.genres) ? info.genres.filter(Boolean).slice(0, 3) : [],
    overview: info.overview || null,
    progress,
    position: ticksToClock(positionTicks),
    duration: ticksToClock(runTimeTicks),
    transcodeReasons: Array.isArray(info.transcodeReasons) ? info.transcodeReasons.map(humanizeReason).filter(Boolean) : [],
  };
}

function playbackMetaLine(media) {
  if (!media) return "";
  return [media.year, media.officialRating, media.runtime, [media.resolution, media.hdr].filter(Boolean).join(" "), media.rating].filter(Boolean).join("  ·  ");
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
  const media = playbackMedia(data);
  return {
    started,
    username,
    title,
    subtitle: seriesName ? subtitle : started ? "Started watching" : "Stopped watching",
    details,
    kicker: started ? "Now playing" : "Stopped",
    client: data.ClientName || data.sessionInfo?.clientName || null,
    device: data.DeviceName || data.sessionInfo?.deviceName || null,
    media,
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
  if (event === "threshold_alert") kicker = "Alert";
  if (event === "invite_created" || event === "invite_deleted") kicker = "Invites";

  const title =
    (event === "threshold_alert" ? data.title || "Alert" : null) ||
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
  } else if (event === "threshold_alert") {
    subtitle = data.message || "A threshold was crossed";
    railLabel = data.severity === "critical" ? "CRIT" : data.severity === "info" ? "INFO" : "WARN";
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

function embedField(name, value, inline = true) {
  const text = String(value || "").trim();
  if (!text) return null;
  return { name, value: truncate(text, 1000), inline };
}

function playbackTextEmbed(data, files, cardSettings) {
  const copy = playbackCopy(data);
  const media = mediaForSettings(copy.media, cardSettings);
  const poster = files.find((file) => file.name === "poster.jpg");
  const avatar = files.find((file) => file.name === "user.jpg");
  const description = [
    copy.subtitle,
    media && media.showMetaLine !== false ? playbackMetaLine(media) : null,
    media?.overview ? `\n${truncate(media.overview, 220)}` : null,
  ].filter(Boolean).join("\n");
  const progressText = media?.position && media?.duration
    ? `${media.position} / ${media.duration}${media.progress != null ? ` (${Math.round(media.progress * 100)}%)` : ""}`
    : null;
  const methodText = media?.playMethod
    ? `${media.playMethod}${media.playMethod === "Transcode" && media.transcodeReasons.length ? ` · ${media.transcodeReasons.join(", ")}` : ""}`
    : media || cardSettings.showPlayMethod === false ? null : copy.media?.playMethod;
  const fields = [
    embedField("Client", copy.client),
    embedField("Device", copy.device),
    embedField("Playback", methodText),
    media ? embedField("Quality", [media.quality, media.audio].filter(Boolean).join(" · ")) : null,
    media ? embedField("Progress", progressText) : null,
    media?.genres?.length ? embedField("Genres", media.genres.join(", ")) : null,
  ].filter(Boolean);
  return {
    color: cardAccent(data, cardSettings),
    author: {
      name: `${copy.username} · ${copy.kicker}`,
      ...(avatar ? { icon_url: "attachment://user.jpg" } : {}),
    },
    title: truncate(copy.title, 250),
    ...(description ? { description: truncate(description, 1500) } : {}),
    ...(poster ? { thumbnail: { url: "attachment://poster.jpg" } } : {}),
    ...(fields.length ? { fields } : {}),
    footer: { text: "JellyGlance" },
    timestamp: data.triggeredAt || new Date().toISOString(),
  };
}

function downloadTextEmbed(data, files) {
  const copy = downloadCopy(data);
  const poster = files.find((file) => file.name === "poster.jpg");
  const fields = [
    embedField("Client", copy.username),
    embedField("State", data.item?.state),
    embedField("Progress", data.item?.progress != null ? `${data.item.progress}%` : null),
    embedField("Size", data.item?.size),
  ].filter(Boolean);
  return {
    color: EVENT_COLORS[data.event] || 3447003,
    author: { name: copy.kicker },
    title: truncate(copy.title, 250),
    ...(copy.subtitle ? { description: truncate(copy.subtitle, 1500) } : {}),
    ...(poster ? { thumbnail: { url: "attachment://poster.jpg" } } : {}),
    ...(fields.length ? { fields } : {}),
    footer: { text: "JellyGlance" },
    timestamp: data.triggeredAt || new Date().toISOString(),
  };
}

function operationalTextEmbed(data) {
  const copy = operationalCopy(data);
  return {
    color: copy.color,
    author: { name: copy.kicker },
    title: truncate(copy.title, 250),
    description: [copy.subtitle, copy.details].filter(Boolean).join("\n"),
    footer: { text: "JellyGlance" },
    timestamp: data.triggeredAt || new Date().toISOString(),
  };
}

function textModeLines(copy, cardSettings, isPlayback) {
  const media = isPlayback ? mediaForSettings(copy.media, cardSettings) : null;
  const progress = media?.position && media?.duration ? `${media.position} / ${media.duration}` : null;
  return [
    copy.subtitle,
    media && media.showMetaLine !== false ? playbackMetaLine(media) : null,
    media?.overview ? truncate(media.overview, 220) : null,
    isPlayback ? [copy.client, copy.device, copy.media?.playMethod].filter(Boolean).join(" · ") : copy.details,
    media ? [media.quality, media.audio].filter(Boolean).join(" · ") : null,
    progress,
    media?.genres?.length ? media.genres.join(", ") : null,
  ].filter(Boolean);
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

const WEBHOOK_CARD_MAX_INPUT_BYTES = 8 * 1024 * 1024;
const WEBHOOK_CARD_MAX_PIXELS = 40 * 1000 * 1000;
const WEBHOOK_CARD_MAX_DIMENSION = 2000;

// Cards are served publicly as image/jpeg, and some inputs (text-mode posters)
// are raw bytes fetched from Jellyfin/Arr/TMDB. Decode and re-encode everything
// through sharp so only a bounded, valid JPEG ever reaches disk.
async function putWebhookCard(buffer) {
  if (!Buffer.isBuffer(buffer) || !buffer.length || buffer.length > WEBHOOK_CARD_MAX_INPUT_BYTES) {
    throw new Error("Webhook card image is empty or too large");
  }
  const jpeg = await sharp(buffer, { limitInputPixels: WEBHOOK_CARD_MAX_PIXELS, failOn: "error" })
    .rotate()
    .resize({
      width: WEBHOOK_CARD_MAX_DIMENSION,
      height: WEBHOOK_CARD_MAX_DIMENSION,
      fit: "inside",
      withoutEnlargement: true,
    })
    .jpeg({ quality: 85 })
    .toBuffer();
  pruneWebhookCards();
  const dir = webhookCardDir();
  const id = randomUUID().replace(/-/g, "");
  fs.writeFileSync(assertPathInside(dir, path.join(dir, `${id}.jpg`)), jpeg, { mode: 0o640 });
  return id;
}

function getWebhookCard(id) {
  if (!/^[a-f0-9]{32}$/i.test(String(id || ""))) return null;
  try {
    return { buffer: fs.readFileSync(assertPathInside(webhookCardDir(), path.join(webhookCardDir(), `${id}.jpg`))), contentType: "image/jpeg" };
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
  const accentColor = cardSettings.accentColor ? cardAccent(data, cardSettings) : EVENT_COLORS[data.event] || copy.color || 3447003;
  const palette = themePalette(cardSettings.theme, accentColor, uiTheme);
  let file = null;
  let artwork = [];
  try {
    if (isPlayback || isDownloadItem) {
      artwork = Array.isArray(data.previewArtwork)
        ? data.previewArtwork
        : isPlayback
          ? await fetchPlaybackArtwork(data)
          : await fetchDownloadArtwork(data);
      artwork = artwork.filter((item) => (item?.name !== "poster.jpg" || cardSettings.showPoster) && (item?.name !== "user.jpg" || cardSettings.showAvatar));
    }
    if (cardSettings.style === "text") {
      return { copy, file: null, artwork, cardSettings, isPlayback, isDownloadItem, isOperational };
    }
    const clientIcon = await resolveCardIcon(data, cardSettings, palette.iconBg);
    if (isPlayback || isDownloadItem) {
      const files = artwork;
      const media = isPlayback ? mediaForSettings(copy.media, cardSettings) : null;
      const progressClock = media?.position && media?.duration ? `${media.position} / ${media.duration}` : null;
      file = await composeLandscapeCard({
        poster: files.find((item) => item.name === "poster.jpg"),
        avatar: files.find((item) => item.name === "user.jpg"),
        accent: cardAccent(data, cardSettings),
        kicker: copy.kicker,
        username: copy.username || copy.kicker,
        title: copy.title,
        subtitle: copy.subtitle,
        details: copy.details,
        theme: cardSettings.theme,
        clientIcon,
        uiTheme,
        media,
        showMediaDetails: cardSettings.showMediaDetails,
        detailsWithMedia: media ? [copy.client, copy.device, progressClock].filter(Boolean).join("  ·  ") : null,
      });
    } else {
      file = await composeStatusCard({ ...copy, ...(cardSettings.accentColor ? { color: cardAccent(data, cardSettings) } : {}), theme: cardSettings.theme, clientIcon, uiTheme });
    }
  } catch (error) {
    console.warn("[WEBHOOK] Unable to render notification card:", error.message);
  }
  return { copy, file, artwork, cardSettings, isPlayback, isDownloadItem, isOperational };
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
    mediaInfo: {
      seasonNumber: 1,
      episodeNumber: 4,
      mediaName: "The Watcher",
      seriesName: "Night Shift",
      playMethod: "DirectPlay",
      productionYear: 2024,
      officialRating: "TV-14",
      communityRating: 8.2,
      genres: ["Drama", "Thriller", "Mystery"],
      runTimeTicks: 2710000000 * 10,
      positionTicks: 1084000000 * 10,
      videoHeight: 2160,
      videoCodec: "hevc",
      videoRange: "HDR10",
      audioCodec: "eac3",
      audioChannels: 6,
    },
    previewArtwork: [{ name: "poster.jpg", buffer: poster, contentType: "image/jpeg" }],
  };
  const cardOverrides = { style: "card", theme: overrides.theme, user: overrides.user, uiTheme: overrides.uiTheme };
  if (overrides.accentColor !== undefined) cardOverrides.accentColor = overrides.accentColor;
  for (const key of CARD_TOGGLES) {
    if (overrides[key] !== undefined) cardOverrides[key] = overrides[key];
  }
  const { file } = await renderEventCard(sample, cardOverrides);
  return file;
}

function gotifyPriority(event) {
  if (String(event || "").includes("fail") || event === "integration_health_warning") return 8;
  if (event === "playback_started" || event === "download_added") return 5;
  if (event === "playback_ended") return 4;
  return 3;
}

async function gotifyImageUrl(buffer, maxWidth) {
  const id = await putWebhookCard(buffer);
  const url = publicCardUrl(id);
  if (url) return url;
  const compact = await sharp(buffer).resize({ width: maxWidth, withoutEnlargement: true }).jpeg({ quality: 70 }).toBuffer();
  return compact.length <= 28 * 1024 ? `data:image/jpeg;base64,${compact.toString("base64")}` : null;
}

async function enrichGotifyPayload(templatePayload = {}, data = {}) {
  const { copy, file, artwork = [], cardSettings, isPlayback } = await renderEventCard(data);
  if (cardSettings?.style === "text") {
    const poster = artwork.find((item) => item.name === "poster.jpg");
    const posterUrl = poster?.buffer ? await gotifyImageUrl(poster.buffer, 240).catch(() => null) : null;
    const lines = textModeLines(copy, cardSettings, isPlayback);
    const message = [
      posterUrl ? `![](${posterUrl})` : null,
      `**${String(copy.title || copy.kicker || "JellyGlance").replace(/\*/g, "")}**`,
      ...lines,
    ].filter(Boolean).join("\n\n");
    return {
      title: truncate([copy.username, copy.kicker].filter(Boolean).join(" · ") || "JellyGlance", 80),
      message,
      priority: templatePayload.priority ?? gotifyPriority(data.event),
      extras: {
        ...(templatePayload.extras || {}),
        "client::display": { contentType: "text/markdown" },
        ...(posterUrl && !posterUrl.startsWith("data:") ? { "client::notification": { bigImageUrl: posterUrl } } : {}),
      },
    };
  }
  let imageUrl = null;
  if (file?.buffer) {
    const id = await putWebhookCard(file.buffer).catch(() => null);
    imageUrl = id ? publicCardUrl(id) : null;
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
  const { file, artwork = [], cardSettings, isPlayback, isDownloadItem, isOperational } = await renderEventCard(data);

  if (cardSettings?.style === "text" && (isPlayback || isDownloadItem || isOperational)) {
    const files = artwork.filter((item) => item?.buffer && (item.name === "poster.jpg" || item.name === "user.jpg"));
    const embed = isPlayback
      ? playbackTextEmbed(data, files, cardSettings)
      : isDownloadItem
        ? downloadTextEmbed(data, files)
        : operationalTextEmbed(data);
    if (cardSettings.accentColor) embed.color = cardAccent(data, cardSettings);
    const payload = sanitizeDiscordPayload({ ...templatePayload });
    if (!Array.isArray(payload.embeds) || payload.embeds.length === 0) {
      payload.embeds = [embed];
      if (!payload.content) delete payload.content;
    } else {
      const first = { ...embed, ...payload.embeds[0] };
      payload.embeds = [first, ...payload.embeds.slice(1)];
    }
    return { payload, files };
  }

  if (!isPlayback && !isDownloadItem && !isOperational) {
    const payload = sanitizeDiscordPayload({ ...templatePayload });
    if (!payload.content && (!Array.isArray(payload.embeds) || payload.embeds.length === 0)) {
      payload.embeds = [operationalEmbed(data, [])];
    }
    return { payload, files: [] };
  }

  const files = file ? [file] : [];
  const embed = isPlayback ? playbackEmbed(data, files) : isDownloadItem ? downloadEmbed(data, files) : operationalEmbed(data, files);
  if (cardSettings?.accentColor) embed.color = cardAccent(data, cardSettings);
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
  CARD_TOGGLES,
  previewWebhookCard,
  CARD_THEMES,
  CARD_STYLES,
};
