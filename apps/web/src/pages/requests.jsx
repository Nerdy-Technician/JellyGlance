import { useEffect, useMemo, useState } from "react";
import ChatCheckFillIcon from "remixicon-react/ChatCheckFillIcon";
import CheckboxCircleLineIcon from "remixicon-react/CheckboxCircleLineIcon";
import CloseCircleLineIcon from "remixicon-react/CloseCircleLineIcon";
import ErrorWarningLineIcon from "remixicon-react/ErrorWarningLineIcon";
import ExternalLinkLineIcon from "remixicon-react/ExternalLinkLineIcon";
import Edit2LineIcon from "remixicon-react/Edit2LineIcon";
import AccountCircleFillIcon from "remixicon-react/AccountCircleFillIcon";
import RefreshLineIcon from "remixicon-react/RefreshLineIcon";
import SearchLineIcon from "remixicon-react/SearchLineIcon";
import { Modal } from "react-bootstrap";
import axios from "../lib/axios_instance";
import "./css/integrations.css";

function formatDate(value) {
  if (!value) return "Unknown";
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function getRequestAge(value) {
  const createdAt = value ? new Date(value).getTime() : 0;
  if (!createdAt) return { label: "Unknown age", level: "unknown", hours: 0 };

  const hours = Math.max(0, Math.floor((Date.now() - createdAt) / 3600000));
  if (hours >= 168) return { label: `${Math.floor(hours / 24)}d old`, level: "week", hours };
  if (hours >= 24) return { label: `${Math.floor(hours / 24)}d old`, level: "day", hours };
  if (hours >= 1) return { label: `${hours}h old`, level: "fresh", hours };
  return { label: "New", level: "fresh", hours };
}

function brandIconUrl(slug, color = "FFFFFF") {
  return `https://cdn.simpleicons.org/${slug}/${color}`;
}

function formatPercentScore(value) {
  const score = Number(value);
  if (!Number.isFinite(score)) return "";
  return `${Math.round(score > 10 ? score : score * 10)}%`;
}

function formatTenPointScore(value) {
  const score = Number(value);
  if (!Number.isFinite(score)) return "";
  return score > 10 ? (score / 10).toFixed(1) : score.toFixed(1);
}

function hasRatingValue(value) {
  const score = Number(value);
  return Number.isFinite(score) && score > 0;
}

function getRequesterName(request) {
  return request?.requester?.name || request?.requestedBy || "Unknown user";
}

function getRequesterAvatarUrl(request) {
  const requester = request?.requester || {};
  if (requester.jellyfinUserId) {
    return `/proxy/Users/Images/Primary?id=${encodeURIComponent(requester.jellyfinUserId)}&fillWidth=96&quality=80`;
  }
  return requester.avatar && /^https?:\/\//i.test(requester.avatar) ? requester.avatar : "";
}

function RequesterIdentity({ request, compact = false }) {
  const name = getRequesterName(request);
  const avatarUrl = getRequesterAvatarUrl(request);
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("") || "?";

  return (
    <span className={`requests-user-chip${compact ? " is-compact" : ""}`}>
      <span className="requests-user-avatar">
        {avatarUrl ? (
          <img src={avatarUrl} alt="" onError={(event) => { event.currentTarget.style.display = "none"; }} />
        ) : (
          <span>{initials}</span>
        )}
        <AccountCircleFillIcon />
      </span>
      <span>
        <small>{compact ? "Requested by" : "Requester"}</small>
        <strong>{name}</strong>
      </span>
    </span>
  );
}

function RequesterByline({ request }) {
  const name = getRequesterName(request);
  const avatarUrl = getRequesterAvatarUrl(request);
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("") || "?";

  return (
    <span className="requests-requester-byline">
      <span className="requests-requester-avatar">
        {avatarUrl ? (
          <img src={avatarUrl} alt="" onError={(event) => { event.currentTarget.style.display = "none"; }} />
        ) : (
          <span>{initials}</span>
        )}
      </span>
      <span>Requested by <strong>{name}</strong></span>
    </span>
  );
}

function RequestPoster({ request, large = false }) {
  const urls = request.posterUrls?.length ? request.posterUrls : request.posterUrl ? [request.posterUrl] : [];
  const [posterIndex, setPosterIndex] = useState(0);
  const posterUrl = urls[posterIndex];

  if (posterUrl) {
    return (
      <img
        src={posterUrl}
        alt=""
        loading={large ? undefined : "lazy"}
        onError={() => {
          if (posterIndex < urls.length - 1) {
            setPosterIndex((current) => current + 1);
          }
        }}
      />
    );
  }

  return String(request.status).toLowerCase() === "error" ? <ErrorWarningLineIcon /> : <ChatCheckFillIcon />;
}

export default function Requests() {
  const [data, setData] = useState({ sources: [], requests: [], syncedAt: null });
  const [loading, setLoading] = useState(true);
  const [actionMessage, setActionMessage] = useState("");
  const [busyAction, setBusyAction] = useState("");
  const [mediaSearch, setMediaSearch] = useState("");
  const [mediaSourceId, setMediaSourceId] = useState("all");
  const [mediaResults, setMediaResults] = useState([]);
  const [mediaSearchLoading, setMediaSearchLoading] = useState(false);
  const [mediaSearchMessage, setMediaSearchMessage] = useState("");
  const [selectedSeasons, setSelectedSeasons] = useState({});
  const [advancedOpen, setAdvancedOpen] = useState({});
  const [requestOptions, setRequestOptions] = useState({});
  const [requestOptionForms, setRequestOptionForms] = useState({});
  const [requestOptionsLoading, setRequestOptionsLoading] = useState({});
  const [statusFilter, setStatusFilter] = useState("All");
  const [sortMode, setSortMode] = useState("newest");
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [selectedRequestLoading, setSelectedRequestLoading] = useState(false);
  const [editingRequestId, setEditingRequestId] = useState("");
  const currentRole = useMemo(() => {
    try {
      return JSON.parse(localStorage.getItem("config") || "{}")?.settings?.auth?.role || "Viewer";
    } catch {
      return "Viewer";
    }
  }, []);
  const canManageRequests = currentRole === "Owner" || currentRole === "Admin";

  const visibleRequests = useMemo(() => {
    const normalizedSearch = mediaSearch.trim().toLowerCase();
    const filtered = (data.requests || []).filter((request) => {
      const statusMatches = statusFilter === "All" || String(request.status).toLowerCase() === statusFilter.toLowerCase();
      if (!statusMatches) return false;
      if (!normalizedSearch) return true;

      return [request.title, request.requestedBy, request.source, request.mediaType, request.status, request.availability?.status]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(normalizedSearch));
    });

    const sorted = [...filtered];
    sorted.sort((first, second) => {
      if (sortMode === "oldest") return new Date(first.createdAt || 0).getTime() - new Date(second.createdAt || 0).getTime();
      if (sortMode === "requester") return String(first.requestedBy || "").localeCompare(String(second.requestedBy || ""));
      if (sortMode === "status") return String(first.status || "").localeCompare(String(second.status || ""));
      if (sortMode === "availability") {
        return String(first.availability?.status || "").localeCompare(String(second.availability?.status || ""));
      }
      return new Date(second.createdAt || 0).getTime() - new Date(first.createdAt || 0).getTime();
    });
    return sorted;
  }, [data.requests, mediaSearch, sortMode, statusFilter]);

  const statuses = useMemo(() => ["All", ...new Set((data.requests || []).map((request) => request.status).filter(Boolean))], [data.requests]);
  const seerrSources = data.sources || [];

  function getDefaultOptionForm(options) {
    const preferredServer = options?.servers?.find((entry) => entry.server.isDefault && !entry.server.is4k) || options?.servers?.find((entry) => !entry.server.is4k) || options?.servers?.[0];
    const preferredProfile = preferredServer?.profiles?.find((profile) => profile.id === preferredServer.server.activeProfileId) || preferredServer?.profiles?.[0];
    const preferredRoot =
      preferredServer?.rootFolders?.find((folder) => folder.path === preferredServer.server.activeDirectory) ||
      preferredServer?.rootFolders?.[0];
    const preferredLanguage =
      preferredServer?.languageProfiles?.find((profile) => profile.id === preferredServer.server.activeLanguageProfileId) ||
      preferredServer?.languageProfiles?.[0];

    return {
      serverId: preferredServer?.server.id ?? "",
      profileId: preferredProfile?.id ?? "",
      rootFolder: preferredRoot?.path || preferredServer?.server.activeDirectory || "",
      languageProfileId: preferredLanguage?.id ?? "",
      tags: preferredServer?.server.activeTags || [],
      is4k: Boolean(preferredServer?.server.is4k),
    };
  }

  function getSelectedServer(result) {
    const form = requestOptionForms[result.id] || {};
    return requestOptions[result.id]?.servers?.find((entry) => String(entry.server.id) === String(form.serverId));
  }

  function updateOptionForm(result, updates) {
    setRequestOptionForms((current) => ({
      ...current,
      [result.id]: {
        ...(current[result.id] || {}),
        ...updates,
      },
    }));
  }

  async function openRequestEditor(request, event) {
    event?.stopPropagation();
    if (!canManageRequests || !request?.requestId || !request?.sourceId) return;

    setSelectedRequest(request);
    const shouldOpen = editingRequestId !== request.id;
    setEditingRequestId(shouldOpen ? request.id : "");
    if (shouldOpen) {
      await loadRequestOptions(request);
    }
  }

  async function saveRequestEdit(request, event) {
    event?.stopPropagation();
    if (!canManageRequests || !request?.requestId || !request?.sourceId) return;

    const optionForm = requestOptionForms[request.id] || {};
    try {
      setBusyAction(`${request.id}-edit`);
      setActionMessage("");
      await axios.put(
        `/api/requests/${encodeURIComponent(request.requestId)}/edit`,
        {
          sourceId: request.sourceId,
          serverId: optionForm.serverId,
          profileId: optionForm.profileId,
          rootFolder: optionForm.rootFolder,
          languageProfileId: optionForm.languageProfileId,
          tags: optionForm.tags || [],
          is4k: optionForm.is4k,
        },
        { headers: { Authorization: `Bearer ${localStorage.getItem("token")}` } }
      );
      setActionMessage(`Request updated in ${request.source}.`);
      setEditingRequestId("");
      await loadRequests(true);
    } catch (error) {
      setActionMessage(error.response?.data?.error || error.message || "Request edit failed");
    } finally {
      setBusyAction("");
    }
  }

  async function openRequestDetail(request) {
    setSelectedRequest(request);
    setEditingRequestId("");
    if (!request?.requestId || !request?.sourceId) return;

    try {
      setSelectedRequestLoading(true);
      const response = await axios.get(`/api/requests/${encodeURIComponent(request.requestId)}/detail`, {
        headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
        params: { sourceId: request.sourceId },
      });
      setSelectedRequest((current) => (current?.id === request.id ? { ...current, ...(response.data || {}) } : current));
    } catch (error) {
      console.log("Unable to load request detail", error);
    } finally {
      setSelectedRequestLoading(false);
    }
  }

  async function openMediaResultDetail(result, event) {
    event?.stopPropagation();
    const baseResult = {
      ...result,
      isSearchResult: true,
      status: result.requested ? "Already requested" : result.availability || "Requestable",
      availability: { status: result.availability || "Unknown" },
    };

    setSelectedRequest(baseResult);
    setEditingRequestId("");
    setAdvancedOpen((current) => ({ ...current, [result.id]: true }));
    if (result.mediaType === "tv" && result.seasons?.length) {
      setSelectedSeasons((current) => ({
        ...current,
        [result.id]: current[result.id] || result.seasons.map((season) => season.seasonNumber),
      }));
    }
    setSelectedRequestLoading(true);
    loadRequestOptions(result);

    try {
      const response = await axios.get("/api/requests/media-detail", {
        headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
        params: {
          sourceId: result.sourceId,
          mediaType: result.mediaType,
          mediaId: result.mediaId,
        },
      });
      const detail = response.data || {};
      setSelectedRequest((current) => (current?.id === result.id ? { ...current, ...detail, isSearchResult: true } : current));
      if (detail.mediaType === "tv" && detail.seasons?.length) {
        setSelectedSeasons((current) => ({
          ...current,
          [result.id]: current[result.id] || detail.seasons.map((season) => season.seasonNumber),
        }));
      }
    } catch (error) {
      console.log("Unable to load media detail", error);
      setActionMessage(error.response?.data?.error || error.message || "Unable to load media detail");
    } finally {
      setSelectedRequestLoading(false);
    }
  }

  async function loadRequests(force = false) {
    try {
      setLoading(true);
      const response = await axios.get("/api/requests", {
        headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
        params: force ? { force: "true" } : undefined,
      });
      setData(response.data || { sources: [], requests: [], syncedAt: null });
      const badgeCount = Number(response.data?.stats?.badgeCount || 0);
      localStorage.setItem("jellyglance_request_badge_count", String(badgeCount));
      window.dispatchEvent(new CustomEvent("jellyglance-request-count", { detail: badgeCount }));
    } finally {
      setLoading(false);
    }
  }

  async function runRequestAction(request, action, event) {
    event?.stopPropagation();
    if (!request?.requestId || !request?.sourceId) return;

    try {
      setBusyAction(`${request.id}-${action}`);
      setActionMessage("");
      await axios.post(
        `/api/requests/${encodeURIComponent(request.requestId)}/actions`,
        { sourceId: request.sourceId, action },
        { headers: { Authorization: `Bearer ${localStorage.getItem("token")}` } }
      );
      setActionMessage(`${action.charAt(0).toUpperCase()}${action.slice(1)} sent to ${request.source}.`);
      await loadRequests(true);
    } catch (error) {
      setActionMessage(error.response?.data?.error || error.message || "Action failed");
    } finally {
      setBusyAction("");
    }
  }

  async function requestMedia(result) {
    if (!result?.mediaId || !result?.sourceId) return;

    const resultKey = result.id;
    if (!result.isSearchResult && !advancedOpen[resultKey]) {
      setAdvancedOpen((current) => ({ ...current, [resultKey]: true }));
      setActionMessage(`Choose settings for ${result.title}, then confirm the request.`);
      await loadRequestOptions(result);
      return;
    }

    if (!requestOptions[resultKey] && requestOptionsLoading[resultKey]) {
      setActionMessage(`Loading settings for ${result.title}...`);
      return;
    }

    if (requestOptions[resultKey]?.error) {
      setActionMessage(requestOptions[resultKey].error);
      return;
    }

    const optionForm = requestOptionForms[resultKey] || {};
    const seasons =
      result.mediaType === "tv"
        ? selectedSeasons[resultKey]?.length
          ? selectedSeasons[resultKey]
          : (result.seasons || []).map((season) => season.seasonNumber)
        : undefined;

    try {
      setBusyAction(`media-${resultKey}`);
      setActionMessage("");
      const response = await axios.post(
        "/api/requests/media",
        {
          sourceId: result.sourceId,
          mediaType: result.mediaType,
          mediaId: result.mediaId,
          seasons,
          serverId: optionForm.serverId,
          profileId: optionForm.profileId,
          rootFolder: optionForm.rootFolder,
          languageProfileId: optionForm.languageProfileId,
          tags: optionForm.tags || [],
          is4k: optionForm.is4k,
        },
        { headers: { Authorization: `Bearer ${localStorage.getItem("token")}` } }
      );
      setActionMessage(`${result.title} sent to ${response.data?.source || result.source}.`);
      if (result.isSearchResult) {
        setSelectedRequest(null);
      }
      await loadRequests(true);
      runMediaSearch(true);
    } catch (error) {
      setActionMessage(error.response?.data?.error || error.message || "Media request failed");
    } finally {
      setBusyAction("");
    }
  }

  async function loadRequestOptions(result) {
    if (!result?.sourceId || requestOptions[result.id] || requestOptionsLoading[result.id]) return;

    try {
      setRequestOptionsLoading((current) => ({ ...current, [result.id]: true }));
      const response = await axios.get("/api/requests/options", {
        headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
        params: {
          sourceId: result.sourceId,
          mediaType: result.mediaType,
        },
      });
      const options = response.data || { servers: [] };
      setRequestOptions((current) => ({ ...current, [result.id]: options }));
      setRequestOptionForms((current) => ({
        ...current,
        [result.id]: current[result.id] || getDefaultOptionForm(options),
      }));
    } catch (error) {
      setRequestOptions((current) => ({
        ...current,
        [result.id]: { servers: [], error: error.response?.data?.error || error.message || "Unable to load request options" },
      }));
    } finally {
      setRequestOptionsLoading((current) => ({ ...current, [result.id]: false }));
    }
  }

  function toggleAdvancedOptions(result) {
    setAdvancedOpen((current) => ({ ...current, [result.id]: !current[result.id] }));
    loadRequestOptions(result);
  }

  function handleServerChange(result, serverId) {
    const selected = requestOptions[result.id]?.servers?.find((entry) => String(entry.server.id) === String(serverId));
    const nextForm = getDefaultOptionForm({ servers: selected ? [selected] : [] });
    updateOptionForm(result, {
      ...nextForm,
      serverId,
    });
  }

  function toggleTag(result, tagId) {
    const form = requestOptionForms[result.id] || {};
    const selected = new Set((form.tags || []).map(Number));
    const numericTagId = Number(tagId);
    if (selected.has(numericTagId)) {
      selected.delete(numericTagId);
    } else {
      selected.add(numericTagId);
    }
    updateOptionForm(result, { tags: [...selected] });
  }

  function toggleSeason(result, seasonNumber) {
    setSelectedSeasons((current) => {
      const selected = new Set(current[result.id] || (result.seasons || []).map((season) => season.seasonNumber));
      if (selected.has(seasonNumber)) {
        selected.delete(seasonNumber);
      } else {
        selected.add(seasonNumber);
      }

      return {
        ...current,
        [result.id]: [...selected].sort((a, b) => a - b),
      };
    });
  }

  function selectAllSeasons(result) {
    setSelectedSeasons((current) => ({
      ...current,
      [result.id]: (result.seasons || []).map((season) => season.seasonNumber),
    }));
  }

  function clearAllSeasons(result) {
    setSelectedSeasons((current) => ({
      ...current,
      [result.id]: [],
    }));
  }

  async function runMediaSearch(force = false) {
    const query = mediaSearch.trim();
    if (query.length < 2) {
      setMediaResults([]);
      setMediaSearchMessage("");
      return;
    }

    try {
      setMediaSearchLoading(true);
      setMediaSearchMessage("");
      const response = await axios.get("/api/requests/search", {
        headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
        params: {
          query,
          ...(mediaSourceId !== "all" ? { sourceId: mediaSourceId } : {}),
          ...(force ? { t: Date.now() } : {}),
        },
      });
      setMediaResults(response.data?.results || []);
      setSelectedSeasons((current) => {
        const next = { ...current };
        (response.data?.results || []).forEach((result) => {
          if (result.mediaType === "tv" && !next[result.id]) {
            next[result.id] = (result.seasons || []).map((season) => season.seasonNumber);
          }
        });
        return next;
      });
      const errors = response.data?.errors || [];
      setMediaSearchMessage(errors.length ? errors.map((error) => `${error.source}: ${error.message}`).join(" · ") : "");
    } catch (error) {
      setMediaResults([]);
      setMediaSearchMessage(error.response?.data?.error || error.message || "Unable to search media");
    } finally {
      setMediaSearchLoading(false);
    }
  }

  function openSeerrRequest(request, event) {
    event?.stopPropagation();
    if (request?.openUrl) {
      window.open(request.openUrl, "_blank", "noopener,noreferrer");
    }
  }

  useEffect(() => {
    loadRequests();
    const intervalId = setInterval(loadRequests, 60000);
    return () => clearInterval(intervalId);
  }, []);

  useEffect(() => {
    const searchTimer = setTimeout(runMediaSearch, 450);
    return () => clearTimeout(searchTimer);
  }, [mediaSearch, mediaSourceId]);

  const selectedRequestOptions = selectedRequest ? requestOptions[selectedRequest.id] : null;
  const selectedRequestServer = selectedRequest ? getSelectedServer(selectedRequest) : null;
  const selectedRequestForm = selectedRequest ? requestOptionForms[selectedRequest.id] || {} : {};
  const selectedRequestRoot = selectedRequestServer?.rootFolders?.find((folder) => folder.path === selectedRequestForm.rootFolder);

  return (
    <div className="requests-page">
      <header className="requests-hero">
        <div>
          <p>Request center</p>
          <h1>Requests</h1>
          <span>Search Seerr, choose destinations, and manage the request queue from one place.</span>
        </div>
        <div className="requests-hero-stats" aria-label="Request status overview">
          <span>
            <strong>{data.stats?.badgeCount || 0}</strong>
            Needs action
          </span>
          <span>
            <strong>{data.stats?.available || 0}</strong>
            Available
          </span>
          <span>
            <strong>{seerrSources.length}</strong>
            Sources
          </span>
        </div>
        <button type="button" onClick={() => loadRequests(true)} disabled={loading}>
          <RefreshLineIcon size={18} />
          {loading ? "Refreshing" : "Refresh"}
        </button>
      </header>

      {actionMessage ? <div className="requests-action-message">{actionMessage}</div> : null}

      <section className="requests-discovery">
        <div className="requests-discovery-head">
          <div>
            <p>Search</p>
            <h2>Find or request media</h2>
            <span>Search once to filter existing requests and request new media from Seerr results.</span>
          </div>
        </div>
        <label className="requests-media-search">
          <SearchLineIcon size={18} />
          <input
            type="search"
            value={mediaSearch}
            onChange={(event) => setMediaSearch(event.target.value)}
            placeholder="Search movies or TV shows..."
          />
          <button type="button" onClick={() => runMediaSearch(true)} disabled={mediaSearchLoading || mediaSearch.trim().length < 2}>
            {mediaSearchLoading ? "Searching" : "Search"}
          </button>
        </label>
        <section className="requests-control-bar">
          <label>
            <span>Sort queue</span>
            <select value={sortMode} onChange={(event) => setSortMode(event.target.value)}>
              <option value="newest">Newest first</option>
              <option value="oldest">Oldest first</option>
              <option value="requester">Requester</option>
              <option value="status">Status</option>
              <option value="availability">Availability</option>
            </select>
          </label>
          <strong>{visibleRequests.length} shown from {data.requests?.length || 0}</strong>
        </section>
        <nav className="requests-filter-strip" aria-label="Request status filters">
          {statuses.map((status) => (
            <button type="button" key={status} className={statusFilter === status ? "is-active" : ""} onClick={() => setStatusFilter(status)}>
              {status}
            </button>
          ))}
        </nav>
        {mediaSearchMessage ? <div className="requests-discovery-message">{mediaSearchMessage}</div> : null}
        {mediaResults.length ? (
          <div className="requests-discovery-results">
            {mediaResults.map((result) => {
              const isAlreadyAvailable = result.availability === "Available";
              const isAlreadyRequested = result.requested && !isAlreadyAvailable;
              const requestDisabled = Boolean(busyAction) || isAlreadyAvailable || isAlreadyRequested;
              const requestLabel = isAlreadyAvailable
                ? "Available"
                : isAlreadyRequested
                  ? "Already requested"
                  : "Request this";
              return (
                <article
                  key={result.id}
                  role="button"
                  tabIndex={0}
                  onClick={(event) => openMediaResultDetail(result, event)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      openMediaResultDetail(result, event);
                    }
                  }}
                >
                  <div className="requests-discovery-poster">
                    <RequestPoster request={result} />
                  </div>
                  <div className="requests-discovery-copy">
                    <strong>{result.title}{result.year ? ` (${result.year})` : ""}</strong>
                    <span>{result.mediaType === "tv" ? "TV" : "Movie"} · {result.source}</span>
                    <small>{result.availability || "Unknown"}</small>
                    {result.overview ? <p>{result.overview}</p> : null}
                  </div>
                  <div className="requests-discovery-actions">
                    <button type="button" disabled={requestDisabled} onClick={(event) => openMediaResultDetail(result, event)}>
                      <ChatCheckFillIcon size={16} />
                      {requestLabel}
                    </button>
                    {result.openUrl ? (
                      <button
                        type="button"
                        title={`Open in ${result.source}`}
                        onClick={(event) => {
                          event.stopPropagation();
                          window.open(result.openUrl, "_blank", "noopener,noreferrer");
                        }}
                      >
                        <ExternalLinkLineIcon size={16} />
                      </button>
                    ) : null}
                  </div>
                </article>
              );
            })}
          </div>
        ) : mediaSearch.trim().length < 2 ? (
          <div className="requests-discovery-prompt">
            <SearchLineIcon size={24} />
            <div>
              <strong>Search to add a request</strong>
              <span>The queue below is still visible. Type a title here to find new media and request it.</span>
            </div>
          </div>
        ) : mediaSearch.trim().length >= 2 && !mediaSearchLoading ? (
          <div className="requests-discovery-empty">No Seerr results found.</div>
        ) : null}
      </section>

      <section className="requests-board">
        {visibleRequests.map((request) => {
          const age = getRequestAge(request.createdAt);
          return (
            <article
              key={request.id}
              className={String(request.status).toLowerCase() === "error" ? "is-error" : ""}
              style={{ "--request-backdrop": request.backdropUrl ? `url("${request.backdropUrl}")` : "none" }}
              role="button"
              tabIndex={0}
              onClick={() => openRequestDetail(request)}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  openRequestDetail(request);
                }
              }}
            >
              <div className="requests-card-poster">
                <RequestPoster request={request} />
              </div>
              <div className="requests-card-title">
                <div>
                  <strong>{request.title}{request.year ? ` (${request.year})` : ""}</strong>
                  <span>{request.mediaType}</span>
                </div>
                <RequesterByline request={request} />
              </div>
              <div className="requests-card-meta">
                <div className="requests-card-status">
                  <b>{request.status}</b>
                </div>
                <div className={`requests-availability is-${String(request.availability?.status || "unknown").toLowerCase().replace(/[^a-z0-9]+/g, "-")}`}>
                  <b>{request.availability?.status || "Unknown"}</b>
                </div>
                <span className={`requests-age-badge is-${age.level}`}>{age.label}</span>
              </div>
              {request.genres?.length ? (
                <div className="requests-card-tags">
                  {request.genres.slice(0, 4).map((genre) => (
                    <span key={`${request.id}-${genre}`}>{genre}</span>
                  ))}
                </div>
              ) : null}
              {request.overview ? <p className="requests-card-overview">{request.overview}</p> : null}
              <div className="requests-card-footer">
                <time>{formatDate(request.createdAt)}</time>
              </div>
              <div className="requests-card-actions">
                {canManageRequests && request.status === "Pending" ? (
                  <>
                    <button type="button" title="Approve" disabled={Boolean(busyAction)} onClick={(event) => runRequestAction(request, "approve", event)}>
                      <CheckboxCircleLineIcon size={16} />
                      <span>Approve</span>
                    </button>
                    <button type="button" title="Decline" disabled={Boolean(busyAction)} onClick={(event) => runRequestAction(request, "decline", event)}>
                      <CloseCircleLineIcon size={16} />
                      <span>Decline</span>
                    </button>
                  </>
                ) : null}
                {canManageRequests && request.requestId && request.status === "Failed" ? (
                  <button type="button" title="Retry" disabled={Boolean(busyAction)} onClick={(event) => runRequestAction(request, "retry", event)}>
                    <RefreshLineIcon size={16} />
                    <span>Retry</span>
                  </button>
                ) : null}
                {canManageRequests && request.requestId ? (
                  <button type="button" title="Edit routing" disabled={Boolean(busyAction)} onClick={(event) => openRequestEditor(request, event)}>
                    <Edit2LineIcon size={16} />
                    <span>Edit</span>
                  </button>
                ) : null}
                {request.openUrl ? (
                  <button type="button" title={`Open in ${request.source}`} onClick={(event) => openSeerrRequest(request, event)}>
                    <ExternalLinkLineIcon size={16} />
                    <span>Open</span>
                  </button>
                ) : null}
              </div>
            </article>
          );
        })}

        {!visibleRequests.length ? (
          <div className="requests-empty-state">
            <ChatCheckFillIcon size={30} />
            <strong>No requests found</strong>
            <span>{data.requests?.length ? "Try a different search, sort, or status filter." : "Enable and test Jellyseerr or Overseerr in Settings > Integrations > Seerr Apps."}</span>
          </div>
        ) : null}
      </section>

      <Modal show={Boolean(selectedRequest)} onHide={() => { setSelectedRequest(null); setEditingRequestId(""); }} centered size="xl" contentClassName="requests-modal">
        {selectedRequest ? (
          <>
            <Modal.Body>
              <button type="button" className="requests-modal-close" aria-label="Close" onClick={() => { setSelectedRequest(null); setEditingRequestId(""); }}>
                <CloseCircleLineIcon size={22} />
              </button>
              <div className="requests-detail">
                <div className="requests-detail-art">
                  <RequestPoster request={selectedRequest} large />
                </div>
                  <div className="requests-detail-copy">
                    <div className="requests-detail-heading">
                    <span>{selectedRequest.isSearchResult ? "New request" : `${selectedRequest.mediaType} request`}</span>
                    <div className="requests-detail-title-row">
                      <h3>{selectedRequest.title}{selectedRequest.year ? ` (${selectedRequest.year})` : ""}</h3>
                      {hasRatingValue(selectedRequest.ratings?.imdb) ||
                      hasRatingValue(selectedRequest.ratings?.rottenTomatoes) ||
                      hasRatingValue(selectedRequest.ratings?.metacritic) ||
                      hasRatingValue(selectedRequest.ratings?.tmdb || selectedRequest.rating) ? (
                        <div className="requests-rating-row requests-rating-row-title" aria-label="Ratings">
                          {hasRatingValue(selectedRequest.ratings?.imdb) ? (
                            <div className="requests-rating-card imdb">
                              <img src={brandIconUrl("imdb", "F5C518")} alt="" />
                              <strong>{formatTenPointScore(selectedRequest.ratings.imdb)}</strong>
                              <span>IMDb</span>
                            </div>
                          ) : null}
                          {hasRatingValue(selectedRequest.ratings?.rottenTomatoes) ? (
                            <div className="requests-rating-card rotten">
                              <img src={brandIconUrl("rottentomatoes", "FA320A")} alt="" />
                              <strong>{formatPercentScore(selectedRequest.ratings.rottenTomatoes)}</strong>
                              <span>Rotten Tomatoes</span>
                            </div>
                          ) : null}
                          {hasRatingValue(selectedRequest.ratings?.metacritic) ? (
                            <div className="requests-rating-card metacritic">
                              <img src={brandIconUrl("metacritic", "8054FF")} alt="" />
                              <strong>{formatPercentScore(selectedRequest.ratings.metacritic)}</strong>
                              <span>Metacritic</span>
                            </div>
                          ) : null}
                          {hasRatingValue(selectedRequest.ratings?.tmdb || selectedRequest.rating) ? (
                            <div className="requests-rating-card tmdb">
                              <img src={brandIconUrl("themoviedatabase", "01B4E4")} alt="" />
                              <strong>{formatPercentScore(selectedRequest.ratings?.tmdb || selectedRequest.rating)}</strong>
                              <span>TMDB</span>
                            </div>
                          ) : null}
                        </div>
                      ) : null}
                    </div>
                    <p>{selectedRequest.overview || "No overview available from Seerr."}</p>
                  </div>

                  <div className="requests-detail-meta">
                    <span className="is-type">{selectedRequest.mediaType}</span>
                    {selectedRequest.year ? <span className="is-fact">{selectedRequest.year}</span> : null}
                    {selectedRequest.runtime ? <span className="is-fact">{selectedRequest.runtime} min</span> : null}
                    <span className={`is-status is-${String(selectedRequest.status || "unknown").toLowerCase().replace(/[^a-z0-9]+/g, "-")}`}>{selectedRequest.status}</span>
                    <span className={`is-availability is-${String(selectedRequest.availability?.status || "unknown").toLowerCase().replace(/[^a-z0-9]+/g, "-")}`}>{selectedRequest.availability?.status || "Unknown"} in Jellyfin</span>
                    {selectedRequest.userInterest?.watchlistedBy?.length ? <span className="is-interest">Watchlisted by {selectedRequest.userInterest.watchlistedBy.join(", ")}</span> : null}
                    {selectedRequest.userInterest?.favouritedBy?.length ? <span className="is-interest">Favourited by {selectedRequest.userInterest.favouritedBy.join(", ")}</span> : null}
                  </div>

                  <div className="requests-detail-actions">
                    {!selectedRequest.isSearchResult && canManageRequests && selectedRequest.status === "Pending" ? (
                      <>
                        <button type="button" disabled={Boolean(busyAction)} onClick={(event) => runRequestAction(selectedRequest, "approve", event)}>
                          <CheckboxCircleLineIcon size={17} />
                          Approve
                        </button>
                        <button type="button" disabled={Boolean(busyAction)} onClick={(event) => runRequestAction(selectedRequest, "decline", event)}>
                          <CloseCircleLineIcon size={17} />
                          Decline
                        </button>
                      </>
                    ) : null}
                    {!selectedRequest.isSearchResult && canManageRequests && selectedRequest.requestId ? (
                      <button type="button" disabled={Boolean(busyAction)} onClick={(event) => openRequestEditor(selectedRequest, event)}>
                        <Edit2LineIcon size={17} />
                        {editingRequestId === selectedRequest.id ? "Hide edit" : "Edit request"}
                      </button>
                    ) : null}
                  </div>

                  {selectedRequest.isSearchResult ? (
                    <div className="requests-edit-panel requests-new-request-panel">
                      <div className="requests-edit-heading">
                        <div>
                          <span>Request settings</span>
                          <strong>Choose destination</strong>
                        </div>
                        {seerrSources.length > 1 ? <small>{selectedRequest.source}</small> : null}
                      </div>

                      {selectedRequest.mediaType === "tv" && selectedRequest.seasons?.length ? (
                        <div className="requests-season-picker requests-modal-season-picker">
                          <div className="requests-season-tools">
                            <span>{(selectedSeasons[selectedRequest.id] || []).length} season{(selectedSeasons[selectedRequest.id] || []).length === 1 ? "" : "s"} selected</span>
                            <button type="button" onClick={() => selectAllSeasons(selectedRequest)}>All</button>
                            <button type="button" onClick={() => clearAllSeasons(selectedRequest)}>None</button>
                          </div>
                          <div>
                            {selectedRequest.seasons.map((season) => (
                              <button
                                key={`${selectedRequest.id}-${season.seasonNumber}`}
                                type="button"
                                className={(selectedSeasons[selectedRequest.id] || []).includes(season.seasonNumber) ? "is-selected" : ""}
                                onClick={() => toggleSeason(selectedRequest, season.seasonNumber)}
                                title={season.title}
                              >
                                S{season.seasonNumber}
                              </button>
                            ))}
                          </div>
                        </div>
                      ) : null}

                      {requestOptionsLoading[selectedRequest.id] ? <span className="requests-options-status">Loading Seerr destinations...</span> : null}
                      {selectedRequestOptions?.error ? <span className="requests-options-status is-error">{selectedRequestOptions.error}</span> : null}
                      {selectedRequestOptions?.servers?.length ? (
                        <>
                          <label>
                            <span>{selectedRequest.mediaType === "tv" ? "Sonarr server" : "Radarr server"}</span>
                            <select value={selectedRequestForm.serverId ?? ""} onChange={(event) => handleServerChange(selectedRequest, event.target.value)}>
                              {selectedRequestOptions.servers.map((entry) => (
                                <option key={entry.server.id} value={entry.server.id}>
                                  {entry.server.name}{entry.server.is4k ? " 4K" : ""}{entry.server.isDefault ? " default" : ""}
                                </option>
                              ))}
                            </select>
                          </label>
                          <label>
                            <span>Quality profile</span>
                            <select value={selectedRequestForm.profileId ?? ""} onChange={(event) => updateOptionForm(selectedRequest, { profileId: event.target.value })}>
                              {(selectedRequestServer?.profiles || []).map((profile) => (
                                <option key={profile.id} value={profile.id}>{profile.name}</option>
                              ))}
                            </select>
                          </label>
                          <label className="requests-root-folder-field">
                            <span>Root folder</span>
                            <select value={selectedRequestForm.rootFolder || ""} onChange={(event) => updateOptionForm(selectedRequest, { rootFolder: event.target.value })}>
                              {(selectedRequestServer?.rootFolders || []).map((folder) => (
                                <option key={folder.path} value={folder.path}>
                                  {folder.path}{folder.freeSpaceLabel ? ` · ${folder.freeSpaceLabel} free` : ""}
                                </option>
                              ))}
                            </select>
                            {selectedRequestRoot?.freeSpaceLabel ? <small>{selectedRequestRoot.freeSpaceLabel} free</small> : null}
                          </label>
                          {selectedRequest.mediaType === "tv" && selectedRequestServer?.languageProfiles?.length ? (
                            <label>
                              <span>Language profile</span>
                              <select value={selectedRequestForm.languageProfileId ?? ""} onChange={(event) => updateOptionForm(selectedRequest, { languageProfileId: event.target.value })}>
                                {selectedRequestServer.languageProfiles.map((profile) => (
                                  <option key={profile.id} value={profile.id}>{profile.name}</option>
                                ))}
                              </select>
                            </label>
                          ) : null}
                          {selectedRequestServer?.tags?.length ? (
                            <div className="requests-tag-options">
                              <span>Tags</span>
                              <div>
                                {selectedRequestServer.tags.map((tag) => (
                                  <button
                                    key={tag.id}
                                    type="button"
                                    className={(selectedRequestForm.tags || []).map(Number).includes(Number(tag.id)) ? "is-selected" : ""}
                                    onClick={() => toggleTag(selectedRequest, tag.id)}
                                  >
                                    {tag.label}
                                  </button>
                                ))}
                              </div>
                            </div>
                          ) : null}
                          <label className="requests-edit-toggle">
                            <input
                              type="checkbox"
                              checked={Boolean(selectedRequestForm.is4k)}
                              onChange={(event) => updateOptionForm(selectedRequest, { is4k: event.target.checked })}
                            />
                            <span>4K request</span>
                          </label>
                        </>
                      ) : !requestOptionsLoading[selectedRequest.id] && !selectedRequestOptions?.error ? (
                        <span className="requests-options-status">No destination options returned by Seerr.</span>
                      ) : null}
                      <div className="requests-edit-actions">
                        {(() => {
                          const isAlreadyAvailable = selectedRequest.availability?.status === "Available";
                          const isAlreadyRequested = selectedRequest.requested && !isAlreadyAvailable;
                          const requestDisabled =
                            Boolean(busyAction) ||
                            isAlreadyAvailable ||
                            isAlreadyRequested ||
                            Boolean(requestOptionsLoading[selectedRequest.id]) ||
                            Boolean(selectedRequestOptions?.error) ||
                            (selectedRequest.mediaType === "tv" && selectedRequest.seasons?.length && !(selectedSeasons[selectedRequest.id] || []).length);
                          return (
                            <button type="button" disabled={requestDisabled} onClick={() => requestMedia(selectedRequest)}>
                              <ChatCheckFillIcon size={17} />
                              {isAlreadyAvailable ? "Available" : isAlreadyRequested ? "Already requested" : "Request this"}
                            </button>
                          );
                        })()}
                      </div>
                    </div>
                  ) : null}

                  {!selectedRequest.isSearchResult && canManageRequests && editingRequestId === selectedRequest.id ? (
                    <div className="requests-edit-panel">
                      <div className="requests-edit-heading">
                        <div>
                          <span>Admin routing</span>
                          <strong>Edit request destination</strong>
                        </div>
                        <small>{selectedRequest.source}</small>
                      </div>
                      {requestOptionsLoading[selectedRequest.id] ? <span className="requests-options-status">Loading Seerr destinations...</span> : null}
                      {selectedRequestOptions?.error ? <span className="requests-options-status is-error">{selectedRequestOptions.error}</span> : null}
                      {selectedRequestOptions?.servers?.length ? (
                        <>
                          <label>
                            <span>{selectedRequest.mediaType === "tv" ? "Sonarr server" : "Radarr server"}</span>
                            <select value={selectedRequestForm.serverId ?? ""} onChange={(event) => handleServerChange(selectedRequest, event.target.value)}>
                              {selectedRequestOptions.servers.map((entry) => (
                                <option key={entry.server.id} value={entry.server.id}>
                                  {entry.server.name}{entry.server.is4k ? " 4K" : ""}{entry.server.isDefault ? " default" : ""}
                                </option>
                              ))}
                            </select>
                          </label>
                          <label>
                            <span>Quality profile</span>
                            <select value={selectedRequestForm.profileId ?? ""} onChange={(event) => updateOptionForm(selectedRequest, { profileId: event.target.value })}>
                              {(selectedRequestServer?.profiles || []).map((profile) => (
                                <option key={profile.id} value={profile.id}>{profile.name}</option>
                              ))}
                            </select>
                          </label>
                          <label className="requests-root-folder-field">
                            <span>Root folder</span>
                            <select value={selectedRequestForm.rootFolder || ""} onChange={(event) => updateOptionForm(selectedRequest, { rootFolder: event.target.value })}>
                              {(selectedRequestServer?.rootFolders || []).map((folder) => (
                                <option key={folder.path} value={folder.path}>
                                  {folder.path}{folder.freeSpaceLabel ? ` · ${folder.freeSpaceLabel} free` : ""}
                                </option>
                              ))}
                            </select>
                            {selectedRequestRoot?.freeSpaceLabel ? <small>{selectedRequestRoot.freeSpaceLabel} free</small> : null}
                          </label>
                          {selectedRequest.mediaType === "tv" && selectedRequestServer?.languageProfiles?.length ? (
                            <label>
                              <span>Language profile</span>
                              <select value={selectedRequestForm.languageProfileId ?? ""} onChange={(event) => updateOptionForm(selectedRequest, { languageProfileId: event.target.value })}>
                                {selectedRequestServer.languageProfiles.map((profile) => (
                                  <option key={profile.id} value={profile.id}>{profile.name}</option>
                                ))}
                              </select>
                            </label>
                          ) : null}
                          {selectedRequestServer?.tags?.length ? (
                            <div className="requests-tag-options">
                              <span>Tags</span>
                              <div>
                                {selectedRequestServer.tags.map((tag) => (
                                  <button
                                    key={tag.id}
                                    type="button"
                                    className={(selectedRequestForm.tags || []).map(Number).includes(Number(tag.id)) ? "is-selected" : ""}
                                    onClick={() => toggleTag(selectedRequest, tag.id)}
                                  >
                                    {tag.label}
                                  </button>
                                ))}
                              </div>
                            </div>
                          ) : null}
                          <label className="requests-edit-toggle">
                            <input
                              type="checkbox"
                              checked={Boolean(selectedRequestForm.is4k)}
                              onChange={(event) => updateOptionForm(selectedRequest, { is4k: event.target.checked })}
                            />
                            <span>4K request</span>
                          </label>
                          <div className="requests-edit-actions">
                            <button type="button" disabled={Boolean(busyAction)} onClick={(event) => saveRequestEdit(selectedRequest, event)}>
                              Save changes
                            </button>
                          </div>
                        </>
                      ) : !requestOptionsLoading[selectedRequest.id] && !selectedRequestOptions?.error ? (
                        <span className="requests-options-status">No destination options returned by Seerr.</span>
                      ) : null}
                    </div>
                  ) : null}

                  {selectedRequest.genres?.length ? (
                    <div className="requests-detail-tags">
                      {selectedRequest.genres.map((genre) => (
                        <span key={genre}>{genre}</span>
                      ))}
                    </div>
                  ) : null}

                  {selectedRequestLoading ? <div className="requests-detail-loading">Loading request details...</div> : null}

                  {selectedRequest.cast?.length ? (
                    <div className="requests-cast-list">
                      <strong>Cast</strong>
                      <div>
                        {selectedRequest.cast.map((person) => (
                          <article key={person.id || `${person.name}-${person.character}`}>
                            <span className="requests-cast-photo">
                              {person.imageUrl ? <img src={person.imageUrl} alt="" loading="lazy" /> : <AccountCircleFillIcon size={18} />}
                            </span>
                            <span>
                              <b>{person.name}</b>
                              {person.character ? <small>{person.character}</small> : null}
                            </span>
                          </article>
                        ))}
                      </div>
                    </div>
                  ) : null}

                  {!selectedRequest.isSearchResult ? (
                  <dl>
                    <div>
                      <dt>Requester</dt>
                      <dd><RequesterIdentity request={selectedRequest} /></dd>
                    </div>
                    <div>
                      <dt>Requested</dt>
                      <dd>{formatDate(selectedRequest.createdAt)}</dd>
                    </div>
                    {seerrSources.length > 1 ? (
                      <div>
                        <dt>Source</dt>
                        <dd>{selectedRequest.source}</dd>
                      </div>
                    ) : null}
                  </dl>
                  ) : null}

                  {!selectedRequest.isSearchResult && selectedRequest.requestedSeasons?.length ? (
                    <div className="requests-episode-list">
                      <strong>Requested episodes</strong>
                      {selectedRequest.requestedSeasons.map((season) => (
                        <section key={season.seasonNumber || "season"}>
                          <span>Season {season.seasonNumber || "unknown"}</span>
                          {season.episodes?.length ? (
                            <div>
                              {season.episodes.map((episode) => (
                                <small key={`${season.seasonNumber}-${episode.episodeNumber}`}>
                                  E{episode.episodeNumber}: {episode.title}{episode.airDate ? ` · ${formatDate(episode.airDate)}` : ""}
                                </small>
                              ))}
                            </div>
                          ) : (
                            <small>Whole season requested</small>
                          )}
                        </section>
                      ))}
                    </div>
                  ) : null}
                </div>
              </div>
            </Modal.Body>
          </>
        ) : null}
      </Modal>
    </div>
  );
}
