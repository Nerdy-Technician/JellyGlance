const axios = require("axios");
const packageJson = require("./package.json");
const { compareVersions } = require("compare-versions");
const memoizee = require("memoizee");

const REPO_OWNER = process.env.JS_REPO_OWNER || "Nerdy-Technician";
const REPO_NAME = process.env.JS_REPO_NAME || "JellyGlance";

async function checkForUpdates() {
  const currentVersion = packageJson.version;
  let result = { current_version: currentVersion, latest_version: "", message: "", update_available: false };

  try {
    const response = await axios.get(
      `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/contents/package.json`,
      { headers: { Accept: "application/vnd.github.raw+json" } }
    );
    const latestVersion = response.data.version;

    if (compareVersions(latestVersion, currentVersion) > 0) {
      result = { current_version: currentVersion, latest_version: latestVersion, message: `${REPO_NAME} has an update ${latestVersion}`, update_available: true };
    } else if (compareVersions(latestVersion, currentVersion) < 0) {
      result = { current_version: currentVersion, latest_version: latestVersion, message: `${REPO_NAME} is using a beta version`, update_available: false };
    } else {
      result = { current_version: currentVersion, latest_version: latestVersion, message: `${REPO_NAME} is up to date`, update_available: false };
    }
  } catch (error) {
    console.error(`Failed to fetch releases for ${REPO_NAME}: ${error.message}`);
    result = { current_version: currentVersion, latest_version: "N/A", message: `Failed to fetch releases for ${REPO_NAME}: ${error.message}`, update_available: false };
  }

  return result;
}

module.exports = { checkForUpdates: memoizee(checkForUpdates, { maxAge: 300000, promise: true }) };
