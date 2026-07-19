import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import ArrowLeftSLineIcon from "remixicon-react/ArrowLeftSLineIcon";
import ArrowRightSLineIcon from "remixicon-react/ArrowRightSLineIcon";
import FolderOpenLineIcon from "remixicon-react/FolderOpenLineIcon";

import axios from "../lib/axios_instance";
import ErrorBoundary from "./components/general/ErrorBoundary";
import Loading from "./components/general/loading";
import RecentlyAddedCard from "./components/library/RecentlyAdded/recently-added-card";
import "./css/home.css";
import "./css/recently-added-page.css";

const mediaTypes = ["Series", "Movie", "Audio", "Episode"];
const shelfCacheKey = "jellyglance_recently_added_shelves_v2_posters";

export default function RecentlyAddedPage() {
  const [shelves, setShelves] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const shelfRefs = useRef({});
  const token = localStorage.getItem("token");

  const headers = useMemo(
    () => ({
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    }),
    [token]
  );

  const fetchShelves = useCallback(async () => {
    try {
      setError("");
      const response = await axios.get("/api/getRecentlyAddedShelves?limit=24", { headers });
      const nextShelves = Array.isArray(response.data)
        ? response.data.map((shelf) => {
            const items = Array.isArray(shelf.items)
              ? shelf.items.filter((item) => mediaTypes.includes(item.Type)).slice(0, 24)
              : [];

            return {
              ...shelf,
              count: items.length,
              items,
            };
          })
        : [];

      sessionStorage.setItem(shelfCacheKey, JSON.stringify({ shelves: nextShelves, cachedAt: Date.now() }));
      setShelves(nextShelves);
    } catch (err) {
      console.log(err);
      setError("Recently added media could not be loaded.");
    } finally {
      setLoading(false);
    }
  }, [headers]);

  useEffect(() => {
    const cached = sessionStorage.getItem(shelfCacheKey);
    if (cached) {
      try {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed.shelves)) {
          setShelves(parsed.shelves);
          setLoading(false);
        }
      } catch (error) {
        sessionStorage.removeItem(shelfCacheKey);
      }
    }

    fetchShelves();
    const intervalId = setInterval(fetchShelves, 60000 * 5);
    return () => clearInterval(intervalId);
  }, [fetchShelves]);

  const scrollShelf = (id, direction) => {
    const shelf = shelfRefs.current[id];
    if (!shelf) {
      return;
    }

    shelf.scrollBy({
      left: direction * shelf.clientWidth,
      behavior: "smooth",
    });
  };

  if (loading) {
    return <Loading />;
  }

  return (
    <div className="Home recently-added-page">
      <div className="recently-added-page-header">
        <p>Media shelf</p>
        <h1>Recently Added</h1>
        <span>Fresh films, series, episodes, and audio grouped by Jellyfin folder.</span>
      </div>

      {error ? <div className="recently-added-error">{error}</div> : null}

      <div className="recently-added-shelves">
        {shelves.length === 0 && !error ? (
          <div className="recently-added-empty">
            <FolderOpenLineIcon size={34} />
            <span>No recently added media found yet.</span>
          </div>
        ) : null}

        {shelves.map((shelf) => (
          <section className="recent-library-shelf" key={shelf.id}>
            <div className="recent-library-shelf-header">
              <div className="recent-library-shelf-title">
                <div className="recent-library-shelf-icon" aria-hidden="true">
                  <FolderOpenLineIcon size={22} />
                </div>
                <div>
                  <h2>{shelf.name}</h2>
                  <span>
                    {shelf.count} recent {shelf.count === 1 ? "item" : "items"}
                  </span>
                </div>
              </div>
              <div className="recent-library-shelf-controls">
                <button
                  type="button"
                  aria-label={`Scroll ${shelf.name} left`}
                  disabled={shelf.items.length <= 10}
                  onClick={() => scrollShelf(shelf.id, -1)}
                >
                  <ArrowLeftSLineIcon size={21} />
                </button>
                <button
                  type="button"
                  aria-label={`Scroll ${shelf.name} right`}
                  disabled={shelf.items.length <= 10}
                  onClick={() => scrollShelf(shelf.id, 1)}
                >
                  <ArrowRightSLineIcon size={21} />
                </button>
              </div>
            </div>

            <div
              className="recent-library-shelf-track"
              ref={(node) => {
                shelfRefs.current[shelf.id] = node;
              }}
            >
              {shelf.items.length > 0 ? (
                shelf.items.map((item) => (
                  <ErrorBoundary key={`${shelf.id}-${item.EpisodeId || item.Id}`}>
                    <RecentlyAddedCard data={item} />
                  </ErrorBoundary>
                ))
              ) : (
                <div className="recent-library-shelf-empty">No recent items in this library.</div>
              )}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
