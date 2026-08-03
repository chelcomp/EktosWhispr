// Windows accent color normalization. systemPreferences.getAccentColor()
// returns "AARRGGBB" (with or without "#") — the UI only needs "RRGGBB".
const FALLBACK_ACCENT = "#0067c0"; // Win11 default blue

function formatAccentColor(raw) {
  if (typeof raw !== "string") return null;
  const trimmed = raw.trim();
  const hex = trimmed.replace(/^#/, "");
  // RRGGBB is only valid with an explicit "#" prefix — a bare 6-digit hex is
  // ambiguous and rejected (the API contract is AARRGGBB with/without "#").
  if (/^[0-9a-fA-F]{6}$/.test(hex) && trimmed.startsWith("#")) return `#${hex.toLowerCase()}`;
  if (/^[0-9a-fA-F]{8}$/.test(hex)) return `#${hex.slice(2).toLowerCase()}`; // AARRGGBB
  return null;
}

module.exports = { formatAccentColor, FALLBACK_ACCENT };
