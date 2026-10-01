const test = require("node:test");
const assert = require("node:assert/strict");
const { clientSettings, publicAuth, CLIENT_HIDDEN_SETTINGS } = require("../classes/client-config");

const stored = {
  time_format: "24h",
  notifications: { position: "bottom-right" },
  roles: ["Owner", "Viewer"],
  auth: {
    mode: "oidc",
    label: "OIDC / Authentik",
    clientId: "public-client-id",
    clientSecret: "super-secret-value",
    discovery: { issuer: "https://auth.example", token_endpoint: "https://auth.example/token" },
  },
  Integrations: { arrApps: [{ slug: "sonarr", values: { url: "http://sonarr", secret: "sonarr-key" } }] },
  Newsletter: { smtp: { host: "smtp.example", password: "smtp-pass" } },
  localUsers: [{ username: "sam", passwordHash: "scrypt$abc" }],
  AdminAuditLog: [{ action: "login" }],
  UserPreferences: { sam: { theme: "dark" } },
};

test("clientSettings removes every server-only setting", () => {
  const out = clientSettings(stored);
  for (const key of CLIENT_HIDDEN_SETTINGS) assert.equal(key in out, false, `${key} should be hidden`);
  assert.equal(out.time_format, "24h");
  assert.deepEqual(out.notifications, { position: "bottom-right" });
  assert.deepEqual(out.roles, ["Owner", "Viewer"]);
});

test("clientSettings strips secrets from auth at any depth", () => {
  const text = JSON.stringify(clientSettings(stored));
  for (const secret of ["super-secret-value", "sonarr-key", "smtp-pass", "scrypt$abc"]) assert.equal(text.includes(secret), false, secret);
  const out = clientSettings(stored);
  assert.equal(out.auth.clientId, "public-client-id");
  assert.equal(out.auth.discovery.issuer, "https://auth.example");
  assert.equal("clientSecret" in out.auth, false);
});

test("clientSettings does not modify the stored settings", () => {
  clientSettings(stored);
  assert.equal(stored.auth.clientSecret, "super-secret-value");
  assert.ok(stored.Integrations);
});

test("publicAuth only exposes mode and label", () => {
  assert.deepEqual(publicAuth(stored.auth), { mode: "oidc", label: "OIDC / Authentik" });
  assert.deepEqual(publicAuth({ mode: "local", username: "sam" }), { mode: "local" });
  assert.equal(publicAuth(null), null);
  assert.equal(publicAuth({}), null);
});
