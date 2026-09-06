import { existsSync, readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const REPO = "Nerdy-Technician/JellyGlance";
const API_URL = `https://api.github.com/repos/${REPO}/releases`;
const ATOM_URL = `https://github.com/${REPO}/releases.atom`;
const RELEASES_URL = `https://github.com/${REPO}/releases`;
const USER_AGENT = "JellyGlance-docs";
const REQUEST_TIMEOUT_MS = 8000;

const configDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(configDir, "../..");
const rootPackage = JSON.parse(readFileSync(resolve(repoRoot, "package.json"), "utf8"));
const packageVersion = String(rootPackage.version || "").replace(/-.+$/, "") || "0.0.0";

const STABLE_FILES = [".github/release.md", ".github/RELEASE"];
const BETA_FILES = [".github/release-beta.md", ".github/RELEASE.beta", ".github/RELEASE.BETA"];

function githubToken() {
  return process.env.GITHUB_TOKEN || process.env.GH_TOKEN || "";
}

function githubHeaders() {
  const headers = {
    Accept: "application/vnd.github+json",
    "User-Agent": USER_AGENT
  };
  const token = githubToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  return headers;
}

function decodeEntities(value = "") {
  return String(value)
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, "&");
}

function stripTags(value = "") {
  return decodeEntities(value)
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/<\/p>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function parseVersion(value = "") {
  const raw = String(value).trim().replace(/^v/i, "");
  const [core = "0.0.0", pre = ""] = raw.split("-");
  const [major = 0, minor = 0, patch = 0] = core.split(".").map((part) => Number.parseInt(part, 10) || 0);
  return { raw, major, minor, patch, pre, tagged: `v${raw}` };
}

export function compareVersions(left, right) {
  const a = parseVersion(left);
  const b = parseVersion(right);
  if (a.major !== b.major) return a.major - b.major;
  if (a.minor !== b.minor) return a.minor - b.minor;
  if (a.patch !== b.patch) return a.patch - b.patch;
  if (!a.pre && b.pre) return 1;
  if (a.pre && !b.pre) return -1;
  return a.pre.localeCompare(b.pre, undefined, { numeric: true });
}

function isPrereleaseTag(value = "") {
  return Boolean(parseVersion(value).pre);
}

function normalizeRelease(entry) {
  const version = String(entry.version || "").trim();
  if (!version) return null;
  const tagged = version.startsWith("v") ? version : `v${version}`;
  const body = entry.body || "";
  return {
    version: tagged,
    name: entry.name || `JellyGlance ${tagged}`,
    url: entry.url || `${RELEASES_URL}/tag/${tagged}`,
    publishedAt: entry.publishedAt || null,
    body,
    prerelease: Boolean(entry.prerelease || isPrereleaseTag(tagged)),
    sections: parseReleaseNotes(body)
  };
}

function parseMarkdownNotes(body = "") {
  const sections = [];
  let current = { title: "Notes", items: [] };

  body
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .forEach((line) => {
      const heading = line.match(/^#{1,4}\s+(.+)/);
      if (heading) {
        if (current.items.length) sections.push(current);
        current = { title: heading[1].replace(/[*_`]/g, ""), items: [] };
        return;
      }

      const table = line.match(/^\|\s*(.+?)\s*\|\s*(.+?)\s*\|$/);
      if (table && !/^\s*:?-+:?\s*$/.test(table[1])) {
        const label = table[1].replace(/[*_`]/g, "").trim();
        const detail = table[2].replace(/[*_`]/g, "").trim();
        if (label && detail) current.items.push(`${label} — ${detail}`);
        return;
      }

      const item = line.replace(/^[-*]\s+/, "").replace(/^`([^`]+)`$/, "$1");
      if (item && item !== line) current.items.push(item);
    });

  if (current.items.length) sections.push(current);
  return sections.slice(0, 8).map((section) => ({
    title: section.title,
    items: section.items.slice(0, 12)
  }));
}

function parseHtmlNotes(html = "") {
  const sections = [];
  const parts = html.split(/<h2\b[^>]*>/i).slice(1);

  for (const part of parts) {
    const titleMatch = part.match(/^([\s\S]*?)<\/h2>/i);
    if (!titleMatch) continue;
    const title = stripTags(titleMatch[1]);
    if (!title) continue;
    const rest = part.slice(titleMatch[0].length);
    const items = [];

    for (const row of rest.matchAll(/<tr\b[^>]*>[\s\S]*?<\/tr>/gi)) {
      const cells = [...row[0].matchAll(/<t[dh]\b[^>]*>([\s\S]*?)<\/t[dh]>/gi)]
        .map((cell) => stripTags(cell[1]))
        .filter(Boolean);
      if (cells.length >= 2) items.push(`${cells[0]} — ${cells[1]}`);
      else if (cells.length === 1) items.push(cells[0]);
    }

    for (const item of rest.matchAll(/<li\b[^>]*>([\s\S]*?)<\/li>/gi)) {
      const text = stripTags(item[1]);
      if (text) items.push(text);
    }

    if (items.length) sections.push({ title, items: items.slice(0, 12) });
  }

  return sections.slice(0, 8);
}

export function parseReleaseNotes(body = "") {
  const decoded = decodeEntities(body);
  const markdown = parseMarkdownNotes(decoded);
  const html = /<[a-z][\s\S]*>/i.test(decoded) ? parseHtmlNotes(decoded) : [];
  return html.length > markdown.length ? html : markdown;
}

function readReleaseFile(relativePath) {
  const filePath = resolve(repoRoot, relativePath);
  if (!existsSync(filePath)) return null;

  const raw = readFileSync(filePath, "utf8").replace(/\r\n/g, "\n");
  const parts = raw.split(/^---\s*$/m);
  const header = parts.shift() || "";
  const body = parts.join("---").trim();
  const meta = {};

  for (const line of header.split("\n")) {
    const match = line.match(/^([A-Za-z_][A-Za-z0-9_-]*)\s*:\s*(.+)$/);
    if (match) meta[match[1].toLowerCase()] = match[2].trim();
  }

  const version = String(meta.version || "").trim();
  if (!version) return null;

  return normalizeRelease({
    version,
    name: meta.title || `JellyGlance ${version}`,
    url: `${RELEASES_URL}/tag/${version.startsWith("v") ? version : `v${version}`}`,
    publishedAt: null,
    body,
    prerelease: isPrereleaseTag(version)
  });
}

function bestFileRelease(paths) {
  return paths
    .map(readReleaseFile)
    .filter(Boolean)
    .sort((left, right) => compareVersions(right.version, left.version))[0] || null;
}

function localGitReleases() {
  try {
    const output = execFileSync("git", ["tag", "--sort=-v:refname"], {
      cwd: repoRoot,
      encoding: "utf8"
    });
    return output
      .split("\n")
      .map((tag) => tag.trim())
      .filter((tag) => /^v?\d+\.\d+/.test(tag))
      .map((tag) =>
        normalizeRelease({
          version: tag,
          name: `JellyGlance ${tag.startsWith("v") ? tag : `v${tag}`}`,
          url: `${RELEASES_URL}/tag/${tag.startsWith("v") ? tag : `v${tag}`}`,
          publishedAt: null,
          body: "",
          prerelease: isPrereleaseTag(tag)
        })
      )
      .filter(Boolean);
  } catch {
    return [];
  }
}

function withFileBody(release) {
  if (!release || release.body) return release;
  const files = release.prerelease ? BETA_FILES : STABLE_FILES;
  for (const path of files) {
    const file = readReleaseFile(path);
    if (file && compareVersions(file.version, release.version) === 0) {
      return { ...release, body: file.body, sections: file.sections, name: file.name || release.name };
    }
  }
  return release;
}

function pickStable(releases) {
  return releases
    .filter((release) => !release.prerelease)
    .sort((left, right) => compareVersions(right.version, left.version))[0] || null;
}

function pickNewerBeta(releases, stable) {
  return releases
    .filter((release) => release.prerelease)
    .filter((release) => !stable || compareVersions(release.version, stable.version) > 0)
    .sort((left, right) => compareVersions(right.version, left.version))[0] || null;
}

function emptyBeta() {
  return {
    version: "",
    name: "",
    url: RELEASES_URL,
    publishedAt: null,
    body: "",
    prerelease: true,
    sections: []
  };
}

function fileFallbackPair() {
  const stable = bestFileRelease(STABLE_FILES) || normalizeRelease({
    version: `v${packageVersion}`,
    name: `JellyGlance v${packageVersion}`,
    url: `${RELEASES_URL}/latest`,
    body: "Release notes are loaded from the latest GitHub release when the documentation site is built."
  });
  const beta = pickNewerBeta([bestFileRelease(BETA_FILES)].filter(Boolean), stable);
  return { latestRelease: stable, latestBetaRelease: beta || emptyBeta() };
}

async function fetchApiReleases() {
  const response = await fetch(API_URL, {
    headers: githubHeaders(),
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS)
  });
  if (!response.ok) {
    throw new Error(`GitHub releases request failed: ${response.status}`);
  }
  const releases = await response.json();
  return releases
    .filter((entry) => !entry.draft)
    .map((entry) =>
      normalizeRelease({
        version: entry.tag_name,
        name: entry.name || entry.tag_name,
        url: entry.html_url,
        publishedAt: entry.published_at || entry.created_at || null,
        body: entry.body || "",
        prerelease: Boolean(entry.prerelease)
      })
    )
    .filter(Boolean);
}

async function fetchAtomReleases() {
  const response = await fetch(ATOM_URL, {
    headers: { Accept: "application/atom+xml", "User-Agent": USER_AGENT },
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS)
  });
  if (!response.ok) {
    throw new Error(`GitHub releases feed failed: ${response.status}`);
  }

  const xml = await response.text();
  const entries = [];
  const blocks = xml.match(/<entry>[\s\S]*?<\/entry>/g) || [];

  for (const block of blocks) {
    const id = block.match(/<id>([^<]+)<\/id>/)?.[1] || "";
    const title = stripTags(block.match(/<title[^>]*>([\s\S]*?)<\/title>/)?.[1] || "");
    const url = block.match(/<link[^>]+href="([^"]+)"/)?.[1] || "";
    const updated = block.match(/<updated>([^<]+)<\/updated>/)?.[1] || null;
    const content = decodeEntities(block.match(/<content[^>]*>([\s\S]*?)<\/content>/)?.[1] || "");
    const tag = id.match(/\/(v?\d[\w.-]*)$/)?.[1] || url.match(/\/tag\/(v?[\d][\w.-]*)/)?.[1];
    if (!tag) continue;
    entries.push(
      normalizeRelease({
        version: tag,
        name: title || `JellyGlance ${tag}`,
        url: url || `${RELEASES_URL}/tag/${tag}`,
        publishedAt: updated,
        body: content,
        prerelease: isPrereleaseTag(tag)
      })
    );
  }

  if (!entries.length) {
    throw new Error("GitHub releases feed had no entries");
  }

  return entries;
}

function pairFromList(releases) {
  const stable = withFileBody(pickStable(releases));
  const beta = withFileBody(pickNewerBeta(releases, stable));
  if (!stable) return fileFallbackPair();
  return {
    latestRelease: stable,
    latestBetaRelease: beta || emptyBeta()
  };
}

export async function getDocsReleases() {
  try {
    return pairFromList(await fetchApiReleases());
  } catch (error) {
    console.warn(`[docs] GitHub releases API failed, trying public feed: ${error.message}`);
  }

  try {
    return pairFromList(await fetchAtomReleases());
  } catch (error) {
    console.warn(`[docs] GitHub releases feed failed, trying local tags: ${error.message}`);
  }

  const tags = localGitReleases();
  if (tags.length) {
    return pairFromList(tags);
  }

  console.warn("[docs] Using release file fallback");
  return fileFallbackPair();
}
