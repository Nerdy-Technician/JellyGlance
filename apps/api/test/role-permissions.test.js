const test = require("node:test");
const assert = require("node:assert/strict");
const roles = require("../classes/role-permissions");
const { normalizeApiKeyScope, isWidgetWriteScope } = require("../classes/api-key-scope");

test("Owner and Disabled ignore stored overrides", () => {
  const settings = { rolePermissions: { Owner: { settings: false }, Disabled: { dashboard: true } } };
  assert.equal(roles.getRolePermissions(settings, "Owner").settings, true);
  assert.equal(roles.getRolePermissions(settings, "Disabled").dashboard, false);
});

test("unknown roles fall back to Viewer permissions", () => {
  const perms = roles.getRolePermissions({}, "Mystery");
  assert.equal(perms.settings, false);
  assert.equal(perms.dashboard, true);
});

test("persistRolePermissions only accepts known keys and coerces to booleans", () => {
  const next = roles.persistRolePermissions("Viewer", { settings: 1, hacker: true });
  assert.equal(next.settings, true);
  assert.equal("hacker" in next, false);
});

test("normalizeAccessRoles inserts Household before Viewer", () => {
  assert.deepEqual(roles.normalizeAccessRoles({ roles: ["Owner", "Viewer", "Disabled"] }), ["Owner", "Household", "Viewer", "Disabled"]);
  assert.deepEqual(roles.normalizeAccessRoles({ roles: ["Owner"] }), ["Owner", "Household"]);
});

test("API key scopes normalise and default to full", () => {
  assert.equal(normalizeApiKeyScope("WIDGETS_WRITE"), "widgets-write");
  assert.equal(normalizeApiKeyScope("widgets"), "widgets");
  assert.equal(normalizeApiKeyScope("admin"), "full");
  assert.equal(normalizeApiKeyScope("admin", { fallback: "widgets" }), "widgets");
  assert.equal(isWidgetWriteScope("widgets-write"), true);
  assert.equal(isWidgetWriteScope("full"), false);
});
