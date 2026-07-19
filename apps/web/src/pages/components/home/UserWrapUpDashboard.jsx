import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import axios from "../../../lib/axios_instance";
import Config from "../../../lib/config";
import { slugifyUserName } from "../../../lib/userProfile";
import AccountCircleFillIcon from "remixicon-react/AccountCircleFillIcon";
import CalendarLineIcon from "remixicon-react/CalendarLineIcon";
import FilmLineIcon from "remixicon-react/FilmLineIcon";
import PlayCircleLineIcon from "remixicon-react/PlayCircleLineIcon";
import StackLineIcon from "remixicon-react/StackLineIcon";
import TimeLineIcon from "remixicon-react/TimeLineIcon";
import TrophyLineIcon from "remixicon-react/TrophyLineIcon";
import UserSettingsLineIcon from "remixicon-react/UserSettingsLineIcon";
import "../../css/home-user-wrap.css";

const token = localStorage.getItem("token");

function formatWatchTime(seconds = 0) {
  const totalMinutes = Math.round(Number(seconds || 0) / 60);
  const days = Math.floor(totalMinutes / 1440);
  const hours = Math.floor((totalMinutes % 1440) / 60);
  const minutes = totalMinutes % 60;

  if (days) {
    return `${days}d ${hours}h`;
  }

  if (hours) {
    return `${hours}h ${minutes}m`;
  }

  return `${minutes}m`;
}

function greeting() {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

function formatHour(hour) {
  if (hour === undefined || hour === null) {
    return "N/A";
  }

  const date = new Date();
  date.setHours(Number(hour), 0, 0, 0);
  return date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

function avatar(user, size = 96) {
  if (user.PrimaryImageTag) {
    return <img src={`/proxy/Users/Images/Primary?id=${user.UserId}&fillWidth=${size * 2}&quality=90`} alt="" />;
  }

  return <AccountCircleFillIcon size={size} />;
}

function buildHeatmap(activity = [], startDate) {
  const activityMap = new Map(activity.map((day) => [new Date(day.Date).toISOString().slice(0, 10), day]));
  const start = startDate ? new Date(startDate) : new Date();
  const end = new Date();
  start.setHours(0, 0, 0, 0);
  end.setHours(0, 0, 0, 0);

  const cells = [];
  for (const current = new Date(start); current <= end; current.setDate(current.getDate() + 1)) {
    const key = current.toISOString().slice(0, 10);
    const item = activityMap.get(key);
    cells.push({
      date: key,
      streams: item?.Streams || 0,
      duration: Number(item?.Duration || 0),
      day: current.getDay(),
    });
  }

  return cells;
}

function intensity(streams) {
  if (!streams) return 0;
  if (streams >= 10) return 4;
  if (streams >= 6) return 3;
  if (streams >= 3) return 2;
  return 1;
}

function WrapMetric({ icon: Icon, label, value, detail, imageId, imageType = "Backdrop" }) {
  const backgroundStyle = imageId
    ? {
        "--metric-art": `url(/proxy/Items/Images/${imageType}?id=${imageId}&fillWidth=720&quality=44)`,
      }
    : undefined;

  return (
    <div className={`wrap-metric-card ${imageId ? "has-artwork" : ""}`} style={backgroundStyle}>
      <Icon size={30} />
      <span>{label}</span>
      <strong>{value || "N/A"}</strong>
      <small>{detail || ""}</small>
    </div>
  );
}

function Heatmap({ user }) {
  const cells = buildHeatmap(user.DailyActivity, user.FirstActivityDate);
  const monthLabels = [];
  let lastMonth = "";

  cells.forEach((cell, index) => {
    const month = new Date(cell.date).toLocaleString([], { month: "short" });
    if (month !== lastMonth) {
      monthLabels.push({ month, index });
      lastMonth = month;
    }
  });

  return (
    <div className="wrap-heatmap">
      <div className="wrap-heatmap-header">
        <span>Activity</span>
        <strong>{user.FirstActivityDate ? `${new Date(user.FirstActivityDate).toLocaleDateString()} to now` : "No playback yet"}</strong>
      </div>
      <div className="wrap-heatmap-months">
        {monthLabels.map((label) => (
          <span key={`${label.month}-${label.index}`} style={{ gridColumnStart: Math.max(1, Math.floor(label.index / 7) + 1) }}>
            {label.month}
          </span>
        ))}
      </div>
      <div className="wrap-heatmap-grid">
        {cells.map((cell) => (
          <span
            className={`heatmap-cell heat-${intensity(cell.streams)}`}
            key={cell.date}
            title={`${cell.date}: ${cell.streams} streams, ${formatWatchTime(cell.duration)}`}
          />
        ))}
      </div>
      <div className="wrap-heatmap-legend">
        <span>Less</span>
        {[0, 1, 2, 3, 4].map((level) => (
          <i className={`heatmap-cell heat-${level}`} key={level} />
        ))}
        <span>More</span>
      </div>
    </div>
  );
}

export function QuickConnectUserWrap({ user, rank }) {
  const heroImageId = user.TopMovie?.ItemId || user.TopSeries?.ItemId || user.TopTitle?.ItemId;
  const posterImageId = user.TopMovie?.ItemId || user.TopTitle?.ItemId || user.TopSeries?.ItemId;
  const seriesImageId = user.TopSeries?.ItemId || user.TopTitle?.ItemId || user.TopMovie?.ItemId;

  return (
    <article className="user-wrap-card">
      <div
        className="user-wrap-hero"
        style={{
          backgroundImage: heroImageId
            ? `linear-gradient(90deg, rgba(14, 20, 32, 0.98), rgba(14, 20, 32, 0.72)), url(/proxy/Items/Images/Backdrop?id=${heroImageId}&fillWidth=1800&quality=50)`
            : undefined,
        }}
      >
        <div className="user-wrap-avatar">{avatar(user, 106)}</div>
        <div>
          <p>{greeting()}</p>
          <h2>{user.UserName}</h2>
          <span>{user.IsAdministrator ? "Server admin" : "Jellyfin Quick Connect user"}</span>
        </div>
      </div>

      <div className="user-wrap-body">
        <div className="user-wrap-title-row">
          <h3>Personal Wrap-Up</h3>
          <span>Rank #{rank}</span>
        </div>

        <div className="wrap-metric-grid">
          <WrapMetric icon={TrophyLineIcon} label="Server rank" value={`#${rank}`} detail={`${user.TotalStreams || 0} streams`} imageId={heroImageId} />
          <WrapMetric icon={PlayCircleLineIcon} label="Total streams" value={user.TotalStreams || 0} detail={formatWatchTime(user.TotalWatchTime)} imageId={seriesImageId} />
          <WrapMetric icon={FilmLineIcon} label="Top title" value={user.TopTitle?.Name} detail={`${user.TopTitle?.Count || 0} plays`} imageId={user.TopTitle?.ItemId || heroImageId} />
          <WrapMetric icon={StackLineIcon} label="Top library" value={user.TopLibrary?.Name} detail={`${user.TopLibrary?.Count || 0} plays`} imageId={heroImageId} />
          <WrapMetric icon={CalendarLineIcon} label="Top day" value={user.TopDay?.Name} detail={`${user.TopDay?.Count || 0} streams`} imageId={heroImageId} />
          <WrapMetric icon={TimeLineIcon} label="Time of day" value={formatHour(user.TopHour?.Hour)} detail={`${user.TopHour?.Count || 0} streams`} imageId={seriesImageId} />
          <WrapMetric icon={FilmLineIcon} label="Top movie" value={user.TopMovie?.Name} detail={`${user.TopMovie?.Count || 0} plays`} imageId={posterImageId} imageType="Primary" />
          <WrapMetric icon={UserSettingsLineIcon} label="Watch style" value={user.TopClient?.Name} detail={`${user.UniqueClients || 0} clients`} imageId={seriesImageId} />
        </div>

        <Heatmap user={user} />
      </div>
    </article>
  );
}

export function AccountDashboard({ access }) {
  const localUsers = access?.localUsers || [];
  return (
    <section className="account-dashboard">
      <div>
        <p>Account center</p>
        <h2>OIDC & Local Users</h2>
        <span>Manage non-Jellyfin accounts separately from Jellyfin Quick Connect watch history.</span>
      </div>

      <div className="account-dashboard-grid">
        <div>
          <strong>{access?.authMode === "oidc" ? "OIDC / Authentik" : access?.authMode === "local" ? "Local login" : "Jellyfin Quick Connect"}</strong>
          <span>Active sign-in mode</span>
        </div>
        <div>
          <strong>{localUsers.length}</strong>
          <span>Local users</span>
        </div>
        <div>
          <strong>{access?.roles?.length || 0}</strong>
          <span>Roles</span>
        </div>
      </div>

      {localUsers.length ? (
        <div className="account-user-strip">
          {localUsers.slice(0, 6).map((user) => (
            <span key={user.id}>
              <AccountCircleFillIcon size={22} />
              {user.username}
              <small>{user.role || "Viewer"}</small>
            </span>
          ))}
        </div>
      ) : null}
    </section>
  );
}

export default function UserWrapUpDashboard() {
  const [users, setUsers] = useState([]);
  const [access, setAccess] = useState(null);
  const [authMode, setAuthMode] = useState("quick-connect");

  useEffect(() => {
    async function fetchData() {
      try {
        const [config, userResponse, accessResponse] = await Promise.all([
          Config.getConfig(),
          axios.get("/stats/getUserWrapUp", { headers: { Authorization: `Bearer ${token}` } }),
          axios.get("/api/userAccess", { headers: { Authorization: `Bearer ${token}` } }),
        ]);

        setAuthMode(config.settings?.auth?.mode || accessResponse.data.authMode || "quick-connect");
        setUsers(userResponse.data.filter((user) => Number(user.TotalStreams || 0) > 0));
        setAccess(accessResponse.data);
      } catch (error) {
        console.log(error);
      }
    }

    fetchData();
    const intervalId = setInterval(fetchData, 60000 * 5);
    return () => clearInterval(intervalId);
  }, []);

  const rankedUsers = useMemo(() => users.sort((a, b) => Number(b.TotalWatchTime || 0) - Number(a.TotalWatchTime || 0)), [users]);

  if (!rankedUsers.length && !access) {
    return null;
  }

  return (
    <section className="home-user-wrap">
      <div className="home-user-wrap-header">
        <div>
          <p>Personal dashboards</p>
          <h1>User Wrap-Ups</h1>
          <span>Jellyfin Quick Connect users get playback insight. OIDC and local accounts get account controls.</span>
        </div>
        <strong>{authMode === "quick-connect" ? "Jellyfin Quick Connect" : authMode === "oidc" ? "OIDC / Authentik" : "Local login"}</strong>
      </div>

      <div className="home-user-wrap-list">
        {rankedUsers.slice(0, 6).map((user, index) => (
          <Link className="user-wrap-card-link" to={`/users/${slugifyUserName(user.UserName)}`} key={user.UserId}>
            <QuickConnectUserWrap user={user} rank={index + 1} />
          </Link>
        ))}
      </div>

      <AccountDashboard access={access} />
    </section>
  );
}
