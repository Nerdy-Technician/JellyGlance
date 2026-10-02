const test = require("node:test");
const assert = require("node:assert/strict");

const originalLog = console.log;
console.log = () => {}; // db.js logs a warning when Postgres env vars are absent
const { buildSvg, renderWrappedCard } = require("../classes/wrapped-card");
console.log = originalLog;

const sample = {
  period: "week",
  start: "2026-09-21",
  end: "2026-09-27",
  year: 2026,
  userId: "u1",
  userName: "Sam <script>",
  totals: { plays: 12, seconds: 36000, titles: 9, active_days: 4 },
  topShows: [{ name: "Tom & Jerry", seconds: 7200, plays: 4 }],
  topMovies: [],
  longestBinge: null,
  genres: [],
  topClients: [],
  months: [],
  days: [{ day: "2026-09-23", seconds: 7200 }],
};

test("recap SVG escapes user-controlled text", () => {
  const svg = buildSvg(sample);
  assert.ok(svg.includes("Sam &lt;script&gt;"));
  assert.ok(svg.includes("Tom &amp; Jerry"));
  assert.ok(!svg.includes("<script>"));
});

test("week recap has one bar per day and year recap one per month", () => {
  const bars = (svg) => (svg.match(/fill="url\(#bar\)"/g) || []).length;
  assert.equal(bars(buildSvg(sample)), 7);
  assert.equal(bars(buildSvg({ ...sample, period: "year", start: "2026-01-01", end: "2026-12-31", months: [{ month: 3, seconds: 100 }] })), 12);
  assert.equal(bars(buildSvg({ ...sample, period: "month", start: "2026-02-01", end: "2026-02-28" })), 28);
});

test("recap card renders to a PNG", async () => {
  const png = await renderWrappedCard(sample);
  assert.deepEqual([...png.subarray(0, 8)], [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
});
