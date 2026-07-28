const express = require("express");
const CryptoJS = require("crypto-js");
const nodemailer = require("nodemailer");
const fs = require("fs");
const path = require("path");
const db = require("../db");
const { addAuditEntry } = require("../classes/admin-history");

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
  const itemRow = (title, meta, badge = "") => `
    <tr>
      <td style="padding:12px 0;border-bottom:1px solid #223047;">
        <div style="color:#f8fafc;font-size:15px;font-weight:800;">${escapeHtml(title)}</div>
        <div style="color:#9fb0c7;font-size:12px;margin-top:3px;">${escapeHtml(meta)}</div>
      </td>
      ${badge ? `<td align="right" style="padding:12px 0;border-bottom:1px solid #223047;color:#6ee7f9;font-size:12px;font-weight:800;white-space:nowrap;">${escapeHtml(badge)}</td>` : ""}
    </tr>
  `;

  return `
    <!doctype html>
    <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <title>${escapeHtml(data.subject)}</title>
      </head>
      <body style="margin:0;background:#090d13;color:#edf2f7;font-family:Arial,Helvetica,sans-serif;">
        <div style="display:none;max-height:0;overflow:hidden;color:transparent;">Recently added media, top watches, active viewers, and repair status from JellyGlance.</div>
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#090d13;">
          <tr>
            <td align="center" style="padding:28px 12px;">
              <table role="presentation" width="760" cellspacing="0" cellpadding="0" style="width:100%;max-width:760px;">
                <tr>
                  <td style="border-radius:22px;overflow:hidden;background:#0f1722;border:1px solid #26364a;">
                    <div style="background:linear-gradient(135deg,#111827 0%,#132436 48%,#351b44 100%);padding:26px 26px 22px;">
                      <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                        <tr>
                          <td>
                            <div style="color:#9ee8ff;font-size:12px;font-weight:900;text-transform:uppercase;">JellyGlance Digest</div>
                            <h1 style="margin:8px 0 8px;color:#ffffff;font-size:34px;line-height:1.05;">Weekly media pulse</h1>
                            <p style="margin:0;color:#c7d4e6;font-size:14px;line-height:1.5;">Fresh additions, what everyone watched, who was active, and what needs a little admin attention.</p>
                          </td>
                          <td align="right" width="92" style="padding-left:18px;">
                            ${logoSrc ? `<img src="${logoSrc}" width="76" height="76" alt="JellyGlance" style="display:block;border-radius:18px;">` : ""}
                          </td>
                        </tr>
                      </table>
                      <div style="margin-top:18px;color:#93a8c4;font-size:12px;">${escapeHtml(data.subject)} · Generated ${formatDate(data.generatedAt)}</div>
                    </div>

                    <div style="padding:18px 20px 8px;background:#0f1722;">
                      <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                        <tr>
                          ${metricBox("New items", data.recentlyAdded.length, "recent additions", "#a78bfa")}
                          ${metricBox("Top plays", totalPlays, "from top titles", "#6ee7f9")}
                          ${metricBox("Watch time", formatWatchTime(totalWatchSeconds), "top title total", "#34d399")}
                          ${metricBox("Repair queue", totalRepairIssues, "items flagged", totalRepairIssues ? "#fb7185" : "#34d399")}
                        </tr>
                      </table>
                    </div>

                    <div style="padding:6px 26px 26px;background:#0f1722;">
                      <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                        <tr>
                          <td style="padding:14px 0;">
                            <div style="background:#111c2a;border:1px solid #26364a;border-radius:16px;padding:18px;">
                              <h2 style="margin:0 0 12px;color:#ffffff;font-size:20px;">Recently Added</h2>
          ${listHtml(
            data.recentlyAdded,
            (item) =>
              `<table role="presentation" width="100%" cellspacing="0" cellpadding="0">${itemRow(
                item.Name,
                `${item.Type || "Media"}${item.ProductionYear ? ` · ${item.ProductionYear}` : ""} · added ${formatDate(item.DateCreated)}`,
                "New"
              )}</table>`,
            "No new items found."
          )}
                            </div>
                          </td>
                        </tr>
                        <tr>
                          <td style="padding:0 0 14px;">
                            <div style="background:#111c2a;border:1px solid #26364a;border-radius:16px;padding:18px;">
                              <h2 style="margin:0 0 12px;color:#ffffff;font-size:20px;">Most Watched This Week</h2>
          ${listHtml(
            data.topWatched,
            (item) =>
              `<table role="presentation" width="100%" cellspacing="0" cellpadding="0">${itemRow(
                item.Name,
                `${item.Plays} plays · ${formatWatchTime(item.WatchSeconds)} watched`,
                `${item.Plays} plays`
              )}</table>`,
            "No watch activity this week."
          )}
                            </div>
                          </td>
                        </tr>
                        <tr>
                          <td style="padding:0 0 14px;">
                            <div style="background:#111c2a;border:1px solid #26364a;border-radius:16px;padding:18px;">
                              <h2 style="margin:0 0 12px;color:#ffffff;font-size:20px;">Active Viewers</h2>
          ${listHtml(
            data.activeUsers,
            (item) =>
              `<table role="presentation" width="100%" cellspacing="0" cellpadding="0">${itemRow(
                item.Name,
                `${item.Plays} plays · ${formatWatchTime(item.WatchSeconds)} watched`,
                formatWatchTime(item.WatchSeconds)
              )}</table>`,
            "No active viewers this week."
          )}
                            </div>
                          </td>
                        </tr>
                        <tr>
                          <td>
                            <div style="background:#171321;border:1px solid #3b294f;border-radius:16px;padding:18px;">
                              <h2 style="margin:0 0 12px;color:#ffffff;font-size:20px;">Repair Snapshot</h2>
                              <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                                <tr>
                                  <td style="color:#c7d4e6;font-size:14px;line-height:1.7;">
                                    <strong style="color:#f8fafc;">${data.repairSummary.missingPosters}</strong> missing posters ·
                                    <strong style="color:#f8fafc;">${data.repairSummary.missingLogos}</strong> missing logos ·
                                    <strong style="color:#f8fafc;">${data.repairSummary.missingRuntime}</strong> runtime gaps ·
                                    <strong style="color:#f8fafc;">${data.repairSummary.unmatchedImports}</strong> unmatched imported plays
                                  </td>
                                </tr>
                              </table>
                            </div>
                          </td>
                        </tr>
                      </table>
                    </div>
                  </td>
                </tr>
                <tr>
                  <td align="center" style="padding:16px;color:#72839a;font-size:12px;">Sent by JellyGlance</td>
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

async function sendNewsletter(req, recipients, mode) {
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

  const targets = normalizeRecipients(recipients?.length ? recipients : newsletter.recipients);
  if (!targets.length || targets.some((email) => !validateEmail(email))) {
    const error = new Error("At least one valid recipient is required");
    error.statusCode = 400;
    throw error;
  }

  const data = await buildNewsletterData();
  const transporter = createTransport(newsletter);
  const result = await transporter.sendMail({
    from: `"${newsletter.senderName || "JellyGlance"}" <${newsletter.senderEmail}>`,
    to: targets,
    subject: data.subject,
    text: buildNewsletterText(data),
    html: buildNewsletterHtml(data, { logoSrc: "cid:jellyglance-logo" }),
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

  return { ok: true, messageId: result.messageId, recipientCount: targets.length, subject: data.subject };
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
    res.json({ ...data, html: buildNewsletterHtml(data), text: buildNewsletterText(data) });
  } catch (error) {
    console.error("Newsletter preview failed:", error);
    res.status(503).json({ error: "Unable to generate newsletter preview" });
  }
});

router.post("/test", async (req, res) => {
  try {
    res.json(await sendNewsletter(req, normalizeRecipients(req.body?.recipients), "test"));
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
    res.json(await sendNewsletter(req, normalizeRecipients(req.body?.recipients), "manual"));
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

module.exports = router;
