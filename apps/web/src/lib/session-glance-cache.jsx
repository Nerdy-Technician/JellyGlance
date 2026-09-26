import { useEffect, useMemo, useRef, useState } from "react";
import axios from "./axios_instance";

const GLANCE_TTL_MS = 5 * 60 * 1000;
const DOWNLOAD_POLL_MS = 45000;
const TDARR_POLL_MS = 20000;

function authHeaders() {
  const token = localStorage.getItem("token");
  return token ? { Authorization: `Bearer ${token}` } : {};
}

function glanceIdsForSession(session) {
  const item = session?.NowPlayingItem;
  if (!item?.Id) return [];
  return [item.Id, item.SeriesId].filter(Boolean);
}

function sessionLookupId(session) {
  return session?.NowPlayingItem?.Id || "";
}

function titleForSession(session) {
  const item = session?.NowPlayingItem;
  if (!item) return "";
  return item.Type === "Episode" ? item.SeriesName || item.Name : item.Name;
}

function namesOverlap(left = "", right = "") {
  const a = String(left).toLowerCase();
  const b = String(right).toLowerCase();
  return Boolean(a && b && (a.includes(b) || b.includes(a)));
}

export function useSessionGlanceStitch(sessions = []) {
  const [glanceById, setGlanceById] = useState({});
  const [downloads, setDownloads] = useState([]);
  const [tdarrJobs, setTdarrJobs] = useState([]);
  const glanceByIdRef = useRef(glanceById);
  glanceByIdRef.current = glanceById;

  const ids = useMemo(() => {
    const next = new Set();
    for (const session of sessions || []) {
      for (const id of glanceIdsForSession(session)) next.add(String(id));
    }
    return [...next].sort();
  }, [sessions]);

  const idKey = ids.join(",");

  useEffect(() => {
    if (!ids.length || !localStorage.getItem("token")) return undefined;
    let cancelled = false;
    const now = Date.now();
    const missing = ids.filter((id) => {
      const cached = glanceByIdRef.current[id];
      return !cached || now - cached.fetchedAt > GLANCE_TTL_MS;
    });
    if (!missing.length) return undefined;

    Promise.all(
      missing.map((id) =>
        axios
          .get(`/api/item-glance/${encodeURIComponent(id)}`, { headers: authHeaders() })
          .then((response) => [id, response.data])
          .catch(() => [id, null])
      )
    ).then((rows) => {
      if (cancelled) return;
      setGlanceById((current) => {
        const next = { ...current };
        for (const [id, data] of rows) {
          next[id] = { data, fetchedAt: Date.now() };
        }
        return next;
      });
    });

    return () => {
      cancelled = true;
    };
  }, [idKey, ids]);

  useEffect(() => {
    if (!localStorage.getItem("token")) return undefined;
    let cancelled = false;
    async function loadDownloads() {
      try {
        const response = await axios.get("/api/downloads/stitched", { headers: authHeaders() });
        if (!cancelled) setDownloads(Array.isArray(response.data?.items) ? response.data.items : []);
      } catch {
        if (!cancelled) setDownloads([]);
      }
    }
    loadDownloads();
    const timer = setInterval(loadDownloads, DOWNLOAD_POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, []);

  useEffect(() => {
    if (!localStorage.getItem("token")) return undefined;
    let cancelled = false;
    async function loadTdarr() {
      try {
        const response = await axios.get("/api/tdarr/transcodes", {
          headers: authHeaders(),
          params: { activeOnly: true },
        });
        const data = response.data || {};
        if (!cancelled) setTdarrJobs([...(data.active || []), ...(data.queued || [])]);
      } catch {
        if (!cancelled) setTdarrJobs([]);
      }
    }
    loadTdarr();
    const timer = setInterval(loadTdarr, TDARR_POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, []);

  return useMemo(() => {
    const map = new Map();
    for (const session of sessions || []) {
      const itemId = sessionLookupId(session);
      if (!itemId) continue;
      const seriesId = session.NowPlayingItem?.SeriesId;
      const glance = glanceById[itemId]?.data || glanceById[seriesId]?.data || null;
      const title = titleForSession(session);
      const download =
        glance?.download ||
        downloads.find((row) => {
          if (row.request?.jellyfinItemId && [String(itemId), String(seriesId || "")].includes(String(row.request.jellyfinItemId))) {
            return true;
          }
          return namesOverlap(row.name, title);
        }) ||
        null;
      const tdarr = tdarrJobs.find((job) => [String(itemId), String(seriesId || "")].includes(String(job.itemId || ""))) || null;
      const request = glance?.request || download?.request || null;
      if (!request && !download && !tdarr) {
        map.set(itemId, null);
        continue;
      }
      map.set(itemId, { request, download, tdarr });
    }
    return map;
  }, [downloads, glanceById, sessions, tdarrJobs]);
}
