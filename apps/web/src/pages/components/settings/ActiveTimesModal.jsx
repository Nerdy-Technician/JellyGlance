import { useEffect, useRef, useState } from "react";
import { Button, Form, Modal } from "react-bootstrap";
import TimeLineIcon from "remixicon-react/TimeLineIcon";

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const HOURS = Array.from({ length: 24 }, (_, hour) => hour);

function fullWeek(value = true) {
  return DAYS.map(() => HOURS.map(() => value));
}

function toGrid(days) {
  if (!Array.isArray(days) || days.length !== 7) return fullWeek(true);
  return days.map((day) => HOURS.map((hour) => String(day)[hour] === "1"));
}

function toDays(grid) {
  return grid.map((day) => day.map((on) => (on ? "1" : "0")).join(""));
}

const PRESETS = [
  { label: "Any time", build: () => fullWeek(true) },
  {
    label: "Overnight (00–06)",
    build: () => DAYS.map(() => HOURS.map((hour) => hour < 6)),
  },
  {
    label: "Night (22–07)",
    build: () => DAYS.map(() => HOURS.map((hour) => hour >= 22 || hour < 7)),
  },
  {
    label: "Weekday daytime",
    build: () =>
      DAYS.map((_, day) =>
        HOURS.map((hour) => day < 5 && hour >= 9 && hour < 17),
      ),
  },
  {
    label: "Weekends",
    build: () => DAYS.map((_, day) => HOURS.map(() => day >= 5)),
  },
  { label: "Clear", build: () => fullWeek(false) },
];

export function describeActiveTimes(schedule) {
  if (!schedule) return "Any time";
  const grid = toGrid(schedule.days);
  const total = grid.flat().filter(Boolean).length;
  if (total === 168) return "Any time";
  if (total === 0) return "Never";
  const first = grid[0].map((on) => (on ? "1" : "0")).join("");
  if (
    grid.every((day) => day.map((on) => (on ? "1" : "0")).join("") === first)
  ) {
    const start = grid[0].findIndex(
      (on, hour) => on && !grid[0][(hour + 23) % 24],
    );
    const end = grid[0].findIndex(
      (on, hour) => on && !grid[0][(hour + 1) % 24],
    );
    const blocks = grid[0].filter(
      (on, hour) => on && !grid[0][(hour + 23) % 24],
    ).length;
    if (blocks === 1 && start >= 0 && end >= 0) {
      return `Daily ${String(start).padStart(2, "0")}:00–${String((end + 1) % 24).padStart(2, "0")}:00`;
    }
  }
  return `${total} h / week`;
}

export default function ActiveTimesModal({
  show,
  task,
  schedule,
  globalSchedule,
  isGlobal,
  timeZone,
  supportsEnforce,
  onHide,
  onSave,
  onClear,
}) {
  const [grid, setGrid] = useState(() => toGrid(schedule?.days));
  const [autoRun, setAutoRun] = useState(Boolean(schedule?.autoRun));
  const [intervalHours, setIntervalHours] = useState(
    schedule?.intervalHours || 24,
  );
  const [enforce, setEnforce] = useState(Boolean(schedule?.enforce));
  const [useGlobal, setUseGlobal] = useState(Boolean(schedule?.useGlobal));
  const [saving, setSaving] = useState(false);
  const paintRef = useRef(null);

  useEffect(() => {
    if (!show) return;
    setGrid(toGrid(schedule?.days));
    setAutoRun(Boolean(schedule?.autoRun));
    setIntervalHours(schedule?.intervalHours || 24);
    setEnforce(Boolean(schedule?.enforce));
    setUseGlobal(Boolean(schedule?.useGlobal));
  }, [show, schedule]);

  const locked = !isGlobal && useGlobal;
  const shownGrid = locked ? toGrid(globalSchedule?.days) : grid;

  useEffect(() => {
    const stop = () => {
      paintRef.current = null;
    };
    window.addEventListener("pointerup", stop);
    return () => window.removeEventListener("pointerup", stop);
  }, []);

  function setCell(day, hour, value) {
    setGrid((current) => {
      if (current[day][hour] === value) return current;
      const next = current.map((row) => row.slice());
      next[day][hour] = value;
      return next;
    });
  }

  function startPaint(event, day, hour) {
    event.preventDefault();
    if (locked) return;
    const value = !grid[day][hour];
    paintRef.current = value;
    setCell(day, hour, value);
  }

  function movePaint(event) {
    if (paintRef.current === null || locked) return;
    const target = document.elementFromPoint(event.clientX, event.clientY);
    const day = target?.dataset?.day;
    const hour = target?.dataset?.hour;
    if (day === undefined || hour === undefined) return;
    setCell(Number(day), Number(hour), paintRef.current);
  }

  function toggleDay(day) {
    if (locked) return;
    setGrid((current) => {
      const value = !current[day].every(Boolean);
      return current.map((row, index) =>
        index === day ? row.map(() => value) : row,
      );
    });
  }

  function toggleHour(hour) {
    if (locked) return;
    setGrid((current) => {
      const value = !current.every((row) => row[hour]);
      return current.map((row) =>
        row.map((on, index) => (index === hour ? value : on)),
      );
    });
  }

  async function save() {
    setSaving(true);
    try {
      await onSave({
        days: toDays(grid),
        autoRun: isGlobal ? false : autoRun,
        intervalHours: Number(intervalHours),
        enforce,
        useGlobal: isGlobal ? false : useGlobal,
      });
    } finally {
      setSaving(false);
    }
  }

  const allowed = shownGrid.flat().filter(Boolean).length;

  return (
    <Modal
      show={show}
      onHide={onHide}
      centered
      size="lg"
      className="active-times-modal"
    >
      <Modal.Header closeButton>
        <Modal.Title>
          <TimeLineIcon size={20} />{" "}
          {isGlobal
            ? "Global active times"
            : `Active times · ${task?.name || ""}`}
        </Modal.Title>
      </Modal.Header>
      <Modal.Body>
        <p className="active-times-help">
          {isGlobal
            ? "These hours apply to every Jellyfin and ARR task that doesn't have its own active times. "
            : ""}
          Click or drag across the grid to choose when{" "}
          {isGlobal ? "tasks are" : "this task is"} allowed to run. Click a day
          or hour label to toggle the whole row or column. Times are in the
          server&apos;s time zone{timeZone ? ` (${timeZone})` : ""}.
        </p>
        {!isGlobal ? (
          <Form.Check
            type="switch"
            id="active-times-use-global"
            className="active-times-use-global"
            label={`Use the global active times (${describeActiveTimes(globalSchedule)})`}
            checked={useGlobal}
            onChange={(event) => setUseGlobal(event.target.checked)}
          />
        ) : null}
        <div className={`active-times-presets ${locked ? "is-locked" : ""}`}>
          {PRESETS.map((preset) => (
            <button
              type="button"
              key={preset.label}
              onClick={() => setGrid(preset.build())}
              disabled={locked}
            >
              {preset.label}
            </button>
          ))}
        </div>
        <div
          className={`active-times-grid ${locked ? "is-locked" : ""}`}
          onPointerMove={movePaint}
          role="grid"
          aria-label="Active times heat map"
        >
          <span />
          {HOURS.map((hour) => (
            <button
              type="button"
              key={`h${hour}`}
              className="active-times-hour"
              onClick={() => toggleHour(hour)}
              title={`Toggle ${hour}:00 every day`}
            >
              {hour % 3 === 0 ? String(hour).padStart(2, "0") : ""}
            </button>
          ))}
          {DAYS.map((label, day) => (
            <div className="active-times-row" key={label} role="row">
              <button
                type="button"
                className="active-times-day"
                onClick={() => toggleDay(day)}
              >
                {label}
              </button>
              {HOURS.map((hour) => (
                <span
                  key={hour}
                  role="gridcell"
                  aria-selected={shownGrid[day][hour]}
                  data-day={day}
                  data-hour={hour}
                  className={`active-times-cell ${shownGrid[day][hour] ? "on" : ""}`}
                  title={`${label} ${String(hour).padStart(2, "0")}:00–${String((hour + 1) % 24).padStart(2, "0")}:00`}
                  onPointerDown={(event) => startPaint(event, day, hour)}
                />
              ))}
            </div>
          ))}
        </div>
        <div className="active-times-legend">
          <span>
            <i className="on" /> Allowed
          </span>
          <span>
            <i /> Blocked
          </span>
          <strong>{allowed} of 168 hours allowed</strong>
        </div>

        <div className="active-times-options">
          {isGlobal ? null : (
            <Form.Check
              type="switch"
              id="active-times-autorun"
              label="Run automatically inside these times"
              checked={autoRun}
              onChange={(event) => setAutoRun(event.target.checked)}
            />
          )}
          {isGlobal ? null : (
            <Form.Select
              size="sm"
              value={intervalHours}
              onChange={(event) => setIntervalHours(event.target.value)}
              disabled={!autoRun}
              aria-label="Run every"
            >
              {[1, 2, 3, 6, 12, 24, 48, 168].map((hours) => (
                <option key={hours} value={hours}>
                  {hours === 168
                    ? "Once a week"
                    : hours === 24
                      ? "Once a day"
                      : hours === 48
                        ? "Every 2 days"
                        : `Every ${hours} hour${hours === 1 ? "" : "s"}`}
                </option>
              ))}
            </Form.Select>
          )}
          {supportsEnforce ? (
            <Form.Check
              type="switch"
              id="active-times-enforce"
              label={
                isGlobal
                  ? "Stop Jellyfin jobs that follow these times if they run outside them"
                  : "Stop the job if it starts outside these times"
              }
              checked={enforce}
              onChange={(event) => setEnforce(event.target.checked)}
            />
          ) : (
            <small>
              The app keeps its own schedule too. JellyGlance only adds runs
              inside these times.
            </small>
          )}
          {isGlobal ? (
            <small>
              ARR apps keep their own schedules. Global times limit when
              JellyGlance runs their tasks automatically.
            </small>
          ) : null}
        </div>
      </Modal.Body>
      <Modal.Footer>
        {schedule ? (
          <Button
            variant="outline-danger"
            onClick={onClear}
            disabled={saving}
            className="me-auto"
          >
            {isGlobal ? "Remove global times" : "Remove active times"}
          </Button>
        ) : null}
        <Button variant="outline-light" onClick={onHide} disabled={saving}>
          Cancel
        </Button>
        <Button variant="primary" onClick={save} disabled={saving}>
          Save
        </Button>
      </Modal.Footer>
    </Modal>
  );
}
