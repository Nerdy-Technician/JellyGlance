const test = require("node:test");
const assert = require("node:assert/strict");
const { getImageInfo, normalizeImageRepo, EXPECTED_IMAGE_REPO } = require("../utils/image-source");

test("old images without JG_IMAGE_REPO are flagged", () => {
  const info = getImageInfo({});
  assert.equal(info.image_repo, null);
  assert.equal(info.on_expected_image, false);
  assert.equal(info.expected_image, `${EXPECTED_IMAGE_REPO}:latest`);
});

test("the old Nerdy-Technician image is flagged", () => {
  assert.equal(getImageInfo({ JG_IMAGE_REPO: "ghcr.io/nerdy-technician/jellyglance" }).on_expected_image, false);
});

test("the JellyGlance/Server image is recognised, with tag, digest or case differences", () => {
  for (const value of ["ghcr.io/jellyglance/server", "GHCR.IO/JellyGlance/Server:latest", "ghcr.io/jellyglance/server@sha256:abc123", " ghcr.io/jellyglance/server:1.3.2 "]) {
    assert.equal(getImageInfo({ JG_IMAGE_REPO: value }).on_expected_image, true, value);
  }
});

test("normalizeImageRepo strips docker.io and tags", () => {
  assert.equal(normalizeImageRepo("docker.io/jellyglance/server:latest"), "jellyglance/server");
});

test("JG_HIDE_IMAGE_NOTICE=true suppresses the notice", () => {
  const info = getImageInfo({ JG_IMAGE_REPO: "ghcr.io/nerdy-technician/jellyglance", JG_HIDE_IMAGE_NOTICE: "true" });
  assert.equal(info.on_expected_image, true);
  assert.equal(info.image_notice_hidden, true);
  assert.equal(getImageInfo({ JG_HIDE_IMAGE_NOTICE: "false" }).on_expected_image, false);
});
