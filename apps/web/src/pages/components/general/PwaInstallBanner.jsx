import { useEffect, useState } from "react";

const DISMISS_KEY = "jellyglance_pwa_install_dismissed";

export default function PwaInstallBanner({ enabled = true, viewerStart = false }) {
  const [promptEvent, setPromptEvent] = useState(null);
  const [dismissed, setDismissed] = useState(() => localStorage.getItem(DISMISS_KEY) === "true");

  useEffect(() => {
    if (!enabled) return undefined;
    function handlePrompt(event) {
      event.preventDefault();
      setPromptEvent(event);
    }
    window.addEventListener("beforeinstallprompt", handlePrompt);
    return () => window.removeEventListener("beforeinstallprompt", handlePrompt);
  }, [enabled]);

  if (!enabled || dismissed || !promptEvent) return null;

  return (
    <div className="pwa-install-banner" role="status">
      <span>
        {viewerStart
          ? "Install JellyGlance. This account opens My Glance from the home screen."
          : "Install JellyGlance for a kiosk-friendly Home dashboard."}
      </span>
      <div>
        <button
          type="button"
          onClick={async () => {
            promptEvent.prompt();
            await promptEvent.userChoice;
            setPromptEvent(null);
          }}
        >
          Install
        </button>
        <button
          type="button"
          className="is-quiet"
          onClick={() => {
            localStorage.setItem(DISMISS_KEY, "true");
            setDismissed(true);
          }}
        >
          Not now
        </button>
      </div>
    </div>
  );
}
