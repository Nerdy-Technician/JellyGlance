const { parentPort } = require("worker_threads");
const { getIntegrations } = require("../classes/integration-store");
const WebhookManager = require("../classes/webhook-manager");
const { buildOpsDigest } = require("../classes/command-center");

async function runIntegrationHealthCheckTask() {
  try {
    const integrations = await getIntegrations();
    const allIntegrations = [...(integrations.arrApps || []), ...(integrations.clients || []), ...(integrations.thirdParty || [])];
    const allowsOptionalSecret = (item) => {
      const name = String(item?.name || item?.slug || "").toLowerCase();
      return name.includes("tdarr") || name.includes("unpackerr") || name.includes("kometa") || name.includes("recyclarr");
    };
    const missingConfig = allIntegrations
      .filter((item) => !item.values?.url || (!allowsOptionalSecret(item) && !item.values?.secret) || item.connected === false)
      .map((item) => item.name);

    const webhookManager = new WebhookManager();
    await webhookManager.flushQuietHoursDigest();
    if (missingConfig.length) {
      await webhookManager.triggerEventWebhooks("integration_health_warning", {
        integrationEvent: "integration health warning",
        source: "Integrations",
        missingConfig,
        message: `${missingConfig.length} integration${missingConfig.length === 1 ? "" : "s"} need setup or testing.`,
      });
    }
    const digest = await buildOpsDigest();
    if (digest.count > 0) {
      await webhookManager.triggerEventWebhooks("ops_digest", {
        integrationEvent: "Ops digest",
        source: "Home",
        count: digest.count,
        items: digest.items.map((item) => item.label),
        message: `${digest.count} ops item${digest.count === 1 ? "" : "s"} need attention.`,
      });
    }
    parentPort.postMessage({ status: "complete" });
  } catch (error) {
    parentPort.postMessage({ status: "error", message: error.message });
  }
}

parentPort.on("message", async (message) => {
  if (message.command === "start") {
    await runIntegrationHealthCheckTask(message.triggertype);
    process.exit(0);
  }
});
