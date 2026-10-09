#!/usr/bin/env node
// Writes the downloadable Homarr widget files for the website
// (public/widgets in https://github.com/JellyGlance/Website) from the same
// widget pack the app uses, so the two can't drift apart.
//   node scripts/widget-files.mjs --out <Website checkout>/public/widgets          # regenerate
//   node scripts/widget-files.mjs --out <Website checkout>/public/widgets --check  # fail if any file is out of date
import fs from "node:fs";
import path from "node:path";
import { WIDGET_PACK, DEFAULT_WIDGET_HOST, homarrFromPack, prettyJson } from "../apps/web/src/lib/widgetSnippets.js";

const outIndex = process.argv.indexOf("--out");
if (!(outIndex > 0 && process.argv[outIndex + 1])) {
  console.error("Pass --out <dir>, e.g. a JellyGlance/Website checkout's public/widgets folder.");
  process.exit(2);
}
const dir = path.resolve(process.argv[outIndex + 1]);
const check = process.argv.includes("--check");

const stale = [];
for (const widget of WIDGET_PACK) {
  const file = path.join(dir, widget.filename);
  const expected = prettyJson(homarrFromPack(DEFAULT_WIDGET_HOST, widget));
  let current = null;
  try {
    current = fs.readFileSync(file, "utf8");
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
  if (current === expected) continue;
  stale.push(widget.filename);
  if (!check) fs.writeFileSync(file, expected);
}

const known = new Set(WIDGET_PACK.map((widget) => widget.filename));
const orphans = fs.readdirSync(dir).filter((name) => name.endsWith(".json") && !known.has(name));

if (check) {
  if (stale.length || orphans.length) {
    if (stale.length) console.error(`Out of date widget files (run npm run widgets:sync): ${stale.join(", ")}`);
    if (orphans.length) console.error(`Widget files with no matching widget: ${orphans.join(", ")}`);
    process.exit(1);
  }
  console.log(`All ${WIDGET_PACK.length} widget files are up to date.`);
} else {
  console.log(stale.length ? `Updated ${stale.length} widget files.` : "Widget files already up to date.");
  if (orphans.length) console.warn(`Widget files with no matching widget: ${orphans.join(", ")}`);
}
