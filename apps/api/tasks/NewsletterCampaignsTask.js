const { parentPort } = require("worker_threads");

async function runNewsletterCampaignsTask() {
  try {
    const { sendDueCampaigns } = require("../routes/newsletter");
    const results = await sendDueCampaigns(null);
    parentPort.postMessage({
      status: "complete",
      message: `Processed ${results.length} due newsletter campaign${results.length === 1 ? "" : "s"}`,
    });
  } catch (error) {
    parentPort.postMessage({ status: "error", message: error.message });
  }
}

parentPort.on("message", async (message) => {
  if (message.command === "start") {
    await runNewsletterCampaignsTask(message.triggertype);
    process.exit(0);
  }
});
