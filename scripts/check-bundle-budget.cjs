#!/usr/bin/env node
/**
 * Compare Vite build output against apps/web/bundle-budget.json.
 * Usage:
 *   node scripts/check-bundle-budget.cjs          # verify (CI)
 *   node scripts/check-bundle-budget.cjs --update # refresh baseline from current build
 */
const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");
const dist = path.join(root, "apps", "web", "dist", "assets");
const budgetPath = path.join(root, "apps", "web", "bundle-budget.json");
const updateMode = process.argv.includes("--update");

function readBudget() {
  if (!fs.existsSync(budgetPath)) {
    return { entryChunkMaxBytes: 460800, tolerancePercent: 20 };
  }
  return JSON.parse(fs.readFileSync(budgetPath, "utf8"));
}

function findEntryChunks(files) {
  const entryCandidates = files.filter((name) => /^index-.*\.js$/.test(name) || /^main-.*\.js$/.test(name));
  if (entryCandidates.length) return entryCandidates;
  return files
    .map((name) => ({ name, size: fs.statSync(path.join(dist, name)).size }))
    .sort((a, b) => b.size - a.size)
    .slice(0, 1)
    .map((item) => item.name);
}

function main() {
  if (!fs.existsSync(dist)) {
    console.error("Bundle budget check failed: apps/web/dist/assets not found. Run npm run build first.");
    process.exit(1);
  }

  const files = fs.readdirSync(dist).filter((name) => name.endsWith(".js"));
  const targets = findEntryChunks(files);
  if (!targets.length) {
    console.error("Bundle budget check failed: no JS chunks found in dist/assets.");
    process.exit(1);
  }

  const measured = {};
  for (const file of targets) {
    measured[file] = fs.statSync(path.join(dist, file)).size;
  }

  const budget = readBudget();
  const tolerance = Number(budget.tolerancePercent || 0) / 100;
  const limit = Math.floor(Number(budget.entryChunkMaxBytes || 0) * (1 + tolerance));

  if (updateMode) {
    const largest = Math.max(...Object.values(measured));
    const next = {
      ...budget,
      entryChunkMaxBytes: largest,
      measuredAt: new Date().toISOString(),
      entryChunks: measured,
    };
    fs.writeFileSync(budgetPath, `${JSON.stringify(next, null, 2)}\n`);
    console.log(`Updated bundle budget baseline to ${(largest / 1024).toFixed(1)} KiB (${Object.keys(measured).join(", ")})`);
    return;
  }

  let failed = false;
  for (const [file, size] of Object.entries(measured)) {
    console.log(`${file}: ${(size / 1024).toFixed(1)} KiB (limit ${(limit / 1024).toFixed(1)} KiB incl. ${budget.tolerancePercent || 0}% tolerance)`);
    if (size > limit) {
      console.error(`Bundle budget exceeded for ${file}: ${size} > ${limit}`);
      failed = true;
    }
  }

  if (failed) {
    console.error("If the increase is intentional, run: npm run bundle:budget:update -w @jellyglance/web");
    process.exit(1);
  }
}

main();
