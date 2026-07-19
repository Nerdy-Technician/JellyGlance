const axios = require("axios");
const packageJson = require("./package.json");
const { compareVersions } = require("compare-versions");
const memoizee = require("memoizee");

const REPO_OWNER = process.env.JS_REPO_OWNER || "Nerdy-Technician";
const REPO_NAME = process.env.JS_REPO_NAME || "JellyGlance";
const RELEASES_URL = `https://github.com/${REPO_OWNER}/${REPO_NAME}/releases`;
const RELEASES_ATOM_URL = `${RELEASES_URL}.atom`;

function normalizeVersion(version) {
  return String(version || "").trim().replace(/^v/i, "");
}

async function fetchLatestReleaseVersion(currentVersion) {
  const headers = {
    Accept: "application/vnd.github+json",
    "User-Agent": `JellyGlance/${currentVersion}`,
  };

  try {
    const response = await axios.get(`https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/releases/latest`, {
      headers,
      timeout: 10000,
    });
    return normalizeVersion(response.data?.tag_name || response.data?.name);
  } catch (apiError) {
    const response = await axios.get(RELEASES_ATOM_URL, {
      headers: {
        Accept: "application/atom+xml",
        "User-Agent": `JellyGlance/${currentVersion}`,
      },
      timeout: 10000,
    });
    const tagMatch = response.data.match(/\/releases\/tag\/([^"<\s]+)/);
    const latestVersion = normalizeVersion(tagMatch?.[1]);

    if (!latestVersion) {
      throw apiError;
    }

    return latestVersion;
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
    const latestVersion = await fetchLatestReleaseVersion(currentVersion);

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

module.exports = { checkForUpdates: memoizee(checkForUpdates, { maxAge: 300000, promise: true }) };
