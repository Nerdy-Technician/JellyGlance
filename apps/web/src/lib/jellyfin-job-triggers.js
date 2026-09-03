const TICKS_PER_SECOND = 10_000_000;
const TICKS_PER_MINUTE = TICKS_PER_SECOND * 60;
const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export const JELLYFIN_TRIGGER_TYPES = [
  { value: "DailyTrigger", label: "Daily" },
  { value: "WeeklyTrigger", label: "Weekly" },
  { value: "IntervalTrigger", label: "Interval" },
  { value: "StartupTrigger", label: "At startup" },
];

export const JELLYFIN_WEEKDAYS = WEEKDAYS;

function normalizeWeekday(value) {
  const asString = String(value ?? "");
  if (WEEKDAYS.includes(asString)) return asString;
  const index = Number(value);
  if (Number.isInteger(index) && index >= 0 && index <= 6) return WEEKDAYS[index];
  return "Sunday";
}

export function jellyfinTriggerKind(type) {
  const value = String(type || "").split(".").pop();
  if (/WeeklyTrigger/i.test(value)) return "WeeklyTrigger";
  if (/IntervalTrigger/i.test(value)) return "IntervalTrigger";
  if (/StartupTrigger/i.test(value)) return "StartupTrigger";
  if (/DailyTrigger/i.test(value)) return "DailyTrigger";
  return "";
}

function padTimePart(value) {
  return String(value).padStart(2, "0");
}

export function ticksToClock(ticks) {
  const totalSeconds = Math.max(0, Math.floor(Number(ticks || 0) / TICKS_PER_SECOND)) % 86400;
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  return `${padTimePart(hours)}:${padTimePart(minutes)}`;
}

export function clockToTicks(time) {
  const [hours, minutes] = String(time || "00:00").split(":").map((part) => Number(part) || 0);
  const safeHours = Math.min(23, Math.max(0, hours));
  const safeMinutes = Math.min(59, Math.max(0, minutes));
  return (safeHours * 60 + safeMinutes) * 60 * TICKS_PER_SECOND;
}

export function ticksToInterval(ticks) {
  const minutes = Math.max(1, Math.round(Number(ticks || TICKS_PER_MINUTE) / TICKS_PER_MINUTE));
  if (minutes >= 60 && minutes % 60 === 0) {
    return { value: minutes / 60, unit: "hours" };
  }
  return { value: minutes, unit: "minutes" };
}

export function intervalToTicks(value, unit) {
  const amount = Math.max(1, Number(value) || 1);
  const minutes = unit === "hours" ? amount * 60 : amount;
  return minutes * TICKS_PER_MINUTE;
}

function formatClock(time) {
  const [hours, minutes] = String(time || "00:00").split(":").map((part) => Number(part) || 0);
  const date = new Date();
  date.setHours(hours, minutes, 0, 0);
  try {
    return new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit" }).format(date);
  } catch {
    return time;
  }
}

function formatIntervalLabel(value, unit) {
  const amount = Math.max(1, Number(value) || 1);
  const noun = unit === "hours" ? (amount === 1 ? "hour" : "hours") : amount === 1 ? "minute" : "minutes";
  return `Every ${amount} ${noun}`;
}

export function formatJellyfinTrigger(trigger = {}) {
  const kind = jellyfinTriggerKind(trigger.Type || trigger.type);
  if (kind === "StartupTrigger") return "At startup";
  if (kind === "IntervalTrigger") {
    const interval = ticksToInterval(trigger.IntervalTicks ?? trigger.intervalTicks);
    return formatIntervalLabel(interval.value, interval.unit);
  }

  const time = formatClock(ticksToClock(trigger.TimeOfDayTicks ?? trigger.timeOfDayTicks));
  if (kind === "WeeklyTrigger") {
    return `Weekly on ${normalizeWeekday(trigger.DayOfWeek || trigger.dayOfWeek)} at ${time}`;
  }
  if (kind === "DailyTrigger") return `Daily at ${time}`;
  return "Custom schedule";
}

export function formatJellyfinSchedule(triggers) {
  if (!Array.isArray(triggers) || !triggers.length) return "Manual only";
  return triggers.map(formatJellyfinTrigger).join(" · ");
}

export function createEditorTrigger(type = "DailyTrigger") {
  return {
    id: typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : `trigger-${Date.now()}-${Math.random()}`,
    Type: jellyfinTriggerKind(type) || "DailyTrigger",
    time: "03:00",
    day: "Sunday",
    intervalValue: 12,
    intervalUnit: "hours",
    MaxRuntimeTicks: null,
  };
}

export function triggersToEditor(triggers = []) {
  return (Array.isArray(triggers) ? triggers : []).map((trigger) => {
    const interval = ticksToInterval(trigger.IntervalTicks ?? trigger.intervalTicks);
    return {
      ...createEditorTrigger(trigger.Type || trigger.type),
      time: ticksToClock(trigger.TimeOfDayTicks ?? trigger.timeOfDayTicks),
      day: normalizeWeekday(trigger.DayOfWeek || trigger.dayOfWeek),
      intervalValue: interval.value,
      intervalUnit: interval.unit,
      MaxRuntimeTicks: trigger.MaxRuntimeTicks ?? trigger.maxRuntimeTicks ?? null,
    };
  });
}

export function editorToApiTriggers(triggers = []) {
  return triggers.map((trigger) => {
    const type = jellyfinTriggerKind(trigger.Type) || "DailyTrigger";
    const payload = { Type: type };
    const maxRuntime = Number(trigger.MaxRuntimeTicks);
    if (Number.isFinite(maxRuntime) && maxRuntime > 0) {
      payload.MaxRuntimeTicks = Math.round(maxRuntime);
    }

    if (type === "StartupTrigger") return payload;
    if (type === "IntervalTrigger") {
      payload.IntervalTicks = intervalToTicks(trigger.intervalValue, trigger.intervalUnit);
      return payload;
    }

    payload.TimeOfDayTicks = clockToTicks(trigger.time);
    if (type === "WeeklyTrigger") payload.DayOfWeek = normalizeWeekday(trigger.day);
    return payload;
  });
}

export function editorTriggersEqual(left = [], right = []) {
  return JSON.stringify(editorToApiTriggers(left)) === JSON.stringify(editorToApiTriggers(right));
}
