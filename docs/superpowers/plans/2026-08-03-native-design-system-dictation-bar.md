# Native Design System + Dictation Bar Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Slice 1 of the UI redesign — replace the Parchment palette with neutral Win11 tokens + dynamic Windows accent, and replace the round floating button during active dictation with the approved horizontal dictation bar (4 states, 20%-max width, anchored above/below the taskbar).

**Architecture:** Pure geometry/formatting helpers live in `src/helpers/` (CommonJS, unit-tested under plain `node --test`); window orchestration in `WindowManager` (thin, reuses the tested helpers); IPC follows the existing `resize-main-window` pattern (invoke from renderer + `registerListener` push events); the bar itself is a new `DictationBar` React component driven by `micState` in `App.jsx`, with the capturing/transcribing/processing/error decision extracted into a pure function. CSS tokens in `src/index.css` (Tailwind v4 `@theme inline` so `--color-primary` etc. follow the dynamic `--color-accent`).

**Tech Stack:** Electron 41 (Node ≥ 26), React 19, Tailwind v4 (`@theme`), zustand (`settingsStore`), `node:test` + `@testing-library/react` (via `tsxRegister` for `test/components/*`).

## Global Constraints

- Main process = CommonJS (`require`/`module.exports`); renderer = ESM/TSX; `src/helpers/*.js` are CommonJS.
- `npm test` = `node --test "test/helpers/*.test.js" "test/utils/*.test.js" "test/models/*.test.js" && node --test --import ./test/setup/tsxRegister.js "test/components/*.test.js"`. Component tests use `@testing-library/react` under happy-dom (see `test/setup/tsxRegister.js`).
- Electron module mocking in helper tests uses the established `Module._load` interception pattern (see `test/helpers/dictationBatchingIpc.test.js`, `test/helpers/activeWindowCapture.test.js`); IPC handler tests use `Object.create(IPCHandlers.prototype)` + `setupHandlers()` with a captured-handler `Map`.
- Test baseline: 753 pass / 1 pre-existing environmental failure (`activeWindowCapture.test.js` — binary present on this machine) / 30 skip. Never treat that failure as a regression.
- Dictation bar spec: window `width = round(workArea.width × 0.2)`, `height = 40` (36px pill + 2px shadow breathing room), centered `x`, bottom = `workArea.y + workArea.height - height - 2`, top = `workArea.y + 2`; pill 36px / radius 18px / font 13px / padding 10px; `hasShadow: false` stays, pill shadow is CSS.
- Four states: capturing (30 bars + `M:SS` timer), transcribing (5 bars left in a fixed 46px block + sliding caption center + timer right), processing (35 bars + sweeping shine; LLM transform reuses this), error (red `!` + slow marquee, auto-hide after 5s).
- Accent: `systemPreferences.getAccentColor()` (main) → normalized `#rrggbb` → IPC → CSS `--color-accent`; fallback `#0067c0`. Non-Windows: fallback only.
- Dark/light: renderer already follows the OS (`useTheme` + `matchMedia`, `theme` store default `auto`) — **no changes** to the theme trigger this slice.
- Mica: Win11-only, guarded, best-effort (`try/catch`); fallback = current transparent behavior. `applyMica` is a no-op elsewhere.
- Font: `"Segoe UI Variable Text", "Segoe UI", system-ui, sans-serif` in `--font-family-sans`.
- Settings store: new `dictationBarPosition: "bottom" | "top"` default `"bottom"`, no settings UI this slice.
- Do NOT run prettier on `docs/specs/*` (pre-existing non-conforming); run it on changed code files only.
- Commit after every task with a conventional message. Branch: `feat/native-design-system-dictation-bar` (already created).
- `npm run typecheck` and `npm run lint` must stay green at every commit; run them once at the end of each task that touches `.ts`/`.tsx`.

---

### Task 1: `WindowPositionUtil.getDictationBarPosition` + `DICTATION_BAR` constants

**Files:**
- Modify: `src/helpers/windowConfig.js` (add constants near `WINDOW_SIZES` line 32; add static method to `WindowPositionUtil` class at line 161; add both to the `module.exports` block at line 283)
- Test: `test/helpers/windowConfig.test.js` (new)

**Interfaces:**
- Produces: `const DICTATION_BAR = { WIDTH_RATIO: 0.2, HEIGHT: 40, MARGIN: 2 }` (exported); `WindowPositionUtil.getDictationBarPosition(display, position = "bottom") → { x, y, width, height }`. Used by Task 3.

- [ ] **Step 1: Write the failing test**

Create `test/helpers/windowConfig.test.js` (mirrors the `Module._load` electron stub from `test/helpers/clipboardRestore.test.js`):

```js
const test = require("node:test");
const assert = require("node:assert/strict");
const Module = require("node:module");

const modulePath = require.resolve("../../src/helpers/windowConfig");
const originalLoad = Module._load;

function loadWindowConfig() {
  delete require.cache[modulePath];
  Module._load = function patchedLoad(request, parent, isMain) {
    if (request === "electron") {
      return { app: { getPath: () => require("os").tmpdir() } };
    }
    return originalLoad.call(this, request, parent, isMain);
  };
  try {
    return require(modulePath);
  } finally {
    Module._load = originalLoad;
  }
}

const fullHd = { workArea: { x: 0, y: 0, width: 1920, height: 1040 } };

test("getDictationBarPosition centers horizontally, width = 20% of workArea, height 40", () => {
  const { WindowPositionUtil } = loadWindowConfig();
  const pos = WindowPositionUtil.getDictationBarPosition(fullHd, "bottom");
  assert.equal(pos.width, 384); // round(1920 * 0.2)
  assert.equal(pos.height, 40);
  assert.equal(pos.x, Math.round((1920 - 384) / 2));
});

test("getDictationBarPosition bottom sits 2px above the workArea bottom edge", () => {
  const { WindowPositionUtil } = loadWindowConfig();
  const pos = WindowPositionUtil.getDictationBarPosition(fullHd, "bottom");
  assert.equal(pos.y, 1040 - 40 - 2);
});

test("getDictationBarPosition top sits 2px below the workArea top edge (respects multi-monitor origin)", () => {
  const { WindowPositionUtil } = loadWindowConfig();
  const display = { workArea: { x: -1920, y: 40, width: 1920, height: 1000 } };
  const pos = WindowPositionUtil.getDictationBarPosition(display, "top");
  assert.equal(pos.x, -1920 + Math.round((1920 - 384) / 2));
  assert.equal(pos.y, 42);
});

test("getDictationBarPosition never leaves the workArea horizontally", () => {
  const { WindowPositionUtil } = loadWindowConfig();
  const display = { workArea: { x: 0, y: 0, width: 250, height: 200 } }; // 20% = 50px
  const pos = WindowPositionUtil.getDictationBarPosition(display, "bottom");
  assert.ok(pos.x >= 0);
  assert.ok(pos.x + pos.width <= 250);
  assert.ok(pos.y >= 0);
});

test("getDictationBarPosition falls back to display.bounds when workArea is missing", () => {
  const { WindowPositionUtil } = loadWindowConfig();
  const display = { bounds: { x: 0, y: 0, width: 1000, height: 800 } };
  const pos = WindowPositionUtil.getDictationBarPosition(display, "bottom");
  assert.equal(pos.y, 800 - 40 - 2);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test test/helpers/windowConfig.test.js`
Expected: FAIL — `TypeError: WindowPositionUtil.getDictationBarPosition is not a function`.

- [ ] **Step 3: Write minimal implementation**

In `src/helpers/windowConfig.js`, after `WINDOW_SIZES` (line 37), add:

```js
const DICTATION_BAR = {
  WIDTH_RATIO: 0.2, // max 20% of the screen width (user requirement, 2026-08-03)
  HEIGHT: 40, // 36px pill + 2px breathing room for the CSS shadow
  MARGIN: 2, // gap to the taskbar / top edge
};
```

Inside the `WindowPositionUtil` class, after `getMainWindowPosition` (line 180), add:

```js
  static getDictationBarPosition(display, position = "bottom") {
    const workArea = display.workArea || display.bounds;
    const width = Math.round(workArea.width * DICTATION_BAR.WIDTH_RATIO);
    const height = DICTATION_BAR.HEIGHT;
    const x = Math.max(
      workArea.x,
      Math.round(workArea.x + (workArea.width - width) / 2)
    );
    const y =
      position === "top"
        ? Math.max(0, workArea.y + DICTATION_BAR.MARGIN)
        : Math.max(0, workArea.y + workArea.height - height - DICTATION_BAR.MARGIN);
    return { x, y, width, height };
  }
```

Add `DICTATION_BAR,` to the `module.exports` object (line 283).

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test test/helpers/windowConfig.test.js`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add src/helpers/windowConfig.js test/helpers/windowConfig.test.js
git commit -m "feat: dictation bar geometry util (20% width, 2px above taskbar)"
```

---

### Task 2: `dictationBarPosition` in `settingsStore`

**Files:**
- Modify: `src/stores/settingsStore.ts` (add to `SettingsState` near `panelStartPosition` line 531; add default near line 1130; add setter near line 1719)
- Test: `test/components/settingsStoreDictationBar.test.js` (new)

**Interfaces:**
- Produces: `useSettingsStore.getState().dictationBarPosition: "bottom" | "top"` (default `"bottom"`), `setDictationBarPosition(value: "bottom" | "top") => void`. Consumed by Task 8.

- [ ] **Step 1: Write the failing test**

Create `test/components/settingsStoreDictationBar.test.js` (imports the store like `test/components/promptPlaceholders.test.js` does — tsxRegister handles the TS):

```js
const test = require("node:test");
const assert = require("node:assert/strict");
const { useSettingsStore } = require("../../src/stores/settingsStore.ts");

test("dictationBarPosition defaults to bottom", () => {
  assert.equal(useSettingsStore.getState().dictationBarPosition, "bottom");
});

test("setDictationBarPosition updates the value", () => {
  const store = useSettingsStore.getState();
  store.setDictationBarPosition("top");
  assert.equal(useSettingsStore.getState().dictationBarPosition, "top");
  store.setDictationBarPosition("bottom");
  assert.equal(useSettingsStore.getState().dictationBarPosition, "bottom");
});

test("setDictationBarPosition ignores invalid values", () => {
  const store = useSettingsStore.getState();
  store.setDictationBarPosition("top");
  store.setDictationBarPosition("sideways"); // not in the union
  assert.equal(useSettingsStore.getState().dictationBarPosition, "top");
  store.setDictationBarPosition("bottom");
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test --import ./test/setup/tsxRegister.js test/components/settingsStoreDictationBar.test.js`
Expected: FAIL — `undefined` where `"bottom"` expected.

- [ ] **Step 3: Write minimal implementation**

In `SettingsState` (after `panelStartPosition`, line 531):

```ts
  dictationBarPosition: "bottom" | "top";
```

In the state initializer (after the `panelStartPosition` entry):

```ts
  dictationBarPosition: (() => {
    const v = readString("dictationBarPosition", "bottom");
    return v === "bottom" || v === "top" ? v : "bottom";
  })(),
```

In the setters block (after `setTheme`, line 1722):

```ts
  setDictationBarPosition: (value: "bottom" | "top") => {
    if (value !== "bottom" && value !== "top") return;
    if (isBrowser) localStorage.setItem("dictationBarPosition", value);
    set({ dictationBarPosition: value });
  },
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test --import ./test/setup/tsxRegister.js test/components/settingsStoreDictationBar.test.js`
Expected: PASS (3 tests).

- [ ] **Step 5: Typecheck + commit**

Run: `cd src && npx tsc --noEmit` — must stay green.
```bash
git add src/stores/settingsStore.ts test/components/settingsStoreDictationBar.test.js
git commit -m "feat: dictationBarPosition setting (bottom|top, default bottom)"
```

---

### Task 3: `WindowManager.resizeToDictationBar(position)`

**Files:**
- Modify: `src/helpers/windowManager.js` (new method, e.g. after `resizeMainWindow` line 235)
- Test: `test/helpers/dictationBarWindow.test.js` (new)

**Interfaces:**
- Consumes: `WindowPositionUtil.getDictationBarPosition` + `DICTATION_BAR` from Task 1.
- Produces: `windowManager.resizeToDictationBar(position = "bottom") → { success: true, bounds } | { success: false }`. Consumed by Task 4.

- [ ] **Step 1: Write the failing test**

Create `test/helpers/dictationBarWindow.test.js` — `Module._load` mocks `electron` (like `dictationBatchingIpc.test.js`) and the instance is built via `Object.create(WindowManager.prototype)` (the real constructor does heavy startup work):

```js
const test = require("node:test");
const assert = require("node:assert/strict");
const Module = require("node:module");

const modulePath = require.resolve("../../src/helpers/windowManager");
const originalLoad = Module._load;

Module._load = function patchedLoad(request, parent, isMain) {
  if (request === "electron") {
    return {
      app: { getPath: () => process.cwd(), getAppPath: () => process.cwd(), isReady: () => false, getVersion: () => "0.0.0", on: () => {} },
      screen: {
        getDisplayNearestPoint: () => ({ workArea: { x: 0, y: 0, width: 1920, height: 1040 } }),
      },
      ipcMain: { handle: () => {}, on: () => {} },
      shell: {},
      BrowserWindow: function BrowserWindow() {},
      dialog: { showMessageBox: async () => ({ response: 0 }) },
      nativeTheme: { on: () => {} },
    };
  }
  return originalLoad.call(this, request, parent, isMain);
};
test.after(() => {
  Module._load = originalLoad;
});

const WindowManager = require("../../src/helpers/windowManager.js");

function createWindowManager() {
  const wm = Object.create(WindowManager.prototype);
  wm.mainWindow = {
    isDestroyed: () => false,
    getBounds: () => ({ x: 0, y: 0, width: 96, height: 96 }),
    setBounds: (bounds) => {
      wm._applied = bounds;
    },
  };
  return wm;
}

test("resizeToDictationBar applies centered bounds, 20% width, 2px above taskbar bottom", () => {
  const wm = createWindowManager();
  const result = wm.resizeToDictationBar("bottom");
  assert.equal(result.success, true);
  assert.equal(wm._applied.width, 384);
  assert.equal(wm._applied.height, 40);
  assert.equal(wm._applied.y, 1040 - 40 - 2);
  assert.equal(wm._applied.x, Math.round((1920 - 384) / 2));
});

test("resizeToDictationBar top anchors 2px from the top", () => {
  const wm = createWindowManager();
  const result = wm.resizeToDictationBar("top");
  assert.equal(result.success, true);
  assert.equal(wm._applied.y, 2);
});

test("resizeToDictationBar returns failure when the window is gone", () => {
  const wm = Object.create(WindowManager.prototype);
  wm.mainWindow = { isDestroyed: () => true, getBounds: () => { throw new Error("destroyed"); }, setBounds: () => {} };
  const result = wm.resizeToDictationBar("bottom");
  assert.equal(result.success, false);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test test/helpers/dictationBarWindow.test.js`
Expected: FAIL — `TypeError: wm.resizeToDictationBar is not a function`.

- [ ] **Step 3: Write minimal implementation**

In `src/helpers/windowManager.js`, after `resizeMainWindow` (line 235):

```js
  resizeToDictationBar(position = "bottom") {
    if (!this.mainWindow || this.mainWindow.isDestroyed()) {
      return { success: false };
    }
    const currentBounds = this.mainWindow.getBounds();
    const display = screen.getDisplayNearestPoint({
      x: currentBounds.x + currentBounds.width / 2,
      y: currentBounds.y + currentBounds.height / 2,
    });
    const bounds = WindowPositionUtil.getDictationBarPosition(display, position);
    this.mainWindow.setBounds(bounds);
    return { success: true, bounds };
  }
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test test/helpers/dictationBarWindow.test.js`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/helpers/windowManager.js test/helpers/dictationBarWindow.test.js
git commit -m "feat: WindowManager.resizeToDictationBar"
```

---

### Task 4: IPC channel `resize-dictation-bar` (handler + preload + types)

**Files:**
- Modify: `src/helpers/ipcHandlers.js` (handler next to `resize-main-window` at line 1050)
- Modify: `preload.js` (method next to `resizeMainWindow` at line 358)
- Modify: `src/types/electron.ts` (add to `Window.electronAPI` interface, near `hideWindow` at line 519)
- Test: `test/helpers/dictationBarIpc.test.js` (new — `Object.create(IPCHandlers.prototype)` convention from `dictationBatchingIpc.test.js`)

**Interfaces:**
- Consumes: `windowManager.resizeToDictationBar` from Task 3.
- Produces: preload `resizeDictationBar(position: "bottom" | "top")` → invoke `"resize-dictation-bar"`. Consumed by Task 8.

- [ ] **Step 1: Write the failing test**

Create `test/helpers/dictationBarIpc.test.js`:

```js
const test = require("node:test");
const assert = require("node:assert/strict");
const Module = require("node:module");

const originalLoad = Module._load;
const registeredHandlers = new Map();

Module._load = function patchedLoad(request, parent, isMain) {
  if (request === "electron") {
    return {
      app: { getPath: () => process.cwd(), getAppPath: () => process.cwd(), isReady: () => false, getVersion: () => "0.0.0", on: () => {} },
      ipcMain: {
        handle: (name, fn) => { registeredHandlers.set(name, fn); },
        on: (name, fn) => { registeredHandlers.set(name, fn); },
      },
      shell: {},
      BrowserWindow: function BrowserWindow() {},
      systemPreferences: { subscribeWorkspaceNotification: () => {} },
      net: {},
    };
  }
  return originalLoad.call(this, request, parent, isMain);
};
test.after(() => {
  Module._load = originalLoad;
});

const IPCHandlers = require("../../src/helpers/ipcHandlers.js");

test("resize-dictation-bar forwards the position to windowManager", () => {
  const calls = [];
  const instance = Object.create(IPCHandlers.prototype);
  instance.windowManager = {
    resizeToDictationBar: (position) => {
      calls.push(position);
      return { success: true, bounds: { x: 1, y: 2, width: 384, height: 40 } };
    },
  };
  instance.setupHandlers();

  const handler = registeredHandlers.get("resize-dictation-bar");
  assert.ok(handler, "resize-dictation-bar handler registered");
  const result = handler({}, "top");
  assert.deepEqual(calls, ["top"]);
  assert.equal(result.success, true);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test test/helpers/dictationBarIpc.test.js`
Expected: FAIL — `handler` is `undefined`.

- [ ] **Step 3: Write minimal implementation**

In `src/helpers/ipcHandlers.js`, right after the `resize-main-window` handler (line 1052):

```js
    ipcMain.handle("resize-dictation-bar", (event, position) => {
      return this.windowManager.resizeToDictationBar(position === "top" ? "top" : "bottom");
    });
```

In `preload.js`, right after `resizeMainWindow` (line 358):

```js
  resizeDictationBar: (position) => ipcRenderer.invoke("resize-dictation-bar", position),
```

In `src/types/electron.ts`, inside the `Window.electronAPI` interface (after `hideWindow`):

```ts
      resizeDictationBar: (position: "bottom" | "top") => Promise<{ success: boolean; bounds?: { x: number; y: number; width: number; height: number } }>;
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test test/helpers/dictationBarIpc.test.js`
Expected: PASS.

- [ ] **Step 5: Typecheck + commit**

Run: `cd src && npx tsc --noEmit` — must stay green.
```bash
git add src/helpers/ipcHandlers.js preload.js src/types/electron.ts test/helpers/dictationBarIpc.test.js
git commit -m "feat: resize-dictation-bar IPC channel"
```

---

### Task 5: Dynamic Windows accent (helper + IPC + renderer hook)

**Files:**
- Create: `src/helpers/accentColor.js`
- Modify: `src/helpers/ipcHandlers.js` (add `nativeTheme`/`systemPreferences` to the electron destructure at the top; `get-accent-color` handler + one-time `nativeTheme.on("updated")` push in `setupHandlers`)
- Modify: `preload.js` (`getAccentColor` invoke + `onThemeUpdated` listener near line 51)
- Modify: `src/types/electron.ts` (types for both)
- Create: `src/hooks/useNativeAccent.ts`
- Modify: `src/AppRouter.jsx` (call `useNativeAccent()` next to `useTheme()` at line 14)
- Test: `test/helpers/accentColor.test.js` (new) + `test/components/useNativeAccent.test.js` (new)

**Interfaces:**
- Produces: `formatAccentColor(raw) → "#rrggbb" | null` (normalizes `aarrggbb`, `AARRGGBB` with/without `#`); `FALLBACK_ACCENT = "#0067c0"`. Preload: `getAccentColor(): Promise<string>` and `onThemeUpdated(cb: (data: { dark: boolean; accent: string }) => void): () => void`. CSS var `--color-accent` (set by hook, consumed by Task 6).

- [ ] **Step 1: Write the failing tests**

Create `test/helpers/accentColor.test.js` (pure, no electron mock):

```js
const test = require("node:test");
const assert = require("node:assert/strict");
const { formatAccentColor, FALLBACK_ACCENT } = require("../../src/helpers/accentColor.js");

test("formatAccentColor strips the alpha channel from AARRGGBB", () => {
  assert.equal(formatAccentColor("0067C0FF"), "#67c0ff");
  assert.equal(formatAccentColor("ff0067c0"), "#0067c0");
});

test("formatAccentColor accepts and normalizes #RRGGBB", () => {
  assert.equal(formatAccentColor("#0067c0"), "#0067c0");
  assert.equal(formatAccentColor("#ABC123"), "#abc123");
});

test("formatAccentColor returns null for anything else", () => {
  assert.equal(formatAccentColor(null), null);
  assert.equal(formatAccentColor(undefined), null);
  assert.equal(formatAccentColor(""), null);
  assert.equal(formatAccentColor("67c0ff"), null);
  assert.equal(formatAccentColor("#gggggg"), null);
  assert.equal(formatAccentColor("0067c0ff00"), null);
});

test("FALLBACK_ACCENT is the Win11 default blue", () => {
  assert.equal(FALLBACK_ACCENT, "#0067c0");
});
```

Create `test/components/useNativeAccent.test.js` (follows the `window.electronAPI` stub pattern of `TranscriptionPreviewOverlay.test.js`):

```js
const test = require("node:test");
const assert = require("node:assert/strict");
const { renderHook, act, cleanup } = require("@testing-library/react");
const React = require("react");
const { useNativeAccent } = require("../../src/hooks/useNativeAccent.ts");

function makeElectronApiStub() {
  const listeners = {};
  return {
    listeners,
    getAccentColor: async () => "#67c0ff",
    onThemeUpdated(callback) {
      listeners.onThemeUpdated = callback;
      return () => { delete listeners.onThemeUpdated; };
    },
  };
}

test.afterEach(cleanup);

test("useNativeAccent applies the accent from IPC to --color-accent", async () => {
  const stub = makeElectronApiStub();
  window.electronAPI = stub;
  await act(async () => {
    renderHook(() => useNativeAccent());
  });
  assert.equal(
    document.documentElement.style.getPropertyValue("--color-accent"),
    "#67c0ff"
  );
});

test("useNativeAccent updates --color-accent when the OS accent changes", async () => {
  const stub = makeElectronApiStub();
  window.electronAPI = stub;
  await act(async () => {
    renderHook(() => useNativeAccent());
  });
  await act(async () => {
    stub.listeners.onThemeUpdated({ dark: false, accent: "#abc123" });
  });
  assert.equal(
    document.documentElement.style.getPropertyValue("--color-accent"),
    "#abc123"
  );
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test test/helpers/accentColor.test.js` and `node --test --import ./test/setup/tsxRegister.js test/components/useNativeAccent.test.js`
Expected: FAIL — `Cannot find module '../../src/helpers/accentColor.js'` / hook not found.

- [ ] **Step 3: Write minimal implementation**

Create `src/helpers/accentColor.js`:

```js
// Windows accent color normalization. systemPreferences.getAccentColor()
// returns "AARRGGBB" (with or without "#") — the UI only needs "RRGGBB".
const FALLBACK_ACCENT = "#0067c0"; // Win11 default blue

function formatAccentColor(raw) {
  if (typeof raw !== "string") return null;
  const hex = raw.trim().replace(/^#/, "");
  if (/^[0-9a-fA-F]{6}$/.test(hex)) return `#${hex.toLowerCase()}`;
  if (/^[0-9a-fA-F]{8}$/.test(hex)) return `#${hex.slice(2).toLowerCase()}`; // AARRGGBB
  return null;
}

module.exports = { formatAccentColor, FALLBACK_ACCENT };
```

In `src/helpers/ipcHandlers.js`:

- Add `nativeTheme` and `systemPreferences` to the electron destructure at the top of the file.
- In `setupHandlers()`, next to the `resize-main-window` block (line 1052), add:

```js
    ipcMain.handle("get-accent-color", () => {
      if (process.platform !== "win32" || typeof systemPreferences?.getAccentColor !== "function") {
        return FALLBACK_ACCENT;
      }
      try {
        return formatAccentColor(systemPreferences.getAccentColor()) || FALLBACK_ACCENT;
      } catch {
        return FALLBACK_ACCENT;
      }
    });

    if (!this._themeWatchInstalled) {
      this._themeWatchInstalled = true;
      nativeTheme.on("updated", () => {
        const accent = (() => {
          if (process.platform !== "win32" || typeof systemPreferences?.getAccentColor !== "function") {
            return FALLBACK_ACCENT;
          }
          try {
            return formatAccentColor(systemPreferences.getAccentColor()) || FALLBACK_ACCENT;
          } catch {
            return FALLBACK_ACCENT;
          }
        })();
        const dark = nativeTheme.shouldUseDarkColors;
        for (const win of BrowserWindow.getAllWindows()) {
          win.webContents.send("theme-updated", { dark, accent });
        }
      });
    }
```

Add `const { formatAccentColor, FALLBACK_ACCENT } = require("./accentColor");` to the requires; make sure `BrowserWindow` is destructured from electron (it already is — `ipcMain.handle` blocks reference `BrowserWindow.getAllWindows`; add to the destructure if missing).

In `preload.js`, after `resizeDictationBar`:

```js
  getAccentColor: () => ipcRenderer.invoke("get-accent-color"),
  onThemeUpdated: registerListener("theme-updated", (callback) => () => callback()),
```

In `src/types/electron.ts`, inside `Window.electronAPI`:

```ts
      getAccentColor: () => Promise<string>;
      onThemeUpdated: (callback: (data: { dark: boolean; accent: string }) => void) => () => void;
```

Create `src/hooks/useNativeAccent.ts`:

```ts
import { useEffect } from "react";

// Applies the Windows accent color (via IPC from systemPreferences.getAccentColor())
// to the --color-accent CSS custom property. No-op fallback when the API is absent.
export function useNativeAccent() {
  useEffect(() => {
    const apply = (accent?: string) => {
      if (!accent) return;
      document.documentElement.style.setProperty("--color-accent", accent);
    };
    void window.electronAPI?.getAccentColor?.().then(apply);
    const unsubscribe = window.electronAPI?.onThemeUpdated?.(({ accent }) => apply(accent));
    return () => unsubscribe?.();
  }, []);
}
```

In `src/AppRouter.jsx`, next to `useTheme()` (line 14):

```js
  useNativeAccent();
```

(add `import { useNativeAccent } from "./hooks/useNativeAccent";`)

- [ ] **Step 4: Run tests to verify they pass**

Run both tests from Step 2.
Expected: PASS.

- [ ] **Step 5: Typecheck + commit**

Run: `cd src && npx tsc --noEmit`.
```bash
git add src/helpers/accentColor.js src/helpers/ipcHandlers.js preload.js src/types/electron.ts src/hooks/useNativeAccent.ts src/AppRouter.jsx test/helpers/accentColor.test.js test/components/useNativeAccent.test.js
git commit -m "feat: dynamic Windows accent over IPC (--color-accent)"
```

---

### Task 6: Neutral Win11 tokens + Segoe UI in `src/index.css`

**Files:**
- Modify: `src/index.css` (lines 1-136; also remove the dead Parchment brand blocks at lines 286-345 after the grep below)
- Test: `test/helpers/cssTokenMigration.test.js` (new)

**Interfaces:**
- Consumes: `--color-accent` (set dynamically by Task 5's hook).
- Produces: Tailwind tokens that follow the accent (`--color-primary`, `--color-ring`, `--color-link`, `--color-info`, `--color-border-active` → `var(--color-accent)`), neutral Win11 surfaces, `--font-family-sans` = Segoe UI. Consumed by Task 7 (bar CSS) and the whole UI.

- [ ] **Step 1: Grep for stale brand usages before deleting**

Run: `grep -rn "text-brand\|status-active\|color-brand\|color-parchment" src/components src/App.jsx src/AppRouter.jsx` (use the repo `grep` tool)
Expected: no matches in components (only `index.css` defines them) — safe to delete the dead CSS blocks. If matches appear, stop and report — do not delete.

- [ ] **Step 2: Write the failing test**

Create `test/helpers/cssTokenMigration.test.js`:

```js
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const cssPath = path.join(__dirname, "..", "..", "src", "index.css");
const css = fs.readFileSync(cssPath, "utf8");

test("Parchment brand tokens are gone", () => {
  assert.ok(!css.includes("parchment"), "no --color-parchment-* tokens");
  assert.ok(!css.includes("--color-brand-"), "no --color-brand-* tokens");
  assert.ok(!css.includes("--color-pattern"), "no --color-pattern token");
});

test("neutral Win11 surface tokens are present (light + dark)", () => {
  assert.ok(css.includes("#f3f3f3"), "light background #f3f3f3");
  assert.ok(css.includes("#202020"), "dark background #202020");
  assert.ok(css.includes("#2b2b2b"), "dark surface #2b2b2b");
});

test("font stack starts with Segoe UI on Windows", () => {
  assert.ok(css.includes('"Segoe UI Variable Text"'), "Segoe UI Variable Text in font stack");
  assert.ok(css.includes("--font-family-sans:"));
});

test("accent token exists with the Win11 fallback", () => {
  assert.ok(css.includes("--color-accent: #0067c0"), "accent fallback declared");
});

test("primary follows the dynamic accent", () => {
  assert.ok(css.includes("--color-primary: var(--color-accent)"), "primary maps to accent");
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `node --test test/helpers/cssTokenMigration.test.js`
Expected: FAIL (current file still has `parchment`, `#f9f6f1`, no `--color-accent: #0067c0`).

- [ ] **Step 4: Apply the token migration**

In `src/index.css`:

1. Change `@theme {` (line 5) to `@theme inline {` and:
   - Replace `--color-primary: #0067c0;` with `--color-primary: var(--color-accent);`
   - Replace `--color-accent: oklch(0.55 0.22 285);` with `--color-accent: #0067c0;` (static fallback; the JS hook overrides it at runtime via inline style)
   - Replace `--color-ring: #0067c0;` with `--color-ring: var(--color-accent);`
   - Replace `--color-link: #0067c0;` with `--color-link: var(--color-accent);`
   - Replace `--color-info: #0067c0;` with `--color-info: var(--color-accent);`
   - Light surfaces → neutral: `--color-background: #f3f3f3;`, `--color-foreground: #1a1a1a;`, `--color-card: #ffffff;`, `--color-popover: #ffffff;`, `--color-secondary: #f5f5f5;`, `--color-muted: #f5f5f5;`, `--color-muted-foreground: #5c5c5c;`, `--color-border: #d9d9d9;`, `--color-input: #ffffff;`, `--color-surface-0: #f3f3f3;`, `--color-surface-1: #f7f7f7;`, `--color-surface-2: #ffffff;`, `--color-surface-3: #efefef;`, `--color-surface-raised: #e8e8e8;`, `--color-border-subtle: #e5e5e5;`, `--color-border-hover: #d4d4d4;`, `--color-border-active: var(--color-accent);`
2. In `:root`, replace the font stack (line 50-52) with:

```css
  --font-family-sans: "Segoe UI Variable Text", "Segoe UI", system-ui, sans-serif;
```

3. Delete the Parchment block (lines 66-75) and the dead brand classes `--shadow-metallic-light`/`--shadow-card-hover-subtle` stay; remove `.status-active` (line 329-332), `.text-brand-primary` (334-336), `.text-brand-accent` (338-340), `.text-brand-highlight` (342-344) only if Step 1's grep found no usages. Update the comment "Card styling - elevated parchment" (line 286) to "Card styling".
4. In `.dark` (line 82+), replace the oklch values with neutrals:
   - `--color-background: #202020;`, `--color-foreground: #f3f3f3;`, `--color-card: #2b2b2b;`, `--color-popover: #2f2f2f;`, `--color-primary: var(--color-accent);` (remove the oklch), `--color-secondary: #2b2b2b;`, `--color-muted: #242424;`, `--color-muted-foreground: #a0a0a0;`, `--color-border: #3d3d3d;`, `--color-input: #1c1c1c;`, `--color-ring: var(--color-accent);`, `--color-surface-0: #202020;`, `--color-surface-1: #242424;`, `--color-surface-2: #2b2b2b;`, `--color-surface-3: #303030;`, `--color-surface-raised: #363636;`, `--color-border-subtle: #333333;`, `--color-border-hover: #444444;`, `--color-border-active: var(--color-accent);`, `--color-link: var(--color-accent);`, `--color-info: var(--color-accent);`
   - Remove `--color-accent` and `--color-accent-foreground` overrides from `.dark` (accent inherits from `:root`/inline).

- [ ] **Step 5: Run test to verify it passes**

Run: `node --test test/helpers/cssTokenMigration.test.js`
Expected: PASS (5 tests).

- [ ] **Step 6: Build + visual smoke + commit**

Run: `cd src && npx vite build` — must succeed (Tailwind resolves `var()` inside `@theme inline`).
```bash
git add src/index.css test/helpers/cssTokenMigration.test.js
git commit -m "feat: neutral Win11 design tokens + Segoe UI, accent-driven primary"
```

---

### Task 7: `DictationBar` component (4 states) + bar CSS

**Files:**
- Create: `src/components/DictationBar.jsx`
- Modify: `src/index.css` (append the `.dictation-bar` stylesheet block)
- Test: `test/components/dictationBar.test.js` (new)

**Interfaces:**
- Consumes: CSS classes from the appended stylesheet; `--color-accent` (Task 5/6).
- Produces: `DictationBar` with props `{ state: "capturing" | "transcribing" | "processing" | "error", transcript?: string, partialTranscript?: string, autoHideMs?: number, onAutoHide?: () => void }`. Consumed by Task 8.

- [ ] **Step 1: Write the failing tests**

Create `test/components/dictationBar.test.js`:

```js
const test = require("node:test");
const assert = require("node:assert/strict");
const { render, screen, cleanup, waitFor } = require("@testing-library/react");
const React = require("react");
const DictationBar = require("../../src/components/DictationBar.jsx").default;

test.afterEach(cleanup);

test("capturing renders 30 bars and an M:SS timer", () => {
  render(<DictationBar state="capturing" />);
  assert.equal(document.querySelectorAll(".dictation-bar__eq .bar").length, 30);
  assert.ok(screen.getByText(/^\d{2}:\d{2}$/), "M:SS timer present");
});

test("transcribing renders 5 bars, the sliding caption and the timer", () => {
  render(<DictationBar state="transcribing" transcript="hello world" partialTranscript=" hoje" />);
  assert.equal(document.querySelectorAll(".dictation-bar__eq .bar").length, 5);
  assert.ok(screen.getByText(/hello world hoje/), "caption shows the live tail");
  assert.ok(screen.getByText(/^\d{2}:\d{2}$/));
});

test("processing renders 35 bars and no caption or timer", () => {
  render(<DictationBar state="processing" transcript="ignored" />);
  assert.equal(document.querySelectorAll(".dictation-bar__eq .bar").length, 35);
  assert.equal(screen.queryByText(/^\d{2}:\d{2}$/), null);
  assert.equal(screen.queryByText(/ignored/), null);
});

test("error renders the ! icon and calls onAutoHide after autoHideMs", async () => {
  let autoHidden = false;
  render(
    <DictationBar state="error" autoHideMs={10} onAutoHide={() => { autoHidden = true; }} />
  );
  assert.ok(screen.getByText("!"), "error icon present");
  await waitFor(() => assert.equal(autoHidden, true), { timeout: 500 });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test --import ./test/setup/tsxRegister.js test/components/dictationBar.test.js`
Expected: FAIL — `Cannot find module '../../src/components/DictationBar.jsx'`.

- [ ] **Step 3: Write minimal implementation**

Create `src/components/DictationBar.jsx`:

```jsx
import { useEffect, useRef, useState } from "react";

const BAR_COUNTS = { capturing: 30, transcribing: 5, processing: 35 };

function formatElapsed(totalSeconds) {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export default function DictationBar({
  state,
  transcript = "",
  partialTranscript = "",
  autoHideMs = 5000,
  onAutoHide,
}) {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    if (state !== "capturing" && state !== "transcribing") return undefined;
    const id = setInterval(() => setElapsed((v) => v + 1), 1000);
    return () => clearInterval(id);
  }, [state]);

  useEffect(() => {
    if (state !== "error") return undefined;
    const id = setTimeout(() => onAutoHide?.(), autoHideMs);
    return () => clearTimeout(id);
  }, [state, autoHideMs, onAutoHide]);

  const liveText = `${transcript} ${partialTranscript}`.trim();
  const words = liveText.split(/\s+/).filter(Boolean);
  const lastWord = words[words.length - 1] ?? "";
  const caption = words.slice(0, -1).join(" ");
  const barCount = BAR_COUNTS[state] ?? 0;

  return (
    <div className="dictation-bar" data-state={state}>
      {state === "error" ? (
        <div className="dictation-bar__error">
          <span className="dictation-bar__error-icon">!</span>
          <span className="dictation-bar__marquee">
            <span>Não foi possível acessar o microfone — verifique as permissões do sistema.</span>
          </span>
        </div>
      ) : (
        <>
          {(state === "capturing" || state === "transcribing" || state === "processing") && (
            <div className={`dictation-bar__eq eq-${state}`}>
              {Array.from({ length: barCount }, (_, i) => (
                <span key={i} className="bar" style={{ animationDelay: `${(i % 8) * 0.09}s` }} />
              ))}
            </div>
          )}
          {state === "transcribing" && (
            <div className="dictation-bar__caption">
              <span className="dictation-bar__caption-inner">
                {caption ? <>{caption} </> : null}
                <span className="dictation-bar__caption-last">{lastWord}</span>
              </span>
            </div>
          )}
          {state === "processing" && <span className="dictation-bar__shine" />}
          {(state === "capturing" || state === "transcribing") && (
            <span className="dictation-bar__timer">{formatElapsed(elapsed)}</span>
          )}
        </>
      )}
    </div>
  );
}
```

Note: keep the error message copy in English in code (`"Could not access the microphone — check system permissions."`) — the `pt` string above is only a mockup placeholder; the final copy goes through `useTranslation` if i18n is wired in the overlay, otherwise plain English (overlay is not localized today — verify in Task 8 and use the same convention as the existing button labels).

Append to `src/index.css` (before the closing of the file):

```css
/* --- Dictation bar (native design system, slice 1) --- */
.dictation-bar {
  width: 100%;
  height: 36px;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 0 10px;
  border-radius: 18px;
  background: color-mix(in srgb, var(--color-surface-raised) 88%, transparent);
  border: 1px solid var(--color-border);
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.25);
  font-family: var(--font-family-sans);
  font-size: 13px;
  color: var(--color-foreground);
  overflow: hidden;
  position: relative;
}
.dictation-bar__eq { display: flex; align-items: center; gap: 2.5px; height: 100%; flex-shrink: 0; }
.dictation-bar__eq .bar {
  width: 3px;
  border-radius: 1.5px;
  background: var(--color-accent);
  height: 30%;
  animation: eq-bounce 1s ease-in-out infinite;
}
.dictation-bar__eq.eq-transcribing { width: 46px; }
.dictation-bar__eq.eq-transcribing .bar { background: var(--color-muted-foreground); }
@keyframes eq-bounce {
  0%, 100% { transform: scaleY(1); }
  50% { transform: scaleY(2.6); }
}
.dictation-bar__caption {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  white-space: nowrap;
  mask-image: linear-gradient(90deg, transparent 0, #000 12px, #000 calc(100% - 12px), transparent 100%);
  -webkit-mask-image: linear-gradient(90deg, transparent 0, #000 12px, #000 calc(100% - 12px), transparent 100%);
}
.dictation-bar__caption-inner { display: inline-block; animation: caption-slide 13s linear infinite; }
@keyframes caption-slide {
  0% { transform: translateX(0); }
  100% { transform: translateX(-50%); }
}
.dictation-bar__caption-last { color: var(--color-accent); font-weight: 600; }
.dictation-bar__timer {
  flex-shrink: 0;
  font-variant-numeric: tabular-nums;
  font-size: 13px;
  color: var(--color-text-muted, var(--color-muted-foreground));
}
.dictation-bar__shine {
  position: absolute;
  inset: 0;
  background: linear-gradient(105deg, transparent 40%, rgba(255, 255, 255, 0.18) 50%, transparent 60%);
  animation: shine-sweep 1.8s linear infinite;
  pointer-events: none;
}
@keyframes shine-sweep {
  0% { transform: translateX(-100%); }
  100% { transform: translateX(100%); }
}
.dictation-bar__error {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
}
.dictation-bar__error-icon {
  flex-shrink: 0;
  width: 18px;
  height: 18px;
  border-radius: 50%;
  background: var(--color-destructive);
  color: #fff;
  font-weight: 700;
  font-size: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
}
.dictation-bar__marquee { flex: 1; min-width: 0; overflow: hidden; white-space: nowrap; }
.dictation-bar__marquee > span { display: inline-block; animation: caption-slide 13s linear infinite; }
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test --import ./test/setup/tsxRegister.js test/components/dictationBar.test.js`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/components/DictationBar.jsx src/index.css test/components/dictationBar.test.js
git commit -m "feat: DictationBar component with 4 states + bar stylesheet"
```

---

### Task 8: Wire the bar into `App.jsx` (view derivation + resize + mic error)

**Files:**
- Create: `src/utils/dictationBar.js` (CommonJS — pure view derivation)
- Modify: `src/hooks/useAudioRecording.js` (expose `micError`, clear on start)
- Modify: `src/App.jsx` (bar view + resize effect + render)
- Test: `test/helpers/dictationBarView.test.js` (new)

**Interfaces:**
- Consumes: `deriveBarView` (this task), `resizeDictationBar` IPC (Task 4), `dictationBarPosition` store (Task 2), `DictationBar` (Task 7), `micError` (this task, from `useAudioRecording`).
- Produces: `deriveBarView(micState, { hasLiveText, micError }) → "capturing" | "transcribing" | "processing" | "error" | null`.

- [ ] **Step 1: Write the failing test**

Create `test/helpers/dictationBarView.test.js` (plain CommonJS, no tsxRegister needed):

```js
const test = require("node:test");
const assert = require("node:assert/strict");
const { deriveBarView } = require("../../src/utils/dictationBar.js");

test("idle/hover produce no bar", () => {
  assert.equal(deriveBarView("idle", {}), null);
  assert.equal(deriveBarView("hover", {}), null);
});

test("recording with no live text yet is capturing", () => {
  assert.equal(deriveBarView("recording", { hasLiveText: false }), "capturing");
});

test("recording with live text is transcribing", () => {
  assert.equal(deriveBarView("recording", { hasLiveText: true }), "transcribing");
});

test("processing and transforming reuse the processing visual", () => {
  assert.equal(deriveBarView("processing", {}), "processing");
  assert.equal(deriveBarView("transforming", {}), "processing");
});

test("mic error overrides everything", () => {
  assert.equal(deriveBarView("recording", { hasLiveText: true, micError: { title: "x" } }), "error");
  assert.equal(deriveBarView("idle", { micError: { title: "x" } }), "error");
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test test/helpers/dictationBarView.test.js`
Expected: FAIL — `Cannot find module '../../src/utils/dictationBar.js'`.

- [ ] **Step 3: Write minimal implementation**

Create `src/utils/dictationBar.js`:

```js
// Pure mapping from overlay micState to the dictation bar view.
// Extracted so the App.jsx glue stays thin and the state machine is testable.
function deriveBarView(micState, { hasLiveText = false, micError = null } = {}) {
  if (micError) return "error";
  if (micState === "recording") return hasLiveText ? "transcribing" : "capturing";
  if (micState === "processing" || micState === "transforming") return "processing";
  return null;
}

module.exports = { deriveBarView };
```

In `src/hooks/useAudioRecording.js`:

- Add state near line 16: `const [micError, setMicError] = useState(null);`
- In `setCallbacks` (line 151), add `onError: (err) => setMicError(err),`
- In `performStartRecording`, right after the `startLockRef` guard (before warmup), add `setMicError(null);`
- Add `micError,` to the returned object (line 428-435).

In `src/App.jsx`:

- Import `DictationBar` and `deriveBarView`.
- From `useAudioRecording` destructure `micError`, `transcript`, `partialTranscript` (alongside the existing `isRecording, isProcessing`).
- Read the position from the store:

```js
  const dictationBarPosition = useSettingsStore((s) => s.dictationBarPosition);
```

- Derive the view after `micState` (line 351):

```js
  const hasLiveText = Boolean((transcript || partialTranscript).trim());
  const barView = deriveBarView(micState, { hasLiveText, micError });
  const barActive = barView !== null;
```

- Replace the resize effect (lines 186-200) so the bar takes priority:

```js
  useEffect(() => {
    if (barActive) {
      window.electronAPI?.resizeDictationBar?.(dictationBarPosition);
      return;
    }
    if (isCommandMenuOpen && toastCount > 0) {
      window.electronAPI?.resizeMainWindow?.("EXPANDED");
    } else if (isCommandMenuOpen) {
      window.electronAPI?.resizeMainWindow?.("WITH_MENU");
    } else if (toastCount > 0) {
      window.electronAPI?.resizeMainWindow?.("WITH_TOAST");
    } else {
      window.electronAPI?.resizeMainWindow?.("BASE");
    }
  }, [barActive, dictationBarPosition, isCommandMenuOpen, toastCount]);
```

- Render: at the top of the overlay content, before the mic button (near line 415):

```jsx
      {barActive && (
        <DictationBar
          state={barView}
          transcript={transcript}
          partialTranscript={partialTranscript}
          onAutoHide={() => useSettingsStore.setState({ micError: null })}
        />
      )}
```

Note: `micError` lives in the hook, not the store — clear it via the hook instead: keep a `clearMicError` returned from `useAudioRecording` (`() => setMicError(null)`) and pass it as `onAutoHide`.

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test test/helpers/dictationBarView.test.js`
Expected: PASS (5 tests).

- [ ] **Step 5: Smoke test (manual, requires the running app)**

Run: `npm run build:renderer`, then `npm start`. Dictate — the bar appears bottom-centered above the taskbar, cycles capturing → transcribing → processing, hides on stop and returns to the 96×96 floating button. Force an error (microphone in use by another app) — red `!` + marquee, auto-hide after 5s.

- [ ] **Step 6: Commit**

```bash
git add src/utils/dictationBar.js src/hooks/useAudioRecording.js src/App.jsx test/helpers/dictationBarView.test.js
git commit -m "feat: wire dictation bar into overlay (micState -> bar view, resize)"
```

---

### Task 9: Mica background material (Win11-only, guarded)

**Files:**
- Modify: `src/helpers/windowConfig.js` (export `applyMica`)
- Modify: `src/helpers/windowManager.js` (call it in `createMainWindow` after line 120 and in `createControlPanelWindow` after line 658)
- Test: extend `test/helpers/windowConfig.test.js`

**Interfaces:**
- Consumes: `BrowserWindow` instances at creation time.
- Produces: `applyMica(win) → boolean` (best-effort; `false` when not Win11 / no API / failure).

- [ ] **Step 1: Write the failing test**

Append to `test/helpers/windowConfig.test.js`:

```js
const originalPlatform = process.platform;
function setPlatform(platform) {
  Object.defineProperty(process, "platform", { value: platform });
}

test("applyMica is a no-op on non-Windows", () => {
  setPlatform("linux");
  try {
    const { applyMica } = loadWindowConfig();
    const calls = [];
    assert.equal(applyMica({ setBackgroundMaterial: (m) => calls.push(m) }), false);
    assert.equal(calls.length, 0);
  } finally {
    setPlatform(originalPlatform);
  }
});

test("applyMica is a no-op when the window has no setBackgroundMaterial", () => {
  setPlatform("win32");
  try {
    const { applyMica } = loadWindowConfig();
    assert.equal(applyMica({}), false);
  } finally {
    setPlatform(originalPlatform);
  }
});

test("applyMica requests mica material on Win32", () => {
  setPlatform("win32");
  try {
    const { applyMica } = loadWindowConfig();
    const calls = [];
    assert.equal(applyMica({ setBackgroundMaterial: (m) => calls.push(m) }), true);
    assert.deepEqual(calls, ["mica"]);
  } finally {
    setPlatform(originalPlatform);
  }
});

test("applyMica swallows API failures", () => {
  setPlatform("win32");
  try {
    const { applyMica } = loadWindowConfig();
    assert.equal(applyMica({ setBackgroundMaterial: () => { throw new Error("unsupported"); } }), false);
  } finally {
    setPlatform(originalPlatform);
  }
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test test/helpers/windowConfig.test.js`
Expected: FAIL — `applyMica is not a function` / destructure is `undefined`.

- [ ] **Step 3: Write minimal implementation**

In `src/helpers/windowConfig.js`, after `getNotificationWindowPosition` (line 190):

```js
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
```

Add `applyMica` to the `module.exports` block.

In `src/helpers/windowManager.js`, add `applyMica` to the destructure from `./windowConfig` (line 10-19), then:
- In `createMainWindow`, right after `this.mainWindow = new BrowserWindow({ ... })` (line 120): `applyMica(this.mainWindow);`
- In `createControlPanelWindow`, right after `this.controlPanelWindow = new BrowserWindow(CONTROL_PANEL_CONFIG)` (line 658): `applyMica(this.controlPanelWindow);`

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test test/helpers/windowConfig.test.js`
Expected: PASS (9 tests total: 5 + 4).

- [ ] **Step 5: Commit**

```bash
git add src/helpers/windowConfig.js src/helpers/windowManager.js test/helpers/windowConfig.test.js
git commit -m "feat: Mica background material on Win11 (guarded)"
```

---

### Task 10: Final gate — full suite, typecheck, lint, spec status

**Files:**
- Modify: `docs/specs/native-design-system-dictation-bar.md` (status → Implemented, keep Decisions)

- [ ] **Step 1: Run the full suite**

Run: `npm test`
Expected: baseline + the new tests all pass; only the known environmental failure (`activeWindowCapture.test.js`) may fail; skip count may grow by the DB-test group (run those with `ELECTRON_RUN_AS_NODE=1 node_modules/electron/dist/electron.exe --test` if they appear).

- [ ] **Step 2: Typecheck + lint**

Run: `npm run typecheck` and `npm run lint`
Expected: both green.

- [ ] **Step 3: Prettier on changed code files only**

Run: `npx prettier --write src/index.css src/App.jsx src/hooks/useAudioRecording.js src/components/DictationBar.jsx src/hooks/useNativeAccent.ts src/utils/dictationBar.js src/helpers/windowConfig.js src/helpers/windowManager.js src/helpers/ipcHandlers.js src/helpers/accentColor.js preload.js src/stores/settingsStore.ts src/types/electron.ts src/AppRouter.jsx test/helpers/windowConfig.test.js test/helpers/dictationBarWindow.test.js test/helpers/dictationBarIpc.test.js test/helpers/dictationBarView.test.js test/helpers/accentColor.test.js test/helpers/cssTokenMigration.test.js test/components/dictationBar.test.js test/components/useNativeAccent.test.js test/components/settingsStoreDictationBar.test.js`
Do NOT run it on `docs/specs/*`.

- [ ] **Step 4: Update the spec status**

In `docs/specs/native-design-system-dictation-bar.md` line 3, change to:

```markdown
> **Status:** ✅ Implemented — slice 1 (design tokens + dictation bar) shipped on branch `feat/native-design-system-dictation-bar` (2026-08-03).
```

- [ ] **Step 5: Commit**

```bash
git add docs/specs/native-design-system-dictation-bar.md
git commit -m "docs: mark native design system + dictation bar spec implemented"
```

---

## Self-Review

**Spec coverage:** R1 (tokens/`#f3f3f3`/`#202020`/Segoe UI/accent/Mica/dark-follows-OS) → Tasks 5, 6, 9 (dark trigger untouched, already `auto` — decision 2). R2 (bar geometry, 4 states, visibility, position, timer, caption, error 5s) → Tasks 1, 3, 7, 8. Settings store → Task 2. IPC → Tasks 4, 5. Validation plan (windowConfig tests, dictationBar component tests, typecheck/lint, manual Win11 smoke) → Tasks 1, 7, 10. Migration (parchment grep, Mica guard, accent additive channel, no DB) → Tasks 4, 6, 9.

**Placeholder scan:** every step has concrete code or an exact command; the only manual step is the Task 8 smoke test (explicitly labeled manual; the bar state machine itself is unit-tested via `deriveBarView` + `DictationBar`).

**Type consistency:** `getDictationBarPosition(display, position)` (T1) is called by `resizeToDictationBar(position)` (T3), which is invoked by the `resize-dictation-bar` handler (T4) with `"bottom" | "top"` from `dictationBarPosition` (T2), consumed in `App.jsx` (T8). `deriveBarView` returns the exact union the `DictationBar` `state` prop accepts. `--color-accent` is declared in `index.css` (T6), set by `useNativeAccent` (T5), consumed by bar CSS (T7).

**Known risk (documented):** `resizeToDictationBar` test stubs the `electron` module per the `dictationBatchingIpc.test.js` convention; if the `hotkeyManager`/`dragManager`/`menuManager` requires in `windowManager.js` demand more electron surface at load time, extend the stub object in that test (same pattern as `audioManagerWarmup.test.js`'s `STUBS` map) — do not weaken the assertions.
