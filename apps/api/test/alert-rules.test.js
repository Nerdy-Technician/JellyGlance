const test = require("node:test");
const assert = require("node:assert/strict");
const rules = require("../classes/alert-rules");

const at = (hour) => new Date(2026, 8, 30, hour, 15);

test("normalizeRules fills defaults and clamps bad input", () => {
  const [rule] = rules.normalizeRules([{ metric: "nope", op: "??", value: "-5", from: 3, to: 3, severity: "loud" }]);
  assert.equal(rule.metric, "active_streams");
  assert.equal(rule.op, "gt");
  assert.equal(rule.value, 0);
  assert.equal(rule.from, null, "a zero-length window means any time");
  assert.equal(rule.severity, "warning");
  assert.equal(rule.enabled, true);
  assert.ok(rule.id);
});

test("normalizeRules caps the number of rules", () => {
  const many = Array.from({ length: 40 }, (_, i) => ({ id: `r${i}` }));
  assert.equal(rules.normalizeRules(many).length, rules.CATALOG.maxRules);
  assert.deepEqual(rules.normalizeRules("junk"), []);
});

test("inWindow handles same-day and overnight windows", () => {
  const day = { from: 9, to: 17 };
  assert.equal(rules.inWindow(day, at(9)), true);
  assert.equal(rules.inWindow(day, at(17)), false);
  const night = { from: 23, to: 5 };
  assert.equal(rules.inWindow(night, at(23)), true);
  assert.equal(rules.inWindow(night, at(2)), true);
  assert.equal(rules.inWindow(night, at(5)), false);
  assert.equal(rules.inWindow(night, at(12)), false);
  assert.equal(rules.inWindow({ from: null, to: null }, at(12)), true);
});

test("collectMetrics reduces sessions, disks and downloads", () => {
  const sessions = [
    { UserName: "sam", NowPlayingItem: {}, PlayState: { PlayMethod: "Transcode" }, TranscodingInfo: { Bitrate: 8_000_000 } },
    { UserName: "sam", NowPlayingItem: { MediaStreams: [{ Type: "Video", BitRate: 20_000_000 }, { Type: "Audio", BitRate: 640_000 }, { Type: "Subtitle", BitRate: 99 }] }, PlayState: { PlayMethod: "DirectPlay" } },
    { UserName: "alex", NowPlayingItem: {}, PlayState: { PlayMethod: "DirectStream" } },
    { UserName: "idle" },
  ];
  const disks = [
    { path: "/media", totalSpace: 1000, freeSpace: 300 },
    { path: "/downloads", label: "Downloads", totalSpace: 1000, freeSpace: 45 },
    { path: "/broken", totalSpace: 0, freeSpace: 0 },
  ];
  const metrics = rules.collectMetrics({ sessions, disks, downloads: [1, 2, 3] });
  assert.equal(metrics.active_streams, 3);
  assert.equal(metrics.transcodes, 1);
  assert.equal(metrics.user_streams, 2);
  assert.equal(metrics.user_streams_who, "sam");
  assert.equal(metrics.bandwidth_mbps, 28.6);
  assert.equal(metrics.disk_free_percent, 4.5);
  assert.equal(metrics.disk_free_percent_who, "Downloads");
  assert.equal(metrics.download_queue, 3);
});

test("collectMetrics leaves metrics undefined when an input is missing", () => {
  const metrics = rules.collectMetrics({ sessions: undefined, disks: [], downloads: undefined });
  assert.equal(metrics.active_streams, undefined);
  assert.equal(metrics.disk_free_percent, undefined);
  assert.equal(metrics.download_queue, undefined);
});

test("evaluateRules fires only matching, enabled, in-window rules", () => {
  const list = [
    { id: "late", name: "Late-night streaming", metric: "active_streams", op: "gt", value: 0, from: 1, to: 5, severity: "info" },
    { id: "tx", metric: "transcodes", op: "gte", value: 3 },
    { id: "share", metric: "user_streams", op: "gte", value: 2 },
    { id: "off", metric: "active_streams", op: "gt", value: 0, enabled: false },
    { id: "disk", metric: "disk_free_percent", op: "lt", value: 10 },
  ];
  const metrics = { active_streams: 2, transcodes: 1, user_streams: 2, user_streams_who: "sam" };

  const night = rules.evaluateRules(list, metrics, at(2));
  assert.deepEqual(night.map((alert) => alert.key).sort(), ["rule:late", "rule:share"]);
  const late = night.find((alert) => alert.key === "rule:late");
  assert.equal(late.title, "Late-night streaming");
  assert.equal(late.severity, "info");
  assert.equal(late.alertType, "custom_rule");

  const noon = rules.evaluateRules(list, metrics, at(12));
  assert.deepEqual(noon.map((alert) => alert.key), ["rule:share"]);
  assert.match(noon[0].message, /\(sam\)/);
});

test("neededInputs only asks for what enabled rules use", () => {
  const needs = rules.neededInputs([
    { metric: "transcodes" },
    { metric: "download_queue", enabled: false },
    { metric: "disk_free_percent" },
  ]);
  assert.deepEqual([...needs].sort(), ["disks", "sessions"]);
});
