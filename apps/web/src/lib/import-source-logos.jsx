const IMPORT_SOURCE_LOGOS = {
  jellystat: "https://cdn.jsdelivr.net/gh/selfhst/icons/png/jellystat.png",
  tautulli: "https://cdn.jsdelivr.net/gh/selfhst/icons/svg/tautulli.svg",
  jellyfin: "https://cdn.jsdelivr.net/gh/selfhst/icons/svg/jellyfin.svg",
  trakt: "https://cdn.jsdelivr.net/gh/selfhst/icons/svg/trakt.svg",
};

export function ImportSourceLogo({ source, size = 20, className = "" }) {
  const src = IMPORT_SOURCE_LOGOS[source];
  if (!src) return null;
  return (
    <img
      src={src}
      alt=""
      width={size}
      height={size}
      loading="lazy"
      decoding="async"
      className={`import-source-logo ${className}`.trim()}
    />
  );
}

export function ImportSourceLabel({ source, label }) {
  return (
    <span className="import-source-label">
      <ImportSourceLogo source={source} />
      {label}
    </span>
  );
}
