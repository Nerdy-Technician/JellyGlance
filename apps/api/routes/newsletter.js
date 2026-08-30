const express = require("express");
const CryptoJS = require("crypto-js");
const nodemailer = require("nodemailer");
const fs = require("fs");
const path = require("path");
const db = require("../db");
const { addAuditEntry } = require("../classes/admin-history");
const campaigns = require("../classes/newsletter-campaigns");

const router = express.Router();
const HISTORY_LIMIT = 50;
const SETTINGS_KEY = "Newsletter";
const logoPath = path.join(__dirname, "..", "..", "web", "src", "pages", "images", "icon-b-512.png");

function secretKey() {
  return process.env.JWT_SECRET || process.env.POSTGRES_PASSWORD || "jellyglance-newsletter";
}

async function getSettings() {
  const { rows } = await db.query('SELECT settings FROM app_config where "ID"=1');
  return rows[0]?.settings || {};
}

async function saveSettings(settings) {
  await db.query('UPDATE app_config SET settings=$1 where "ID"=1', [settings]);
}

function defaultNewsletterSettings() {
  return {
    enabled: false,
    senderName: "JellyGlance",
    senderEmail: "",
    recipients: [],
    frequency: "manual",
    smtp: {
      host: "",
      port: 587,
      secure: false,
      username: "",
      password: "",
      rejectUnauthorized: true,
    },
    history: [],
  };
}

function decryptPassword(value) {
  if (!value) return "";
  try {
    const bytes = CryptoJS.AES.decrypt(value, secretKey());
    return bytes.toString(CryptoJS.enc.Utf8);
  } catch {
    return "";
  }
}

function publicSettings(settings) {
  const newsletter = {
    ...defaultNewsletterSettings(),
    ...(settings[SETTINGS_KEY] || {}),
    smtp: {
      ...defaultNewsletterSettings().smtp,
      ...((settings[SETTINGS_KEY] || {}).smtp || {}),
    },
  };

  return {
    ...newsletter,
    smtp: {
      ...newsletter.smtp,
      password: "",
      hasPassword: Boolean(newsletter.smtp.password),
    },
  };
}

function normalizeRecipients(value) {
  if (Array.isArray(value)) {
    return value.map((item) => String(item || "").trim()).filter(Boolean);
  }
  return String(value || "")
    .split(/[\n,;]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function validateEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || "").trim());
}

function mergeNewsletterSettings(existingSettings, incoming) {
  const current = {
    ...defaultNewsletterSettings(),
    ...(existingSettings[SETTINGS_KEY] || {}),
    smtp: {
      ...defaultNewsletterSettings().smtp,
      ...((existingSettings[SETTINGS_KEY] || {}).smtp || {}),
    },
  };

  const nextPassword =
    incoming.smtp?.password && String(incoming.smtp.password).trim()
      ? CryptoJS.AES.encrypt(String(incoming.smtp.password), secretKey()).toString()
      : current.smtp.password;

  return {
    ...current,
    enabled: Boolean(incoming.enabled),
    senderName: String(incoming.senderName || "JellyGlance").trim(),
    senderEmail: String(incoming.senderEmail || "").trim(),
    recipients: normalizeRecipients(incoming.recipients),
    frequency: ["manual", "weekly", "monthly"].includes(incoming.frequency) ? incoming.frequency : "manual",
    smtp: {
      host: String(incoming.smtp?.host || "").trim(),
      port: Number(incoming.smtp?.port || 587),
      secure: Boolean(incoming.smtp?.secure),
      username: String(incoming.smtp?.username || "").trim(),
      password: nextPassword,
      rejectUnauthorized: incoming.smtp?.rejectUnauthorized !== false,
    },
    history: Array.isArray(current.history) ? current.history.slice(0, HISTORY_LIMIT) : [],
  };
}

function validateSmtpSettings(newsletter) {
  if (!newsletter.smtp.host) return "SMTP host is required";
  if (!newsletter.smtp.port || Number(newsletter.smtp.port) <= 0) return "SMTP port is required";
  if (!newsletter.senderEmail || !validateEmail(newsletter.senderEmail)) return "A valid sender email is required";
  if (!decryptPassword(newsletter.smtp.password) && newsletter.smtp.username) return "SMTP password is required when a username is set";
  return "";
}

function createTransport(newsletter) {
  return nodemailer.createTransport({
    host: newsletter.smtp.host,
    port: Number(newsletter.smtp.port || 587),
    secure: Boolean(newsletter.smtp.secure),
    auth: newsletter.smtp.username
      ? {
          user: newsletter.smtp.username,
          pass: decryptPassword(newsletter.smtp.password),
        }
      : undefined,
    tls: {
      rejectUnauthorized: newsletter.smtp.rejectUnauthorized !== false,
    },
  });
}

function formatDate(value) {
  if (!value) return "Unknown";
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(value));
}

function formatWatchTime(seconds) {
  const hours = Math.round(Number(seconds || 0) / 3600);
  if (hours >= 1) return `${hours.toLocaleString()}h`;
  const minutes = Math.round(Number(seconds || 0) / 60);
  return `${minutes.toLocaleString()}m`;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function getLogoDataUri() {
  try {
    const logo = fs.readFileSync(logoPath);
    return `data:image/png;base64,${logo.toString("base64")}`;
  } catch {
    return "";
  }
}

async function buildNewsletterData() {
  const [recentlyAdded, topWatched, activeUsers, libraryIssues, repairHub] = await Promise.all([
    db.query(`
      SELECT "Id", "Name", "Type", "ProductionYear", "DateCreated"
      FROM jf_library_items
      WHERE archived = false
      ORDER BY "DateCreated" DESC NULLS LAST
      LIMIT 8
    `),
    db.query(`
      SELECT
        COALESCE(NULLIF("SeriesName", ''), NULLIF("NowPlayingItemName", ''), 'Unknown item') AS "Name",
        count(*)::int AS "Plays",
        COALESCE(sum("PlaybackDuration"), 0)::bigint AS "WatchSeconds"
      FROM jf_playback_activity
      WHERE "ActivityDateInserted" >= now() - interval '7 days'
      GROUP BY COALESCE(NULLIF("SeriesName", ''), NULLIF("NowPlayingItemName", ''), 'Unknown item')
      ORDER BY count(*) DESC, COALESCE(sum("PlaybackDuration"), 0) DESC
      LIMIT 6
    `),
    db.query(`
      SELECT
        COALESCE(NULLIF("UserName", ''), 'Unknown user') AS "Name",
        count(*)::int AS "Plays",
        COALESCE(sum("PlaybackDuration"), 0)::bigint AS "WatchSeconds"
      FROM jf_playback_activity
      WHERE "ActivityDateInserted" >= now() - interval '7 days'
      GROUP BY COALESCE(NULLIF("UserName", ''), 'Unknown user')
      ORDER BY count(*) DESC, COALESCE(sum("PlaybackDuration"), 0) DESC
      LIMIT 5
    `),
    db.query(`
      SELECT
        count(*) FILTER (WHERE COALESCE("PrimaryImageHash", '') = '')::int AS "MissingPosters",
        count(*) FILTER (WHERE COALESCE("ImageTagsLogo", '') = '')::int AS "MissingLogos",
        count(*) FILTER (WHERE COALESCE("RunTimeTicks", 0) = 0)::int AS "MissingRuntime"
      FROM jf_library_items
      WHERE archived = false
    `),
    db.query(`
      SELECT count(*)::int AS "UnmatchedImports"
      FROM jf_playback_activity
      WHERE imported = true
        AND "Id" LIKE 'tautulli:%'
        AND "NowPlayingItemId" LIKE 'tautulli:%'
    `),
  ]);

  const issues = libraryIssues.rows[0] || {};
  const repair = repairHub.rows[0] || {};
  return {
    generatedAt: new Date().toISOString(),
    subject: `JellyGlance weekly digest - ${formatDate(new Date())}`,
    recentlyAdded: recentlyAdded.rows,
    topWatched: topWatched.rows,
    activeUsers: activeUsers.rows,
    repairSummary: {
      missingPosters: Number(issues.MissingPosters || 0),
      missingLogos: Number(issues.MissingLogos || 0),
      missingRuntime: Number(issues.MissingRuntime || 0),
      unmatchedImports: Number(repair.UnmatchedImports || 0),
    },
  };
}

function listHtml(items, rowBuilder, emptyText) {
  if (!items.length) return `<p style="color:#8fa3bd;margin:0;font-size:14px;">${emptyText}</p>`;
  return `<div>${items.map(rowBuilder).join("")}</div>`;
}

function buildNewsletterHtml(data, options = {}) {
  const sections = { recentlyAdded: true, topWatched: true, activeUsers: true, repairSummary: true, ...(options.sections || {}) };
  const logoSrc = options.logoSrc || getLogoDataUri();
  const totalRepairIssues =
    data.repairSummary.missingPosters +
    data.repairSummary.missingLogos +
    data.repairSummary.missingRuntime +
    data.repairSummary.unmatchedImports;
  const totalPlays = data.topWatched.reduce((total, item) => total + Number(item.Plays || 0), 0);
  const totalWatchSeconds = data.topWatched.reduce((total, item) => total + Number(item.WatchSeconds || 0), 0);
  const metricBox = (label, value, detail, color = "#6ee7f9") => `
    <td style="width:25%;padding:6px;">
      <div style="background:#121a24;border:1px solid #27364a;border-radius:14px;padding:14px;min-height:86px;">
        <div style="color:#8fa3bd;font-size:11px;font-weight:800;text-transform:uppercase;">${label}</div>
        <div style="color:${color};font-size:26px;font-weight:900;line-height:1.1;margin:6px 0 3px;">${value}</div>
        <div style="color:#9fb0c7;font-size:12px;">${detail}</div>
      </div>
    </td>
  `;
  const sectionTitle = (title) => `<h2 style="color:#e8eef8;font-size:16px;margin:24px 0 10px;">${title}</h2>`;
  const recentlyAddedHtml = sections.recentlyAdded
    ? `${sectionTitle("Recently Added")}${listHtml(
        data.recentlyAdded,
        (item) =>
          `<div style="padding:8px 0;border-bottom:1px solid #243246;color:#d7e2f2;font-size:14px;"><strong>${escapeHtml(item.Name)}</strong> <span style="color:#8fa3bd;">${escapeHtml([item.Type, item.ProductionYear].filter(Boolean).join(" · "))}</span></div>`,
        "No new media this period."
      )}`
    : "";
  const topWatchedHtml = sections.topWatched
    ? `${sectionTitle("Most Watched")}${listHtml(
        data.topWatched,
        (item) =>
          `<div style="padding:8px 0;border-bottom:1px solid #243246;color:#d7e2f2;font-size:14px;"><strong>${escapeHtml(item.Name)}</strong> <span style="color:#8fa3bd;">${item.Plays} plays · ${formatWatchTime(item.WatchSeconds)}</span></div>`,
        "No watch activity yet."
      )}`
    : "";
  const activeUsersHtml = sections.activeUsers
    ? `${sectionTitle("Active Viewers")}${listHtml(
        data.activeUsers,
        (item) =>
          `<div style="padding:8px 0;border-bottom:1px solid #243246;color:#d7e2f2;font-size:14px;"><strong>${escapeHtml(item.Name)}</strong> <span style="color:#8fa3bd;">${item.Plays} plays · ${formatWatchTime(item.WatchSeconds)}</span></div>`,
        "No active viewers this period."
      )}`
    : "";
  const repairHtml = sections.repairSummary
    ? `${sectionTitle("Repair Snapshot")}<p style="color:#9fb0c7;font-size:14px;margin:0;">Missing posters ${data.repairSummary.missingPosters} · logos ${data.repairSummary.missingLogos} · runtime ${data.repairSummary.missingRuntime} · unmatched imports ${data.repairSummary.unmatchedImports}</p>`
    : "";
  const customHtml = sections.customHtml ? `<div style="margin-top:20px;">${sections.customHtml}</div>` : "";

  return `
    <!doctype html>
    <html>
      <body style="margin:0;background:#0b111a;font-family:Arial,sans-serif;color:#d7e2f2;">
        <table width="100%" cellpadding="0" cellspacing="0" style="background:#0b111a;padding:24px 12px;">
          <tr>
            <td align="center">
              <table width="640" cellpadding="0" cellspacing="0" style="background:#151d29;border:1px solid #27364a;border-radius:18px;overflow:hidden;">
                <tr>
                  <td style="padding:28px 28px 12px;">
                    ${logoSrc ? `<img src="${logoSrc}" alt="JellyGlance" width="48" height="48" style="display:block;margin-bottom:14px;" />` : ""}
                    <div style="color:#8fa3bd;font-size:12px;font-weight:800;text-transform:uppercase;">${escapeHtml(options.campaignName || "JellyGlance Newsletter")}</div>
                    <h1 style="margin:8px 0 6px;color:#f4f8ff;font-size:28px;">${escapeHtml(data.subject)}</h1>
                    <p style="margin:0;color:#9fb0c7;font-size:14px;">Generated ${escapeHtml(formatDate(data.generatedAt))}</p>
                  </td>
                </tr>
                <tr>
                  <td style="padding:8px 22px 8px;">
                    <table width="100%" cellpadding="0" cellspacing="0">
                      <tr>
                        ${metricBox("Plays", totalPlays.toLocaleString(), "Top titles this week")}
                        ${metricBox("Watch", formatWatchTime(totalWatchSeconds), "Across top titles", "#a78bfa")}
                        ${metricBox("New", String(data.recentlyAdded.length), "Recently added items", "#34d399")}
                        ${metricBox("Repair", String(totalRepairIssues), "Open metadata issues", "#fbbf24")}
                      </tr>
                    </table>
                  </td>
                </tr>
                <tr>
                  <td style="padding:8px 28px 32px;">
                    ${recentlyAddedHtml}
                    ${topWatchedHtml}
                    ${activeUsersHtml}
                    ${repairHtml}
                    ${customHtml}
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </body>
    </html>
  `;
}

function buildNewsletterText(data) {
  const lines = [
    "JellyGlance Newsletter",
    `Generated ${formatDate(data.generatedAt)}`,
    "",
    "Recently Added",
    ...data.recentlyAdded.map((item) => `- ${item.Name} (${[item.Type, item.ProductionYear].filter(Boolean).join(", ") || "Media"})`),
    "",
    "Most Watched This Week",
    ...data.topWatched.map((item) => `- ${item.Name}: ${item.Plays} plays, ${formatWatchTime(item.WatchSeconds)}`),
    "",
    "Active Viewers",
    ...data.activeUsers.map((item) => `- ${item.Name}: ${item.Plays} plays, ${formatWatchTime(item.WatchSeconds)}`),
    "",
    "Repair Snapshot",
    `Missing posters: ${data.repairSummary.missingPosters}`,
    `Missing logos: ${data.repairSummary.missingLogos}`,
    `Runtime gaps: ${data.repairSummary.missingRuntime}`,
    `Unmatched imports: ${data.repairSummary.unmatchedImports}`,
  ];
  return lines.join("\n");
}

async function addNewsletterHistory(req, entry) {
  const settings = await getSettings();
  const newsletter = settings[SETTINGS_KEY] || defaultNewsletterSettings();
  const history = Array.isArray(newsletter.history) ? newsletter.history : [];
  settings[SETTINGS_KEY] = {
    ...newsletter,
    history: [{ ...entry, timestamp: new Date().toISOString() }, ...history].slice(0, HISTORY_LIMIT),
  };
  await saveSettings(settings);
  await addAuditEntry(req, entry.ok ? "newsletter.sent" : "newsletter.failed", {
    recipients: entry.recipientCount,
    mode: entry.mode,
    error: entry.error || null,
  });
}

async function sendNewsletter(req, recipients, mode, options = {}) {
  const settings = await getSettings();
  const newsletter = {
    ...defaultNewsletterSettings(),
    ...(settings[SETTINGS_KEY] || {}),
    smtp: {
      ...defaultNewsletterSettings().smtp,
      ...((settings[SETTINGS_KEY] || {}).smtp || {}),
    },
  };
  const validationError = validateSmtpSettings(newsletter);
  if (validationError) {
    const error = new Error(validationError);
    error.statusCode = 400;
    throw error;
  }

  let campaign = null;
  if (options.campaignId) {
    campaign = await campaigns.getCampaign(options.campaignId);
    if (!campaign) {
      const error = new Error("Campaign not found");
      error.statusCode = 404;
      throw error;
    }
  }

  const targets = normalizeRecipients(
    recipients?.length
      ? recipients
      : campaign
        ? await campaigns.resolveCampaignRecipients(campaign)
        : newsletter.recipients
  );
  if (!targets.length || targets.some((email) => !validateEmail(email))) {
    const error = new Error("At least one valid recipient is required");
    error.statusCode = 400;
    throw error;
  }

  const data = await buildNewsletterData();
  if (campaign?.name) {
    data.subject = `${campaign.name} - ${formatDate(new Date())}`;
  }
  const sections = {
    ...campaigns.DEFAULT_SECTIONS,
    ...(campaign?.sections || {}),
    ...(campaign?.template?.blocks || {}),
  };
  const transporter = createTransport(newsletter);
  const result = await transporter.sendMail({
    from: `"${newsletter.senderName || "JellyGlance"}" <${newsletter.senderEmail}>`,
    to: targets,
    subject: data.subject,
    text: buildNewsletterText(data),
    html: buildNewsletterHtml(data, {
      logoSrc: "cid:jellyglance-logo",
      campaignName: campaign?.name,
      sections,
    }),
    attachments: fs.existsSync(logoPath)
      ? [
          {
            filename: "jellyglance-logo.png",
            path: logoPath,
            cid: "jellyglance-logo",
          },
        ]
      : [],
  });

  await addNewsletterHistory(req, {
    ok: true,
    mode,
    subject: data.subject,
    recipientCount: targets.length,
    messageId: result.messageId,
  });
  await campaigns.addHistoryEntry({
    campaignId: campaign?.id || null,
    recipientCount: targets.length,
    status: "ok",
    mode,
    subject: data.subject,
    meta: { messageId: result.messageId },
  });

  return { ok: true, messageId: result.messageId, recipientCount: targets.length, subject: data.subject, campaignId: campaign?.id || null };
}

async function sendDueCampaigns(req = null) {
  const due = await campaigns.listDueCampaigns();
  const results = [];
  for (const campaign of due) {
    try {
      results.push(await sendNewsletter(req, [], "scheduled", { campaignId: campaign.id }));
    } catch (error) {
      await campaigns.addHistoryEntry({
        campaignId: campaign.id,
        recipientCount: 0,
        status: "failed",
        mode: "scheduled",
        error: error.message,
      });
      results.push({ ok: false, campaignId: campaign.id, error: error.message });
    }
  }
  return results;
}

router.get("/settings", async (req, res) => {
  try {
    res.json(publicSettings(await getSettings()));
  } catch (error) {
    res.status(503).json({ error: "Unable to load newsletter settings" });
  }
});

router.post("/settings", async (req, res) => {
  try {
    const settings = await getSettings();
    const next = mergeNewsletterSettings(settings, req.body || {});
    const validationError = next.enabled ? validateSmtpSettings(next) : "";
    if (validationError) {
      return res.status(400).json({ error: validationError });
    }
    settings[SETTINGS_KEY] = next;
    await saveSettings(settings);
    await addAuditEntry(req, "newsletter.settings.updated", { enabled: next.enabled, recipients: next.recipients.length });
    res.json(publicSettings(settings));
  } catch (error) {
    res.status(503).json({ error: "Unable to save newsletter settings" });
  }
});

router.get("/preview", async (req, res) => {
  try {
    const data = await buildNewsletterData();
    let sections = { ...campaigns.DEFAULT_SECTIONS };
    let campaignName = "JellyGlance Newsletter";
    if (req.query?.campaignId) {
      const campaign = await campaigns.getCampaign(req.query.campaignId);
      if (campaign) {
        sections = { ...sections, ...(campaign.sections || {}), ...(campaign.template?.blocks || {}) };
        campaignName = campaign.name;
        data.subject = `${campaign.name} - ${formatDate(new Date())}`;
      }
    }
    res.json({ ...data, html: buildNewsletterHtml(data, { sections, campaignName }), text: buildNewsletterText(data) });
  } catch (error) {
    console.error("Newsletter preview failed:", error);
    res.status(503).json({ error: "Unable to generate newsletter preview" });
  }
});

router.post("/test", async (req, res) => {
  try {
    res.json(await sendNewsletter(req, normalizeRecipients(req.body?.recipients), "test", { campaignId: req.body?.campaignId }));
  } catch (error) {
    await addNewsletterHistory(req, {
      ok: false,
      mode: "test",
      recipientCount: normalizeRecipients(req.body?.recipients).length,
      error: error.message,
    }).catch(() => {});
    res.status(error.statusCode || 503).json({ error: error.message || "Unable to send test newsletter" });
  }
});

router.post("/send", async (req, res) => {
  try {
    res.json(
      await sendNewsletter(req, normalizeRecipients(req.body?.recipients), "manual", {
        campaignId: req.body?.campaignId,
      })
    );
  } catch (error) {
    await addNewsletterHistory(req, {
      ok: false,
      mode: "manual",
      recipientCount: normalizeRecipients(req.body?.recipients).length,
      error: error.message,
    }).catch(() => {});
    res.status(error.statusCode || 503).json({ error: error.message || "Unable to send newsletter" });
  }
});

router.get("/campaigns", async (_req, res) => {
  try {
    const schemaReady = await campaigns.isCampaignSchemaReady();
    res.json({
      schemaReady,
      campaigns: schemaReady ? await campaigns.listCampaigns() : [],
      templates: schemaReady ? await campaigns.listTemplates() : [],
      history: schemaReady ? await campaigns.listHistory({ limit: 30 }) : [],
      legacyFallback: !schemaReady,
    });
  } catch (error) {
    console.error("List newsletter campaigns failed:", error);
    res.status(503).json({ error: "Unable to load newsletter campaigns" });
  }
});

router.post("/campaigns", async (req, res) => {
  try {
    const campaign = await campaigns.createCampaign(req.body || {});
    await addAuditEntry(req, "newsletter.campaign.created", { campaignId: campaign.id, name: campaign.name });
    res.json(campaign);
  } catch (error) {
    console.error("Create newsletter campaign failed:", error);
    res.status(503).json({ error: "Unable to create newsletter campaign" });
  }
});

router.put("/campaigns/:id", async (req, res) => {
  try {
    const campaign = await campaigns.updateCampaign(req.params.id, req.body || {});
    if (!campaign) return res.status(404).json({ error: "Campaign not found" });
    await addAuditEntry(req, "newsletter.campaign.updated", { campaignId: campaign.id });
    res.json(campaign);
  } catch (error) {
    console.error("Update newsletter campaign failed:", error);
    res.status(503).json({ error: "Unable to update newsletter campaign" });
  }
});

router.delete("/campaigns/:id", async (req, res) => {
  try {
    await campaigns.deleteCampaign(req.params.id);
    await addAuditEntry(req, "newsletter.campaign.deleted", { campaignId: req.params.id });
    res.json({ ok: true });
  } catch (error) {
    console.error("Delete newsletter campaign failed:", error);
    res.status(503).json({ error: "Unable to delete newsletter campaign" });
  }
});

router.post("/campaigns/:id/send", async (req, res) => {
  try {
    res.json(
      await sendNewsletter(req, normalizeRecipients(req.body?.recipients), "manual", {
        campaignId: req.params.id,
      })
    );
  } catch (error) {
    await campaigns
      .addHistoryEntry({
        campaignId: req.params.id,
        recipientCount: 0,
        status: "failed",
        mode: "manual",
        error: error.message,
      })
      .catch(() => {});
    res.status(error.statusCode || 503).json({ error: error.message || "Unable to send campaign" });
  }
});

router.post("/templates", async (req, res) => {
  try {
    res.json(await campaigns.upsertTemplate(req.body || {}));
  } catch (error) {
    console.error("Save newsletter template failed:", error);
    res.status(503).json({ error: "Unable to save newsletter template" });
  }
});

module.exports = router;
module.exports.sendDueCampaigns = sendDueCampaigns;
module.exports.sendNewsletter = sendNewsletter;
