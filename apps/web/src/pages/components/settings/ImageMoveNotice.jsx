import { useEffect, useRef, useState } from "react";
import { Alert, Button } from "react-bootstrap";
import { useTranslation } from "react-i18next";
import axios from "../../../lib/axios_instance";

const DISMISS_KEY_PREFIX = "JG_IMAGE_MOVE_NOTICE_DISMISSED_";
const RELEASE_NOTES_URL = "https://github.com/Nerdy-Technician/JellyGlance/releases/tag/v1.3.2";

function dismissKey(version) {
  return `${DISMISS_KEY_PREFIX}${String(version || "unknown").replace(/^v/i, "")}`;
}

function readDismissed(version) {
  try {
    return localStorage.getItem(dismissKey(version)) === "1";
  } catch {
    return false;
  }
}

export default function ImageMoveNotice() {
  const { t } = useTranslation();
  const [info, setInfo] = useState(null);
  const [dismissed, setDismissed] = useState(false);
  const [copied, setCopied] = useState(false);
  const codeRef = useRef(null);
  const canCopy = typeof navigator !== "undefined" && Boolean(navigator.clipboard?.writeText);

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) return undefined;
    let active = true;
    axios
      .get("/api/CheckForUpdates", { headers: { Authorization: `Bearer ${token}` } })
      .then((response) => {
        if (!active) return;
        const data = response.data || {};
        setInfo(data);
        setDismissed(readDismissed(data.current_version));
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!copied) return undefined;
    const timer = setTimeout(() => setCopied(false), 2000);
    return () => clearTimeout(timer);
  }, [copied]);

  // Only show when the API explicitly says this instance is not on the new
  // image; older API builds without image info show nothing.
  if (!info || info.on_expected_image !== false || !info.expected_image || dismissed) return null;

  const imageLine = `image: ${info.expected_image}`;

  const dismiss = () => {
    try {
      localStorage.setItem(dismissKey(info.current_version), "1");
    } catch {
      // Storage may be unavailable (private mode, quota); hide for this session anyway.
    }
    setDismissed(true);
  };

  const selectImageLine = () => {
    const node = codeRef.current;
    const selection = window.getSelection?.();
    if (!node || !selection) return;
    const range = document.createRange();
    range.selectNodeContents(node);
    selection.removeAllRanges();
    selection.addRange(range);
  };

  const copy = () => {
    navigator.clipboard
      .writeText(imageLine)
      .then(() => setCopied(true))
      .catch(selectImageLine);
  };

  return (
    <Alert variant="warning" dismissible onClose={dismiss} className="image-move-notice">
      <Alert.Heading as="h6">{t("IMAGE_MOVE_NOTICE.TITLE")}</Alert.Heading>
      <p className="mb-2">{t("IMAGE_MOVE_NOTICE.BODY", { version: info.image_move_after_version || "1.3.2" })}</p>
      <div className="d-flex flex-wrap align-items-center gap-2">
        <code ref={codeRef} onClick={selectImageLine} style={{ userSelect: "all", cursor: "text" }}>
          {imageLine}
        </code>
        {canCopy && (
          <Button size="sm" variant="outline-dark" onClick={copy}>
            {copied ? t("IMAGE_MOVE_NOTICE.COPIED") : t("IMAGE_MOVE_NOTICE.COPY")}
          </Button>
        )}
        <a href={RELEASE_NOTES_URL} target="_blank" rel="noreferrer" className="alert-link">
          {t("IMAGE_MOVE_NOTICE.RELEASE_NOTES")}
        </a>
      </div>
    </Alert>
  );
}
