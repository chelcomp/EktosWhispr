/**
 * Hotkey utilities for formatting and displaying keyboard shortcuts.
 * Supports both single keys and compound hotkeys (e.g., "CommandOrControl+Shift+K").
 */

import { getPlatform, type Platform } from "./platform";

export function isGlobeLikeHotkey(hotkey: string): boolean {
  return hotkey === "GLOBE" || hotkey === "Fn";
}

/**
 * Parse a comma-separated hotkey list (a legacy single value is a one-item
 * list): trimmed, de-duplicated, empties removed, order preserved. The comma
 * KEY is itself a valid hotkey (e.g. "Control+,"): no accelerator legitimately
 * ends with "+", so a split segment ending in "+" gets its comma restored.
 *
 * Keep in sync with the main-process twin in src/helpers/hotkeyList.js.
 */
export function parseHotkeyList(value?: string | null): string[] {
  if (!value) return [];
  const raw = value.split(",");
  const seen = new Set<string>();
  const result: string[] = [];
  for (let i = 0; i < raw.length; i++) {
    let hotkey = raw[i].trim();
    if (hotkey.endsWith("+") && i < raw.length - 1) {
      hotkey += ",";
    }
    if (!hotkey || seen.has(hotkey)) continue;
    seen.add(hotkey);
    result.push(hotkey);
  }
  return result;
}

/** Serialize a hotkey list back to the canonical comma-separated string. */
export function serializeHotkeyList(list: string[]): string {
  return parseHotkeyList(list.join(",")).join(",");
}

export function isMouseButtonHotkey(hotkey: string): boolean {
  return /^MouseButton[45]$/i.test(hotkey || "");
}

function formatModifierPart(part: string, platform: Platform): string {
  switch (part) {
    case "CommandOrControl":
      return platform === "darwin" ? "Cmd" : "Ctrl";
    case "Command":
    case "Cmd":
      return "Cmd";
    case "Control":
    case "Ctrl":
      return "Ctrl";
    case "Alt":
      return platform === "darwin" ? "Option" : "Alt";
    case "Option":
      return "Option";
    case "Shift":
      return "Shift";
    case "Super":
    case "Meta":
      return platform === "darwin" ? "Cmd" : platform === "win32" ? "Win" : "Super";
    case "Win":
      return platform === "win32" ? "Win" : "Super";
    case "Fn":
      return "Fn";
    default:
      return part;
  }
}

/**
 * Formats an Electron accelerator string into a user-friendly display label.
 *
 * @param hotkey - The hotkey string in Electron accelerator format
 * @returns User-friendly label (e.g., "Cmd+Shift+K" on macOS, "Ctrl+Shift+K" on Windows)
 *
 * @example
 * formatHotkeyLabel("CommandOrControl+Shift+K") // "Cmd+Shift+K" on macOS, "Ctrl+Shift+K" on Windows
 * formatHotkeyLabel("GLOBE") // "Globe"
 * formatHotkeyLabel("`") // "`"
 * formatHotkeyLabel(null) // platform default
 */
export function formatHotkeyLabel(hotkey?: string | null): string {
  const platform = getPlatform();
  const resolvedHotkey = hotkey && hotkey.trim() !== "" ? hotkey : getDefaultHotkey();
  return formatHotkeyLabelForPlatform(resolvedHotkey, platform);
}

/**
 * Label for a comma-separated hotkey list: entries formatted individually and
 * joined with " / "; empty lists fall back like formatHotkeyLabel.
 */
export function formatHotkeyListLabel(value?: string | null): string {
  const list = parseHotkeyList(value);
  if (list.length === 0) return formatHotkeyLabel(value);
  return list.map((hotkey) => formatHotkeyLabel(hotkey)).join(" / ");
}

export function formatHotkeyLabelForPlatform(hotkey: string, platform: Platform): string {
  if (!hotkey || hotkey.trim() === "") {
    return "";
  }

  if (isGlobeLikeHotkey(hotkey)) {
    return "Globe/Fn";
  }

  if (isMouseButtonHotkey(hotkey)) {
    return hotkey === "MouseButton4" ? "Mouse Button 4" : "Mouse Button 5";
  }

  // Right-side single modifiers
  const rightSideMap: Record<string, string> = {
    RightOption: platform === "darwin" ? "Right Option" : "Right Alt",
    RightAlt: "Right Alt",
    RightCommand: "Right Cmd",
    RightCmd: "Right Cmd",
    RightControl: "Right Ctrl",
    RightCtrl: "Right Ctrl",
    RightShift: "Right Shift",
    RightSuper: platform === "win32" ? "Right Win" : "Right Super",
    RightMeta:
      platform === "darwin" ? "Right Cmd" : platform === "win32" ? "Right Win" : "Right Super",
    RightWin: "Right Win",
  };
  if (rightSideMap[hotkey]) {
    return rightSideMap[hotkey];
  }

  if (hotkey.includes("+")) {
    const parts = hotkey.split("+");
    const formattedParts = parts.map((part) => formatModifierPart(part, platform));
    return formattedParts.join("+");
  }

  return hotkey;
}

/**
 * Gets the default hotkey for the current platform.
 * - macOS: GLOBE key (Fn key on modern Macs)
 * - Windows/Linux: Control+Super (Ctrl+Win / Ctrl+Super)
 */
export function getDefaultHotkey(): string {
  const platform = getPlatform();
  return platform === "darwin" ? "GLOBE" : "Control+Super";
}
