const { parentPort } = require("worker_threads");
const { getIntegrations } = require("../classes/integration-store");
const WebhookManager = require("../classes/webhook-manager");

async function runIntegrationHealthCheckTask() {
  try {
    const integrations = await getIntegrations();
    const allIntegrations = [...(integrations.arrApps || []), ...(integrations.clients || []), ...(integrations.thirdParty || [])];
    const allowsOptionalSecret = (item) => String(item?.name || item?.slug || "").toLowerCase().includes("tdarr");
    const missingConfig = allIntegrations
      .filter((item) => !item.values?.url || (!allowsOptionalSecret(item) && !item.values?.secret) || item.connected === false)
      .map((item) => item.name);

    const webhookManager = new WebhookManager();
    if (missingConfig.length) {
      await webhookManager.triggerEventWebhooks("integration_health_warning", {
        integrationEvent: "integration health warning",
        source: "Integrations",
        missingConfig,
        message: `${missingConfig.length} integration${missingConfig.length === 1 ? "" : "s"} need setup or testing.`,
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
