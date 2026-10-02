import { useEffect, useState } from "react";
import RefreshLineIcon from "remixicon-react/RefreshLineIcon";
import HeadphoneLineIcon from "remixicon-react/HeadphoneLineIcon";
import HistoryLineIcon from "remixicon-react/HistoryLineIcon";
import BookOpenLineIcon from "remixicon-react/BookOpenLineIcon";
import axios from "../lib/axios_instance";
import "./css/maintainerr.css";
import "./css/integrations.css";
import "./css/audiobookshelf.css";

const emptyBundle = { libraries: [], totals: {}, listeningNow: [], recentSessions: [], recentlyAdded: [] };

function formatDuration(seconds) {
  const total = Math.round(Number(seconds || 0));
  if (total < 60) return `${total}s`;
  const hours = Math.floor(total / 3600);
  const minutes = Math.round((total % 3600) / 60);
  return hours ? `${hours}h ${minutes}m` : `${minutes}m`;
}

function formatBytes(bytes) {
  const size = Number(bytes || 0);
  if (!size) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  const index = Math.min(Math.floor(Math.log(size) / Math.log(1024)), units.length - 1);
  return `${(size / 1024 ** index).toFixed(index >= 3 ? 1 : 0)} ${units[index]}`;
}

function formatWhen(value) {
  if (!value) return "";
  return new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }).format(new Date(value));
}

function Cover({ item, size = 56 }) {
  const [failed, setFailed] = useState(false);
  if (!item?.itemId && !item?.id) return null;
  const id = item.itemId || item.id;
  return (
    <span className="abs-cover" style={{ width: size, height: size }}>
      {failed ? (
        <BookOpenLineIcon size={Math.round(size * 0.45)} />
      ) : (
        <img src={`/proxy/Audiobookshelf/Images/${encodeURIComponent(id)}?width=${size * 2}`} alt="" loading="lazy" onError={() => setFailed(true)} />
      )}
    </span>
  );
}

function Progress({ current, duration }) {
  const percent = duration ? Math.min(100, Math.round((Number(current) / Number(duration)) * 100)) : 0;
  return (
    <span className="abs-progress" aria-label={`${percent}% listened`}>
      <span style={{ width: `${percent}%` }} />
    </span>
  );
}

export default function Audiobookshelf() {
  const [bundle, setBundle] = useState(emptyBundle);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function load() {
    setLoading(true);
    setError("");
    try {
      const response = await axios.get("/api/audiobookshelf");
      setBundle({ ...emptyBundle, ...response.data });
    } catch (loadError) {
      setError(loadError?.response?.data?.error || "Unable to load Audiobookshelf. Check Settings > Integrations > 3rd party apps.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  const { totals, libraries, listeningNow, recentSessions, recentlyAdded } = bundle;

  return (
    <div className="integrations-page maintainerr-page abs-page">
      <section className="integration-page-header">
        <div>
          <p>Audiobooks</p>
          <h1>Audiobookshelf</h1>
          <span>Who is listening, recent sessions and the newest books across your Audiobookshelf libraries.</span>
        </div>
        <button type="button" onClick={load} disabled={loading}>
          <RefreshLineIcon size={18} />
          {loading ? "Refreshing" : "Refresh"}
        </button>
      </section>

      {error ? <div className="integration-notice is-error">{error}</div> : null}
      {!loading && !error && !bundle.admin ? (
        <div className="integration-notice">This API token is not an admin token, so who is listening and recent sessions are hidden.</div>
      ) : null}

      <section className="maintainerr-summary-grid">
        <article>
          <span>Listening now</span>
          <strong>{listeningNow.length}</strong>
          <small>Open Audiobookshelf sessions</small>
        </article>
        <article>
          <span>Books</span>
          <strong>{Number(totals.items || 0).toLocaleString()}</strong>
          <small>
            {libraries.length} {libraries.length === 1 ? "library" : "libraries"}
          </small>
        </article>
        <article>
          <span>Authors</span>
          <strong>{Number(totals.authors || 0).toLocaleString()}</strong>
          <small>Across all libraries</small>
        </article>
        <article>
          <span>Total length</span>
          <strong>{formatDuration(totals.durationSeconds)}</strong>
          <small>{formatBytes(totals.sizeBytes)} on disk</small>
        </article>
        <article>
          <span>Server</span>
          <strong>{bundle.version ? `v${bundle.version}` : "–"}</strong>
          <small>{bundle.users ? `${bundle.users} users` : "Audiobookshelf"}</small>
        </article>
      </section>

      <section className="maintainerr-layout-grid">
        <article className="maintainerr-panel">
          <div className="maintainerr-panel-head">
            <HeadphoneLineIcon size={17} />
            <div>
              <h2>Listening now</h2>
              <span>{listeningNow.length ? `${listeningNow.length} open sessions` : "Nobody is listening"}</span>
            </div>
          </div>
          <div className="maintainerr-panel-body">
            {loading ? (
              <span className="maintainerr-loading">Loading sessions...</span>
            ) : listeningNow.length ? (
              listeningNow.map((session) => (
                <div key={session.id} className="maintainerr-item-row abs-row">
                  <Cover item={session} />
                  <div>
                    <strong>{session.title}</strong>
                    <small>
                      {session.author ? `${session.author} · ` : ""}
                      {session.user}
                      {session.device || session.client ? ` · ${session.device || session.client}` : ""}
                    </small>
                    <Progress current={session.currentTime} duration={session.duration} />
                    <small>
                      {formatDuration(session.currentTime)} of {formatDuration(session.duration)}
                    </small>
                  </div>
                </div>
              ))
            ) : (
              <span className="maintainerr-empty">No one is listening right now.</span>
            )}
          </div>
        </article>

        <article className="maintainerr-panel">
          <div className="maintainerr-panel-head">
            <HistoryLineIcon size={17} />
            <div>
              <h2>Recent sessions</h2>
              <span>Latest listening across all users</span>
            </div>
          </div>
          <div className="maintainerr-panel-body">
            {loading ? (
              <span className="maintainerr-loading">Loading history...</span>
            ) : recentSessions.length ? (
              recentSessions.map((session) => (
                <div key={session.id} className="maintainerr-item-row abs-row">
                  <Cover item={session} size={44} />
                  <div>
                    <strong>{session.title}</strong>
                    <small>
                      {session.user} · listened {formatDuration(session.timeListening)} · {formatWhen(session.updatedAt)}
                    </small>
                  </div>
                </div>
              ))
            ) : (
              <span className="maintainerr-empty">No listening sessions yet.</span>
            )}
          </div>
        </article>

        <article className="maintainerr-panel abs-wide">
          <div className="maintainerr-panel-head">
            <BookOpenLineIcon size={17} />
            <div>
              <h2>Recently added</h2>
              <span>Newest books across {libraries.map((library) => library.name).join(", ") || "your libraries"}</span>
            </div>
          </div>
          <div className="maintainerr-panel-body abs-shelf">
            {loading ? (
              <span className="maintainerr-loading">Loading books...</span>
            ) : recentlyAdded.length ? (
              recentlyAdded.map((item) => (
                <div key={item.id} className="abs-book">
                  <Cover item={item} size={120} />
                  <strong title={item.title}>{item.title}</strong>
                  <small>{item.author || "Unknown author"}</small>
                  <small>{formatDuration(item.duration)}</small>
                </div>
              ))
            ) : (
              <span className="maintainerr-empty">No books found.</span>
            )}
          </div>
        </article>
      </section>
    </div>
  );
}
