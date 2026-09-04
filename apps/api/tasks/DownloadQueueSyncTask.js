const { parentPort } = require("worker_threads");
const { getIntegrations, getIntegrationData, saveIntegrationData } = require("../classes/integration-store");
const { fetchClientQueue } = require("../classes/download-client");
const WebhookManager = require("../classes/webhook-manager");

async function runDownloadQueueSyncTask() {
  try {
    const integrations = await getIntegrations();
    const integrationData = await getIntegrationData();
    const connectedClients = (integrations.clients || []).filter((client) => client.connected);
    if (!connectedClients.length) {
      await saveIntegrationData({
        downloads: {
          ...integrationData.downloads,
          items: [],
          clients: (integrations.clients || []).map((client) => ({
            name: client.name,
            slug: client.slug,
            protocol: client.protocol,
            instanceId: client.instanceId,
            connected: false,
            itemCount: 0,
            message: "Needs setup",
          })),
          syncedAt: new Date().toISOString(),
        },
      });
      parentPort.postMessage({ status: "skipped", message: "No download clients configured." });
      return;
    }

    const queueResults = await Promise.allSettled(connectedClients.map((client) => fetchClientQueue(client)));
    const syncedItems = queueResults.flatMap((result) => (result.status === "fulfilled" ? result.value.items || [] : []));
    const previousItems = Array.isArray(integrationData.downloads?.items) ? integrationData.downloads.items : [];
    const previousById = new Map(previousItems.map((item) => [item.id, item]));
    const webhookManager = new WebhookManager();

    await Promise.all(
      syncedItems.flatMap((item) => {
        const previous = previousById.get(item.id);
        const events = [];
        if (!previous) events.push(["download_added", "Download added"]);
        if (previous && Number(previous.progress || 0) < 100 && Number(item.progress || 0) >= 100) {
          events.push(["download_completed", "Download completed"]);
        }
        if (String(item.state).includes("fail") && !String(previous?.state || "").includes("fail")) {
          events.push(["download_failed", "Download failed"]);
        }
        return events.map(([eventType, integrationEvent]) =>
          webhookManager.triggerEventWebhooks(eventType, {
            integrationEvent,
            source: item.client,
            client: item.client,
            item,
            itemName: item.name,
            message: `${item.name} on ${item.client}`,
          })
        );
      })
    );
    const clients = (integrations.clients || []).map((client) => {
      const resultIndex = connectedClients.findIndex((item) => item.instanceId === client.instanceId);
      const result = resultIndex >= 0 ? queueResults[resultIndex] : null;
      const queueData = result?.status === "fulfilled" ? result.value : null;
      const itemCount = syncedItems.filter((item) => item.client === client.name).length;
      return {
        name: client.name,
        slug: client.slug,
        protocol: client.protocol,
        instanceId: client.instanceId,
        connected: Boolean(client.connected && result?.status !== "rejected" && !queueData?.error),
        itemCount,
        message: queueData?.error || (client.connected ? "Online" : "Needs setup"),
      };
    });

    await saveIntegrationData({
      downloads: {
        ...integrationData.downloads,
        items: syncedItems,
        clients,
        syncedAt: new Date().toISOString(),
      },
    });

    await webhookManager.triggerEventWebhooks("download_queue_refreshed", {
      taskKey: "DownloadQueueSync",
      taskName: "Download Queue Sync",
      integrationEvent: "Download queue synced",
      source: "Download clients",
      clientCount: clients.length,
      activeCount: syncedItems.filter((item) => Number(item.progress || 0) < 100).length,
      message: "Download queue synced.",
    });
    await webhookManager.flushCoalescedWebhooks();
    parentPort.postMessage({ status: "complete" });
  } catch (error) {
    parentPort.postMessage({ status: "error", message: error.message });
  }
}

parentPort.on("message", async (message) => {
  if (message.command === "start") {
    await runDownloadQueueSyncTask(message.triggertype);
    process.exit(0);
  }
});
