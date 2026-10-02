const test = require("node:test");
const assert = require("node:assert/strict");
const { safeHttpGet, safeHttpPost } = require("../utils/security");
const { axios } = require("../classes/axios");

test("safe HTTP helpers keep the port from the integration URL", async () => {
  const seen = [];
  const original = axios.request;
  axios.request = async (config) => {
    seen.push(`${config.method} ${config.baseURL}${config.url}`);
    return { status: 200, data: {} };
  };
  try {
    await safeHttpGet("http://sonarr.local:8989/", "/api/v3/system/status?x=1");
    await safeHttpPost("https://abs.example:13378", "/api/libraries", {});
    await safeHttpGet("https://media.example", "/status");
  } finally {
    axios.request = original;
  }
  assert.deepEqual(seen, [
    "get http://sonarr.local:8989/api/v3/system/status?x=1",
    "post https://abs.example:13378/api/libraries",
    "get https://media.example/status",
  ]);
});
