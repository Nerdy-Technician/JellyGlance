// HTTP-level check of the public /auth/isConfigured endpoint using the real router.
const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");

process.env.JWT_SECRET = process.env.JWT_SECRET || "test-secret";
const configPath = require.resolve(path.join(__dirname, "..", "classes", "config"));
const storedConfig = {
  state: 2,
  REQUIRE_LOGIN: true,
  APP_USER: "oidc",
  JF_API_KEY: "media-server-key",
  settings: {
    auth: { mode: "oidc", label: "OIDC / Authentik", clientId: "cid", clientSecret: "oidc-secret", discovery: { issuer: "https://auth.example" } },
    Integrations: { arrApps: [{ values: { secret: "sonarr-key" } }] },
  },
};
class FakeConfig {
  async getConfig() {
    return storedConfig;
  }
  clearCache() {}
}
require.cache[configPath] = { id: configPath, filename: configPath, loaded: true, exports: FakeConfig };

const originalLog = console.log;
console.log = () => {};
const express = require("express");
const authRouter = require("../routes/auth");
console.log = originalLog;

test("GET /auth/isConfigured never returns secrets", async () => {
  const app = express();
  app.use("/auth", authRouter);
  const server = app.listen(0);
  try {
    const { port } = server.address();
    const response = await fetch(`http://127.0.0.1:${port}/auth/isConfigured`);
    assert.equal(response.status, 200);
    const text = await response.text();
    const body = JSON.parse(text);
    assert.deepEqual(body.auth, { mode: "oidc", label: "OIDC / Authentik" });
    assert.equal(body.state, 2);
    for (const secret of ["oidc-secret", "sonarr-key", "media-server-key", "cid"]) assert.equal(text.includes(secret), false, secret);
  } finally {
    server.close();
  }
});

test("setup-only server checks are refused once JellyGlance is configured", async () => {
  const app = express();
  app.use(express.json());
  app.use("/auth", authRouter);
  const server = app.listen(0);
  try {
    const { port } = server.address();
    for (const route of ["test-jellyfin", "configSetup"]) {
      const response = await fetch(`http://127.0.0.1:${port}/auth/${route}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ JF_HOST: "http://127.0.0.1:9", JF_API_KEY: "x" }),
      });
      assert.equal(response.status, 403, route);
    }
  } finally {
    server.close();
  }
});
