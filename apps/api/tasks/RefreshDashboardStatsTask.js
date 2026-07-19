const { parentPort } = require("worker_threads");
const db = require("../db");

async function runRefreshDashboardStatsTask() {
  try {
    for (const view of db.materializedViews) {
      await db.refreshMaterializedView(view);
    }

    parentPort.postMessage({ status: "complete" });
  } catch (error) {
    parentPort.postMessage({ status: "error", message: error.message });
  }
}

parentPort.on("message", async (message) => {
  if (message.command === "start") {
    await runRefreshDashboardStatsTask();
    process.exit(0);
  }
});
