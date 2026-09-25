// Per-user achievements (badges with tiers) and optional yearly watch goals.
// Everything is computed from jf_playback_activity on request; only goals are stored.
const db = require("../db");

const TZ = process.env.TZ || "UTC";
const MOVIE_MIN_SECONDS = 20 * 60; // a movie counts once someone has watched 20 minutes of it
const EPISODE_MIN_SECONDS = 5 * 60;
// Bulk "mark as watched" syncs and imports write many plays with the exact same timestamp.
// Time-of-day and same-day badges skip those so they reflect real viewing.
const REAL_PLAYS = `(SELECT a.* FROM jf_playback_activity a
   WHERE a."UserId" = $1
     AND (SELECT COUNT(*) FROM jf_playback_activity b WHERE b."UserId" = a."UserId" AND b."ActivityDateInserted" = a."ActivityDateInserted") <= 2)`;

let tableReady = null;
function ensureTable() {
  if (!tableReady) {
    tableReady = db.pool
      .query(
        `CREATE TABLE IF NOT EXISTS jg_watch_goals (
           user_key text NOT NULL,
           year integer NOT NULL,
           movies integer,
           episodes integer,
           hours integer,
           updated_at timestamptz NOT NULL DEFAULT NOW(),
           PRIMARY KEY (user_key, year)
         )`
      )
      .catch((error) => {
        tableReady = null;
        throw error;
      });
  }
  return tableReady;
}

async function q(sql, params = []) {
  const { rows } = await db.pool.query(sql, params);
  return rows;
}

// Each badge has increasing tier thresholds; tier names are shared.
const TIERS = ["Bronze", "Silver", "Gold", "Platinum"];
const BADGES = [
  { id: "movie-buff", name: "Movie buff", description: "Different movies watched", unit: "movies", tiers: [10, 50, 200, 500] },
  { id: "series-finisher", name: "Finisher", description: "Shows watched from the first episode to the last", unit: "shows", tiers: [1, 5, 20, 50] },
  { id: "episode-hunter", name: "Episode hunter", description: "Different episodes watched", unit: "episodes", tiers: [50, 250, 1000, 5000] },
  { id: "marathoner", name: "Marathoner", description: "Hours watched in total", unit: "hours", tiers: [24, 100, 500, 1500] },
  { id: "binge", name: "Binge watcher", description: "Most episodes of one show in a single day", unit: "episodes", tiers: [4, 8, 15, 25] },
  { id: "streak", name: "On a roll", description: "Longest run of days in a row with something watched", unit: "days", tiers: [3, 7, 30, 100] },
  { id: "regular", name: "Regular", description: "Days with something watched", unit: "days", tiers: [30, 100, 365, 1000] },
  { id: "night-owl", name: "Night owl", description: "Plays started between midnight and 5am", unit: "plays", tiers: [10, 50, 200, 500] },
  { id: "early-bird", name: "Early bird", description: "Plays started between 5am and 9am", unit: "plays", tiers: [10, 50, 200, 500] },
  { id: "explorer", name: "Explorer", description: "Different genres watched", unit: "genres", tiers: [5, 12, 20, 28] },
  { id: "time-traveller", name: "Time traveller", description: "Decades of film and TV watched", unit: "decades", tiers: [3, 5, 7, 9] },
  { id: "first-in-line", name: "First in line", description: "New titles you were the first person to watch", unit: "titles", tiers: [1, 10, 50, 200] },
  { id: "rewatcher", name: "Comfort viewer", description: "Movies watched again on another day", unit: "movies", tiers: [1, 5, 20, 50] },
];

function badgeResult(badge, value) {
  const count = Number(value || 0);
  let tier = -1;
  badge.tiers.forEach((threshold, index) => {
    if (count >= threshold) tier = index;
  });
  const next = badge.tiers[tier + 1] ?? null;
  const floor = tier >= 0 ? badge.tiers[tier] : 0;
  return {
    id: badge.id,
    name: badge.name,
    description: badge.description,
    unit: badge.unit,
    value: count,
    tier: tier >= 0 ? TIERS[tier] : null,
    tierIndex: tier,
    maxTier: badge.tiers.length - 1,
    next,
    progress: next == null ? 100 : Math.max(0, Math.min(100, Math.round(((count - floor) / (next - floor)) * 100))),
  };
}

async function badgeValues(userId) {
  const params = [userId, TZ];
  const [totals, finished, binge, streak, hours, genres, decades, first, rewatch] = await Promise.all([
    q(
      `SELECT COUNT(DISTINCT a."NowPlayingItemId") FILTER (WHERE a."SeriesName" IS NULL AND a."PlaybackDuration" >= ${MOVIE_MIN_SECONDS})::int AS movies,
              COUNT(DISTINCT a."EpisodeId") FILTER (WHERE a."EpisodeId" IS NOT NULL AND a."PlaybackDuration" >= ${EPISODE_MIN_SECONDS})::int AS episodes,
              COALESCE(SUM(a."PlaybackDuration"), 0)::bigint AS seconds,
              COUNT(DISTINCT (a."ActivityDateInserted" AT TIME ZONE $2)::date)::int AS active_days
         FROM jf_playback_activity a WHERE a."UserId" = $1`,
      params
    ),
    q(
      `WITH seen AS (
         SELECT e."SeriesId" AS series_id, COUNT(DISTINCT a."EpisodeId") AS watched
           FROM jf_playback_activity a JOIN jf_library_episodes e ON e."EpisodeId" = a."EpisodeId"
          WHERE a."UserId" = $1 AND a."PlaybackDuration" >= ${EPISODE_MIN_SECONDS}
          GROUP BY e."SeriesId"
       ), totals AS (
         SELECT "SeriesId" AS series_id, COUNT(DISTINCT "EpisodeId") AS total
           FROM jf_library_episodes WHERE "SeriesId" IN (SELECT series_id FROM seen) GROUP BY "SeriesId"
       )
       SELECT COUNT(*)::int AS value FROM seen JOIN totals USING (series_id) WHERE totals.total >= 2 AND seen.watched >= totals.total`,
      [userId]
    ),
    q(
      `SELECT COALESCE(MAX(episodes), 0)::int AS value FROM (
         SELECT COUNT(DISTINCT a."EpisodeId") AS episodes
           FROM ${REAL_PLAYS} a
          WHERE a."EpisodeId" IS NOT NULL AND a."SeriesName" IS NOT NULL AND a."PlaybackDuration" >= ${EPISODE_MIN_SECONDS}
          GROUP BY a."SeriesName", (a."ActivityDateInserted" AT TIME ZONE $2)::date
         HAVING SUM(a."PlaybackDuration") <= 86400
       ) t`,
      params
    ),
    q(
      `WITH days AS (
         SELECT DISTINCT (a."ActivityDateInserted" AT TIME ZONE $2)::date AS day FROM jf_playback_activity a WHERE a."UserId" = $1
       ), grouped AS (
         SELECT day, day - (ROW_NUMBER() OVER (ORDER BY day))::int AS grp FROM days
       )
       SELECT COALESCE(MAX(length), 0)::int AS value FROM (SELECT COUNT(*) AS length FROM grouped GROUP BY grp) t`,
      params
    ),
    q(
      `SELECT COUNT(*) FILTER (WHERE h < 5)::int AS night, COUNT(*) FILTER (WHERE h >= 5 AND h < 9)::int AS early
         FROM (SELECT EXTRACT(HOUR FROM a."ActivityDateInserted" AT TIME ZONE $2) AS h FROM ${REAL_PLAYS} a) t`,
      params
    ),
    q(
      `SELECT COUNT(DISTINCT g.genre)::int AS value
         FROM jf_playback_activity a
         JOIN jf_library_items i ON i."Id" = a."NowPlayingItemId"
         CROSS JOIN LATERAL jsonb_array_elements_text(COALESCE(i."Genres", '[]'::jsonb)) AS g(genre)
        WHERE a."UserId" = $1`,
      [userId]
    ),
    q(
      `SELECT COUNT(DISTINCT (i."ProductionYear" / 10))::int AS value
         FROM jf_playback_activity a
         LEFT JOIN jf_library_episodes e ON e."EpisodeId" = a."EpisodeId"
         JOIN jf_library_items i ON i."Id" = COALESCE(e."SeriesId", a."NowPlayingItemId")
        WHERE a."UserId" = $1 AND i."ProductionYear" > 1900`,
      [userId]
    ),
    q(
      `WITH firsts AS (
         SELECT DISTINCT ON (a."NowPlayingItemId") a."NowPlayingItemId" AS item_id, a."UserId" AS user_id, a."ActivityDateInserted" AS played
           FROM jf_playback_activity a
          WHERE a."SeriesName" IS NULL
          ORDER BY a."NowPlayingItemId", a."ActivityDateInserted" ASC
       )
       SELECT COUNT(*)::int AS value
         FROM firsts f JOIN jf_library_items i ON i."Id" = f.item_id
        WHERE f.user_id = $1
          AND (SELECT COUNT(*) FROM jf_playback_activity b WHERE b."UserId" = f.user_id AND b."ActivityDateInserted" = f.played) <= 2
          AND i."DateCreated" IS NOT NULL AND f.played <= i."DateCreated" + interval '7 days'`,
      [userId]
    ),
    q(
      `SELECT COUNT(*)::int AS value FROM (
         SELECT a."NowPlayingItemId"
           FROM jf_playback_activity a
          WHERE a."UserId" = $1 AND a."SeriesName" IS NULL AND a."PlaybackDuration" >= ${MOVIE_MIN_SECONDS}
          GROUP BY a."NowPlayingItemId"
         HAVING COUNT(DISTINCT (a."ActivityDateInserted" AT TIME ZONE $2)::date) >= 2
       ) t`,
      params
    ),
  ]);
  const total = totals[0] || {};
  return {
    summary: {
      movies: total.movies || 0,
      episodes: total.episodes || 0,
      hours: Math.round(Number(total.seconds || 0) / 3600),
      activeDays: total.active_days || 0,
    },
    values: {
      "movie-buff": total.movies,
      "series-finisher": finished[0]?.value,
      "episode-hunter": total.episodes,
      marathoner: Math.floor(Number(total.seconds || 0) / 3600),
      binge: binge[0]?.value,
      streak: streak[0]?.value,
      regular: total.active_days,
      "night-owl": hours[0]?.night,
      "early-bird": hours[0]?.early,
      explorer: genres[0]?.value,
      "time-traveller": decades[0]?.value,
      "first-in-line": first[0]?.value,
      rewatcher: rewatch[0]?.value,
    },
  };
}

async function yearProgress(userId, year) {
  const rows = await q(
    `SELECT COUNT(DISTINCT a."NowPlayingItemId") FILTER (WHERE a."SeriesName" IS NULL AND a."PlaybackDuration" >= ${MOVIE_MIN_SECONDS})::int AS movies,
            COUNT(DISTINCT a."EpisodeId") FILTER (WHERE a."EpisodeId" IS NOT NULL AND a."PlaybackDuration" >= ${EPISODE_MIN_SECONDS})::int AS episodes,
            COALESCE(SUM(a."PlaybackDuration"), 0)::bigint AS seconds
       FROM jf_playback_activity a
      WHERE a."UserId" = $1 AND EXTRACT(YEAR FROM a."ActivityDateInserted" AT TIME ZONE $2) = $3`,
    [userId, TZ, year]
  );
  const row = rows[0] || {};
  return { movies: row.movies || 0, episodes: row.episodes || 0, hours: Math.floor(Number(row.seconds || 0) / 3600) };
}

function yearFraction(year) {
  const now = new Date();
  if (now.getFullYear() > year) return 1;
  if (now.getFullYear() < year) return 0;
  const start = new Date(year, 0, 1).getTime();
  const end = new Date(year + 1, 0, 1).getTime();
  return (now.getTime() - start) / (end - start);
}

async function getGoals(goalKey, year) {
  await ensureTable();
  const rows = await q(`SELECT movies, episodes, hours FROM jg_watch_goals WHERE user_key = $1 AND year = $2`, [goalKey, year]);
  return rows[0] || { movies: null, episodes: null, hours: null };
}

function cleanTarget(value) {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return null;
  return Math.min(parsed, 100000);
}

async function saveGoals(goalKey, year, input = {}) {
  await ensureTable();
  const goals = { movies: cleanTarget(input.movies), episodes: cleanTarget(input.episodes), hours: cleanTarget(input.hours) };
  if (goals.movies == null && goals.episodes == null && goals.hours == null) {
    await q(`DELETE FROM jg_watch_goals WHERE user_key = $1 AND year = $2`, [goalKey, year]);
  } else {
    await q(
      `INSERT INTO jg_watch_goals (user_key, year, movies, episodes, hours, updated_at) VALUES ($1, $2, $3, $4, $5, NOW())
       ON CONFLICT (user_key, year) DO UPDATE SET movies = EXCLUDED.movies, episodes = EXCLUDED.episodes, hours = EXCLUDED.hours, updated_at = NOW()`,
      [goalKey, year, goals.movies, goals.episodes, goals.hours]
    );
  }
  return goals;
}

async function buildAchievements(userId, goalKey, year) {
  const [{ summary, values }, progress, goals] = await Promise.all([badgeValues(userId), yearProgress(userId, year), getGoals(goalKey, year)]);
  const fraction = yearFraction(year);
  const goalRows = ["movies", "episodes", "hours"].map((key) => {
    const target = goals[key];
    const done = progress[key];
    const expected = target ? Math.round(target * fraction) : null;
    return {
      key,
      target,
      done,
      percent: target ? Math.min(100, Math.round((done / target) * 100)) : null,
      expected,
      status: !target ? "unset" : done >= target ? "complete" : done >= expected ? "on-track" : "behind",
    };
  });
  const badges = BADGES.map((badge) => badgeResult(badge, values[badge.id]));
  return {
    year,
    summary,
    goals: goalRows,
    badges,
    earned: badges.filter((badge) => badge.tierIndex >= 0).length,
    total: badges.length,
  };
}

module.exports = { BADGES, TIERS, buildAchievements, saveGoals, getGoals };
