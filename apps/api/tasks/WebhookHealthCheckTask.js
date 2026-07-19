const { parentPort } = require("worker_threads");

async function runWebhookHealthCheckTask() {
  try {
    parentPort.postMessage({ status: "complete" });
  } catch (error) {
    parentPort.postMessage({ status: "error", message: error.message });
  }
}

parentPort.on("message", async (message) => {
  if (message.command === "start") {
    await runWebhookHealthCheckTask(message.triggertype);
    process.exit(0);
  }
});
