// Regression cover for #79: a burst of webhook-triggered refreshes must not crash
// the process or leak pool clients when REFRESH MATERIALIZED VIEW fails.
const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");

const state = { connects: 0, releases: 0, refreshes: 0, failView: null, delayMs: 0 };

class FakePool {
  on() {}
  async query(text) {
    if (String(text).includes(";")) return [{ rows: [] }, { rows: [] }];
    return { rows: [{ total: "42", Name: "007" }] };
  }
  async connect() {
    state.connects += 1;
    return {
      async query(sql) {
        const text = typeof sql === "string" ? sql : sql.text;
        if (!text.startsWith("REFRESH")) return { rows: [] };
        state.refreshes += 1;
        if (state.delayMs) await new Promise((resolve) => setTimeout(resolve, state.delayMs));
        if (state.failView && text.includes(state.failView)) throw new Error("could not refresh");
        return { rows: [] };
      },
      release() {
        state.releases += 1;
      },
    };
  }
}

process.env.POSTGRES_USER = "test";
process.env.POSTGRES_PASSWORD = "test";
process.env.POSTGRES_IP = "127.0.0.1";
process.env.POSTGRES_PORT = "5432";
require("pg").Pool = FakePool; // db.js destructures Pool at load time
const db = require(path.join(__dirname, "..", "db"));

function reset() {
  Object.assign(state, { connects: 0, releases: 0, refreshes: 0, failView: null, delayMs: 0 });
}

test("a failing refresh reports an error instead of throwing and releases its client", async () => {
  reset();
  state.failView = db.materializedViews[0];
  const result = await db.refreshMaterializedView(db.materializedViews[0]);
  assert.equal(result.Result, "ERROR");
  assert.match(result.message, /could not refresh/);
  assert.equal(state.releases, state.connects);
});

test("a failing view does not stop the rest of the batch", async () => {
  reset();
  state.failView = db.materializedViews[0];
  const originalError = console.error;
  console.error = () => {};
  try {
    await db.flushMaterializedViewRefreshes();
  } finally {
    console.error = originalError;
  }
  assert.equal(state.refreshes, db.materializedViews.length);
  assert.equal(state.releases, state.connects);
});

test("a burst of refresh requests coalesces into at most one follow-up batch", async () => {
  reset();
  state.delayMs = 5;
  await Promise.all(Array.from({ length: 25 }, () => db.flushMaterializedViewRefreshes()));
  assert.ok(state.refreshes <= db.materializedViews.length * 2, `ran ${state.refreshes} refreshes`);
  assert.equal(state.releases, state.connects);
});

test("db.query returns multi-statement results instead of failing on rows.map", async () => {
  const originalError = console.error;
  let logged = false;
  console.error = () => {
    logged = true;
  };
  try {
    const result = await db.query("CREATE TABLE a (id int); CREATE INDEX a_id ON a (id)");
    assert.ok(Array.isArray(result));
    assert.equal(result.length, 2);
    const single = await db.query("SELECT 1");
    assert.deepEqual(single.rows, [{ total: 42, Name: "007" }]);
  } finally {
    console.error = originalError;
  }
  assert.equal(logged, false);
});
