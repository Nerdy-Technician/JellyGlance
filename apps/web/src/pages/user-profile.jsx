import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import axios from "../lib/axios_instance";
import Config from "../lib/config";
import { slugifyUserName } from "../lib/userProfile";
import Loading from "./components/general/loading";
import UserInfo from "./components/user-info";
import { AccountDashboard, QuickConnectUserWrap } from "./components/home/UserWrapUpDashboard";
import "./css/home-user-wrap.css";

const token = localStorage.getItem("token");

function MediaPoster({ item }) {
  const [failed, setFailed] = useState(!item?.hasPrimaryImage);

  if (failed) {
    return <span>{item?.type?.slice(0, 1) || "M"}</span>;
  }

  return (
    <img
      src={`/proxy/Items/Images/Primary?id=${item.imageId || item.id}&fillWidth=260&quality=82`}
      alt=""
      loading="lazy"
      onError={() => setFailed(true)}
    />
  );
}

function UserMediaRail({ title, subtitle, items = [], onAction, actions = [], variant = "" }) {
  const previewItems = items.slice(0, 18);

  return (
    <section className={`user-media-rail${variant ? ` is-${variant}` : ""}`}>
      <div className="user-media-rail-heading">
        <div>
          <h2>{title}</h2>
          <p>{subtitle}</p>
        </div>
        <strong>{items.length}</strong>
      </div>
      <div className="user-media-grid">
        {previewItems.length ? (
          previewItems.map((item) => (
            <article key={item.id} className="user-media-card">
              <Link to={`/libraries/item/${item.id}`}>
                <div className="user-media-poster">
                  <MediaPoster item={item} />
                </div>
                <strong>{item.type === "Episode" && item.seriesName ? item.seriesName : item.name}</strong>
                <span>
                  {item.type}
                  {item.year ? ` · ${item.year}` : ""}
                  {item.progress ? ` · ${item.progress}%` : ""}
                </span>
                {item.type === "Episode" ? (
                  <small>
                    S{item.seasonNumber ?? "?"}:E{item.episodeNumber ?? "?"} · {item.name}
                  </small>
                ) : item.reason ? (
                  <small>Because of {item.reason}</small>
                ) : item.users?.length ? (
                  <small>{item.users.join(", ")}</small>
                ) : null}
              </Link>
              {actions.length ? (
                <div className="user-media-actions">
                  {actions.map((action) => (
                    <button key={action.action} type="button" title={action.label} onClick={() => onAction?.(item, action.action)}>
                      {action.label}
                    </button>
                  ))}
                </div>
              ) : null}
            </article>
          ))
        ) : (
          <div className="user-media-empty">Nothing here yet.</div>
        )}
      </div>
      {items.length > previewItems.length ? <div className="user-media-more">{items.length - previewItems.length} more hidden by this compact rail.</div> : null}
    </section>
  );
}

export default function UserProfilePage() {
  const { UserId: userKey = "" } = useParams();
  const [users, setUsers] = useState([]);
  const [access, setAccess] = useState(null);
  const [config, setConfig] = useState(null);
  const [mediaLists, setMediaLists] = useState({ favourites: [], watchlist: [] });
  const [mediaSearch, setMediaSearch] = useState("");
  const [mediaMessage, setMediaMessage] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchProfileData() {
      try {
        const [configResponse, userResponse, accessResponse] = await Promise.all([
          Config.getConfig(),
          axios.get("/stats/getUserWrapUp", { headers: { Authorization: `Bearer ${token}` } }),
          axios.get("/api/userAccess", { headers: { Authorization: `Bearer ${token}` } }),
        ]);

        setConfig(configResponse);
        setUsers(userResponse.data || []);
        setAccess(accessResponse.data);
      } catch (error) {
        console.log(error);
      } finally {
        setLoading(false);
      }
    }

    fetchProfileData();
    const intervalId = setInterval(fetchProfileData, 60000 * 5);
    return () => clearInterval(intervalId);
  }, []);

  const rankedUsers = useMemo(
    () => [...users].sort((a, b) => Number(b.TotalWatchTime || 0) - Number(a.TotalWatchTime || 0)),
    [users]
  );

  const matchedUser = rankedUsers.find((user) => {
    const normalizedKey = decodeURIComponent(userKey).toLowerCase();
    return user.UserId?.toLowerCase?.() === normalizedKey || slugifyUserName(user.UserName) === normalizedKey;
  });

  const rank = matchedUser ? rankedUsers.findIndex((user) => user.UserId === matchedUser.UserId) + 1 : 0;
  const localUsers = access?.localUsers || [];
  const localUser = localUsers.find((user) => slugifyUserName(user.username) === decodeURIComponent(userKey).toLowerCase());

  useEffect(() => {
    let active = true;

    async function fetchMediaLists() {
      if (!matchedUser?.UserId) {
        setMediaLists({ favourites: [], watchlist: [] });
        return;
      }

      try {
        const response = await axios.get(`/api/users/${encodeURIComponent(matchedUser.UserId)}/media-lists`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (active) {
          setMediaLists(response.data || { favourites: [], watchlist: [] });
        }
      } catch (error) {
        console.log(error);
        if (active) {
          setMediaLists({ favourites: [], watchlist: [] });
        }
      }
    }

    fetchMediaLists();
    return () => {
      active = false;
    };
  }, [matchedUser?.UserId]);

  const reloadMediaLists = async () => {
    if (!matchedUser?.UserId) return;
    const response = await axios.get(`/api/users/${encodeURIComponent(matchedUser.UserId)}/media-lists`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    setMediaLists(response.data || { favourites: [], watchlist: [] });
  };

  async function runMediaAction(item, action) {
    if (!matchedUser?.UserId || !item?.id) return;
    try {
      setMediaMessage("");
      await axios.post(
        `/api/users/${encodeURIComponent(matchedUser.UserId)}/media/${encodeURIComponent(item.id)}/actions`,
        { action },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setMediaMessage("Updated Jellyfin media state.");
      await reloadMediaLists();
    } catch (error) {
      setMediaMessage(error.response?.data?.error || error.message || "Unable to update item.");
    }
  }

  const filterMedia = (items = []) => {
    const query = mediaSearch.trim().toLowerCase();
    if (!query) return items;
    return items.filter((item) =>
      [item.name, item.seriesName, item.type, item.year, ...(item.genres || []), ...(item.users || [])]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(query))
    );
  };

  if (loading) {
    return <Loading />;
  }

  if (matchedUser) {
    return (
      <div className="user-profile-page">
        <QuickConnectUserWrap user={matchedUser} rank={rank || 1} />
        <div className="user-profile-media-section">
          <section className="user-media-toolbar">
            <div>
              <h2>Media profile</h2>
              <p>Favourites, watchlist, progress, recommendations, and shared household picks.</p>
            </div>
            <input type="search" value={mediaSearch} onChange={(event) => setMediaSearch(event.target.value)} placeholder="Search this profile..." />
          </section>
          {mediaMessage ? <div className="user-media-message">{mediaMessage}</div> : null}
          <UserMediaRail
            title="Continue Watching"
            subtitle="In-progress Jellyfin media for this user."
            items={filterMedia(mediaLists.continueWatching || [])}
            onAction={runMediaAction}
            actions={[{ label: "Watched", action: "markWatched" }]}
          />
          <UserMediaRail title="Recently Watched" subtitle="Last 10 synced plays for this user." items={filterMedia(mediaLists.recentlyWatched || [])} />
          <UserMediaRail
            title="Favourites"
            subtitle="Jellyfin favourites for this user."
            items={filterMedia(mediaLists.favourites || [])}
            onAction={runMediaAction}
            actions={[{ label: "Unfavourite", action: "unfavourite" }, { label: "Watched", action: "markWatched" }]}
          />
          <UserMediaRail
            title="Watchlist Movies"
            subtitle="Movies pulled from Jellyfin Watchlist."
            items={filterMedia(mediaLists.watchlistByType?.movies || [])}
            onAction={runMediaAction}
            actions={[{ label: "Remove", action: "removeWatchlist" }, { label: "Favourite", action: "favourite" }, { label: "Watched", action: "markWatched" }]}
            variant="featured"
          />
          <UserMediaRail
            title="Watchlist Shows"
            subtitle="Shows pulled from Jellyfin Watchlist."
            items={filterMedia(mediaLists.watchlistByType?.shows || [])}
            onAction={runMediaAction}
            actions={[{ label: "Remove", action: "removeWatchlist" }, { label: "Favourite", action: "favourite" }]}
            variant="featured"
          />
          <UserMediaRail title="Next Episodes" subtitle="Next unwatched episodes for watchlisted shows." items={filterMedia(mediaLists.nextEpisodes || [])} onAction={runMediaAction} actions={[{ label: "Watched", action: "markWatched" }]} />
          <UserMediaRail title="Recommended" subtitle="Suggestions based on watchlist genres." items={filterMedia(mediaLists.recommendations || [])} onAction={runMediaAction} actions={[{ label: "Watchlist", action: "addWatchlist" }, { label: "Favourite", action: "favourite" }]} />
          <section className="user-media-taste">
            <div>
              <h2>Taste profile</h2>
              <p>Built from favourites, watchlist, and recent plays.</p>
            </div>
            <div>
              {(mediaLists.taste?.genres || []).map((item) => <span key={`genre-${item.name}`}>{item.name} · {item.count}</span>)}
              {(mediaLists.taste?.actors || []).slice(0, 6).map((item) => <span key={`actor-${item.name}`}>{item.name} · {item.count}</span>)}
              {(mediaLists.taste?.studios || []).slice(0, 6).map((item) => <span key={`studio-${item.name}`}>{item.name} · {item.count}</span>)}
            </div>
          </section>
          <UserMediaRail title="Shared Favourites" subtitle="Items this user and others overlap on." items={filterMedia(mediaLists.sharedFavourites || [])} />
          <UserMediaRail title="Family Watchlist" subtitle="Combined household watchlist, grouped by popularity." items={filterMedia([...(mediaLists.familyWatchlist?.movies || []), ...(mediaLists.familyWatchlist?.shows || [])])} />
          <UserMediaRail title="Stale Watchlist" subtitle="Watchlisted for 30+ days and not cleared yet." items={filterMedia(mediaLists.staleWatchlist || [])} onAction={runMediaAction} actions={[{ label: "Remove", action: "removeWatchlist" }]} />
          <UserMediaRail title="Library Gaps" subtitle="Watchlisted shows with an unwatched next episode to catch up on." items={filterMedia(mediaLists.libraryGaps || [])} />
        </div>
      </div>
    );
  }

  if (localUser || ["local", "oidc"].includes(config?.settings?.auth?.mode)) {
    return (
      <div className="user-profile-page">
        <AccountDashboard access={access} />
      </div>
    );
  }

  if (userKey.length > 20) {
    return <UserInfo />;
  }

  return (
    <div className="user-profile-page">
      <section className="user-profile-empty">
        <h1>User not found</h1>
        <p>No JellyGlance profile matched `{decodeURIComponent(userKey)}`.</p>
        <Link to="/users">Back to users</Link>
      </section>
    </div>
  );
}
