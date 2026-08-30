const knex = require("knex");
const knexConfig = require("../migrations");

const DEFAULT_MAX_ATTEMPTS = Number(process.env.MIGRATION_MAX_ATTEMPTS || 30);
const DEFAULT_RETRY_DELAY_MS = Number(process.env.MIGRATION_RETRY_DELAY_MS || 2000);

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function createMigrationClient() {
  return knex(knexConfig.development);
}

async function waitForDatabase(client, maxAttempts = DEFAULT_MAX_ATTEMPTS, retryDelayMs = DEFAULT_RETRY_DELAY_MS) {
  let lastError = null;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      await client.raw("SELECT 1");
      if (attempt > 1) {
        console.log(`[MIGRATIONS] Database ready after ${attempt} attempt(s)`);
      }
      return;
    } catch (error) {
      lastError = error;
      console.log(
        `[MIGRATIONS] Waiting for database (${attempt}/${maxAttempts}): ${error.message || error}`
      );
      if (attempt < maxAttempts) {
        await delay(retryDelayMs);
      }
    }
  }

  throw new Error(
    `Database not reachable after ${maxAttempts} attempts: ${lastError?.message || lastError || "unknown error"}`
  );
}

async function runLatestMigrations(options = {}) {
  const maxAttempts = options.maxAttempts ?? DEFAULT_MAX_ATTEMPTS;
  const retryDelayMs = options.retryDelayMs ?? DEFAULT_RETRY_DELAY_MS;
  const client = createMigrationClient();

  try {
    await waitForDatabase(client, maxAttempts, retryDelayMs);
    const [batch, log] = await client.migrate.latest();

    if (!log.length) {
      console.log("[MIGRATIONS] Database schema is up to date");
    } else {
      console.log(`[MIGRATIONS] Applied batch ${batch}: ${log.join(", ")}`);
    }

    return { batch, log };
  } finally {
    await client.destroy();
  }
}

module.exports = {
  runLatestMigrations,
  waitForDatabase,
};
