const PROJECT_OWNER = "Nerdy-Technician";
const PROJECT_NUMBER = 5;
const PROJECT_URL = `https://github.com/users/${PROJECT_OWNER}/projects/${PROJECT_NUMBER}`;
const USER_AGENT = "JellyGlance-docs";
const PAGE_SIZE = 100;
const REQUEST_TIMEOUT_MS = 8000;
const SHIPPED_LIMIT = 5;

const HIDDEN_STATUS_PATTERNS = [
  /^no status$/i,
  /^completed$/i,
  /^done$/i,
  /^shipped$/i,
  /pushed to main/i,
  /merged to main/i,
  /completed/i,
  /shipped/i
];

const PROJECT_QUERY = `
  query($login: String!, $number: Int!, $cursor: String) {
    user(login: $login) {
      projectV2(number: $number) {
        title
        url
        fields(first: 30) {
          nodes {
            ... on ProjectV2SingleSelectField {
              name
              options {
                name
                color
              }
            }
          }
        }
        items(first: ${PAGE_SIZE}, after: $cursor) {
          pageInfo {
            hasNextPage
            endCursor
          }
          nodes {
            content {
              ... on DraftIssue {
                title
              }
              ... on Issue {
                title
                url
                number
                closedAt
                updatedAt
                labels(first: 8) {
                  nodes {
                    name
                  }
                }
                repository {
                  nameWithOwner
                }
              }
              ... on PullRequest {
                title
                url
                number
                closedAt
                updatedAt
                labels(first: 8) {
                  nodes {
                    name
                  }
                }
                repository {
                  nameWithOwner
                }
              }
            }
            fieldValues(first: 20) {
              nodes {
                ... on ProjectV2ItemFieldSingleSelectValue {
                  name
                  field {
                    ... on ProjectV2SingleSelectField {
                      name
                    }
                  }
                }
              }
            }
          }
        }
      }
    }
  }
`;

export const fallbackRoadmap = {
  title: "JellyGlance Roadmap",
  url: PROJECT_URL,
  columns: [],
  shipped: [],
  fetched: false
};

const BROWSER_USER_AGENT =
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36";

function githubToken() {
  return process.env.GITHUB_TOKEN || process.env.GH_TOKEN || "";
}

function parseJsonScripts(html) {
  const scripts = [];
  const pattern = /<script type="application\/json"[^>]*>([\s\S]*?)<\/script>/g;
  let match;

  while ((match = pattern.exec(html))) {
    try {
      scripts.push(JSON.parse(match[1]));
    } catch {
      // Ignore non-JSON script payloads.
    }
  }

  return scripts;
}

function statusOptionsFromFields(fields) {
  const statusField = (fields || []).find((field) => field?.name === "Status" && Array.isArray(field.settings?.options));
  return (statusField?.settings?.options || [])
    .map((option) => ({ name: option.name, color: option.color || null }))
    .filter((option) => option.name);
}

function columnValue(node, columnId) {
  return (node?.memexProjectColumnValues || []).find((column) => column.memexProjectColumnId === columnId)?.value;
}

function labelsFromTitle(title) {
  const match = String(title || "").match(/^([a-z]+)(?:\(([^)]+)\))?\s*:/i);
  if (!match) return [];
  return [match[1], match[2]].filter(Boolean).map((label) => label.toLowerCase());
}

function labelsFromColumn(value) {
  if (!Array.isArray(value)) return [];
  return value.map((entry) => entry?.name || entry?.label || entry).filter(Boolean).map((label) => String(label).toLowerCase());
}

function uniqueLabels(...groups) {
  return [...new Set(groups.flat().filter(Boolean))];
}

function displayTitle(title, labels) {
  if (!labels.length) return title;
  return String(title).replace(/^[a-z]+(?:\([^)]+\))?\s*:\s*/i, "") || title;
}

function decorateItem(item, extraLabels = []) {
  const labels = uniqueLabels(labelsFromTitle(item.title), extraLabels).slice(0, 3);
  return {
    ...item,
    title: displayTitle(item.title, labels),
    labels
  };
}

function itemTimestamp(item) {
  return Date.parse(item.closedAt || item.updatedAt || 0) || 0;
}

function isShippedStatus(status) {
  const value = String(status || "").trim();
  if (!value || /^no status$/i.test(value)) return false;
  return isHiddenStatus(value);
}

function shippedItems(items) {
  return items
    .filter((item) => isShippedStatus(item.status))
    .sort((left, right) => itemTimestamp(right) - itemTimestamp(left))
    .slice(0, SHIPPED_LIMIT);
}

function normalizePublicItem(node, status) {
  const titleValue = columnValue(node, "Title");
  const repoValue = columnValue(node, "Repository");
  const title = titleValue?.title?.raw || titleValue?.title?.html;
  if (!title) return null;

  const number = Number.isInteger(titleValue?.number) ? titleValue.number : null;
  const repo = repoValue?.nameWithOwner || null;
  const kind = node.contentType === "PullRequest" ? "pull" : "issues";
  const url = node.content?.url || (repo && number ? `https://github.com/${repo}/${kind}/${number}` : PROJECT_URL);

  return decorateItem({
    title,
    url,
    number,
    repo,
    status,
    closedAt: node.issueClosedAt || null,
    updatedAt: node.updatedAt || null
  }, labelsFromColumn(columnValue(node, "Labels")));
}

function parsePublicProjectPage(html) {
  const scripts = parseJsonScripts(html);
  const fields = scripts.find((script) => Array.isArray(script) && script.some((field) => field?.name === "Status" && field?.dataType === "singleSelect"));
  const board = scripts.find((script) => script?.groups?.nodes && Array.isArray(script.groupedItems));

  if (!board) {
    throw new Error("Public project page did not include board data");
  }

  const groupNameById = new Map();
  for (const group of board.groups.nodes) {
    const name = group.groupMetadata?.name || (group.groupValue === "_noValue" ? "No Status" : group.groupValue);
    if (name) groupNameById.set(group.groupId, name);
  }

  const items = [];
  for (const group of board.groupedItems) {
    const status = groupNameById.get(group.groupId) || "No Status";
    for (const node of group.nodes || []) {
      const item = normalizePublicItem(node, status);
      if (item) items.push(item);
    }
  }

  const titleMatch = html.match(/<title>([^<]+)<\/title>/i);
  const title = titleMatch?.[1]?.replace(/\s*·\s*GitHub\s*$/i, "").replace(/\s*·\s*JellyGlance Roadmap\s*$/i, "").trim();

  return {
    title: title && title !== "GitHub" ? title : fallbackRoadmap.title,
    url: PROJECT_URL,
    columns: groupColumns({ fields: { nodes: [{ name: "Status", options: statusOptionsFromFields(fields) }] } }, items),
    shipped: shippedItems(items),
    fetched: true
  };
}

async function fetchPublicProjectPage() {
  const response = await fetch(PROJECT_URL, {
    headers: {
      Accept: "text/html",
      "User-Agent": BROWSER_USER_AGENT
    },
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS)
  });

  if (!response.ok) {
    throw new Error(`Public project page failed: ${response.status}`);
  }

  return parsePublicProjectPage(await response.text());
}

function isHiddenStatus(status) {
  const value = String(status || "").trim();
  if (!value) return true;
  return HIDDEN_STATUS_PATTERNS.some((pattern) => pattern.test(value));
}

function itemStatus(fieldValues = []) {
  for (const value of fieldValues) {
    if (value?.field?.name === "Status" && value.name) {
      return value.name;
    }
  }
  return "No Status";
}

function normalizeItem(node) {
  const content = node?.content;
  if (!content?.title) return null;

  return decorateItem({
    title: content.title,
    url: content.url || PROJECT_URL,
    number: Number.isInteger(content.number) ? content.number : null,
    repo: content.repository?.nameWithOwner || null,
    status: itemStatus(node.fieldValues?.nodes || []),
    closedAt: content.closedAt || null,
    updatedAt: content.updatedAt || null
  }, (content.labels?.nodes || []).map((label) => String(label.name || "").toLowerCase()).filter(Boolean));
}

function statusOrder(project) {
  const statusField = (project.fields?.nodes || []).find((field) => field?.name === "Status" && Array.isArray(field.options));
  return (statusField?.options || []).map((option) => option.name).filter((name) => name && name !== "No Status");
}

function statusColors(project) {
  const statusField = (project.fields?.nodes || []).find((field) => field?.name === "Status" && Array.isArray(field.options));
  const colors = {};

  for (const option of statusField?.options || []) {
    if (option?.name) colors[option.name] = option.color || null;
  }

  return colors;
}

function groupColumns(project, items) {
  const columns = new Map();
  const colors = statusColors(project);

  for (const name of statusOrder(project)) {
    if (isHiddenStatus(name)) continue;
    columns.set(name, { name, color: colors[name] || null, items: [] });
  }

  for (const item of items) {
    if (isHiddenStatus(item.status)) continue;
    if (!columns.has(item.status)) {
      columns.set(item.status, { name: item.status, color: colors[item.status] || null, items: [] });
    }
    columns.get(item.status).items.push(item);
  }

  return [...columns.values()];
}

async function graphql(token, cursor) {
  const response = await fetch("https://api.github.com/graphql", {
    method: "POST",
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      "User-Agent": USER_AGENT
    },
    body: JSON.stringify({
      query: PROJECT_QUERY,
      variables: {
        login: PROJECT_OWNER,
        number: PROJECT_NUMBER,
        cursor
      }
    }),
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS)
  });

  if (!response.ok) {
    throw new Error(`GitHub project request failed: ${response.status}`);
  }

  const payload = await response.json();
  if (payload.errors?.length) {
    throw new Error(payload.errors.map((error) => error.message).join("; "));
  }

  const project = payload.data?.user?.projectV2;
  if (!project) {
    throw new Error("GitHub project 5 was not found");
  }

  return project;
}

async function fetchProjectWithToken(token) {
  let cursor = null;
  let project = null;
  const items = [];

  do {
    project = await graphql(token, cursor);
    for (const node of project.items?.nodes || []) {
      const item = normalizeItem(node);
      if (item) items.push(item);
    }
    cursor = project.items?.pageInfo?.hasNextPage ? project.items.pageInfo.endCursor : null;
  } while (cursor);

  return {
    title: project.title || fallbackRoadmap.title,
    url: project.url || PROJECT_URL,
    columns: groupColumns(project, items),
    shipped: shippedItems(items),
    fetched: true
  };
}

export async function getRoadmapProject() {
  const token = githubToken();

  if (token) {
    try {
      return await fetchProjectWithToken(token);
    } catch (error) {
      console.warn(`[docs] GitHub project GraphQL failed, trying public page: ${error.message}`);
    }
  }

  try {
    return await fetchPublicProjectPage();
  } catch (error) {
    console.warn(`[docs] Using empty GitHub project roadmap: ${error.message}`);
    return fallbackRoadmap;
  }
}
