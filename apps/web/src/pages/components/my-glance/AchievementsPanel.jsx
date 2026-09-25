import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import AwardLineIcon from "remixicon-react/AwardLineIcon";
import axios from "../../../lib/axios_instance";

const GOAL_LABELS = { movies: "Movies", episodes: "Episodes", hours: "Hours watched" };
const STATUS_TEXT = { complete: "Goal reached", "on-track": "On track", behind: "Behind pace" };

function authHeaders() {
  return { Authorization: `Bearer ${localStorage.getItem("token")}` };
}

function GoalEditor({ year, goals, onSaved, onCancel }) {
  const [values, setValues] = useState(() => Object.fromEntries(goals.map((goal) => [goal.key, goal.target || ""])));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function save() {
    setBusy(true);
    setError("");
    try {
      await axios.put("/insights-data/achievements/goals", { year, ...values }, { headers: authHeaders() });
      onSaved();
    } catch (err) {
      setError(err.response?.data?.error || "Couldn't save your goals.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="achievements-goal-editor">
      {goals.map((goal) => (
        <label key={goal.key}>
          <span>{GOAL_LABELS[goal.key]}</span>
          <input
            type="number"
            min={0}
            placeholder="No goal"
            value={values[goal.key]}
            onChange={(event) => setValues((current) => ({ ...current, [goal.key]: event.target.value }))}
          />
        </label>
      ))}
      <div className="achievements-goal-actions">
        <button type="button" className="is-primary" disabled={busy} onClick={save}>
          Save goals
        </button>
        <button type="button" onClick={onCancel}>
          Cancel
        </button>
      </div>
      <small>Leave a box empty for no goal. Clear all three to turn goals off for {year}.</small>
      {error ? <em>{error}</em> : null}
    </div>
  );
}

function GoalRow({ goal, year }) {
  if (!goal.target) return null;
  const expectedPct = goal.expected != null ? Math.min(100, Math.round((goal.expected / goal.target) * 100)) : null;
  const currentYear = new Date().getFullYear() === year;
  return (
    <div className={`achievements-goal is-${goal.status}`}>
      <div className="achievements-goal-head">
        <strong>{GOAL_LABELS[goal.key]}</strong>
        <span>
          {goal.done.toLocaleString()} of {goal.target.toLocaleString()}
        </span>
      </div>
      <div className="achievements-goal-bar">
        <span style={{ width: `${goal.percent}%` }} />
        {currentYear && expectedPct != null && goal.status !== "complete" ? <i style={{ left: `${expectedPct}%` }} title={`Where you'd be at an even pace: ${goal.expected}`} /> : null}
      </div>
      <small>
        {STATUS_TEXT[goal.status]}
        {currentYear && goal.status === "behind" ? `. You'd be at ${goal.expected.toLocaleString()} at an even pace.` : ""}
      </small>
    </div>
  );
}

function Badge({ badge }) {
  const tierClass = badge.tier ? `tier-${badge.tier.toLowerCase()}` : "is-locked";
  return (
    <article className={`achievements-badge ${tierClass}`} title={badge.description}>
      <span className="achievements-badge-medal">
        <AwardLineIcon size={22} />
      </span>
      <div>
        <strong>{badge.name}</strong>
        <small>{badge.description}</small>
        <div className="achievements-badge-progress">
          <span style={{ width: `${badge.progress}%` }} />
        </div>
        <em>
          {badge.tier ? `${badge.tier} · ` : ""}
          {badge.next == null
            ? `${badge.value.toLocaleString()} ${badge.unit}, top tier`
            : `${badge.value.toLocaleString()} of ${badge.next.toLocaleString()} ${badge.unit} for the next tier`}
        </em>
      </div>
    </article>
  );
}

export default function AchievementsPanel({ userId }) {
  const [data, setData] = useState(null);
  const [editing, setEditing] = useState(false);
  const [showAll, setShowAll] = useState(false);
  const [reload, setReload] = useState(0);
  const year = new Date().getFullYear();

  useEffect(() => {
    if (!userId) return undefined;
    let active = true;
    axios
      .get("/insights-data/achievements", { headers: authHeaders(), params: { userId, year } })
      .then((response) => active && setData(response.data))
      .catch(() => active && setData(null));
    return () => {
      active = false;
    };
  }, [userId, year, reload]);

  if (!data || data.empty || !data.badges) return null;

  const hasGoals = data.goals.some((goal) => goal.target);
  const sorted = [...data.badges].sort((a, b) => b.tierIndex - a.tierIndex || b.progress - a.progress);
  const visible = showAll ? sorted : sorted.slice(0, 6);

  return (
    <section className="achievements">
      <div className="achievements-head">
        <div>
          <p>Achievements</p>
          <span>
            {data.earned} of {data.total} badges earned. {data.summary.movies.toLocaleString()} movies, {data.summary.episodes.toLocaleString()} episodes and{" "}
            {data.summary.hours.toLocaleString()} hours so far.
          </span>
        </div>
        <Link to={`/statistics?tab=wrapped`} className="achievements-wrapped-link">
          Your {year} in review
        </Link>
      </div>

      <div className="achievements-goals">
        <div className="achievements-goals-head">
          <strong>{year} goals</strong>
          {data.canEditGoals && !editing ? (
            <button type="button" onClick={() => setEditing(true)}>
              {hasGoals ? "Edit goals" : "Set a goal"}
            </button>
          ) : null}
        </div>
        {editing ? (
          <GoalEditor
            year={year}
            goals={data.goals}
            onCancel={() => setEditing(false)}
            onSaved={() => {
              setEditing(false);
              setReload((value) => value + 1);
            }}
          />
        ) : hasGoals ? (
          <div className="achievements-goal-list">
            {data.goals.map((goal) => (
              <GoalRow key={goal.key} goal={goal} year={year} />
            ))}
          </div>
        ) : (
          <small className="achievements-muted">
            No goals yet. So far this year you&apos;ve watched {data.goals.find((goal) => goal.key === "movies")?.done || 0} movies and{" "}
            {data.goals.find((goal) => goal.key === "episodes")?.done || 0} episodes.
          </small>
        )}
      </div>

      <div className="achievements-badges">
        {visible.map((badge) => (
          <Badge key={badge.id} badge={badge} />
        ))}
      </div>
      {sorted.length > 6 ? (
        <button type="button" className="achievements-more" onClick={() => setShowAll((value) => !value)}>
          {showAll ? "Show fewer badges" : `Show all ${sorted.length} badges`}
        </button>
      ) : null}
    </section>
  );
}
