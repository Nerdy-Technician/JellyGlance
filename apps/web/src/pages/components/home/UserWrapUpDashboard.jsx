import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import axios from "../../../lib/axios_instance";
import Config from "../../../lib/config";
import { slugifyUserName } from "../../../lib/userProfile";
import AccountCircleFillIcon from "remixicon-react/AccountCircleFillIcon";
import CalendarLineIcon from "remixicon-react/CalendarLineIcon";
import ComputerLineIcon from "remixicon-react/ComputerLineIcon";
import FilmLineIcon from "remixicon-react/FilmLineIcon";
import FireLineIcon from "remixicon-react/FireLineIcon";
import MoonLineIcon from "remixicon-react/MoonLineIcon";
import PlayCircleLineIcon from "remixicon-react/PlayCircleLineIcon";
import StarSmileLineIcon from "remixicon-react/StarSmileLineIcon";
import StackLineIcon from "remixicon-react/StackLineIcon";
import SunLineIcon from "remixicon-react/SunLineIcon";
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

function getNextTarget(value, targets) {
  const current = Number(value || 0);
  return targets.find((target) => current < target) || targets[targets.length - 1];
}

function progress(value, target) {
  return Math.max(0, Math.min(100, (Number(value || 0) / Number(target || 1)) * 100));
}

function daysSince(value) {
  if (!value) return Infinity;
  return Math.floor((Date.now() - new Date(value).getTime()) / (24 * 60 * 60 * 1000));
}

function buildUserAchievements(user, rank) {
  const streams = Number(user.TotalStreams || 0);
  const watchSeconds = Number(user.TotalWatchTime || 0);
  const watchHours = watchSeconds / 3600;
  const uniqueTitles = Number(user.UniqueTitles || 0);
  const uniqueClients = Number(user.UniqueClients || 0);
  const topHour = Number(user.TopHour?.Hour ?? -1);
  const topDayCount = Number(user.TopDay?.Count || 0);
  const topLibraryCount = Number(user.TopLibrary?.Count || 0);
  const recentDays = daysSince(user.LastActivityDate);
  const streamTarget = getNextTarget(streams, [10, 25, 50, 100, 250, 500, 1000, 2500, 5000]);
  const hourTarget = getNextTarget(watchHours, [10, 25, 50, 100, 250, 500, 1000, 2500]);
  const titleTarget = getNextTarget(uniqueTitles, [5, 10, 25, 50, 100, 250, 500]);
  const clientTarget = getNextTarget(uniqueClients, [2, 3, 5, 8, 12]);

  return [
    {
      id: "rank",
      title: rank === 1 ? "Household Champion" : "Leaderboard Climber",
      value: `#${rank}`,
      detail: rank === 1 ? "Top watch-time rank in the household." : "Ranked by total watch time.",
      icon: TrophyLineIcon,
      unlocked: rank === 1,
      progress: rank === 1 ? 100 : Math.max(12, 100 - rank * 12),
    },
    {
      id: "streams",
      title: streams >= 1000 ? "Stream Machine" : "Play Counter",
      value: streams.toLocaleString(),
      detail: `${Math.max(streamTarget - streams, 0).toLocaleString()} streams to ${streamTarget.toLocaleString()}`,
      icon: PlayCircleLineIcon,
      unlocked: streams >= 10,
      progress: progress(streams, streamTarget),
    },
    {
      id: "watch-time",
      title: watchHours >= 500 ? "Time Lord" : "Time Collector",
      value: formatWatchTime(watchSeconds),
      detail: `${formatWatchTime(Math.max(hourTarget * 3600 - watchSeconds, 0))} to ${hourTarget.toLocaleString()} hours`,
      icon: TimeLineIcon,
      unlocked: watchHours >= 10,
      progress: progress(watchHours, hourTarget),
    },
    {
      id: "unique-titles",
      title: uniqueTitles >= 100 ? "Taste Explorer" : "Sampler",
      value: uniqueTitles.toLocaleString(),
      detail: `${Math.max(titleTarget - uniqueTitles, 0).toLocaleString()} titles to ${titleTarget.toLocaleString()}`,
      icon: StarSmileLineIcon,
      unlocked: uniqueTitles >= 5,
      progress: progress(uniqueTitles, titleTarget),
    },
    {
      id: "clients",
      title: uniqueClients >= 5 ? "Device Hopper" : "Client Curious",
      value: uniqueClients.toLocaleString(),
      detail: user.TopClient?.Name ? `${user.TopClient.Name} is the favourite client.` : "No client history yet.",
      icon: ComputerLineIcon,
      unlocked: uniqueClients >= 2,
      progress: progress(uniqueClients, clientTarget),
    },
    {
      id: "watch-window",
      title: topHour >= 22 || topHour <= 4 ? "Night Owl" : topHour >= 5 && topHour <= 11 ? "Morning Watcher" : "Prime-Time Regular",
      value: formatHour(user.TopHour?.Hour),
      detail: `${user.TopHour?.Count || 0} streams around this time.`,
      icon: topHour >= 22 || topHour <= 4 ? MoonLineIcon : topHour >= 5 && topHour <= 11 ? SunLineIcon : FireLineIcon,
      unlocked: topHour >= 0,
      progress: progress(Number(user.TopHour?.Count || 0), 25),
    },
    {
      id: "favourite-day",
      title: "Ritual Day",
      value: user.TopDay?.Name || "N/A",
      detail: `${topDayCount.toLocaleString()} streams on this day.`,
      icon: CalendarLineIcon,
      unlocked: topDayCount >= 3,
      progress: progress(topDayCount, 25),
    },
    {
      id: "library-loyalty",
      title: topLibraryCount >= 50 ? "Library Loyalist" : "Library Regular",
      value: user.TopLibrary?.Name || "N/A",
      detail: `${topLibraryCount.toLocaleString()} plays in this library.`,
      icon: StackLineIcon,
      unlocked: topLibraryCount >= 10,
      progress: progress(topLibraryCount, 100),
    },
    {
      id: "recent",
      title: recentDays <= 7 ? "Recently Active" : "Comeback Pending",
      value: recentDays === Infinity ? "Never" : `${recentDays}d`,
      detail: recentDays <= 7 ? "Watched within the last week." : "No synced playback in the last week.",
      icon: FireLineIcon,
      unlocked: recentDays <= 7,
      progress: recentDays === Infinity ? 0 : Math.max(0, 100 - recentDays * 8),
    },
  ];
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

function UserAchievements({ user, rank }) {
  const achievements = buildUserAchievements(user, rank);

  return (
    <section className="wrap-achievements" aria-label={`${user.UserName} achievements`}>
      <div className="wrap-achievements-header">
        <div>
          <span>Achievements</span>
          <strong>Personal Badges</strong>
        </div>
        <em>{achievements.filter((achievement) => achievement.unlocked).length}/{achievements.length} unlocked</em>
      </div>
      <div className="wrap-achievement-grid">
        {achievements.map((achievement) => {
          const Icon = achievement.icon;
          return (
            <article className={`wrap-achievement-card ${achievement.unlocked ? "is-unlocked" : ""}`} key={achievement.id}>
              <span className="wrap-achievement-icon">
                <Icon size={22} />
              </span>
              <div>
                <strong>{achievement.title}</strong>
                <small>{achievement.detail}</small>
              </div>
              <em>{achievement.value}</em>
              <span className="wrap-achievement-progress" aria-hidden="true">
                <i style={{ width: `${achievement.progress}%` }} />
              </span>
            </article>
          );
        })}
      </div>
    </section>
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

        <UserAchievements user={user} rank={rank} />

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
