import { Tabs, Tab } from "react-bootstrap";
import { useState } from "react";
import BarChartFillIcon from "remixicon-react/BarChartFillIcon";
import CalendarLineIcon from "remixicon-react/CalendarLineIcon";
import PulseLineIcon from "remixicon-react/PulseLineIcon";

import "./css/stats.css";

import DailyPlayStats from "./components/statistics/daily-play-count";
import PlayStatsByDay from "./components/statistics/play-stats-by-day";
import PlayStatsByHour from "./components/statistics/play-stats-by-hour";
import HomeStatisticCards from "./components/HomeStatisticCards";
import { Trans } from "react-i18next";

function Statistics() {
  const presets = [7, 30, 90];
  const [days, setDays] = useState(
    localStorage.getItem("PREF_STATISTICS_STAT_DAYS_INPUT") != undefined
      ? localStorage.getItem("PREF_STATISTICS_STAT_DAYS_INPUT")
      : localStorage.getItem("PREF_STATISTICS_STAT_DAYS") ?? 20
  );
  const [input, setInput] = useState(localStorage.getItem("PREF_STATISTICS_STAT_DAYS_INPUT") ?? 20);

  const handleOnChange = (event) => {
    setInput(event.target.value);
    localStorage.setItem("PREF_STATISTICS_STAT_DAYS_INPUT", event.target.value);
  };

  const [activeTab, setActiveTab] = useState(localStorage.getItem(`PREF_STATISTICS_LAST_SELECTED_TAB`) ?? "tabCount");

  function setTab(tabName) {
    setActiveTab(tabName);
    localStorage.setItem(`PREF_STATISTICS_LAST_SELECTED_TAB`, tabName);
  }

  const applyDays = (value = input) => {
    const nextDays = Math.max(1, parseInt(value, 10) || 1);
    setInput(nextDays);
    setDays(nextDays);
    localStorage.setItem("PREF_STATISTICS_STAT_DAYS", nextDays);
    localStorage.setItem("PREF_STATISTICS_STAT_DAYS_INPUT", nextDays);
  };

  const handleKeyDown = (event) => {
    if (event.key === "Enter") {
      applyDays();
    }
  };

  const modeLabel = activeTab === "tabCount" ? "Count view" : "Duration view";

  return (
    <div className="watch-stats">
      <div className="stats-page-header">
        <div className="stats-title-block">
          <div className="stats-title-icon">
            <BarChartFillIcon />
          </div>
          <div>
            <p className="stats-eyebrow">Playback analytics</p>
            <h1>
              <Trans i18nKey={"STAT_PAGE.STATISTICS"} />
            </h1>
            <p className="stats-subtitle">Library trends, daily activity, and watch-time patterns.</p>
          </div>
        </div>

        <div className="stats-controls">
          <div className="stats-tab-nav">
            <Tabs defaultActiveKey={activeTab} activeKey={activeTab} onSelect={setTab} variant="pills">
              <Tab eventKey="tabCount" className="bg-transparent" title={<Trans i18nKey="STAT_PAGE.COUNT_VIEW" />} />

              <Tab eventKey="tabDuration" className="bg-transparent" title={<Trans i18nKey="STAT_PAGE.DURATION_VIEW" />} />
            </Tabs>
          </div>
          <div className="stats-range-panel">
            <div className="stats-range-label">
              <CalendarLineIcon size={17} />
              <span>
                <Trans i18nKey={"LAST"} />
              </span>
            </div>
            <div className="stats-presets">
              {presets.map((preset) => (
                <button
                  className={Number(days) === preset ? "active" : ""}
                  key={preset}
                  type="button"
                  onClick={() => applyDays(preset)}
                >
                  {preset}
                </button>
              ))}
            </div>
            <div className="stats-days-input">
              <input type="number" min={1} value={input} onChange={handleOnChange} onKeyDown={handleKeyDown} />
              <span>
                <Trans i18nKey={`UNITS.DAY${days > 1 ? "S" : ""}`} />
              </span>
            </div>
            <button className="stats-apply-button" type="button" onClick={() => applyDays()}>
              Apply
            </button>
          </div>
        </div>
      </div>

      <div className="stats-summary-strip" aria-label="Statistics filters">
        <div>
          <PulseLineIcon />
          <span>Mode</span>
          <strong>{modeLabel}</strong>
        </div>
        <div>
          <CalendarLineIcon />
          <span>Window</span>
          <strong>
            {days} <Trans i18nKey={`UNITS.DAY${days > 1 ? "S" : ""}`} />
          </strong>
        </div>
        <div>
          <BarChartFillIcon />
          <span>Refresh</span>
          <strong>Every 5 minutes</strong>
        </div>
      </div>

      <div className="statistics-dashboard">
        <HomeStatisticCards days={days} />
      </div>

      {activeTab === "tabCount" && (
        <div className="statistics-dashboard">
          <div className="stats-section-heading">
            <p>Charts</p>
            <h2>Playback Over Time</h2>
          </div>
          <DailyPlayStats days={days} viewName="count" />
          <div className="statistics-graphs">
            <PlayStatsByDay days={days} viewName="count" />
            <PlayStatsByHour days={days} viewName="count" />
          </div>
        </div>
      )}

      {activeTab === "tabDuration" && (
        <div className="statistics-dashboard">
          <div className="stats-section-heading">
            <p>Charts</p>
            <h2>Playback Duration</h2>
          </div>
          <DailyPlayStats days={days} viewName="duration" />
          <div className="statistics-graphs">
            <PlayStatsByDay days={days} viewName="duration" />
            <PlayStatsByHour days={days} viewName="duration" />
          </div>
        </div>
      )}
    </div>
  );
}

export default Statistics;
