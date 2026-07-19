import { useState } from "react";

import MVLibraries from "./statCards/mv_libraries";
import MVMovies from "./statCards/mv_movies";
import MVSeries from "./statCards/mv_series";
import MostUsedClient from "./statCards/most_used_client";
import MostActiveUsers from "./statCards/most_active_users";
import MPSeries from "./statCards/mp_series";
import MPMovies from "./statCards/mp_movies";
import MVMusic from "./statCards/mv_music";
import MPMusic from "./statCards/mp_music";

import "../css/statCard.css";
import { Trans } from "react-i18next";
import PlaybackMethodStats from "./statCards/playback_method_stats";

function HomeStatisticCards({ days: controlledDays }) {
  const isControlled = controlledDays !== undefined && controlledDays !== null;
  const [days, setDays] = useState(localStorage.getItem("PREF_HOME_STAT_DAYS") ?? 30);
  const [input, setInput] = useState(localStorage.getItem("PREF_HOME_STAT_DAYS") ?? 30);
  const activeDays = isControlled ? controlledDays : days;

  const handleKeyDown = (event) => {
    if (event.key === "Enter") {
      if (input < 1) {
        setInput(1);
        setDays(0);
      } else {
        setDays(parseInt(input));
        localStorage.setItem("PREF_HOME_STAT_DAYS", input);
      }
    }
  };

  return (
    <div className="watch-stat-cards">
      <div className="Heading my-3">
        <div>
          <p className="stat-section-eyebrow">Overview</p>
          <h1>
            <Trans i18nKey="HOME_PAGE.WATCH_STATISTIC" />
          </h1>
          <span className="stat-section-subtitle">Top libraries, users, clients, and playback methods for this window.</span>
        </div>
        {!isControlled && (
          <div className="date-range">
            <div className="header">
              <Trans i18nKey="LAST" />
            </div>
            <div className="days">
              <input
                type="number"
                min={1}
                value={input}
                onChange={(event) => setInput(event.target.value)}
                onKeyDown={handleKeyDown}
              />
            </div>
            <div className="trailer">
              <Trans i18nKey="UNITS.DAYS" />
            </div>
          </div>
        )}
      </div>
      <div className="grid-stat-cards">
        <MVMovies days={activeDays} />
        <MPMovies days={activeDays} />
        <MVSeries days={activeDays} />
        <MPSeries days={activeDays} />
        <MVMusic days={activeDays} />
        <MPMusic days={activeDays} />
        <MVLibraries days={activeDays} />
        <MostUsedClient days={activeDays} />
        <MostActiveUsers days={activeDays} />
        <PlaybackMethodStats days={activeDays} />
      </div>
    </div>
  );
}

export default HomeStatisticCards;
