import { useState } from "react";
import SmartphoneLineIcon from "remixicon-react/SmartphoneLineIcon";
import { useInstallPrompt } from "../../../lib/pwa-install";

export default function InstallAppButton({ className = "" }) {
  const { canInstall, iosManual, install } = useInstallPrompt();
  const [showHint, setShowHint] = useState(false);
  if (!canInstall && !iosManual) return null;
  return (
    <div className={`install-app ${className}`}>
      <button type="button" className="install-app-button" onClick={() => (canInstall ? install() : setShowHint((value) => !value))} title="Install JellyGlance as an app">
        <SmartphoneLineIcon size={16} />
        <span>Install app</span>
      </button>
      {showHint ? <p className="install-app-hint">Tap the Share button in Safari, then choose &ldquo;Add to Home Screen&rdquo;.</p> : null}
    </div>
  );
}
