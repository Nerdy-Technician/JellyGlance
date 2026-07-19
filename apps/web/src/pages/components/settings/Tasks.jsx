import { useState, useEffect } from "react";
import axios from "../../../lib/axios_instance";
import { taskList } from "../../../lib/tasklist.jsx";
import Task from "./Task";
import socket from "../../../socket";
import TaskLineIcon from "remixicon-react/TaskLineIcon";
import LinksLineIcon from "remixicon-react/LinksLineIcon";

import "../../css/settings/settings.css";

export default function Tasks() {
  const [processing, setProcessing] = useState(false);
  const [taskIntervals, setTaskIntervals] = useState([]);
  const [taskStateList, setTaskStateList] = useState();
  const [webhookEvents, setWebhookEvents] = useState({});
  const token = localStorage.getItem("token");

  useEffect(() => {
    socket.on("task-list", (data) => {
      if (typeof data === "object" && Array.isArray(data)) {
        setTaskStateList(data);
      }
    });
    return () => {
      socket.off("task-list");
    };
  }, []);

  async function executeTask(url) {
    setProcessing(true);

    await axios
      .get(url, {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      })
      .catch((error) => {
        console.log(error);
      });
    setProcessing(false);
  }

  async function stopTask(task) {
    await axios
      .get(`/api/stopTask?task=${task}`, {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      })
      .catch((error) => {
        console.log(error);
      });
  }

  async function updateTaskSettings(taskName, Interval) {
    await axios
      .post(
        "/api/setTaskSettings",
        {
          taskname: taskName,
          Interval: Interval,
        },
        {
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
        }
      )
      .then((response) => {
        setTaskIntervals(response.data);
      })
      .catch((error) => {
        console.log(error);
      });
  }

  async function getTaskSettings() {
    await axios
      .get("/api/getTaskSettings", {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      })
      .then((response) => {
        setTaskIntervals(response.data);
      })
      .catch((error) => {
        console.log(error);
      });
  }

  async function getWebhookEvents() {
    await axios
      .get("/webhooks/event-status", {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      })
      .then((response) => setWebhookEvents(response.data))
      .catch((error) => console.log(error));
  }

  useEffect(() => {
    getTaskSettings();
    getWebhookEvents();
  }, []);

  const runningCount = taskStateList?.filter((task) => task.running).length || 0;
  const taskWebhookCount = ["task_started", "task_completed", "task_failed"].filter((event) => webhookEvents[event]?.enabled).length;

  return (
    <div className="tasks">
      <div className="tasks-header">
        <div>
          <p>Automation</p>
          <h1>Tasks</h1>
          <span>Schedule syncs, imports, maintenance jobs, backups, and webhook checks.</span>
        </div>
        <div className="tasks-summary">
          <span>
            <TaskLineIcon size={18} />
            {taskList.length} jobs
          </span>
          <span>
            <TaskLineIcon size={18} />
            {runningCount} running
          </span>
          <span>
            <LinksLineIcon size={18} />
            {taskWebhookCount}/3 task webhooks
          </span>
        </div>
      </div>

      <div className="tasks-grid">
        {taskList.map((task) => (
          <Task
            key={task.id}
            task={task}
            taskState={taskStateList}
            processing={processing}
            taskIntervals={taskIntervals}
            updateTask={updateTaskSettings}
            onClick={executeTask}
            stopTask={stopTask}
            webhookEvents={webhookEvents}
          />
        ))}
      </div>
    </div>
  );
}
