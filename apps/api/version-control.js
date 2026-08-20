const axios = require("axios");
const fs = require("fs");
const path = require("path");
const packageJson = require("./package.json");
const { compareVersions } = require("compare-versions");
const memoizee = require("memoizee");
const { getConfigDir } = require("./utils/storage-paths");

const REPO_OWNER = process.env.JS_REPO_OWNER || "Nerdy-Technician";
const REPO_NAME = process.env.JS_REPO_NAME || "JellyGlance";
const RELEASES_URL = `https://github.com/${REPO_OWNER}/${REPO_NAME}/releases`;
const RELEASES_ATOM_URL = `${RELEASES_URL}.atom`;
const RELEASE_CACHE_TTL_MS = Number(process.env.JS_RELEASE_CACHE_TTL_MS || 6 * 60 * 60 * 1000);
const RELEASE_CACHE_MAX_STALE_MS = Number(process.env.JS_RELEASE_CACHE_MAX_STALE_MS || 14 * 24 * 60 * 60 * 1000);
const RELEASE_CACHE_FILE = path.join(getConfigDir(), "release-notes-cache.json");
const CONTRIBUTORS_CACHE_FILE = path.join(getConfigDir(), "github-contributors-cache.json");
const BUNDLED_RELEASE_NOTES_FILE = path.join(__dirname, "../web/src/whats-new.json");

function normalizeVersion(version) {
  return String(version || "").trim().replace(/^v/i, "");
}

function releaseChannel(currentVersion = packageJson.version) {
  const explicitChannel = String(process.env.JS_RELEASE_CHANNEL || process.env.RELEASE_CHANNEL || "").trim().toLowerCase();
  const normalizedVersion = normalizeVersion(currentVersion).toLowerCase();

  if (explicitChannel === "stable" || explicitChannel === "release") {
    return "stable";
  }

  if (explicitChannel === "beta" || normalizedVersion.includes("beta")) {
    return "beta";
  }

  return "stable";
}

function releaseMatchesChannel(release, channel) {
  const prerelease = Boolean(release?.prerelease) || isPrereleaseVersion(release?.version || release?.tag_name || release?.name);
  return channel === "beta" ? prerelease : !prerelease;
}

async function fetchLatestReleaseVersion(currentVersion, channel = releaseChannel(currentVersion)) {
  const headers = {
    Accept: "application/vnd.github+json",
    "User-Agent": `JellyGlance/${currentVersion}`,
    ...(process.env.GITHUB_TOKEN ? { Authorization: `Bearer ${process.env.GITHUB_TOKEN}` } : {}),
  };

  try {
    const response = await axios.get(`https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/releases`, {
      headers,
      params: {
        per_page: 20,
      },
      timeout: 10000,
    });

    const latestRelease = (response.data || [])
      .filter((release) => !release.draft)
      .map(normalizeRelease)
      .filter((release) => releaseMatchesChannel(release, channel))
      .sort((a, b) => compareVersions(b.version, a.version))[0];

    if (!latestRelease?.version) {
      throw new Error(`GitHub did not return any ${channel} releases`);
    }

    return latestRelease.version;
  } catch (apiError) {
    const response = await axios.get(RELEASES_ATOM_URL, {
      headers: {
        Accept: "application/atom+xml",
        "User-Agent": `JellyGlance/${currentVersion}`,
      },
      timeout: 10000,
    });
    const latestVersion = [...String(response.data || "").matchAll(/\/releases\/tag\/([^"<\s]+)/g)]
      .map((match) => normalizeVersion(match[1]))
      .filter(Boolean)
      .filter((version) => releaseMatchesChannel({ version }, channel))
      .sort((a, b) => compareVersions(b, a))[0];

    if (!latestVersion) {
      throw apiError;
    }

    return latestVersion;
  }
}

function normalizeRelease(release) {
  const tagName = release?.tag_name || release?.name || "";

  return {
    id: release?.id || tagName,
    version: normalizeVersion(tagName),
    name: release?.name || tagName,
    date: release?.published_at || release?.created_at || null,
    prerelease: Boolean(release?.prerelease),
    draft: Boolean(release?.draft),
    url: release?.html_url || RELEASES_URL,
    body: release?.body || "",
  };
}

function isBotContributor(contributor) {
  const login = String(contributor?.login || contributor?.name || "").toLowerCase();
  return contributor?.type === "Bot" || /\bbot\b/.test(login) || login.includes("[bot]") || login.includes("dependabot") || login.includes("github-actions");
}

function normalizeContributor(contributor) {
  return {
    id: contributor?.id || contributor?.login,
    login: contributor?.login || "unknown",
    avatar_url: contributor?.avatar_url || "",
    profile_url: contributor?.html_url || `https://github.com/${contributor?.login || ""}`,
    contributions: Number(contributor?.contributions || 0),
  };
}

function readBundledReleaseNotes() {
  try {
    if (!fs.existsSync(BUNDLED_RELEASE_NOTES_FILE)) {
      return null;
    }

    return JSON.parse(fs.readFileSync(BUNDLED_RELEASE_NOTES_FILE, "utf8"));
  } catch (error) {
    console.warn(`Unable to read bundled release notes: ${error.message}`);
    return null;
  }
}

function readContributorsCache() {
  try {
    if (!fs.existsSync(CONTRIBUTORS_CACHE_FILE)) {
      return null;
    }

    return JSON.parse(fs.readFileSync(CONTRIBUTORS_CACHE_FILE, "utf8"));
  } catch (error) {
    console.warn(`Unable to read GitHub contributors cache: ${error.message}`);
    return null;
  }
}

function writeContributorsCache(data) {
  try {
    fs.mkdirSync(path.dirname(CONTRIBUTORS_CACHE_FILE), { recursive: true });
    fs.writeFileSync(
      CONTRIBUTORS_CACHE_FILE,
      JSON.stringify(
        {
          cached_at: new Date().toISOString(),
          data,
        },
        null,
        2
      )
    );
  } catch (error) {
    console.warn(`Unable to write GitHub contributors cache: ${error.message}`);
  }
}

function getCachedContributors({ allowStale = false } = {}) {
  const cache = readContributorsCache();
  if (!cache?.cached_at || !cache?.data?.contributors?.length) {
    return null;
  }

  const age = Date.now() - new Date(cache.cached_at).getTime();
  const maxAge = allowStale ? RELEASE_CACHE_MAX_STALE_MS : RELEASE_CACHE_TTL_MS;
  if (!Number.isFinite(age) || age < 0 || age > maxAge) {
    return null;
  }

  return {
    ...cache.data,
    cached: true,
    cached_at: cache.cached_at,
    stale: age > RELEASE_CACHE_TTL_MS,
  };
}

function isPrereleaseVersion(version) {
  return /-(alpha|beta|rc|pre|preview)\b/i.test(normalizeVersion(version));
}

function bundledNotesToRelease(version, notes) {
  const normalizedVersion = normalizeVersion(version);
  const noteItems = Array.isArray(notes) ? notes : [];

  return {
    id: `bundled-${normalizedVersion}`,
    version: normalizedVersion,
    name: `JellyGlance v${normalizedVersion}`,
    date: null,
    prerelease: isPrereleaseVersion(normalizedVersion),
    draft: false,
    url: `${RELEASES_URL}/tag/v${normalizedVersion}`,
    body: noteItems.length
      ? noteItems.map((item) => `## ${item.title || "Changes"}\n\n- ${item.body || "No release notes were provided for this version."}`).join("\n\n")
      : "No release notes were provided for this version.",
  };
}

function getBundledReleaseNotes(currentVersion, channel) {
  const bundledNotes = readBundledReleaseNotes();
  if (!bundledNotes || typeof bundledNotes !== "object") {
    return null;
  }

  const releases = Object.entries(bundledNotes)
    .map(([version, notes]) => bundledNotesToRelease(version, notes))
    .filter((release) => releaseMatchesChannel(release, channel))
    .sort((a, b) => compareVersions(b.version, a.version));

  if (!releases.length) {
    return null;
  }

  return {
    current_version: currentVersion,
    channel,
    releases_url: RELEASES_URL,
    cached: false,
    bundled: true,
    releases,
  };
}

function readReleaseCache() {
  try {
    if (!fs.existsSync(RELEASE_CACHE_FILE)) {
      return null;
    }

    return JSON.parse(fs.readFileSync(RELEASE_CACHE_FILE, "utf8"));
  } catch (error) {
    console.warn(`Unable to read release notes cache: ${error.message}`);
    return null;
  }
}

function writeReleaseCache(data) {
  try {
    fs.mkdirSync(path.dirname(RELEASE_CACHE_FILE), { recursive: true });
    fs.writeFileSync(
      RELEASE_CACHE_FILE,
      JSON.stringify(
        {
          cached_at: new Date().toISOString(),
          data,
        },
        null,
        2
      )
    );
  } catch (error) {
    console.warn(`Unable to write release notes cache: ${error.message}`);
  }
}

function getCachedReleaseNotes({ allowStale = false } = {}) {
  const cache = readReleaseCache();
  if (!cache?.cached_at || !cache?.data?.releases?.length) {
    return null;
  }

  const age = Date.now() - new Date(cache.cached_at).getTime();
  const maxAge = allowStale ? RELEASE_CACHE_MAX_STALE_MS : RELEASE_CACHE_TTL_MS;
  if (!Number.isFinite(age) || age < 0 || age > maxAge) {
    return null;
  }

  return {
    ...cache.data,
    cached: true,
    cached_at: cache.cached_at,
    stale: age > RELEASE_CACHE_TTL_MS,
  };
}

function getFallbackReleaseNotes(currentVersion, channel) {
  const bundled = getBundledReleaseNotes(currentVersion, channel);
  if (bundled) {
    return bundled;
  }

  const version = normalizeVersion(currentVersion);

  return {
    current_version: currentVersion,
    channel,
    releases_url: RELEASES_URL,
    cached: false,
    fallback: true,
    releases: [
      {
        id: `fallback-${version}`,
        version,
        name: `JellyGlance v${version}`,
        date: null,
        prerelease: channel === "beta",
        draft: false,
        url: `${RELEASES_URL}/tag/v${version}`,
        body: `Release notes are temporarily unavailable because GitHub could not be reached. View JellyGlance v${version} on GitHub for the full notes.`,
      },
    ],
  };
}

async function fetchReleaseNotes() {
  const currentVersion = packageJson.version;
  const channel = releaseChannel(currentVersion);
  const cached = getCachedReleaseNotes();
  if (cached?.current_version === currentVersion && cached?.channel === channel) {
    return cached;
  }

  try {
    const response = await axios.get(`https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/releases`, {
      headers: {
        Accept: "application/vnd.github+json",
        "User-Agent": `JellyGlance/${currentVersion}`,
        ...(process.env.GITHUB_TOKEN ? { Authorization: `Bearer ${process.env.GITHUB_TOKEN}` } : {}),
      },
      params: {
        per_page: 20,
      },
      timeout: 10000,
    });

    const data = {
      current_version: currentVersion,
      channel,
      releases_url: RELEASES_URL,
      releases: (response.data || [])
        .filter((release) => !release.draft)
        .map(normalizeRelease)
        .filter((release) => releaseMatchesChannel(release, channel)),
    };

    if (data.releases.length) {
      writeReleaseCache(data);
      return data;
    }

    return getFallbackReleaseNotes(currentVersion, channel);
  } catch (error) {
    const staleCache = getCachedReleaseNotes({ allowStale: true });
    if (staleCache?.current_version === currentVersion && staleCache?.channel === channel) {
      console.warn(`Using cached release notes after GitHub fetch failed: ${error.message}`);
      return staleCache;
    }

    console.warn(`Using fallback release notes after GitHub fetch failed: ${error.message}`);
    return getFallbackReleaseNotes(currentVersion, channel);
  }
}

async function fetchGithubContributors() {
  const currentVersion = packageJson.version;
  const cached = getCachedContributors();
  if (cached) {
    return cached;
  }

  try {
    const response = await axios.get(`https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/contributors`, {
      headers: {
        Accept: "application/vnd.github+json",
        "User-Agent": `JellyGlance/${currentVersion}`,
        ...(process.env.GITHUB_TOKEN ? { Authorization: `Bearer ${process.env.GITHUB_TOKEN}` } : {}),
      },
      params: {
        per_page: 100,
        anon: "false",
      },
      timeout: 10000,
    });

    const data = {
      repository_url: `https://github.com/${REPO_OWNER}/${REPO_NAME}`,
      contributors: (response.data || [])
        .filter((contributor) => !isBotContributor(contributor))
        .map(normalizeContributor)
        .filter((contributor) => contributor.login && contributor.login !== "unknown"),
    };

    if (data.contributors.length) {
      writeContributorsCache(data);
      return data;
    }

    throw new Error("GitHub returned no non-bot contributors");
  } catch (error) {
    const staleCache = getCachedContributors({ allowStale: true });
    if (staleCache) {
      console.warn(`Using cached GitHub contributors after fetch failed: ${error.message}`);
      return staleCache;
    }

    throw error;
  }
}

async function checkForUpdates() {
  const currentVersion = packageJson.version;
  let result = {
    current_version: currentVersion,
    latest_version: "",
    message: "",
    update_available: false,
    releases_url: RELEASES_URL,
  };

  try {
    const channel = releaseChannel(currentVersion);
    const latestVersion = await fetchLatestReleaseVersion(currentVersion, channel);

    if (!latestVersion) {
      throw new Error("GitHub release did not include a version tag");
    }

    if (compareVersions(latestVersion, currentVersion) > 0) {
      result = {
        current_version: currentVersion,
        latest_version: latestVersion,
        message: `${REPO_NAME} has an update ${latestVersion}`,
        update_available: true,
        releases_url: RELEASES_URL,
      };
    } else if (compareVersions(latestVersion, currentVersion) < 0) {
      result = {
        current_version: currentVersion,
        latest_version: latestVersion,
        message: `${REPO_NAME} is using a beta version`,
        update_available: false,
        releases_url: RELEASES_URL,
      };
    } else {
      result = {
        current_version: currentVersion,
        latest_version: latestVersion,
        message: `${REPO_NAME} is up to date`,
        update_available: false,
        releases_url: RELEASES_URL,
      };
    }
  } catch (error) {
    console.error(`Failed to fetch releases for ${REPO_NAME}: ${error.message}`);
    result = {
      current_version: currentVersion,
      latest_version: "N/A",
      message: `Unable to check releases. View releases at ${RELEASES_URL}`,
      update_available: false,
      releases_url: RELEASES_URL,
    };
  }

  return result;
}

module.exports = {
  checkForUpdates: memoizee(checkForUpdates, { maxAge: 300000, promise: true }),
  fetchReleaseNotes: memoizee(fetchReleaseNotes, { maxAge: 300000, promise: true }),
  fetchGithubContributors: memoizee(fetchGithubContributors, { maxAge: 300000, promise: true }),
};
