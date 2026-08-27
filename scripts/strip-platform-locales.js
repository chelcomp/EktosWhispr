#!/usr/bin/env node
// Strip macOS/Linux-specific keys from locale translation.json files.
// Walks all locale files under src/locales/<locale>/translation.json
// and recursively deletes keys matching the platform-specific globs.

const fs = require("fs");
const path = require("path");

const LOCALES_DIR = path.join(__dirname, "..", "src", "locales");

const PLATFORM_KEY_PATTERNS = [
  /^globeOnlyMac$/i,
  /^mouseButtonOnlyMac$/i,
  /^globe[A-Z].*$/, // globeKey, globeHotkey, globeListener, etc.
  /^globe$/i,
  /^macos/i,
  /^macOS/i,
  /^linuxPtt/i,
  /^linux/i,
  /^wayland/i,
  /^xdotool/i,
  /^wl-copy/i,
  /^wl-paste/i,
  /^wl-clipboard/i,
  /^recommended-linux$/i,
  /^recommended-macos$/i,
];

const HOTKEY_ARRAY_KEYS = new Set(["hotkeyPresets", "hotkeyExamples"]);

const PLATFORM_ENTRY_HINTS = ["mac", "linux", "darwin", "wayland", "ydotool", "xdotool"];

function shouldDeleteKey(key) {
  return PLATFORM_KEY_PATTERNS.some((p) => p.test(key));
}

function walkObject(obj) {
  if (!obj || typeof obj !== "object") return obj;
  const out = Array.isArray(obj) ? [] : {};
  for (const [key, value] of Object.entries(obj)) {
    if (shouldDeleteKey(key)) continue;
    if (HOTKEY_ARRAY_KEYS.has(key) && Array.isArray(value)) {
      // Filter out platform-conditional entries.
      const filtered = value.filter((entry) => {
        if (!entry || typeof entry !== "object") return true;
        const s = JSON.stringify(entry).toLowerCase();
        return !PLATFORM_ENTRY_HINTS.some((h) => s.includes(h));
      });
      out[key] = filtered;
    } else if (value && typeof value === "object") {
      out[key] = walkObject(value);
    } else {
      out[key] = value;
    }
  }
  return out;
}

function processFile(filePath) {
  const original = fs.readFileSync(filePath, "utf8");
  const obj = JSON.parse(original);
  const stripped = walkObject(obj);
  const out = JSON.stringify(stripped, null, 2) + "\n";
  if (out !== original) {
    fs.writeFileSync(filePath, out);
    console.log(`stripped: ${filePath}`);
    return true;
  }
  console.log(`unchanged: ${filePath}`);
  return false;
}

function main() {
  const entries = fs.readdirSync(LOCALES_DIR, { withFileTypes: true });
  let total = 0;
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const filePath = path.join(LOCALES_DIR, entry.name, "translation.json");
    if (!fs.existsSync(filePath)) continue;
    if (processFile(filePath)) total++;
  }
  console.log(`done. stripped ${total} files`);
}

main();
