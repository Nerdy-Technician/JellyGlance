const DISCORD_LIMIT = 4096;

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

function trimDescription(value) {
  if (!value || value.length <= DISCORD_LIMIT) return value || "";
  return `${value.slice(0, DISCORD_LIMIT - 24).trim()}\n\n...read more on GitHub`;
}

async function postDiscord(webhookUrl, payload) {
  const response = await fetch(webhookUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Discord webhook failed with ${response.status}: ${text}`);
  }
}

function buildBaseEmbed() {
  return {
    color: 0xaa5cc3,
    footer: {
      text: "JellyGlance",
      icon_url: "https://raw.githubusercontent.com/Nerdy-Technician/JellyGlance/main/docs/public/icon-b-192.png",
    },
    timestamp: new Date().toISOString(),
  };
}

async function sendRelease() {
  const webhook = requireEnv("DISCORD_WEBHOOK_URL");
  const tag = requireEnv("RELEASE_TAG");
  const title = optionalEnv("RELEASE_TITLE", `JellyGlance ${tag}`);
  const url = optionalEnv("RELEASE_URL", `https://github.com/Nerdy-Technician/JellyGlance/releases/tag/${tag}`);
  const notes = optionalEnv("RELEASE_NOTES", "");

  await postDiscord(webhook, {
    username: "JellyGlance Releases",
    avatar_url: "https://raw.githubusercontent.com/Nerdy-Technician/JellyGlance/main/docs/public/icon-b-192.png",
    embeds: [
      {
        ...buildBaseEmbed(),
        title: `New JellyGlance release: ${title}`,
        url,
        description: trimDescription(notes) || "A new JellyGlance release is available.",
        fields: [
          { name: "Version", value: tag, inline: true },
          { name: "Docker", value: "`ghcr.io/nerdy-technician/jellyglance:latest`", inline: true },
          { name: "Docs", value: "https://jellyglance.com/", inline: false },
        ],
      },
    ],
  });
}

async function sendStars() {
  const webhook = requireEnv("DISCORD_WEBHOOK_URL");
  const current = Number(requireEnv("STAR_COUNT"));
  const previous = Number(optionalEnv("PREVIOUS_STAR_COUNT", "0"));
  const gained = Math.max(0, current - previous);
  const repoUrl = optionalEnv("REPOSITORY_URL", "https://github.com/Nerdy-Technician/JellyGlance");

  await postDiscord(webhook, {
    username: "JellyGlance Stars",
    avatar_url: "https://raw.githubusercontent.com/Nerdy-Technician/JellyGlance/main/docs/public/icon-b-192.png",
    embeds: [
      {
        ...buildBaseEmbed(),
        title: gained > 1 ? `JellyGlance gained ${gained} new stars` : "JellyGlance gained a new star",
        url: `${repoUrl}/stargazers`,
        description: `JellyGlance now has **${current}** GitHub stars. Thanks for helping the project grow.`,
        fields: [
          { name: "Previous", value: String(previous), inline: true },
          { name: "Current", value: String(current), inline: true },
          { name: "Repository", value: repoUrl, inline: false },
        ],
      },
    ],
  });
}

const type = requireEnv("DISCORD_EVENT_TYPE");

if (type === "release") {
  await sendRelease();
} else if (type === "stars") {
  await sendStars();
} else {
  throw new Error(`Unsupported DISCORD_EVENT_TYPE: ${type}`);
}
