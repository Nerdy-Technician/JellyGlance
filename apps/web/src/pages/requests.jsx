import { useEffect, useMemo, useState } from "react";
import ChatCheckFillIcon from "remixicon-react/ChatCheckFillIcon";
import CheckboxCircleLineIcon from "remixicon-react/CheckboxCircleLineIcon";
import CloseCircleLineIcon from "remixicon-react/CloseCircleLineIcon";
import ErrorWarningLineIcon from "remixicon-react/ErrorWarningLineIcon";
import ExternalLinkLineIcon from "remixicon-react/ExternalLinkLineIcon";
import RefreshLineIcon from "remixicon-react/RefreshLineIcon";
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
  const [statusFilter, setStatusFilter] = useState("All");
  const [requestSearch, setRequestSearch] = useState("");
  const [sortMode, setSortMode] = useState("newest");
  const [selectedRequest, setSelectedRequest] = useState(null);

  const visibleRequests = useMemo(() => {
    const normalizedSearch = requestSearch.trim().toLowerCase();
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
  }, [data.requests, requestSearch, sortMode, statusFilter]);

  const statuses = useMemo(() => ["All", ...new Set((data.requests || []).map((request) => request.status).filter(Boolean))], [data.requests]);

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

  return (
    <div className="requests-page">
      <header className="requests-hero">
        <div>
          <p>Request center</p>
          <h1>Requests</h1>
          <span>Jellyseerr and Overseerr requests.</span>
        </div>
        <button type="button" onClick={() => loadRequests(true)} disabled={loading}>
          <RefreshLineIcon size={18} />
          {loading ? "Refreshing" : "Refresh"}
        </button>
      </header>

      <section className="requests-summary-grid">
        <article>
          <ChatCheckFillIcon />
          <div>
            <span>Enabled sources</span>
            <strong>{data.sources?.length || 0}</strong>
            <small>{data.sources?.map((source) => source.name).join(", ") || "Enable Jellyseerr or Overseerr in Settings"}</small>
          </div>
        </article>
        <article>
          <ChatCheckFillIcon />
          <div>
            <span>Requests</span>
            <strong>{data.requests?.length || 0}</strong>
            <small>Updated {formatDate(data.syncedAt)}</small>
          </div>
        </article>
        <article>
          <ChatCheckFillIcon />
          <div>
            <span>Pending / failed</span>
            <strong>{data.stats?.badgeCount || 0}</strong>
            <small>{data.stats?.pending || 0} pending, {data.stats?.failed || 0} failed</small>
          </div>
        </article>
        <article>
          <ChatCheckFillIcon />
          <div>
            <span>Approved / available</span>
            <strong>{data.stats?.approved || 0} / {data.stats?.available || 0}</strong>
            <small>{data.stats?.partial || 0} partial · {data.stats?.mostRequestedMediaType?.type || "media"} most requested</small>
          </div>
        </article>
        <article>
          <ChatCheckFillIcon />
          <div>
            <span>Top requester</span>
            <strong>{data.stats?.topRequesters?.[0]?.name || "N/A"}</strong>
            <small>{data.stats?.topRequesters?.[0]?.count || 0} requests · {data.stats?.mostRequestedMediaType?.type || "media"} leads</small>
          </div>
        </article>
      </section>

      {actionMessage ? <div className="requests-action-message">{actionMessage}</div> : null}

      <section className="requests-control-bar">
        <label>
          <span>Search</span>
          <input
            type="search"
            value={requestSearch}
            onChange={(event) => setRequestSearch(event.target.value)}
            placeholder="Title, requester, status..."
          />
        </label>
        <label>
          <span>Sort</span>
          <select value={sortMode} onChange={(event) => setSortMode(event.target.value)}>
            <option value="newest">Newest first</option>
            <option value="oldest">Oldest first</option>
            <option value="requester">Requester</option>
            <option value="status">Status</option>
            <option value="availability">Availability</option>
          </select>
        </label>
        <strong>{visibleRequests.length} shown</strong>
      </section>

      <nav className="requests-filter-strip" aria-label="Request status filters">
        {statuses.map((status) => (
          <button type="button" key={status} className={statusFilter === status ? "is-active" : ""} onClick={() => setStatusFilter(status)}>
            {status}
          </button>
        ))}
      </nav>

      <section className="requests-board">
        {visibleRequests.map((request) => {
          const age = getRequestAge(request.createdAt);
          return (
            <article
              key={request.id}
              className={String(request.status).toLowerCase() === "error" ? "is-error" : ""}
              role="button"
              tabIndex={0}
              onClick={() => setSelectedRequest(request)}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  setSelectedRequest(request);
                }
              }}
            >
              <div className="requests-card-poster">
                <RequestPoster request={request} />
              </div>
              <div className="requests-card-title">
                <strong>{request.title}{request.year ? ` (${request.year})` : ""}</strong>
                <span>{request.mediaType} · {request.source}</span>
              </div>
              <span className={`requests-age-badge is-${age.level}`}>{age.label}</span>
              <div className="requests-card-status">
                <small>Status</small>
                <b>{request.status}</b>
              </div>
              <div className="requests-card-user">
                <small>Requested by</small>
                <b>{request.requestedBy}</b>
              </div>
              <div className={`requests-availability is-${String(request.availability?.status || "unknown").toLowerCase().replace(/[^a-z0-9]+/g, "-")}`}>
                <small>Jellyfin</small>
                <b>{request.availability?.status || "Unknown"}</b>
              </div>
              <time>{formatDate(request.createdAt)}</time>
              <div className="requests-card-actions">
                {request.status === "Pending" ? (
                  <>
                    <button type="button" title="Approve" disabled={Boolean(busyAction)} onClick={(event) => runRequestAction(request, "approve", event)}>
                      <CheckboxCircleLineIcon size={16} />
                    </button>
                    <button type="button" title="Decline" disabled={Boolean(busyAction)} onClick={(event) => runRequestAction(request, "decline", event)}>
                      <CloseCircleLineIcon size={16} />
                    </button>
                  </>
                ) : null}
                {request.requestId && request.status === "Failed" ? (
                  <button type="button" title="Retry" disabled={Boolean(busyAction)} onClick={(event) => runRequestAction(request, "retry", event)}>
                    <RefreshLineIcon size={16} />
                  </button>
                ) : null}
                {request.openUrl ? (
                  <button type="button" title={`Open in ${request.source}`} onClick={(event) => openSeerrRequest(request, event)}>
                    <ExternalLinkLineIcon size={16} />
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

      <Modal show={Boolean(selectedRequest)} onHide={() => setSelectedRequest(null)} centered size="xl" contentClassName="requests-modal">
        {selectedRequest ? (
          <>
            <Modal.Header closeButton>
              <Modal.Title>{selectedRequest.title}</Modal.Title>
            </Modal.Header>
            <Modal.Body>
              <div className="requests-detail">
                <div className="requests-detail-art">
                  <RequestPoster request={selectedRequest} large />
                </div>
                <div className="requests-detail-copy">
                  <div className="requests-detail-meta">
                    <span>{selectedRequest.mediaType}</span>
                    {selectedRequest.year ? <span>{selectedRequest.year}</span> : null}
                    {selectedRequest.runtime ? <span>{selectedRequest.runtime} min</span> : null}
                    {selectedRequest.rating ? <span>{Number(selectedRequest.rating).toFixed(1)}/10</span> : null}
                    <span>{selectedRequest.status}</span>
                    <span>{selectedRequest.availability?.status || "Unknown"} in Jellyfin</span>
                    {selectedRequest.userInterest?.watchlistedBy?.length ? <span>Watchlisted by {selectedRequest.userInterest.watchlistedBy.join(", ")}</span> : null}
                    {selectedRequest.userInterest?.favouritedBy?.length ? <span>Favourited by {selectedRequest.userInterest.favouritedBy.join(", ")}</span> : null}
                  </div>

                  <div className="requests-detail-actions">
                    {selectedRequest.status === "Pending" ? (
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
                    {selectedRequest.openUrl ? (
                      <button type="button" onClick={(event) => openSeerrRequest(selectedRequest, event)}>
                        <ExternalLinkLineIcon size={17} />
                        Open Seerr
                      </button>
                    ) : null}
                  </div>

                  <p>{selectedRequest.overview || "No overview available from Seerr."}</p>

                  {selectedRequest.genres?.length ? (
                    <div className="requests-detail-tags">
                      {selectedRequest.genres.map((genre) => (
                        <span key={genre}>{genre}</span>
                      ))}
                    </div>
                  ) : null}

                  <dl>
                    <div>
                      <dt>Requested by</dt>
                      <dd>{selectedRequest.requestedBy}</dd>
                    </div>
                    <div>
                      <dt>Requested</dt>
                      <dd>{formatDate(selectedRequest.createdAt)}</dd>
                    </div>
                    <div>
                      <dt>Source</dt>
                      <dd>{selectedRequest.source}</dd>
                    </div>
                    <div>
                      <dt>TMDB</dt>
                      <dd>{selectedRequest.externalIds?.tmdbId || "N/A"}</dd>
                    </div>
                    <div>
                      <dt>TVDB</dt>
                      <dd>{selectedRequest.externalIds?.tvdbId || "N/A"}</dd>
                    </div>
                    <div>
                      <dt>IMDB</dt>
                      <dd>{selectedRequest.externalIds?.imdbId || "N/A"}</dd>
                    </div>
                  </dl>

                  {selectedRequest.requestedSeasons?.length ? (
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
