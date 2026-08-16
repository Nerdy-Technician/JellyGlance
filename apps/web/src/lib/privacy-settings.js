export const ACTIVE_SESSION_IP_PRIVACY_KEY = "jellyglance_active_session_ip_privacy";
export const ACTIVE_SESSION_IP_PRIVACY_EVENT = "jellyglance-active-session-ip-privacy-updated";

export const ACTIVE_SESSION_IP_PRIVACY_OPTIONS = [
  {
    id: "none",
    title: "None",
    text: "Display session IP addresses on Home and Kiosk.",
  },
  {
    id: "home",
    title: "Hide on Home",
    text: "Hide session IP addresses on the Home dashboard only.",
  },
  {
    id: "kiosk",
    title: "Hide on Kiosk",
    text: "Hide session IP addresses on the Kiosk display only.",
  },
  {
    id: "both",
    title: "Hide on both",
    text: "Hide session IP addresses on Home and Kiosk.",
  },
];

const VALID_ACTIVE_SESSION_IP_PRIVACY = new Set(ACTIVE_SESSION_IP_PRIVACY_OPTIONS.map((option) => option.id));

export function getActiveSessionIpPrivacy() {
  try {
    const saved = localStorage.getItem(ACTIVE_SESSION_IP_PRIVACY_KEY) || "none";
    return VALID_ACTIVE_SESSION_IP_PRIVACY.has(saved) ? saved : "none";
  } catch {
    return "none";
  }
}

export function setActiveSessionIpPrivacy(value) {
  const nextValue = VALID_ACTIVE_SESSION_IP_PRIVACY.has(value) ? value : "none";
  localStorage.setItem(ACTIVE_SESSION_IP_PRIVACY_KEY, nextValue);
  window.dispatchEvent(new CustomEvent(ACTIVE_SESSION_IP_PRIVACY_EVENT, { detail: nextValue }));
  return nextValue;
}

export function shouldHideActiveSessionIp(surface, value = getActiveSessionIpPrivacy()) {
  if (value === "both") return true;
  return value === surface;
}
