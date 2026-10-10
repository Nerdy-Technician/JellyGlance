// Which Docker image this instance was built from.
//
// JG_IMAGE_REPO is baked in at build time (Dockerfile ARG/ENV, set from each
// publish workflow's image repo). Images built before this change leave it
// empty. Anything other than the JellyGlance/Server repo makes the web UI tell
// users to switch. JG_HIDE_IMAGE_NOTICE=true opts out of the notice.
const EXPECTED_IMAGE_REPO = "ghcr.io/jellyglance/server";
const IMAGE_MOVE_AFTER_VERSION = "1.3.2";

function normalizeImageRepo(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/^docker\.io\//, "")
    .replace(/@sha256:[a-f0-9]+$/, "")
    .replace(/:[^/:]+$/, "");
}

function isTruthy(value) {
  return ["1", "true", "yes", "on"].includes(String(value || "").trim().toLowerCase());
}

function getImageInfo(env = process.env) {
  const imageRepo = normalizeImageRepo(env.JG_IMAGE_REPO);
  const noticeHidden = isTruthy(env.JG_HIDE_IMAGE_NOTICE);
  return {
    image_repo: imageRepo || null,
    expected_image_repo: EXPECTED_IMAGE_REPO,
    expected_image: `${EXPECTED_IMAGE_REPO}:latest`,
    on_expected_image: noticeHidden || imageRepo === EXPECTED_IMAGE_REPO,
    image_notice_hidden: noticeHidden,
    image_move_after_version: IMAGE_MOVE_AFTER_VERSION,
  };
}

module.exports = { EXPECTED_IMAGE_REPO, IMAGE_MOVE_AFTER_VERSION, normalizeImageRepo, getImageInfo };
