const path = require("path");
const { app } = require("electron");

const MAIN_OVERLAY_TYPE = "normal";

const FLOATING_OVERLAY_TYPE = "normal";


const WINDOW_SIZES = {
  BASE: { width: 96, height: 96 },
  WITH_MENU: { width: 240, height: 280 },
  WITH_TOAST: { width: 400, height: 500 },
  EXPANDED: { width: 400, height: 500 },
};

const DICTATION_BAR = {
  WIDTH_RATIO: 0.2, // max 20% of the screen width (user requirement, 2026-08-03)
  HEIGHT: 36, // exact pill height — no breathing room, no visible rectangle
  MARGIN: 2, // gap to the taskbar / top edge
};

// Main dictation window configuration
const MAIN_WINDOW_CONFIG = {
  width: WINDOW_SIZES.BASE.width,
  height: WINDOW_SIZES.BASE.height,
  title: "Voice Recorder",
  webPreferences: {
    preload: path.join(__dirname, "..", "..", "preload.js"),
    nodeIntegration: false,
    contextIsolation: true,
    sandbox: true,
  },
  frame: false,
  alwaysOnTop: true,
  transparent: true,
  show: false,
  focusable: false,
  visibleOnAllWorkspaces: false,
  fullScreenable: false,
  hasShadow: false,
  acceptsFirstMouse: true,
  type: MAIN_OVERLAY_TYPE,
  resizable: false,
  thickFrame: false,
  skipTaskbar: true,
  backgroundColor: "#00000000",
};
function resolveAppIcon() {
  return path.join(app.getAppPath(), "src", "assets", "icon.ico");
}

// Control panel window configuration
const CONTROL_PANEL_CONFIG = {
  width: 1200,
  height: 800,
  backgroundColor: "#1c1c2e",
  icon: resolveAppIcon(),
  webPreferences: {
    preload: path.join(__dirname, "..", "..", "preload.js"),
    nodeIntegration: false,
    contextIsolation: true,
    // sandbox: false is required because the preload script bridges IPC
    // between the renderer and main process.
    sandbox: false,
    // webSecurity: false disables same-origin policy. Required because in
    // production the renderer loads from a file:// origin but makes
    // cross-origin fetch calls to Better Auth, Gemini, OpenAI, and Groq APIs
    // directly from the browser. These would be blocked by CORS otherwise.
    webSecurity: false,
    spellcheck: false,
  },
  title: "Control Panel",
  resizable: true,
  show: false,
  frame: false,

  transparent: false,
  minimizable: true,
  maximizable: true,
  closable: true,
  fullscreenable: true,
  skipTaskbar: false,
  alwaysOnTop: false,
  visibleOnAllWorkspaces: false,
};

const TRANSCRIPTION_PREVIEW_SIZE_LIMITS = {
  minWidth: 400,
  defaultWidth: 460,
  maxWidth: 640,
  minHeight: 96,
  defaultHeight: 132,
  maxHeight: 520,
};

const TRANSCRIPTION_PREVIEW_CONFIG = {
  width: TRANSCRIPTION_PREVIEW_SIZE_LIMITS.defaultWidth,
  height: TRANSCRIPTION_PREVIEW_SIZE_LIMITS.defaultHeight,
  frame: false,
  transparent: true,
  alwaysOnTop: true,
  skipTaskbar: true,
  resizable: false,
  focusable: false,
  hasShadow: false,
  show: false,
  acceptsFirstMouse: true,
  webPreferences: {
    preload: path.join(__dirname, "..", "..", "preload.js"),
    nodeIntegration: false,
    contextIsolation: true,
    sandbox: true,
  },
  visibleOnAllWorkspaces: false,
  type: FLOATING_OVERLAY_TYPE,
};

class WindowPositionUtil {
  static getMainWindowPosition(display, customSize = null, position = "bottom-right") {
    const { width, height } = customSize || WINDOW_SIZES.BASE;
    const MARGIN = 4;
    const workArea = display.workArea || display.bounds;

    let x, y;
    if (position === "bottom-left") {
      x = workArea.x + MARGIN;
      y = Math.max(0, workArea.y + workArea.height - height - MARGIN);
    } else if (position === "center") {
      x = Math.round(workArea.x + (workArea.width - width) / 2);
      y = Math.max(0, workArea.y + workArea.height - height - MARGIN);
    } else {
      // bottom-right (default)
      x = Math.max(0, workArea.x + workArea.width - width - MARGIN);
      y = Math.max(0, workArea.y + workArea.height - height - MARGIN);
    }

    return { x, y, width, height };
  }

  static getDictationBarPosition(display, position = "bottom", alignX = "right") {
    const workArea = display.workArea || display.bounds;
    const width = Math.round(workArea.width * DICTATION_BAR.WIDTH_RATIO);
    const height = DICTATION_BAR.HEIGHT;
    let x;
    if (alignX === "left") {
      x = workArea.x + DICTATION_BAR.MARGIN;
    } else if (alignX === "center") {
      x = Math.max(
        workArea.x,
        Math.round(workArea.x + (workArea.width - width) / 2)
      );
    } else {
      // right (default) — same corner anchor as the idle ball
      x = Math.max(workArea.x, workArea.x + workArea.width - width - DICTATION_BAR.MARGIN);
    }
    const y =
      position === "top"
        ? Math.max(0, workArea.y + DICTATION_BAR.MARGIN)
        : Math.max(0, workArea.y + workArea.height - height - DICTATION_BAR.MARGIN);
    return { x, y, width, height };
  }

  static getTranscriptionPreviewPosition(display, mainWindowBounds, size = {}) {
    const width =
      size.width ||
      TRANSCRIPTION_PREVIEW_CONFIG.width ||
      TRANSCRIPTION_PREVIEW_SIZE_LIMITS.defaultWidth;
    const height =
      size.height ||
      TRANSCRIPTION_PREVIEW_CONFIG.height ||
      TRANSCRIPTION_PREVIEW_SIZE_LIMITS.defaultHeight;
    const GAP = 8;
    const workArea = display.workArea || display.bounds;

    const spaceLeft = mainWindowBounds.x - workArea.x;
    const spaceRight =
      workArea.x + workArea.width - (mainWindowBounds.x + mainWindowBounds.width);

    // Sit beside the floating icon, on whichever side has more room.
    const side = spaceRight >= width + GAP || spaceRight >= spaceLeft ? "right" : "left";

    let x =
      side === "right"
        ? mainWindowBounds.x + mainWindowBounds.width + GAP
        : mainWindowBounds.x - width - GAP;
    let y = mainWindowBounds.y + mainWindowBounds.height - height;

    x = Math.max(workArea.x, Math.min(x, workArea.x + workArea.width - width));
    y = Math.max(workArea.y, Math.min(y, workArea.y + workArea.height - height));

    return { x, y, width, height };
  }

  static setupAlwaysOnTop(window) {
    window.setAlwaysOnTop(true, "pop-up-menu");
  }
}

// Win11 background material (Mica) — best-effort. transparent windows ignore
// it; the fallback is the existing transparent/solid behavior (accepted
// deviation, spec "Material / Mica").
function applyMica(win) {
  if (!win || process.platform !== "win32" || typeof win.setBackgroundMaterial !== "function") {
    return false;
  }
  try {
    win.setBackgroundMaterial("mica");
    return true;
  } catch {
    return false;
  }
}

const AGENT_OVERLAY_CONFIG = {
  width: 420,
  height: 300,
  minWidth: 360,
  minHeight: 200,
  maxWidth: 800,
  maxHeight: 10000,
  frame: false,
  alwaysOnTop: true,
  transparent: true,
  show: false,
  skipTaskbar: true,
  hasShadow: false,
  focusable: true,
  resizable: false,
  fullScreenable: false,
  acceptsFirstMouse: true,
  type: FLOATING_OVERLAY_TYPE,
  visibleOnAllWorkspaces: false,
  webPreferences: {
    preload: path.join(__dirname, "..", "..", "preload.js"),
    nodeIntegration: false,
    contextIsolation: true,
    sandbox: false,
    webSecurity: false,
    spellcheck: false,
  },
};

module.exports = {
  MAIN_WINDOW_CONFIG,
  CONTROL_PANEL_CONFIG,
  AGENT_OVERLAY_CONFIG,
  TRANSCRIPTION_PREVIEW_CONFIG,
  TRANSCRIPTION_PREVIEW_SIZE_LIMITS,
  WINDOW_SIZES,
  DICTATION_BAR,
  WindowPositionUtil,
  applyMica,
};
