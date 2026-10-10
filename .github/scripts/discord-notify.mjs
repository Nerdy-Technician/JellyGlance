import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const DISCORD_LIMIT = 4096;
const __dirname = path.dirname(fileURLToPath(import.meta.url));
// JellyGlance Bot branding, shared by every Discord embed.
const BRAND_RED = 0xc90000; // brand / alerts / failures
const CHARCOAL = 0x1e1e1e; // neutral accent (info, updates, dependency bots)
const SUCCESS_GREEN = 0x2ecc71;
const WARN_AMBER = 0xf0b429;
const BRAND = BRAND_RED;
const ISSUE_BLUE = 0x5b9cff;
const BETA_AMBER = WARN_AMBER;
const REPO_URL = "https://github.com/Nerdy-Technician/JellyGlance";
const LOGO_URL =
  "https://raw.githubusercontent.com/Nerdy-Technician/JellyGlance/main/.github/assets/icon-b-192.png";

/** Webhook identity: "JellyGlance Bot" or one of its sub-bots, always with the logo. */
function botIdentity(name = "JellyGlance Bot") {
  return { username: name, avatar_url: LOGO_URL };
}

/** Consistent footer on every embed. */
function brandFooter(extra = "") {
  return {
    text: extra ? `JellyGlance Bot · ${extra}` : "JellyGlance Bot · jellyglance.com",
    icon_url: LOGO_URL,
  };
}

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

async function postDiscord(webhookUrl, rawPayload, files = []) {
  const payload = {
    ...botIdentity(),
    ...rawPayload,
    // Embeds may contain @names from GitHub; never turn them into Discord pings.
    allowed_mentions: { parse: [] },
  };
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
    ...botIdentity(isBeta ? "JellyGlance Release Bot · Beta" : "JellyGlance Release Bot"),
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
            value: `[Release notes](${url}) · [Docs](https://jellyglance.com/) · [Docker](https://github.com/JellyGlance/Server/pkgs/container/server)`,
            inline: false,
          },
        ],
        footer: brandFooter(),
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
  const action = optionalEnv("ISSUE_ACTION", "opened");
  const stateReason = optionalEnv("ISSUE_STATE_REASON", "");
  const actor = optionalEnv("ISSUE_ACTOR", "");
  const rawAuthor = optionalEnv("ISSUE_AUTHOR", "someone");
  const author = rawAuthor.replace(/\[bot\]$/, "");
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
  const isSecurityAlert = labels.includes("security-alert");

  // Alert issues start with their own heading; the embed already has one.
  const text = isSecurityAlert ? stripToText(body).replace(/^#{1,6}\s.*\n*/, "") : stripToText(body);
  const excerpt = trimDescription(text || "No description provided.", isSecurityAlert ? 700 : 1200);

  let heading = "🐛 New issue";
  let color = ISSUE_BLUE;
  let description = excerpt;
  if (isSecurityAlert) {
    heading = action === "closed" ? "✅ Security alert resolved" : "🚨 Security alert";
    color = action === "closed" ? SUCCESS_GREEN : BRAND_RED;
  } else if (action === "closed") {
    const notPlanned = stateReason === "not_planned";
    heading = notPlanned ? "🚫 Issue closed (not planned)" : "✅ Issue closed";
    color = notPlanned ? CHARCOAL : SUCCESS_GREEN;
    description = actor ? `Closed by [@${actor}](https://github.com/${actor}).` : "Issue closed.";
  } else if (action === "reopened") {
    heading = "🔁 Issue reopened";
    color = WARN_AMBER;
  }

  await postDiscord(webhook, {
    ...botIdentity(isSecurityAlert ? "JellyGlance Security Bot" : "JellyGlance Bot"),
    embeds: [
      {
        color,
        author: {
          name: `${heading} · @${author}`,
          url: authorUrl,
          icon_url: authorAvatar,
        },
        title: trimDescription(number ? `#${number} · ${title}` : title, 250),
        url: url || undefined,
        description,
        fields: [
          { name: "Author", value: `[@${author}](${authorUrl})`, inline: true },
          { name: "Labels", value: labelText, inline: true },
          ...(url
            ? [{ name: "Issue", value: `[Open on GitHub](${url})`, inline: false }]
            : []),
        ],
        footer: brandFooter(isSecurityAlert ? "Security alerts" : "Issues"),
        timestamp: new Date().toISOString(),
      },
    ],
  });
}

function isDependencyBot(login, head) {
  return /renovate|dependabot|security-bot/i.test(login || "") || /^(renovate|dependabot)\//.test(head || "");
}

async function sendPullRequest() {
  const webhook = requireEnv("DISCORD_WEBHOOK_URL");
  const title = optionalEnv("PR_TITLE", "Pull request");
  const url = optionalEnv("PR_URL", "");
  const number = optionalEnv("PR_NUMBER", "");
  const author = optionalEnv("PR_AUTHOR", "someone");
  const authorAvatar = optionalEnv("PR_AUTHOR_AVATAR", `https://github.com/${author}.png?size=128`);
  const base = optionalEnv("PR_BASE", "main");
  const head = optionalEnv("PR_HEAD", "");
  const labels = optionalEnv("PR_LABELS", "");
  const body = stripToText(optionalEnv("PR_BODY", ""));
  const action = optionalEnv("PR_ACTION", "opened");
  const merged = optionalEnv("PR_MERGED", "") === "true";
  const mergedBy = optionalEnv("PR_MERGED_BY", "");
  const actor = optionalEnv("PR_ACTOR", "");
  const commits = optionalEnv("PR_COMMITS", "");
  const additions = optionalEnv("PR_ADDITIONS", "");
  const deletions = optionalEnv("PR_DELETIONS", "");
  const draft = optionalEnv("PR_DRAFT", "") === "true";
  const depBot = isDependencyBot(author, head);
  const authorLabel = author.replace(/\[bot\]$/, "");

  let status = "Opened";
  let emoji = depBot ? "📦" : "🆕";
  let color = depBot ? CHARCOAL : BRAND_RED;
  let description = trimDescription(body || "No description provided.", 700);

  if (action === "closed" && merged) {
    status = "Merged";
    emoji = "🎉";
    color = SUCCESS_GREEN;
    description = mergedBy
      ? `Merged into \`${base}\` by [@${mergedBy}](https://github.com/${mergedBy}).`
      : `Merged into \`${base}\`.`;
  } else if (action === "closed") {
    status = "Closed";
    emoji = "🚫";
    color = CHARCOAL;
    description = actor ? `Closed without merging by [@${actor}](https://github.com/${actor}).` : "Closed without merging.";
  } else if (action === "synchronize") {
    status = "Updated";
    emoji = "🔄";
    color = CHARCOAL;
    description = `New commits pushed to \`${head}\`.`;
  } else if (action === "reopened") {
    status = "Reopened";
    emoji = "🔁";
    color = WARN_AMBER;
  } else if (action === "ready_for_review") {
    status = "Ready for review";
    emoji = "👀";
  }
  if (draft && action !== "closed") status += " · draft";

  const fields = [
    { name: "Status", value: status, inline: true },
    { name: "Author", value: `[@${authorLabel}](https://github.com/${author.replace(/\[bot\]$/, "")})`, inline: true },
  ];
  if (commits || additions || deletions) {
    fields.push({
      name: "Size",
      value: `${commits ? `${commits} commit${commits === "1" ? "" : "s"} · ` : ""}+${additions || 0} / −${deletions || 0}`,
      inline: true,
    });
  }
  fields.push({ name: "Branch", value: `\`${head}\` → \`${base}\``, inline: false });
  fields.push({
    name: "Labels",
    value: labels
      ? labels
          .split(",")
          .map((l) => `\`${l.trim()}\``)
          .join(" ")
      : "_none_",
    inline: false,
  });

  await postDiscord(webhook, {
    ...botIdentity(depBot ? "JellyGlance Security Bot · Renovate" : "JellyGlance Bot"),
    embeds: [
      {
        color,
        author: { name: `${emoji} PR ${status.toLowerCase()} · @${authorLabel}`, icon_url: authorAvatar },
        title: trimDescription(`#${number} · ${title}`, 250),
        url: url || undefined,
        description,
        fields,
        footer: brandFooter(depBot ? "Dependency updates" : "Pull requests"),
        timestamp: new Date().toISOString(),
      },
    ],
  });
}

/**
 * Workflow result (Check Bot, Build Bot, or any workflow failing on main).
 * WORKFLOW_KIND: ci | build | failure
 */
async function sendWorkflow() {
  const webhook = requireEnv("DISCORD_WEBHOOK_URL");
  const kind = optionalEnv("WORKFLOW_KIND", "failure");
  const workflowName = optionalEnv("WORKFLOW_NAME", "Workflow");
  const workflowUrl = optionalEnv("WORKFLOW_URL", "");
  const conclusion = optionalEnv("CONCLUSION", "unknown");
  const branch = optionalEnv("BRANCH", "");
  const sha = (optionalEnv("SHA", "") || "").slice(0, 7);
  const trigger = optionalEnv("TRIGGER_EVENT", "unknown");
  const displayTitle = optionalEnv("DISPLAY_TITLE", "");
  const actor = optionalEnv("ACTOR", "");
  const prNumber = optionalEnv("PR_NUMBER", "");
  const prUrl = optionalEnv("PR_URL", "");
  const attempt = optionalEnv("RUN_ATTEMPT", "");

  const states = {
    success: { label: "Passed", emoji: "✅", color: SUCCESS_GREEN },
    failure: { label: "Failed", emoji: "❌", color: BRAND_RED },
    cancelled: { label: "Cancelled", emoji: "⏹️", color: WARN_AMBER },
    timed_out: { label: "Timed out", emoji: "⏱️", color: BRAND_RED },
    startup_failure: { label: "Startup failure", emoji: "💥", color: BRAND_RED },
  };
  const state = states[conclusion] || {
    label: conclusion.replace(/_/g, " ") || "Completed",
    emoji: "ℹ️",
    color: CHARCOAL,
  };

  const identity = {
    ci: "JellyGlance Check Bot",
    build: "JellyGlance Build Bot",
    failure: "JellyGlance Bot",
  }[kind] || "JellyGlance Bot";
  const checks = {
    ci: "Quality · Secrets · Security · Compatibility",
    build: "Docker build (multi-arch, no push)",
  }[kind];
  const description = {
    ci: `JellyGlance Check Bot ${state.label.toLowerCase()}.`,
    build: "A JellyGlance Build Bot workflow did not pass.",
    failure: `**${workflowName}** ${state.label.toLowerCase()} on \`${branch || "main"}\`. This usually needs a look.`,
  }[kind];

  const fields = [
    { name: "Status", value: `${state.emoji} ${state.label}`, inline: true },
    { name: "Trigger", value: trigger, inline: true },
    { name: "Branch", value: branch ? `\`${branch}\`` : "(unknown)", inline: true },
  ];
  if (sha) fields.push({ name: "Commit", value: `[\`${sha}\`](${REPO_URL}/commit/${optionalEnv("SHA", "")})`, inline: true });
  if (actor) fields.push({ name: "Actor", value: `[@${actor.replace(/\[bot\]$/, "")}](https://github.com/${actor.replace(/\[bot\]$/, "")})`, inline: true });
  if (attempt && attempt !== "1") fields.push({ name: "Attempt", value: attempt, inline: true });
  if (prNumber && prUrl) {
    fields.push({ name: "Pull request", value: `[#${prNumber}](${prUrl})`, inline: false });
  } else if (displayTitle) {
    fields.push({ name: "Run", value: trimDescription(displayTitle, 250), inline: false });
  }
  if (checks) fields.push({ name: "Checks", value: checks, inline: false });
  fields.push({
    name: "Actions",
    value: workflowUrl ? `[View workflow run](${workflowUrl})` : "(no link)",
    inline: false,
  });

  await postDiscord(webhook, {
    ...botIdentity(identity),
    embeds: [
      {
        color: state.color,
        title: `${state.emoji} ${workflowName} · ${state.label}`,
        url: workflowUrl || undefined,
        description,
        fields,
        footer: brandFooter(kind === "failure" ? "Workflow alerts" : "CI"),
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
  let color = CHARCOAL;
  let title = "🛡️ Security scan finished";

  if (conclusion === "failure") {
    statusLabel = "Findings / failed";
    color = BRAND_RED;
    title = "🚨 Security scan found issues";
  } else if (conclusion === "success") {
    statusLabel = "Clean";
    color = SUCCESS_GREEN;
    title = "✅ Security scan clean";
  } else if (conclusion === "cancelled") {
    statusLabel = "Cancelled";
    color = WARN_AMBER;
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
    ...botIdentity("JellyGlance Security Bot"),
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
        footer: brandFooter(),
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
    ...botIdentity("JellyGlance Security Bot"),
    embeds: [
      {
        color: BRAND_RED,
        title: "🔐 Secrets scan failed",
        url: workflowUrl || undefined,
        description:
          "Gitleaks (or the tracked-secret file guard) failed. Rotate anything that leaked and scrub history if needed.",
        fields,
        footer: brandFooter(),
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
    footer: brandFooter(),
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
        ...botIdentity(),
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
} else if (type === "pull_request") {
  await sendPullRequest();
} else if (type === "workflow") {
  await sendWorkflow();
} else {
  throw new Error(`Unsupported DISCORD_EVENT_TYPE: ${type}`);
}
