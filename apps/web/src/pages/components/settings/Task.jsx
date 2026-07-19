import Button from "react-bootstrap/Button";
import Dropdown from "react-bootstrap/Dropdown";
import i18next from "i18next";
import PlayCircleLineIcon from "remixicon-react/PlayCircleLineIcon";
import StopCircleLineIcon from "remixicon-react/StopCircleLineIcon";
import TimerLineIcon from "remixicon-react/TimerLineIcon";
import LinksLineIcon from "remixicon-react/LinksLineIcon";

import "../../css/settings/settings.css";

function Task({ task, taskState, processing, taskIntervals, updateTask, onClick, stopTask, webhookEvents }) {
  const intervals = [
    { value: 15, display: i18next.t("SETTINGS_PAGE.INTERVALS.15_MIN") },
    { value: 30, display: i18next.t("SETTINGS_PAGE.INTERVALS.30_MIN") },
    { value: 60, display: i18next.t("SETTINGS_PAGE.INTERVALS.1_HOUR") },
    { value: 720, display: i18next.t("SETTINGS_PAGE.INTERVALS.12_HOURS") },
    { value: 1440, display: i18next.t("SETTINGS_PAGE.INTERVALS.1_DAY") },
    { value: 10080, display: i18next.t("SETTINGS_PAGE.INTERVALS.1_WEEK") },
  ];
  const state = taskState ? taskState.find((state) => state.task === task.name) : null;
  const interval = taskIntervals?.[task.name]?.Interval || 15;
  const intervalLabel = intervals.find((item) => item.value === interval)?.display || `${interval} minutes`;
  const hasTaskWebhook = webhookEvents?.task_completed?.enabled || webhookEvents?.task_failed?.enabled || webhookEvents?.task_started?.enabled;

  return (
    <article className={`task-card ${state?.running ? "is-running" : ""}`}>
      <div className="task-card-top">
        <span>{task.group}</span>
        <strong>{state?.running ? "Running" : "Ready"}</strong>
      </div>

      <div className="task-card-main">
        <h2>{task.title}</h2>
        <p>{task.description}</p>
      </div>

      <div className="task-card-meta">
        <div>
          <TimerLineIcon size={18} />
          <span>{task.type === "JOB" ? intervalLabel : "Manual"}</span>
        </div>
        <div className={hasTaskWebhook ? "is-enabled" : ""}>
          <LinksLineIcon size={18} />
          <span>{hasTaskWebhook ? "Webhook wired" : "No task webhook"}</span>
        </div>
      </div>

      <div className="task-card-actions">
        {task.type === "JOB" ? (
          <Dropdown>
            <Dropdown.Toggle variant="outline-primary" className="dropdown-basic">
              {intervalLabel}
            </Dropdown.Toggle>
            <Dropdown.Menu>
              {intervals.map((interval) => (
                <Dropdown.Item onClick={() => updateTask(task.name, interval.value)} value={interval.value} key={interval.value}>
                  {interval.display}
                </Dropdown.Item>
              ))}
            </Dropdown.Menu>
          </Dropdown>
        ) : (
          <span />
        )}

        {state?.running ? (
          <Button variant="danger" onClick={() => stopTask(task.name)} disabled={processing}>
            <StopCircleLineIcon size={17} />
            Stop
          </Button>
        ) : (
          <Button variant="primary" onClick={() => onClick(task.link)} disabled={processing}>
            <PlayCircleLineIcon size={17} />
            Start
          </Button>
        )}
      </div>
    </article>
  );
}

export default Task;
