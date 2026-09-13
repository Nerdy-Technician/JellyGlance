import { memo } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";

function SessionGlanceStrip({ stitch }) {
  const { t } = useTranslation();
  if (!stitch?.request && !stitch?.download && !stitch?.tdarr) return null;

  const request = stitch.request;
  const download = stitch.download;
  const tdarr = stitch.tdarr;
  const tdarrQueued = tdarr && Number(tdarr.progress || 0) <= 0 && String(tdarr.status || "").toLowerCase() !== "working";

  return (
    <div className="session-glance-strip" data-session-card-ignore>
      {request ? (
        <Link to="/requests" className="is-on">
          {t("FEATURES.GLANCE.SEERR", { status: request.status })}
        </Link>
      ) : null}
      {download ? (
        <Link to="/downloads" className="is-on">
          {download.progress != null
            ? t("FEATURES.GLANCE.DOWNLOAD_PROGRESS", {
                client: download.client || download.source || "Download",
                progress: Math.round(Number(download.progress || 0)),
              })
            : t("FEATURES.GLANCE.DOWNLOAD", { client: download.client || "Download", state: download.state || "" })}
        </Link>
      ) : null}
      {tdarr ? (
        <Link to="/active-transcodes" className="is-on">
          {tdarrQueued
            ? t("FEATURES.GLANCE.TDARR_QUEUED")
            : t("FEATURES.GLANCE.TDARR_ACTIVE", { progress: Math.round(Number(tdarr.progress || 0)) })}
        </Link>
      ) : null}
    </div>
  );
}

export default memo(SessionGlanceStrip);
