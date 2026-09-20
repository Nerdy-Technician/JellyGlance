import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const DISCORD_LIMIT = 4096;
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BRAND = 0xaa5cc3;
const ISSUE_BLUE = 0x5b9cff;
const BETA_AMBER = 0xf0b429;

function requireEnv(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} is required`);
  }
  return value;
}

function optionalEnv(name, fallback = "") {
  return process.env[name] || fallback;
}

function trimDescription(value, limit = DISCORD_LIMIT) {
  if (!value || value.length <= limit) return value || "";
  return `${value.slice(0, limit - 28).trim()}\n\n…read more on GitHub`;
}

/** Light cleanup so release notes read cleanly in Discord (plain text, not HTML). */
function stripToText(raw) {
  if (!raw) return "";
  let s = String(raw).replace(/\r\n/g, "\n");

  // Drop HTML comments until stable (avoids incomplete <!-- leftovers).
  for (let i = 0; i < 8; i++) {
    const next = s.replace(/<!--[\s\S]*?-->/g, "");
    if (next === s) break;
    s = next;
  }

  s = s
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<\/div>/gi, "\n")
    .replace(/<\/h[1-6]>/gi, "\n")
    .replace(/<summary[^>]*>\s*<b>([\s\S]*?)<\/b>[^<]*/gi, "$1")
    .replace(/<summary[^>]*>([\s\S]*?)<\/summary>/gi, "$1\n")
    .replace(/<details[^>]*>/gi, "")
    .replace(/<\/details>/gi, "\n")
    .replace(/<li[^>]*>/gi, "• ")
    .replace(/<\/li>/gi, "\n")
    .replace(/<(?:ul|ol)[^>]*>/gi, "")
    .replace(/<\/(?:ul|ol)>/gi, "\n")
    .replace(/<blockquote[^>]*>/gi, "")
    .replace(/<\/blockquote>/gi, "\n")
    .replace(/<a[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi, "$2")
    .replace(/<(strong|b)>([\s\S]*?)<\/\1>/gi, "$2")
    .replace(/<(em|i)>([\s\S]*?)<\/\1>/gi, "$2")
    .replace(/<code>([\s\S]*?)<\/code>/gi, "`$1`")
    .replace(/<img[^>]*>/gi, "")
    .replace(/<hr\s*\/?>/gi, "\n");

  // Strip remaining tags until stable, then remove leftover angle brackets
  // so incomplete fragments like "<script" cannot survive.
  for (let i = 0; i < 8; i++) {
    const next = s.replace(/<\/?[a-zA-Z][^>]*>/g, "");
    if (next === s) break;
    s = next;
  }
  s = s.replace(/[<>]/g, "");

  // Normalize a few safe entities only. Do NOT decode &amp; → & —
  // CodeQL flags that as double-unescape, and Discord is plain text anyway.
  s = s
    .replace(/&nbsp;/gi, " ")
    .replace(/&quot;/gi, '"')
    .replace(/&#0*39;/g, "'")
    .replace(/&apos;/gi, "'")
    .replace(/&lt;/gi, "")
    .replace(/&gt;/gi, "")
    .replace(/&amp;/gi, " and ")
    .replace(/!\[[^\]]*\]\([^)]+\)/g, "")
    .replace(/\|[^\n]*\|/g, "")
    .replace(/^[\t ]+$/gm, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  return s;
}

/** Compact Discord digest — highlight + up to a few bullets, not the full notes. */
function compactReleaseNotes(raw, { maxChars = 700, maxBullets = 5 } = {}) {
  const text = stripToText(raw);
  if (!text) return "";

  const lines = text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  // Highlight: prefer a Note: line, else first decent sentence.
  let highlight = "";
  for (const line of lines) {
    const plain = line.replace(/^>+\s*/, "").replace(/\*+/g, "").trim();
    if (/^note:/i.test(plain) && plain.length > 40) {
      highlight = plain.replace(/^note:\s*/i, "");
      break;
    }
  }
  if (!highlight) {
    for (const line of lines) {
      if (/^#{1,6}\s/.test(line)) continue;
      if (/^[•\-*]\s/.test(line)) continue;
      if (/^(fixed|changed|added|new|full changelog|api keys|widget api)/i.test(line)) continue;
      const plain = line.replace(/^>+\s*/, "").replace(/\*+/g, "").trim();
      if (plain.length < 40) continue;
      highlight = plain;
      break;
    }
  }

  const bullets = [];
  for (const line of lines) {
    if (!/^[•\-*]\s/.test(line)) continue;
    const item = line
      .replace(/^([•\-*]\s*)/, "• ")
      .replace(/\*+/g, "")
      .replace(/\s{2,}/g, " ")
      .trim();
    if (item.length < 12) continue;
    if (highlight && item.slice(2).includes(highlight.slice(0, 32))) continue;
    bullets.push(item);
    if (bullets.length >= maxBullets) break;
  }

  if (!bullets.length) {
    for (const line of lines) {
      const plain = line.replace(/\*+/g, "").trim();
      if (/^(api keys|widget api|homarr|settings &|fixed|changed|added)/i.test(plain)) {
        bullets.push(`• ${plain}`);
      }
      if (bullets.length >= maxBullets) break;
    }
  }

  const parts = [];
  if (highlight) parts.push(highlight);
  if (bullets.length) parts.push(bullets.join("\n"));
  let out = parts.join("\n\n").trim();
  if (out.length > maxChars) {
    out = `${out.slice(0, maxChars - 1).trim()}…`;
  }
  return out;
}

async function postDiscord(webhookUrl, payload, files = []) {
  if (!files.length) {
    const response = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Discord webhook failed with ${response.status}: ${text}`);
    }
    return;
  }

  const form = new FormData();
  form.append("payload_json", JSON.stringify(payload));
  for (const [index, file] of files.entries()) {
    const bytes = fs.readFileSync(file.path);
    form.append(
      `files[${index}]`,
      new Blob([bytes], { type: file.type || "image/png" }),
      file.name,
    );
  }

  const response = await fetch(webhookUrl, {
    method: "POST",
    body: form,
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Discord webhook failed with ${response.status}: ${text}`);
  }
}

async function sendRelease() {
  const webhook = requireEnv("DISCORD_WEBHOOK_URL");
  const tag = requireEnv("RELEASE_TAG");
  const title = optionalEnv("RELEASE_TITLE", tag);
  const url = optionalEnv(
    "RELEASE_URL",
    `https://github.com/Nerdy-Technician/JellyGlance/releases/tag/${tag}`,
  );
  const channel = optionalEnv("DISCORD_CHANNEL", "stable").toLowerCase();
  const isBeta = channel === "beta" || optionalEnv("RELEASE_PRERELEASE", "") === "true";
  const notes = compactReleaseNotes(optionalEnv("RELEASE_NOTES", ""), {
    maxChars: Number(optionalEnv("RELEASE_NOTES_MAX", "700")) || 700,
    maxBullets: Number(optionalEnv("RELEASE_NOTES_BULLETS", "5")) || 5,
  });

  const displayTitle = title && title !== tag ? title : `JellyGlance ${tag}`;
  const dockerTag = isBeta ? tag : "latest";
  const dockerImage = `\`ghcr.io/nerdy-technician/jellyglance:${dockerTag}\``;

  await postDiscord(webhook, {
    username: isBeta ? "JellyGlance Beta" : "JellyGlance Releases",
    embeds: [
      {
        color: isBeta ? BETA_AMBER : BRAND,
        title: isBeta ? `🧪 Beta ${tag}` : `🚀 ${displayTitle}`,
        url,
        description:
          notes ||
          (isBeta
            ? "A new JellyGlance **beta** build is available."
            : "A new JellyGlance release is available."),
        fields: [
          { name: "Version", value: `\`${tag}\``, inline: true },
          { name: "Channel", value: isBeta ? "Beta" : "Stable", inline: true },
          { name: "Docker", value: dockerImage, inline: false },
          {
            name: "Links",
            value: `[Release notes](${url}) · [Docs](https://jellyglance.com/) · [Docker](https://github.com/Nerdy-Technician/JellyGlance/pkgs/container/jellyglance)`,
            inline: false,
          },
        ],
        footer: { text: "jellyglance.com" },
        timestamp: new Date().toISOString(),
      },
    ],
  });
}

async function sendIssue() {
  const webhook = requireEnv("DISCORD_WEBHOOK_URL");
  const title = optionalEnv("ISSUE_TITLE", "New issue");
  const url = optionalEnv("ISSUE_URL", "");
  const number = optionalEnv("ISSUE_NUMBER", "");
  const author = optionalEnv("ISSUE_AUTHOR", "someone");
  const authorUrl = optionalEnv("ISSUE_AUTHOR_URL", `https://github.com/${author}`);
  const authorAvatar = optionalEnv(
    "ISSUE_AUTHOR_AVATAR",
    `https://github.com/${author}.png?size=128`,
  );
  const labelsRaw = optionalEnv("ISSUE_LABELS", "");
  const body = optionalEnv("ISSUE_BODY", "").trim();

  const labels = labelsRaw
    .split(",")
    .map((label) => label.trim())
    .filter(Boolean);
  const labelText = labels.length
    ? labels.map((label) => `\`${label}\``).join(" ")
    : "_none_";

  const excerpt = trimDescription(
    body.replace(/\r\n/g, "\n").replace(/\n{3,}/g, "\n\n") || "No description provided.",
    1200,
  );

  await postDiscord(webhook, {
    username: "JellyGlance Issues",
    embeds: [
      {
        color: ISSUE_BLUE,
        author: {
          name: `@${author}`,
          url: authorUrl,
          icon_url: authorAvatar,
        },
        title: number ? `#${number} · ${title}` : title,
        url: url || undefined,
        description: excerpt,
        fields: [
          { name: "Author", value: `[@${author}](${authorUrl})`, inline: true },
          { name: "Labels", value: labelText, inline: true },
          ...(url
            ? [{ name: "Issue", value: `[Open on GitHub](${url})`, inline: false }]
            : []),
        ],
        footer: { text: "jellyglance.com" },
        timestamp: new Date().toISOString(),
      },
    ],
  });
}


async function sendSecurity() {
  const webhook = requireEnv("DISCORD_WEBHOOK_URL");
  const conclusion = optionalEnv("CONCLUSION", "unknown");
  const workflowUrl = optionalEnv("WORKFLOW_URL", "");
  const branch = optionalEnv("BRANCH", "");
  const sha = (optionalEnv("SHA", "") || "").slice(0, 7);
  const trigger = optionalEnv("TRIGGER_EVENT", "unknown");
  const displayTitle = optionalEnv("DISPLAY_TITLE", "Security");
  const summary = optionalEnv("SECURITY_SUMMARY", "");

  let statusLabel = "Completed";
  let color = 0x95a5a6;
  let title = "🛡️ Security scan finished";

  if (conclusion === "failure") {
    statusLabel = "Findings / failed";
    color = 0xe74c3c;
    title = "🚨 Security scan found issues";
  } else if (conclusion === "success") {
    statusLabel = "Clean";
    color = 0x2ecc71;
    title = "✅ Security scan clean";
  } else if (conclusion === "cancelled") {
    statusLabel = "Cancelled";
    color = 0xf39c12;
    title = "🛡️ Security scan cancelled";
  }

  const fields = [
    { name: "Status", value: statusLabel, inline: true },
    { name: "Trigger", value: trigger, inline: true },
    { name: "Branch", value: branch ? `\`${branch}\`` : "(unknown)", inline: true },
  ];
  if (sha) fields.push({ name: "Commit", value: `\`${sha}\``, inline: true });
  if (summary) {
    fields.push({ name: "Summary", value: summary.slice(0, 1000), inline: false });
  }
  if (workflowUrl) {
    fields.push({ name: "Run", value: `[Open workflow](${workflowUrl})`, inline: false });
  }
  fields.push({
    name: "Security tab",
    value: "[Code scanning / Dependabot](https://github.com/Nerdy-Technician/JellyGlance/security)",
    inline: false,
  });

  await postDiscord(webhook, {
    username: "JellyGlance Security",
    embeds: [
      {
        color,
        title,
        url: workflowUrl || undefined,
        description:
          conclusion === "failure"
            ? "CodeQL, Trivy, or OSV reported problems. Check the workflow run and the GitHub Security tab."
            : displayTitle || "Security workflow finished.",
        fields,
        footer: { text: "jellyglance.com" },
        timestamp: new Date().toISOString(),
      },
    ],
  });
}


async function sendSecrets() {
  const webhook = requireEnv("DISCORD_WEBHOOK_URL");
  const workflowUrl = optionalEnv("WORKFLOW_URL", "");
  const branch = optionalEnv("BRANCH", "");
  const sha = (optionalEnv("SHA", "") || "").slice(0, 7);
  const prNumber = optionalEnv("PR_NUMBER", "");
  const prUrl = optionalEnv("PR_URL", "");

  const fields = [
    { name: "Check", value: "Gitleaks / secrets", inline: true },
    { name: "Branch", value: branch ? `\`${branch}\`` : "(unknown)", inline: true },
  ];
  if (sha) fields.push({ name: "Commit", value: `\`${sha}\``, inline: true });
  if (prNumber && prUrl) {
    fields.push({ name: "Pull request", value: `[#${prNumber}](${prUrl})`, inline: false });
  }
  if (workflowUrl) {
    fields.push({ name: "Run", value: `[Open workflow](${workflowUrl})`, inline: false });
  }

  await postDiscord(webhook, {
    username: "JellyGlance Security",
    embeds: [
      {
        color: 0xe74c3c,
        title: "🔐 Secrets scan failed",
        url: workflowUrl || undefined,
        description:
          "Gitleaks (or the tracked-secret file guard) failed. Rotate anything that leaked and scrub history if needed.",
        fields,
        footer: { text: "jellyglance.com" },
        timestamp: new Date().toISOString(),
      },
    ],
  });
}

function normalizeStarUser(entry) {
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
  };
}

function usersFromUnknown(parsed, source) {
  if (!Array.isArray(parsed)) {
    console.log(`${source} was ${typeof parsed}, expected an array`);
    return [];
  }
  const users = parsed.map(normalizeStarUser).filter(Boolean);
  if (parsed.length && !users.length) {
    const sample = parsed[0] && typeof parsed[0] === "object" ? Object.keys(parsed[0]).join(",") : typeof parsed[0];
    console.log(`${source} had ${parsed.length} row(s) but none had a login (sample keys: ${sample})`);
  }
  return users;
}

function parseStarUsers() {
  const usersFile = optionalEnv("STAR_USERS_FILE", "").trim();
  if (usersFile) {
    try {
      const parsed = JSON.parse(fs.readFileSync(usersFile, "utf8"));
      const users = usersFromUnknown(parsed, `STAR_USERS_FILE=${usersFile}`);
      console.log(`Parsed ${users.length} stargazer(s) from STAR_USERS_FILE=${usersFile}`);
      return users;
    } catch (error) {
      console.log(`Unable to read STAR_USERS_FILE (${usersFile}): ${error.message}`);
    }
  }

  const rawJson = optionalEnv("STAR_USERS_JSON", "").trim();
  if (rawJson) {
    try {
      const users = usersFromUnknown(JSON.parse(rawJson), "STAR_USERS_JSON");
      console.log(`Parsed ${users.length} stargazer(s) from STAR_USERS_JSON`);
      return users;
    } catch (error) {
      console.log(`Unable to parse STAR_USERS_JSON: ${error.message}`);
    }
  }

  const starUsers = optionalEnv("STAR_USERS", "");
  const fromMarkdown = starUsers
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean)
    .map((entry) => {
      const match = entry.match(/\[@([^\]]+)\]\(([^)]+)\)/);
      if (!match) return null;
      return {
        login: match[1],
        html_url: match[2],
        avatar_url: `https://github.com/${match[1]}.png`,
      };
    })
    .filter(Boolean);
  if (starUsers.trim() && !fromMarkdown.length) {
    console.log("STAR_USERS was non-empty but no [@login](url) entries parsed");
  } else if (fromMarkdown.length) {
    console.log(`Parsed ${fromMarkdown.length} stargazer(s) from STAR_USERS markdown`);
  }
  return fromMarkdown;
}

function buildRosterImage(users) {
  const builder = path.join(__dirname, "build-star-roster.py");
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "jg-stars-"));
  const jsonPath = path.join(tmpDir, "users.json");
  const pngPath = path.join(tmpDir, "roster.png");
  fs.writeFileSync(jsonPath, JSON.stringify(users));

  const result = spawnSync("python3", [builder, jsonPath, pngPath], {
    encoding: "utf8",
  });
  if (result.status !== 0) {
    throw new Error(result.stderr || result.stdout || "roster build failed");
  }
  if (!fs.existsSync(pngPath)) {
    throw new Error("roster PNG was not created");
  }
  return { pngPath, tmpDir };
}

async function sendStars() {
  const dryRun = optionalEnv("DISCORD_DRY_RUN", "") === "1";
  const webhook = dryRun ? optionalEnv("DISCORD_WEBHOOK_URL", "") : requireEnv("DISCORD_WEBHOOK_URL");
  const current = Number(requireEnv("STAR_COUNT"));
  const previous = Number(optionalEnv("PREVIOUS_STAR_COUNT", "0"));
  const gained = Math.max(0, current - previous);
  const repoUrl = optionalEnv("REPOSITORY_URL", "https://github.com/Nerdy-Technician/JellyGlance");
  const users = parseStarUsers();
  console.log(`Star notify: ${previous} → ${current} (gained=${gained}), users=${users.length}`);
  if (gained > 0 && users.length === 0) {
    console.log("WARNING: posting star digest without resolved profiles");
  }
  const title =
    gained > 1
      ? `⭐ ${gained} new GitHub stars`
      : users[0]
        ? `⭐ @${users[0].login} starred JellyGlance`
        : "⭐ JellyGlance gained a new star";

  const listLines = users.length
    ? users.map((user) => `[@${user.login}](${user.html_url})`).join(" · ")
    : "_No stargazer profiles resolved._";

  const embed = {
    color: BRAND,
    title,
    url: `${repoUrl}/stargazers`,
    description: `**${current}** stars total  ·  ${previous} → ${current}\n${listLines}`,
    footer: { text: "jellyglance.com" },
    timestamp: new Date().toISOString(),
  };

  let files = [];
  let tmpDir = "";
  try {
    if (users.length) {
      const roster = buildRosterImage(users);
      tmpDir = roster.tmpDir;
      embed.image = { url: "attachment://roster.png" };
      files = [{ path: roster.pngPath, name: "roster.png", type: "image/png" }];
    }

    if (dryRun) {
      const rosterOut = optionalEnv("STAR_ROSTER_OUT", "");
      if (rosterOut && files[0]) {
        fs.mkdirSync(path.dirname(rosterOut), { recursive: true });
        fs.copyFileSync(files[0].path, rosterOut);
        console.log(`DRY RUN roster=${rosterOut}`);
      }
      console.log(`DRY RUN title=${title}`);
      console.log(`DRY RUN description=\n${embed.description}`);
      return;
    }

    await postDiscord(
      webhook,
      {
        username: "JellyGlance Stars",
        embeds: [embed],
      },
      files,
    );
  } finally {
    if (tmpDir) {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  }
}

const type = requireEnv("DISCORD_EVENT_TYPE");

if (type === "release") {
  await sendRelease();
} else if (type === "issue") {
  await sendIssue();
} else if (type === "stars") {
  await sendStars();
} else if (type === "security") {
  await sendSecurity();
} else if (type === "secrets") {
  await sendSecrets();
} else {
  throw new Error(`Unsupported DISCORD_EVENT_TYPE: ${type}`);
}
