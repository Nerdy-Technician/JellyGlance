import { useCallback, useEffect, useRef, useState } from "react";
import { ProgressBar } from "react-bootstrap";
import axios from "../../../lib/axios_instance";

function authHeader() {
  return { Authorization: `Bearer ${localStorage.getItem("token")}` };
}

function elapsed(startedAt) {
  const seconds = Math.max(0, Math.round((Date.now() - new Date(startedAt).getTime()) / 1000));
  if (seconds < 60) return `${seconds}s`;
  return `${Math.floor(seconds / 60)}m ${String(seconds % 60).padStart(2, "0")}s`;
}

// Polls the server's background import job for one source ("jellyfin" or "trakt").
// Picks up a job that is already running when the page opens, and calls onFinish once when it ends.
export function useImportJob(source, onFinish) {
  const [job, setJob] = useState(null);
  const timer = useRef(null);
  const finishRef = useRef(onFinish);
  finishRef.current = onFinish;

  const stop = () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
  };

  const poll = useCallback(async () => {
    stop();
    try {
      const response = await axios.get("/external-imports/jobs", { headers: authHeader() });
      const next = response.data?.jobs?.[source] || null;
      setJob(next);
      if (next?.status === "running") {
        timer.current = setTimeout(poll, 1500);
      } else if (next && finishRef.current) {
        finishRef.current(next);
      }
    } catch {
      timer.current = setTimeout(poll, 4000);
    }
  }, [source]);

  const track = useCallback(
    (started) => {
      setJob(started);
      timer.current = setTimeout(poll, 800);
    },
    [poll]
  );

  useEffect(() => {
    let active = true;
    axios
      .get("/external-imports/jobs", { headers: authHeader() })
      .then((response) => {
        const current = response.data?.jobs?.[source];
        if (active && current?.status === "running") track(current);
      })
      .catch(() => {});
    return () => {
      active = false;
      stop();
    };
  }, [source, track]);

  return { job, running: job?.status === "running", track };
}

export default function ImportJobProgress({ job }) {
  if (!job || job.status !== "running") return null;
  const percent = job.total ? Math.round((job.done / job.total) * 100) : null;
  return (
    <section className="import-job-progress" aria-live="polite">
      <div className="import-job-progress-head">
        <strong>{job.stage || "Working"}</strong>
        <span>
          {job.total ? `${job.done.toLocaleString()} of ${job.total.toLocaleString()} · ` : ""}
          {elapsed(job.startedAt)}
        </span>
      </div>
      <ProgressBar animated now={percent ?? 100} striped variant={percent === null ? "info" : "primary"} />
      <small>This keeps running on the server, so you can leave this page and come back.</small>
    </section>
  );
}
