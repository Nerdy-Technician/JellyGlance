import { useEffect, useMemo, useState } from "react";
import axios from "../../lib/axios_instance";
import baseUrl from "../../lib/baseurl";

const CACHE_KEY = "jellyglance:auth-artwork-background-v2";
const CACHE_TTL = 5 * 60 * 1000;
const REFRESH_INTERVAL = 5 * 60 * 1000;

function readCachedArtwork() {
  try {
    const cached = JSON.parse(localStorage.getItem(CACHE_KEY) || "null");
    if (!cached || Date.now() - cached.createdAt > CACHE_TTL || !Array.isArray(cached.artwork)) {
      return [];
    }
    return cached.artwork;
  } catch {
    return [];
  }
}

function cacheArtwork(artwork) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify({ createdAt: Date.now(), artwork }));
  } catch {
    // Decorative only; storage failures should never block auth.
  }
}

export default function AuthArtworkBackground({ enabled = true }) {
  const [artwork, setArtwork] = useState(() => (enabled ? readCachedArtwork() : []));

  useEffect(() => {
    if (!enabled) {
      setArtwork([]);
      return undefined;
    }

    let cancelled = false;

    const fetchPosters = async () => {
      try {
        const response = await axios.get("/auth/background-posters", { params: { limit: 28 } });
        const nextArtwork = response?.data?.artwork || response?.data?.posters || [];
        if (!cancelled && nextArtwork.length > 0) {
          setArtwork(nextArtwork);
          cacheArtwork(nextArtwork);
        }
      } catch {
        if (!cancelled) {
          setArtwork(readCachedArtwork());
        }
      }
    };

    fetchPosters();
    const interval = window.setInterval(fetchPosters, REFRESH_INTERVAL);

    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [enabled]);

  const artworkRows = useMemo(
    () => {
      const rowCount = 4;
      const rows = Array.from({ length: rowCount }, () => []);

      artwork.slice(0, 30).forEach((item, index) => {
        rows[index % rowCount].push(item);
      });

      return rows.map((row, rowIndex) => (
        <div className="auth-artwork-row" key={`artwork-row-${rowIndex}`}>
          {row.map((item, itemIndex) => {
            const isBackdrop = item.imageType === "backdrop";
            const imagePath = isBackdrop ? "Backdrop" : "Primary";
            const width = isBackdrop ? 680 : 320;
            const src = `${baseUrl}/proxy/Items/Images/${imagePath}?id=${item.id}&fillWidth=${width}&quality=58`;

            return (
              <div
                className={`auth-artwork-card ${isBackdrop ? "is-backdrop" : "is-poster"}`}
                key={`${item.id}-${item.imageType}-${item.imageTag || itemIndex}`}
              >
                <img src={src} loading="lazy" decoding="async" alt="" />
              </div>
            );
          })}
        </div>
      ));
    },
    [artwork]
  );

  return (
    <div className={`auth-artwork-background ${artwork.length > 0 ? "has-posters" : ""}`} aria-hidden="true">
      {artwork.length > 0 && <div className="auth-artwork-grid">{artworkRows}</div>}
      <div className="auth-artwork-scrim" />
      <div className="auth-artwork-vignette" />
    </div>
  );
}
