const REPO = "Nerdy-Technician/JellyGlance";
const USER_AGENT = "JellyGlance-docs";
const REQUEST_TIMEOUT_MS = 8000;
const REPO_URL = `https://github.com/${REPO}`;
const STARS_URL = `${REPO_URL}/stargazers`;
const DOWNLOADS_URL = `${REPO_URL}/pkgs/container/jellyglance`;

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

function parseCount(raw) {
  const text = String(raw || "").replace(/,/g, "").trim();
  const match = text.match(/^([\d.]+)\s*([kKmM])?$/);
  if (!match) return 0;
  const value = Number(match[1]);
  if (!Number.isFinite(value)) return 0;
  const suffix = (match[2] || "").toLowerCase();
  if (suffix === "k") return Math.round(value * 1000);
  if (suffix === "m") return Math.round(value * 1_000_000);
  return Math.round(value);
}

export function formatCount(value) {
  const count = Number(value) || 0;
  if (count >= 1_000_000) {
    const scaled = count / 1_000_000;
    return `${scaled >= 10 ? Math.round(scaled) : scaled.toFixed(1).replace(/\.0$/, "")}M`;
  }
  if (count >= 100_000) return `${Math.round(count / 1000)}k`;
  if (count >= 1000) return `${(count / 1000).toFixed(1).replace(/\.0$/, "")}k`;
  return String(count);
}

async function fetchStarsFromApi() {
  const response = await fetch(`https://api.github.com/repos/${REPO}`, {
    headers: githubHeaders(),
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS)
  });
  if (!response.ok) {
    throw new Error(`GitHub repo request failed: ${response.status}`);
  }
  const payload = await response.json();
  const stars = Number(payload.stargazers_count) || 0;
  if (!stars) throw new Error("GitHub repo had no star count");
  return stars;
}

async function fetchStarsFromPage() {
  const response = await fetch(REPO_URL, {
    headers: { Accept: "text/html", "User-Agent": USER_AGENT },
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS)
  });
  if (!response.ok) {
    throw new Error(`GitHub repo page failed: ${response.status}`);
  }
  const html = await response.text();
  const labeled = html.match(/([\d,.]+)\s+users?\s+starred this repository/i)?.[1];
  const counter = html.match(/id="repo-stars-counter-star"[^>]*>([^<]+)/i)?.[1];
  const stars = parseCount(labeled || counter);
  if (!stars) throw new Error("GitHub repo page had no star count");
  return stars;
}

async function fetchDownloadsFromPage() {
  const response = await fetch(DOWNLOADS_URL, {
    headers: { Accept: "text/html", "User-Agent": USER_AGENT },
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS)
  });
  if (!response.ok) {
    throw new Error(`GHCR package page failed: ${response.status}`);
  }
  const html = await response.text();
  const exact = html.match(/Total downloads<\/span>\s*<h3 title="(\d+)">/i)?.[1];
  const labeled = html.match(/Total downloads[\s\S]{0,120}?>\s*([0-9][0-9,]*(?:\.[0-9]+)?\s*[kKmM])\s*</i)?.[1];
  const downloads = parseCount(exact || labeled);
  if (!downloads) throw new Error("GHCR package page had no download count");
  return downloads;
}

const emptyStats = {
  stars: 0,
  downloads: 0,
  starsLabel: "Stars",
  downloadsLabel: "Download",
  starsUrl: STARS_URL,
  downloadsUrl: DOWNLOADS_URL
};

export async function getRepoStats() {
  let stars = 0;
  let downloads = 0;

  try {
    stars = await fetchStarsFromApi();
  } catch (error) {
    console.warn(`[docs] GitHub stars API failed, trying public page: ${error.message}`);
    try {
      stars = await fetchStarsFromPage();
    } catch (pageError) {
      console.warn(`[docs] GitHub stars page failed: ${pageError.message}`);
    }
  }

  try {
    downloads = await fetchDownloadsFromPage();
  } catch (error) {
    console.warn(`[docs] GHCR downloads failed: ${error.message}`);
  }

  return {
    stars,
    downloads,
    starsLabel: stars ? `${formatCount(stars)} stars` : "Stars",
    downloadsLabel: downloads ? `${formatCount(downloads)} downloads` : "Download",
    starsUrl: STARS_URL,
    downloadsUrl: DOWNLOADS_URL
  };
}
