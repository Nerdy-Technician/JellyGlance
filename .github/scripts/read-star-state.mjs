import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";

const repo = process.env.REPO;
if (!repo || !repo.includes("/")) {
  throw new Error("REPO must be set to owner/name");
}
const [owner, name] = repo.split("/");
const stateDir = process.env.STAR_STATE_DIR || ".discord-star-state";
const usersFile = path.join(stateDir, "gained-users.json");
const stateFile = path.join(stateDir, "count.txt");

function log(message) {
  console.log(message);
}

function errorText(error) {
  return [error?.message, error?.stderr, error?.stdout].filter(Boolean).join("\n");
}

function isAuthError(error) {
  return /HTTP 401|HTTP 403|Resource not accessible|Requires authentication/i.test(errorText(error));
}

function ghJson(args, options = {}) {
  const raw = execFileSync("gh", args, {
    encoding: "utf8",
    ...options,
  });
  return JSON.parse(raw);
}

function normalizeUser(entry) {
  if (!entry || typeof entry !== "object") return null;
  const nested =
    (entry.user && typeof entry.user === "object" && entry.user) ||
    (entry.node && typeof entry.node === "object" && entry.node) ||
    null;
  const user = nested || entry;
  const login = user.login;
  if (!login) return null;
  return {
    login: String(login),
    html_url: user.html_url || user.url || `https://github.com/${login}`,
    avatar_url: user.avatar_url || user.avatarUrl || `https://github.com/${login}.png`,
    starred_at: entry.starred_at || entry.starredAt || user.starred_at || null,
  };
}

function uniqueUsers(entries) {
  const seen = new Set();
  const users = [];
  for (const entry of entries) {
    const user = normalizeUser(entry);
    if (!user || seen.has(user.login)) continue;
    seen.add(user.login);
    users.push(user);
  }
  return users;
}

function selectRecent(users, gained) {
  if (gained <= 0) return [];
  const withTime = users.filter((user) => user.starred_at);
  if (withTime.length) {
    return [...withTime]
      .sort((a, b) => new Date(b.starred_at || 0) - new Date(a.starred_at || 0))
      .slice(0, gained);
  }
  // Default REST list is oldest-first; the tail of the last page is newest.
  return users.slice(-gained).reverse();
}

function fetchGraphqlUsers(gained) {
  const users = [];
  let after = null;
  while (users.length < gained) {
    const first = Math.min(100, Math.max(gained - users.length, 1));
    const payload = ghJson(["api", "graphql", "--input", "-"], {
      input: JSON.stringify({
        query: `query($owner: String!, $name: String!, $first: Int!, $after: String) {
          repository(owner: $owner, name: $name) {
            stargazers(first: $first, after: $after, orderBy: { field: STARRED_AT, direction: DESC }) {
              pageInfo { hasNextPage endCursor }
              edges { starredAt node { login url avatarUrl } }
            }
          }
        }`,
        variables: { owner, name, first, after },
      }),
    });
    if (payload.errors?.length) {
      throw new Error(payload.errors.map((entry) => entry.message).join("; "));
    }
    const connection = payload?.data?.repository?.stargazers;
    const edges = connection?.edges;
    if (!Array.isArray(edges) || !edges.length) {
      log("GraphQL stargazers page returned no edges");
      break;
    }
    log(`GraphQL stargazers page: ${edges.length} edge(s) (after=${after || "start"})`);
    users.push(...uniqueUsers(edges));
    if (!connection.pageInfo?.hasNextPage) break;
    after = connection.pageInfo.endCursor;
    if (!after) break;
  }
  return users;
}

function fetchRestUsers(current, gained, withStarJson) {
  const lastPage = Math.max(1, Math.ceil(current / 100));
  const pageCount = Math.min(lastPage, Math.max(1, Math.ceil(gained / 100) + 1));
  const pages = [];
  for (let page = lastPage; page > lastPage - pageCount && page >= 1; page -= 1) {
    pages.push(page);
  }
  // Oldest-first REST pages: fetch low→high so slice(-gained) is newest when timestamps are missing.
  pages.sort((a, b) => a - b);

  const collected = [];
  for (const page of pages) {
    try {
      const args = ["api", `repos/${repo}/stargazers`, "-f", `per_page=100`, "-f", `page=${page}`];
      if (withStarJson) {
        args.push("-H", "Accept: application/vnd.github.star+json");
      }
      const data = ghJson(args);
      if (!Array.isArray(data)) {
        log(`REST stargazers page ${page} returned ${typeof data}, skipping`);
        continue;
      }
      if (data[0]) {
        log(`REST stargazers page ${page}: ${data.length} row(s); keys=${Object.keys(data[0]).join(",")}`);
      } else {
        log(`REST stargazers page ${page}: 0 rows`);
      }
      collected.push(...data);
    } catch (error) {
      log(`REST stargazers page ${page} failed (star+json=${withStarJson}): ${error.message}`);
      if (withStarJson && isAuthError(error)) {
        throw error;
      }
    }
  }
  return uniqueUsers(collected);
}

function appendOutput(name, value) {
  const dest = process.env.GITHUB_OUTPUT;
  if (!dest) return;
  fs.appendFileSync(dest, `${name}=${value}\n`);
}

function appendMultiline(name, value) {
  const dest = process.env.GITHUB_OUTPUT;
  if (!dest) return;
  fs.appendFileSync(dest, `${name}<<EOF\n${value}\nEOF\n`);
}

const repoData = ghJson(["api", `repos/${repo}`]);
const current = Number(repoData.stargazers_count || 0);
const hasState = fs.existsSync(stateFile);
let previous = current;
if (hasState) {
  previous = Number(fs.readFileSync(stateFile, "utf8").trim() || current);
}
if (process.env.STAR_PREVIOUS_OVERRIDE !== undefined && process.env.STAR_PREVIOUS_OVERRIDE !== "") {
  previous = Number(process.env.STAR_PREVIOUS_OVERRIDE);
}

const gained = Math.max(0, current - previous);
log(`Star delta: ${previous} → ${current} (gained=${gained}, has_state=${hasState})`);

let users = [];
if (gained > 0) {
  try {
    users = selectRecent(fetchGraphqlUsers(gained), gained);
    log(`GraphQL resolved ${users.length} stargazer(s)`);
  } catch (error) {
    log(`GraphQL stargazers failed: ${error.message}`);
    try {
      users = selectRecent(fetchRestUsers(current, gained, true), gained);
      log(`REST star+json resolved ${users.length} stargazer(s)`);
    } catch (starJsonError) {
      log(`REST star+json unavailable (${starJsonError.message}); trying default REST list`);
      try {
        users = selectRecent(fetchRestUsers(current, gained, false), gained);
        log(`REST default list resolved ${users.length} stargazer(s)`);
      } catch (restError) {
        log(`Unable to read stargazer users: ${restError.message}`);
      }
    }
  }

  if (gained > 0 && users.length === 0) {
    log("WARNING: star count increased but no stargazer profiles were resolved");
  } else if (users.length) {
    log(`Using ${users.length} stargazer(s): ${users.map((user) => `@${user.login}`).join(", ")}`);
  }
}

fs.mkdirSync(stateDir, { recursive: true });
const payload = users.map(({ login, html_url, avatar_url }) => ({ login, html_url, avatar_url }));
fs.writeFileSync(usersFile, `${JSON.stringify(payload, null, 2)}\n`);
log(`Wrote ${payload.length} user(s) to ${usersFile}`);

const usersMarkdown = payload.map((user) => `[@${user.login}](${user.html_url})`).join(", ");
appendOutput("current", String(current));
appendOutput("previous", String(previous));
appendOutput("changed", current > previous ? "true" : "false");
appendOutput("has_state", hasState ? "true" : "false");
appendOutput("users_file", usersFile);
appendOutput("user_count", String(payload.length));
appendOutput("users", usersMarkdown);
appendMultiline("users_json", JSON.stringify(payload));
