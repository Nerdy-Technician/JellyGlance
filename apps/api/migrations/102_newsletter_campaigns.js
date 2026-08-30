const { randomUUID } = require("crypto");

exports.up = async function (knex) {
  const hasTemplates = await knex.schema.hasTable("newsletter_templates");
  if (!hasTemplates) {
    await knex.schema.createTable("newsletter_templates", (table) => {
      table.uuid("id").primary();
      table.string("name", 160).notNullable();
      table.text("html_body").nullable();
      table.jsonb("blocks").notNullable().defaultTo("{}");
      table.jsonb("branding").notNullable().defaultTo("{}");
      table.timestamp("created_at", { useTz: true }).defaultTo(knex.fn.now());
      table.timestamp("updated_at", { useTz: true }).defaultTo(knex.fn.now());
    });
  }

  const hasCampaigns = await knex.schema.hasTable("newsletter_campaigns");
  if (!hasCampaigns) {
    await knex.schema.createTable("newsletter_campaigns", (table) => {
      table.uuid("id").primary();
      table.string("name", 160).notNullable();
      table.string("type", 32).notNullable().defaultTo("global");
      table.string("owner_user_id", 128).nullable();
      table.uuid("template_id").nullable().references("id").inTable("newsletter_templates").onDelete("SET NULL");
      table.string("schedule_cron", 64).nullable();
      table.string("frequency", 32).notNullable().defaultTo("manual");
      table.boolean("enabled").notNullable().defaultTo(false);
      table.jsonb("audience").notNullable().defaultTo("{}");
      table.jsonb("sections").notNullable().defaultTo("{}");
      table.timestamp("last_sent_at", { useTz: true }).nullable();
      table.timestamp("created_at", { useTz: true }).defaultTo(knex.fn.now());
      table.timestamp("updated_at", { useTz: true }).defaultTo(knex.fn.now());
    });
  }

  const hasSubscriptions = await knex.schema.hasTable("newsletter_subscriptions");
  if (!hasSubscriptions) {
    await knex.schema.createTable("newsletter_subscriptions", (table) => {
      table.uuid("id").primary();
      table.string("user_id", 128).notNullable();
      table.uuid("campaign_id").notNullable().references("id").inTable("newsletter_campaigns").onDelete("CASCADE");
      table.boolean("opted_in").notNullable().defaultTo(true);
      table.jsonb("extra_recipients").notNullable().defaultTo("[]");
      table.timestamp("updated_at", { useTz: true }).defaultTo(knex.fn.now());
      table.unique(["user_id", "campaign_id"]);
    });
  }

  const hasHistory = await knex.schema.hasTable("newsletter_send_history");
  if (!hasHistory) {
    await knex.schema.createTable("newsletter_send_history", (table) => {
      table.uuid("id").primary();
      table.uuid("campaign_id").nullable().references("id").inTable("newsletter_campaigns").onDelete("SET NULL");
      table.timestamp("sent_at", { useTz: true }).defaultTo(knex.fn.now());
      table.integer("recipient_count").notNullable().defaultTo(0);
      table.string("status", 32).notNullable().defaultTo("ok");
      table.string("mode", 32).notNullable().defaultTo("manual");
      table.string("subject", 255).nullable();
      table.text("error").nullable();
      table.jsonb("meta").notNullable().defaultTo("{}");
    });
  }

  const rows = await knex.select("settings").from("app_config").where({ ID: 1 });
  const settings = rows[0]?.settings || {};
  const legacy = settings.Newsletter || {};
  const existingCampaigns = await knex("newsletter_campaigns").count({ count: "*" }).first();
  if (Number(existingCampaigns?.count || 0) === 0) {
    const templateId = randomUUID();
    const campaignId = randomUUID();
    await knex("newsletter_templates").insert({
      id: templateId,
      name: "Default digest",
      html_body: null,
      blocks: {
        recentlyAdded: true,
        topWatched: true,
        activeUsers: true,
        repairSummary: true,
        customHtml: "",
      },
      branding: {},
    });

    await knex("newsletter_campaigns").insert({
      id: campaignId,
      name: "Global digest",
      type: "global",
      owner_user_id: null,
      template_id: templateId,
      schedule_cron: legacy.frequency === "weekly" ? "0 9 * * 1" : legacy.frequency === "monthly" ? "0 9 1 * *" : null,
      frequency: ["manual", "weekly", "monthly"].includes(legacy.frequency) ? legacy.frequency : "manual",
      enabled: Boolean(legacy.enabled),
      audience: {
        recipients: Array.isArray(legacy.recipients) ? legacy.recipients : [],
        roles: [],
      },
      sections: {
        recentlyAdded: true,
        topWatched: true,
        activeUsers: true,
        repairSummary: true,
      },
    });

    const history = Array.isArray(legacy.history) ? legacy.history : [];
    for (const entry of history.slice(0, 50)) {
      await knex("newsletter_send_history").insert({
        id: randomUUID(),
        campaign_id: campaignId,
        sent_at: entry.timestamp ? new Date(entry.timestamp) : knex.fn.now(),
        recipient_count: Number(entry.recipientCount || 0),
        status: entry.ok === false ? "failed" : "ok",
        mode: entry.mode || "manual",
        subject: entry.subject || null,
        error: entry.error || null,
        meta: { messageId: entry.messageId || null },
      });
    }
  }
};

exports.down = async function (knex) {
  await knex.schema.dropTableIfExists("newsletter_send_history");
  await knex.schema.dropTableIfExists("newsletter_subscriptions");
  await knex.schema.dropTableIfExists("newsletter_campaigns");
  await knex.schema.dropTableIfExists("newsletter_templates");
};
