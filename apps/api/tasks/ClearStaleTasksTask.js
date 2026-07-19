const { parentPort } = require("worker_threads");
const db = require("../db");
const taskstate = require("../logging/taskstate");

async function runClearStaleTasksTask() {
  try {
    await db.query(`UPDATE jf_logging SET "Result"=$1 WHERE "Result"=$2`, [taskstate.FAILED, taskstate.RUNNING]);
    parentPort.postMessage({ status: "complete" });
  } catch (error) {
    parentPort.postMessage({ status: "error", message: error.message });
  }
}

parentPort.on("message", async (message) => {
  if (message.command === "start") {
    await runClearStaleTasksTask();
    process.exit(0);
  }
});
