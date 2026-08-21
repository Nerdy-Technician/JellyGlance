export const THEME_STORAGE_KEY = "jellyglance_custom_theme";

export const DEFAULT_THEME = {
  primary: "#9b6ac8",
  secondary: "#4aa8bc",
  background: "#0b0d12",
  surface: "#131820",
};

export const THEME_PRESETS = [
  { name: "JellyGlance", primary: "#9b6ac8", secondary: "#4aa8bc", background: "#0b0d12", surface: "#131820" },
  { name: "Ocean", primary: "#2dd4bf", secondary: "#38bdf8", background: "#071015", surface: "#10212a" },
  { name: "Ember", primary: "#f97316", secondary: "#f43f5e", background: "#120b08", surface: "#1f1512" },
  { name: "Forest", primary: "#22c55e", secondary: "#eab308", background: "#08110d", surface: "#111d17" },
  { name: "Aurora", primary: "#a78bfa", secondary: "#22d3ee", background: "#090814", surface: "#17142a" },
  { name: "Rose", primary: "#fb7185", secondary: "#f9a8d4", background: "#130910", surface: "#23111c" },
  { name: "Solar", primary: "#facc15", secondary: "#fb923c", background: "#100d05", surface: "#201809" },
  { name: "Arctic", primary: "#93c5fd", secondary: "#67e8f9", background: "#06101a", surface: "#101d2b" },
  { name: "Grape", primary: "#c084fc", secondary: "#818cf8", background: "#0d0718", surface: "#1b102c" },
  { name: "Ruby", primary: "#ef4444", secondary: "#f97316", background: "#120707", surface: "#211010" },
  { name: "Mint", primary: "#34d399", secondary: "#a3e635", background: "#06110c", surface: "#102017" },
  { name: "Copper", primary: "#d97706", secondary: "#f59e0b", background: "#110b05", surface: "#21160c" },
  { name: "Lagoon", primary: "#06b6d4", secondary: "#14b8a6", background: "#041115", surface: "#0d2226" },
  { name: "Slate", primary: "#94a3b8", secondary: "#38bdf8", background: "#080b10", surface: "#151b24" },
  { name: "Mono", primary: "#e5e7eb", secondary: "#94a3b8", background: "#07080a", surface: "#15171c" },
  { name: "Midnight", primary: "#60a5fa", secondary: "#f472b6", background: "#050816", surface: "#101827" },
  { name: "Citrus", primary: "#84cc16", secondary: "#facc15", background: "#080f05", surface: "#14200d" },
  { name: "Coral", primary: "#fb7185", secondary: "#2dd4bf", background: "#10090b", surface: "#201316" },
  { name: "Matrix", primary: "#22c55e", secondary: "#86efac", background: "#020806", surface: "#08140f" },
  { name: "Nord", primary: "#88c0d0", secondary: "#b48ead", background: "#0b1118", surface: "#17202b" },
  { name: "Synth", primary: "#ff2bd6", secondary: "#00e5ff", background: "#080510", surface: "#171024" },
  { name: "Terminal", primary: "#4ade80", secondary: "#f8fafc", background: "#030604", surface: "#0b120d" },
  { name: "Peacock", primary: "#14b8a6", secondary: "#a3e635", background: "#031014", surface: "#0c2024" },
  { name: "Crimson", primary: "#dc2626", secondary: "#fbbf24", background: "#100405", surface: "#1f0d0f" },
  { name: "Iceberg", primary: "#7dd3fc", secondary: "#c4b5fd", background: "#071018", surface: "#121d29" },
  { name: "Limewire", primary: "#bef264", secondary: "#22d3ee", background: "#050b08", surface: "#101a14" },
  { name: "Noir", primary: "#fafafa", secondary: "#f43f5e", background: "#050505", surface: "#111111" },
  { name: "Sakura", primary: "#fda4af", secondary: "#f0abfc", background: "#120910", surface: "#24131f" },
  { name: "Volcanic", primary: "#fb923c", secondary: "#fef08a", background: "#120805", surface: "#26150d" },
  { name: "Deep Sea", primary: "#38bdf8", secondary: "#2dd4bf", background: "#031018", surface: "#0b202b" },
  { name: "Honey", primary: "#fbbf24", secondary: "#fef3c7", background: "#120d03", surface: "#251b08" },
  { name: "Plasma", primary: "#e879f9", secondary: "#818cf8", background: "#0d0614", surface: "#1d1029" },
  { name: "Moss", primary: "#a3e635", secondary: "#84cc16", background: "#091006", surface: "#17210d" },
  { name: "Paper", primary: "#f8fafc", secondary: "#94a3b8", background: "#111318", surface: "#20242c" },
  { name: "Electric Blue", primary: "#2563eb", secondary: "#67e8f9", background: "#050a18", surface: "#101b35" },
  { name: "Tangerine", primary: "#fb923c", secondary: "#f472b6", background: "#130905", surface: "#26140f" },
  { name: "Violet Night", primary: "#8b5cf6", secondary: "#c4b5fd", background: "#090615", surface: "#17102a" },
];

const HEX_COLOR_PATTERN = /^#[0-9a-f]{6}$/i;

function normalizeHexColor(value, fallback) {
  if (typeof value !== "string") {
    return fallback;
  }

  const nextValue = value.trim();
  return HEX_COLOR_PATTERN.test(nextValue) ? nextValue : fallback;
}

function hexToRgb(hexColor) {
  const normalized = normalizeHexColor(hexColor, "#000000").slice(1);
  return {
    r: parseInt(normalized.slice(0, 2), 16),
    g: parseInt(normalized.slice(2, 4), 16),
    b: parseInt(normalized.slice(4, 6), 16),
  };
}

function darkenHex(hexColor, amount = 0.28) {
  const { r, g, b } = hexToRgb(hexColor);
  const channel = (value) => Math.max(0, Math.min(255, Math.round(value * (1 - amount))));
  return `#${[channel(r), channel(g), channel(b)].map((value) => value.toString(16).padStart(2, "0")).join("")}`;
}

function mixHex(firstHexColor, secondHexColor, weight = 0.42) {
  const first = hexToRgb(firstHexColor);
  const second = hexToRgb(secondHexColor);
  const channel = (firstValue, secondValue) => Math.max(0, Math.min(255, Math.round(firstValue * (1 - weight) + secondValue * weight)));
  return `#${[channel(first.r, second.r), channel(first.g, second.g), channel(first.b, second.b)]
    .map((value) => value.toString(16).padStart(2, "0"))
    .join("")}`;
}

function rgbString(hexColor) {
  const { r, g, b } = hexToRgb(hexColor);
  return `${r}, ${g}, ${b}`;
}

export function getStoredTheme() {
  try {
    const storedTheme = JSON.parse(localStorage.getItem(THEME_STORAGE_KEY) || "{}");
    return {
      primary: normalizeHexColor(storedTheme.primary, DEFAULT_THEME.primary),
      secondary: normalizeHexColor(storedTheme.secondary, DEFAULT_THEME.secondary),
      background: normalizeHexColor(storedTheme.background, DEFAULT_THEME.background),
      surface: normalizeHexColor(storedTheme.surface, DEFAULT_THEME.surface),
    };
  } catch {
    return DEFAULT_THEME;
  }
}

export function saveTheme(theme) {
  const nextTheme = {
    primary: normalizeHexColor(theme.primary, DEFAULT_THEME.primary),
    secondary: normalizeHexColor(theme.secondary, DEFAULT_THEME.secondary),
    background: normalizeHexColor(theme.background, DEFAULT_THEME.background),
    surface: normalizeHexColor(theme.surface, DEFAULT_THEME.surface),
  };

  localStorage.setItem(THEME_STORAGE_KEY, JSON.stringify(nextTheme));
  applyTheme(nextTheme);
  window.dispatchEvent(new CustomEvent("jellyglance-theme-updated", { detail: nextTheme }));
  return nextTheme;
}

export function resetTheme() {
  localStorage.removeItem(THEME_STORAGE_KEY);
  applyTheme(DEFAULT_THEME);
  window.dispatchEvent(new CustomEvent("jellyglance-theme-updated", { detail: DEFAULT_THEME }));
  return DEFAULT_THEME;
}

export function applyTheme(theme = getStoredTheme()) {
  const root = document.documentElement;
  const nextTheme = {
    primary: normalizeHexColor(theme.primary, DEFAULT_THEME.primary),
    secondary: normalizeHexColor(theme.secondary, DEFAULT_THEME.secondary),
    background: normalizeHexColor(theme.background, DEFAULT_THEME.background),
    surface: normalizeHexColor(theme.surface, DEFAULT_THEME.surface),
  };
  const { r, g, b } = hexToRgb(nextTheme.surface);
  const primaryLightColor = mixHex(nextTheme.primary, "#ffffff");

  root.style.colorScheme = "dark";
  root.style.setProperty("--primary-color", nextTheme.primary);
  root.style.setProperty("--primary-rgb", rgbString(nextTheme.primary));
  root.style.setProperty("--primary-light-color", primaryLightColor);
  root.style.setProperty("--primary-light-rgb", rgbString(primaryLightColor));
  root.style.setProperty("--primary-dark-color", darkenHex(nextTheme.primary));
  root.style.setProperty("--secondary-color", nextTheme.secondary);
  root.style.setProperty("--secondary-rgb", rgbString(nextTheme.secondary));
  root.style.setProperty("--background-color", nextTheme.background);
  root.style.setProperty("--secondary-background-color", nextTheme.surface);
  root.style.setProperty("--tertiary-background-color", darkenHex(nextTheme.surface, -0.18));
  root.style.setProperty("--surface-color", `rgba(${r}, ${g}, ${b}, 0.86)`);
}
