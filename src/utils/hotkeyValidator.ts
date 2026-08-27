import {
  formatHotkeyLabelForPlatform,
  isGlobeLikeHotkey,
  isMouseButtonHotkey,
  parseHotkeyList,
} from "./hotkeys";

export type Platform = "win32";

export type ValidationErrorCode =
  | "TOO_MANY_KEYS"
  | "NO_MODIFIER_OR_SPECIAL"
  | "LEFT_RIGHT_MIX"
  | "LEFT_MODIFIER_ONLY"
  | "DUPLICATE"
  | "RESERVED"
  | "INVALID_GLOBE";

export interface ValidationResult {
  valid: boolean;
  error?: string;
  errorCode?: ValidationErrorCode;
}

const MODIFIER_ORDER = ["Control", "Command", "Alt", "Shift", "Super", "Fn"];

const MODIFIERS = new Set(MODIFIER_ORDER);

const RIGHT_SIDE_MODIFIERS = new Set([
  "rightcontrol",
  "rightctrl",
  "rightalt",
  "rightoption",
  "rightshift",
  "rightcommand",
  "rightcmd",
  "rightsuper",
  "rightmeta",
  "rightwin",
]);

function isRightSideModifier(part: string): boolean {
  const normalized = part.replace(/[-_ ]/g, "").toLowerCase();
  return RIGHT_SIDE_MODIFIERS.has(normalized);
}

const SPECIAL_KEYS = new Set(
  [
    "GLOBE",
    "Fn",
    "Esc",
    "Tab",
    "Space",
    "Backspace",
    "Insert",
    "Delete",
    "Home",
    "End",
    "PageUp",
    "PageDown",
    "Left",
    "Right",
    "Up",
    "Down",
    "PrintScreen",
    "Pause",
    "ScrollLock",
    "NumLock",
  ].concat(Array.from({ length: 24 }, (_, i) => `F${i + 1}`))
);


const WINDOWS_RESERVED_SHORTCUTS = [
  "Control+C",
  "Control+V",
  "Control+X",
  "Control+Z",
  "Control+Y",
  "Control+R",
  "Control+A",
  "Control+F",
  "Control+G",
  "Control+O",
  "Control+S",
  "Control+P",
  "Control+N",
  "Control+T",
  "Control+W",
  "Control+Home",
  "Control+End",
  "Control+Alt+Delete",
  "Control+Shift+Esc",
  "Control+Backspace",
  "Control+Delete",
  "Control+K",
  "Control+Shift+T",
  "Control+=",
  "Control+-",
  "Alt+Tab",
  "Alt+F4",
  "Alt+Left",
  "Alt+Right",
  "Alt+PrintScreen",
  "F5",
  "F11",
  "Home",
  "End",
  "PrintScreen",
  "Super+E",
  "Super+R",
  "Super+L",
  "Super+D",
  "Super+Tab",
  "Super+I",
  "Super+S",
  "Super+X",
  "Super+P",
  "Super+Q",
  "Super+U",
  "Super+B",
  "Super+Up",
  "Super+Down",
] as const;


function normalizeModifier(part: string, _platform: Platform): string | null {
  const trimmed = part.replace(/\s+/g, "");
  const lowered = trimmed.toLowerCase();

  if (lowered === "commandorcontrol" || lowered === "cmdorctrl") {
    return "Control";
  }

  if (lowered === "control" || lowered === "ctrl") {
    return "Control";
  }

  if (lowered === "alt" || lowered === "option") {
    return "Alt";
  }

  if (lowered === "shift") {
    return "Shift";
  }

  if (lowered === "super" || lowered === "win" || lowered === "meta") {
    return "Super";
  }

  if (lowered === "fn") {
    return "Fn";
  }

  // Handle right-side modifiers (e.g., RightControl, RightOption)
  // These are valid modifiers but we preserve their "Right" prefix for single-modifier validation
  if (isRightSideModifier(part)) {
    // Return a normalized form but mark it as a modifier
    if (lowered.includes("control") || lowered.includes("ctrl")) return "RightControl";
    if (lowered.includes("alt") || lowered.includes("option")) return "RightAlt";
    if (lowered.includes("shift")) return "RightShift";
    if (lowered.includes("super") || lowered.includes("meta") || lowered.includes("win")) {
      return "RightSuper";
    }
  }

  return null;
}

function normalizeKeyToken(part: string): string {
  const trimmed = part.replace(/\s+/g, "");
  const lowered = trimmed.toLowerCase();

  if (lowered === "arrowleft") return "Left";
  if (lowered === "arrowright") return "Right";
  if (lowered === "arrowup") return "Up";
  if (lowered === "arrowdown") return "Down";
  if (lowered === "escape" || lowered === "esc") return "Esc";
  if (lowered === "printscreen" || lowered === "print") return "PrintScreen";
  if (lowered === "pageup" || lowered === "pgup") return "PageUp";
  if (lowered === "pagedown" || lowered === "pgdown") return "PageDown";
  if (lowered === "scrolllock") return "ScrollLock";
  if (lowered === "numlock") return "NumLock";
  if (lowered === "delete" || lowered === "del") return "Delete";
  if (lowered === "insert" || lowered === "ins") return "Insert";
  if (lowered === "space") return "Space";
  if (lowered === "tab") return "Tab";
  if (lowered === "home") return "Home";
  if (lowered === "end") return "End";
  if (lowered === "backspace") return "Backspace";
  if (lowered === "globe") return "GLOBE";
  if (lowered === "fn") return "Fn";
  if (lowered === "mousebutton4") return "MouseButton4";
  if (lowered === "mousebutton5") return "MouseButton5";

  const functionMatch = lowered.match(/^f(\d{1,2})$/);
  if (functionMatch) {
    return `F${functionMatch[1]}`;
  }

  if (trimmed.length === 1) {
    return trimmed.toUpperCase();
  }

  return trimmed;
}

function isLeftRightMix(parts: string[]): boolean {
  const sidesByModifier = new Map<string, Set<string>>();

  const patterns = [
    /^(left|right)[-_ ]?(ctrl|control|alt|option|shift|command|cmd|super|meta)$/i,
    /^(ctrl|control|alt|option|shift|command|cmd|super|meta)[-_ ]?(left|right)$/i,
  ];

  for (const rawPart of parts) {
    const part = rawPart.replace(/\s+/g, "");
    for (const pattern of patterns) {
      const match = part.match(pattern);
      if (match) {
        const side = match[1].toLowerCase().includes("left") ? "left" : "right";
        const modifier = match[2]?.toLowerCase() || match[1]?.toLowerCase();
        if (!modifier) continue;
        const normalizedModifier =
          modifier === "ctrl"
            ? "control"
            : modifier === "cmd"
              ? "command"
              : modifier === "option"
                ? "alt"
                : modifier;
        const set = sidesByModifier.get(normalizedModifier) ?? new Set<string>();
        set.add(side);
        sidesByModifier.set(normalizedModifier, set);
      }
    }
  }

  for (const set of sidesByModifier.values()) {
    if (set.size > 1) {
      return true;
    }
  }

  return false;
}

export function normalizeHotkey(hotkey: string, platform: Platform): string {
  if (!hotkey) return "";

  const parts = hotkey
    .split("+")
    .map((part) => part.trim())
    .filter(Boolean);

  const modifiers: string[] = [];
  const keys: string[] = [];

  for (const part of parts) {
    const normalizedModifier = normalizeModifier(part, platform);
    if (normalizedModifier) {
      modifiers.push(normalizedModifier);
      continue;
    }

    keys.push(normalizeKeyToken(part));
  }

  modifiers.sort((a, b) => MODIFIER_ORDER.indexOf(a) - MODIFIER_ORDER.indexOf(b));

  return [...modifiers, ...keys].join("+");
}

export function getReservedShortcuts(_platform: Platform): readonly string[] {
  return WINDOWS_RESERVED_SHORTCUTS;
}

export function getValidExamples(_platform: Platform): readonly string[] {
  return ["Control+Shift+K", "Alt+Space", "F8", "Control+Super", "Shift+F1"];
}

export function getValidationMessage(
  hotkey: string,
  platform: Platform,
  existingHotkeys: string[] = []
): string | null {
  const result = validateHotkey(hotkey, platform, existingHotkeys);
  if (result.valid) return null;

  if (result.errorCode === "RESERVED") {
    const label = formatHotkeyLabelForPlatform(hotkey, platform);
    return `${label} is reserved by the system`;
  }

  return result.error || "That shortcut is not supported";
}

export function validateHotkey(
  hotkey: string,
  platform: Platform,
  existingHotkeys: string[] = []
): ValidationResult {
  if (!hotkey || hotkey.trim() === "") {
    return { valid: false, error: "Please enter a valid shortcut." };
  }

  // A slot may hold several hotkeys as a comma-separated list (#936) — validate
  // each entry independently and return the first failure. parseHotkeyList keeps
  // comma-key hotkeys like "Control+," intact, so a single such hotkey falls
  // through to the regular single-hotkey validation below.
  if (hotkey.includes(",")) {
    const items = parseHotkeyList(hotkey);
    if (items.length === 0) {
      return { valid: false, error: "Please enter a valid shortcut." };
    }
    if (items.length > 1) {
      for (const item of items) {
        const result = validateHotkey(item, platform, existingHotkeys);
        if (!result.valid) return result;
      }
      return { valid: true };
    }
    hotkey = items[0];
  }

  if (isGlobeLikeHotkey(hotkey)) {
    return {
      valid: false,
      error: "The Globe/Fn key is only available on macOS.",
      errorCode: "INVALID_GLOBE",
    };
  }

  if (isMouseButtonHotkey(hotkey)) {
    return {
      valid: false,
      error: "Mouse button hotkeys are currently supported on macOS only.",
    };
  }

  const parts = hotkey
    .split("+")
    .map((part) => part.trim())
    .filter(Boolean);

  if (parts.length > 3) {
    return {
      valid: false,
      error: "Shortcuts are limited to three keys.",
      errorCode: "TOO_MANY_KEYS",
    };
  }

  if (isLeftRightMix(parts)) {
    return {
      valid: false,
      error: "Do not mix left and right versions of the same modifier in one shortcut.",
      errorCode: "LEFT_RIGHT_MIX",
    };
  }

  let hasModifier = false;
  let hasSpecialKey = false;

  for (const part of parts) {
    const normalizedModifier = normalizeModifier(part, platform);
    if (normalizedModifier) {
      hasModifier = true;
      continue;
    }

    const normalizedKey = normalizeKeyToken(part);
    if (SPECIAL_KEYS.has(normalizedKey)) {
      hasSpecialKey = true;
    }
  }

  if (!hasModifier && !hasSpecialKey) {
    return {
      valid: false,
      error:
        "Shortcuts must include a modifier or a non-alphanumeric key (like arrows, space, or function keys).",
      errorCode: "NO_MODIFIER_OR_SPECIAL",
    };
  }

  // Check for modifier-only hotkeys: require right-side for single modifier, or 2+ modifiers
  const modifierCount = parts.filter((part) => normalizeModifier(part, platform) !== null).length;
  const hasBaseKey = parts.length > modifierCount;

  if (!hasBaseKey && modifierCount === 1) {
    const singleMod = parts[0];
    if (!isRightSideModifier(singleMod)) {
      return {
        valid: false,
        error:
          "Single modifier hotkeys must use the right-side key (e.g., RightOption). Or use two modifiers (e.g., Control+Alt).",
        errorCode: "LEFT_MODIFIER_ONLY",
      };
    }
  }

  const normalizedHotkey = normalizeHotkey(hotkey, platform);
  const normalizedExisting = existingHotkeys.map((existing) => normalizeHotkey(existing, platform));

  if (normalizedExisting.includes(normalizedHotkey)) {
    return {
      valid: false,
      error: "That shortcut is already in use.",
      errorCode: "DUPLICATE",
    };
  }

  const reserved = getReservedShortcuts(platform);
  const normalizedReserved = reserved.map((entry) => normalizeHotkey(entry, platform));

  if (normalizedReserved.includes(normalizedHotkey)) {
    return {
      valid: false,
      error: "That shortcut is reserved by your system.",
      errorCode: "RESERVED",
    };
  }

  return { valid: true };
}
