import React from "react";
import {
  siAndroid,
  siApple,
  siAppletv,
  siBrave,
  siEmby,
  siFirefox,
  siGooglecast,
  siGooglechrome,
  siGoogletv,
  siJellyfin,
  siKodi,
  siLg,
  siLinux,
  siNvidia,
  siOpera,
  siPlex,
  siRoku,
  siSafari,
  siSamsung,
  siUbuntu,
  siVivaldi,
} from "simple-icons";

const iconMap = [
  { match: ["roku"], icon: siRoku },
  { match: ["android", "fire tv"], icon: siAndroid },
  { match: ["apple tv", "tvos"], icon: siAppletv },
  { match: ["iphone", "ipad", "ios", "macos", "apple"], icon: siApple },
  { match: ["google tv"], icon: siGoogletv },
  { match: ["chromecast", "cast"], icon: siGooglecast },
  { match: ["chrome"], icon: siGooglechrome },
  { match: ["firefox"], icon: siFirefox },
  { match: ["safari"], icon: siSafari },
  { match: ["opera"], icon: siOpera },
  { match: ["brave"], icon: siBrave },
  { match: ["vivaldi"], icon: siVivaldi },
  { match: ["lg", "webos"], icon: siLg },
  { match: ["samsung", "tizen"], icon: siSamsung },
  { match: ["nvidia", "shield"], icon: siNvidia },
  { match: ["linux"], icon: siLinux },
  { match: ["ubuntu"], icon: siUbuntu },
  { match: ["kodi"], icon: siKodi },
  { match: ["plex"], icon: siPlex },
  { match: ["emby"], icon: siEmby },
  { match: ["jellyfin"], icon: siJellyfin },
];

function getPlatformIcon(client = "", deviceName = "") {
  const haystack = `${client} ${deviceName}`.toLowerCase();
  const matched = iconMap.find((entry) => entry.match.some((term) => haystack.includes(term)));

  return matched?.icon ?? siJellyfin;
}

export function PlatformIcon({ client, deviceName, className = "" }) {
  const icon = getPlatformIcon(client, deviceName);
  const color = `#${icon.hex}`;

  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      role="img"
      aria-label={icon.title}
      style={{ "--platform-icon-color": color }}
    >
      <path d={icon.path} />
    </svg>
  );
}
