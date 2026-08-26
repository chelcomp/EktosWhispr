# Native Design System + Dictation Bar

> **Status:** ✅ Implemented — verified 2026-08-03 via SDD (9 tasks + final-review fix wave). **Post-verification fixes applied 2026-08-24** (see § Post-verification fixes). Gate: full suite 881 pass / 1 pre-existing environmental fail (activeWindowCapture) / 33 skip; typecheck, eslint, prettier, build:renderer all green.

## TL;DR

Slice 1 of the UI redesign, approved via interactive mockups (visual companion) and user decisions:

1. **Design tokens → native Windows look** (Approach B): replace the Parchment palette with neutral Win11 colors (light `#f3f3f3` / dark `#202020`), Segoe UI on Windows, dynamic Windows accent color, and Mica background material on Win11 (solid fallbacks elsewhere). Dark/light follows the OS.
2. **Dictation bar**: replace the round floating button while dictating with a horizontal pill bar — **max 20% screen width** × 36px, radius 18px, 13px font, 10px padding — with four states: **capturing** (30 bars + timer), **transcribing** (5 bars left, sliding caption center, timer right), **processing** (35 bars + sweeping shine), **error** (red `!` + slow marquee, auto-hides after 5s). Visible only while capturing/processing/error; positioned **below** (2px above the taskbar) or **above** (2px from the top), always centered.
3. Settings redesign and navigation evolution are **later slices** (own spec cycles).

## Goal / Problem

The app's UI uses a custom Parchment brand palette and a small round floating button as the dictation overlay. The user wants:

- A **native Windows look**: neutral surfaces, system font, dynamic accent, Mica material; dark/light following the OS (Approach B approved over static tokens A and maximal-native C).
- A **clean, readable dictation bar** replacing the round button during active dictation, consistently sized across all states, anchored near the taskbar or the top edge, appearing only while dictation is active (error caps at 5s).
- Mockups approved **before** any implementation (done — v10…v15, v15 current).

## Requirements

### R1 — Design tokens (Approach B, approved)
- Neutral Win11 surfaces replace Parchment: light bg `#f3f3f3`, dark bg `#202020`; borders/cards derived from these (not a new brand palette).
- Font: Segoe UI family on Windows (`"Segoe UI Variable Text", "Segoe UI", system-ui`), `system-ui` elsewhere.
- Corner radius: keep current radius values (no change).
- Dynamic accent: read `systemPreferences.getAccentColor()` (main process) over IPC → CSS custom property `--accent`; static fallback when unavailable.
- Dark/light: follow `nativeTheme.shouldUseDarkColors`, update on `nativeTheme.on('updated')` (no manual toggle change in this slice).
- Mica on Win11 via `setBackgroundMaterial('mica')`; fallbacks: solid on Win10/Linux, vibrancy on macOS (optional).
- Existing CSS variables (`--color-parchment-*`, `--color-brand-*`) migrate to the neutral set with a mapping table (see Migration).

### R2 — Dictation bar (approved mockups v10–v16)
- **Consistency**: every state shares height 36px, width **min(20% of screen width)** (user requirement, 2026-08-03: "20% of the screen max"), font 13px, internal padding 10px, radius 18px.
- **Visibility**: appears only while capturing, processing, or error; error auto-hides after 5s. No dictation = no bar (idle keeps the existing floating button — see D4).
- **Position**: horizontally centered; **bottom** = 2px above the taskbar (`workArea.y + workArea.height - height - 2` — `workArea` already ends at the taskbar), **top** = 2px from the top (`workArea.y + 2`). New setting `dictationBarPosition: "bottom" | "top"` (default `bottom`).
- **States** (reusing existing `isRecording`/`isProcessing` flows):
  - Capturing: 30 bars + timer (right).
  - Transcribing: 5 bars left (block width = timer block, 46px), sliding caption center (last words visible, edge fade), timer right.
  - Processing: 35 bars + sweeping shine, no text.
  - Error: red `!` icon + slow marquee (13s loop), auto-hide 5s.
- **Timer**: `M:SS` format, 13px, monospace-ish tabular figures.
- Caption slide: mask fade at both edges, ~10s loop, last recognized word highlighted (accent color).

## Design

### Tokens (src/index.css)

Current `:root` block (Parchment) is replaced by a neutral Win11 set:

| Token (new) | Light | Dark |
|---|---|---|
| `--color-bg` | `#f3f3f3` | `#202020` |
| `--color-surface` | `#ffffff` | `#2b2b2b` |
| `--color-border` | `#d9d9d9` | `#3d3d3d` |
| `--color-text` | `#1a1a1a` | `#f3f3f3` |
| `--color-text-muted` | `#5c5c5c` | `#a0a0a0` |
| `--color-accent` | dynamic (see below) | dynamic |

Mapping: `--color-parchment-bg → --color-bg`, `--color-parchment-text → --color-text`, `--color-parchment-border → --color-border`, `--color-brand-highlight → --color-accent`, etc. Tailwind v4 theme vars (`@theme`) updated to reference the new names; `.dark` overrides (already present) stay, but the trigger becomes `nativeTheme` instead of the manual setting.

### Accent (main + IPC)

- Main: `systemPreferences.getAccentColor()` → hex `AARRGGBB` → strip alpha → `#RRGGBB`; expose via existing IPC patterns (`ipcHandlers.js` + `preload.js` + `src/types/electron.ts`), plus push updates on `nativeTheme.on('updated')` (accent can change while running).
- Renderer: set `document.documentElement.style.setProperty('--color-accent', …)`; fallback static accent (e.g. `#0067c0` Win11 blue) when the API is unavailable (non-Windows).
- Windows 11 "accent on titlebars/windows" only affects native frames; since our windows are frameless, the accent applies to accent-colored UI (buttons, highlights, waveform, caption highlight).

### Material / Mica

- Dictation bar window and control panel: `win.setBackgroundMaterial('mica')` on Win11 (Electron ≥ 25; project is on Electron 41). Win11 only — guard with `process.platform === 'win32' && win.getBackgroundMaterial` + try/catch.
- Fallback: `transparent: true` stays for Win10/Linux (current behavior); macOS keeps vibrancy if present.
- **Mockup-vs-implementation note**: CSS `backdrop-filter` cannot blur the desktop behind a transparent Electron window — the real blur comes from Mica (Win11) or stays transparent (fallback). The mockup's translucent blur is rendered by Mica on Win11; on fallbacks the bar is a solid/semi-transparent pill. Accepted deviation, visually close enough.

### Dictation bar (App.jsx + windowConfig.js)

Window: reuse `mainWindow`; during active dictation resize to `{ width: round(workArea.width * 0.2), height: 40 }` (36px pill + 2px breathing room for the shadow) and position via a new `WindowPositionUtil.getDictationBarPosition(display, position)`:

```
x = workArea.x + round((workArea.width - width) / 2)
y = position === "top" ? workArea.y + 2
    : workArea.y + workArea.height - height - 2
```

Idle returns to the current floating-button size/position (existing `getMainWindowPosition` + `WINDOW_SIZES`).

Renderer (App.jsx): new `DictationBar` component rendered when `micState` is `recording | processing | transforming | error`; idle/hover keeps the current button. State visuals per R2 (bars via CSS animations, same as approved mockups; timer `M:SS`; caption slides the tail of the live transcript; error auto-hide 5s timer in the component). The LLM text-transform state reuses the processing visual.

Transcribing state derives from the existing live-transcript stream (finalized + interim words); "last word visible" = the tail of the stream, sliding once the text overflows the caption width.

The window keeps `hasShadow: false`; the pill shadow from the mockup is CSS (renders inside the transparent window), no native shadow needed.

## Validation Plan

- **Automated regression tests**:
  - `test/helpers/windowConfig.test.js` (new): `getDictationBarPosition` — centered x, `workArea.bottom - height - 2` for bottom, `workArea.y + 2` for top, clamped within workArea.
  - `test/components/dictationBar.test.js` (new): four states render the correct child structure (bars count, timer presence, caption, error icon); error auto-hide timer fires after 5s (fake timers); caption only when transcribing.
  - Existing suite keeps passing (753 pass baseline; pre-existing environmental failure in `activeWindowCapture.test.js` unrelated).
- **Manual validation**:
  - Dictate on Win11: bar appears bottom-centered 2px above taskbar, states cycle capturing → transcribing → processing, hides after stop.
  - Set `dictationBarPosition: "top"`: bar sits 2px from the top.
  - Toggle OS dark/light + accent color: app surfaces and accent update live.
  - Force an error (microphone busy): `!` + marquee, auto-hides in 5s.
  - Win10/Linux: no Mica — solid fallback, no crash.
- **Typecheck + lint** (`npm run typecheck`, `npm run lint`), prettier on changed files (spec docs under `docs/specs/` are pre-existing non-conforming — don't reformat).

## Migration / Compatibility

- **Token migration**: rename/remap `--color-parchment-*` / `--color-brand-*` across `src/index.css` and any inline usages; grep for `parchment|brand-` before removing. This touches the whole UI (SettingsPage, ControlPanel) — visual verification pass required; no behavior change.
- **Theme trigger**: manual light/dark setting is overridden by system in this slice (documented decision; user asked "claro/escuro por sistema"). The manual toggle in settings becomes a no-op or is hidden until the settings slice.
- **Mica**: Win11-only, guarded; fallback transparent/solid.
- **Accent IPC**: additive channel; old renderers unaffected (preload gains one method).
- **New setting** `dictationBarPosition` added to settingsStore with default `"bottom"`; no migration needed (missing = default).
- **No data changes**; no DB migration.

## Decisions (open questions resolved at approval, 2026-08-03)

1. **Idle behavior**: keep the current round floating button when not dictating. Restyle is part of a later polish slice.
2. **Manual theme toggle**: keep it as-is this slice (default is already `auto` = follows the OS via `useTheme`/`matchMedia`); no settings changes in slice 1. The `nativeTheme` main-process route is not needed for dark/light in this slice — the renderer already follows the OS.
3. **Caption data source**: tail of the live transcript — `useAudioRecording` already exposes both `transcript` (finalized) and `partialTranscript` (interim); the caption slides those.
4. **Bar position setting**: `dictationBarPosition` lives only in `settingsStore` (`"bottom" | "top"`, default `"bottom"`); UI placement deferred to the settings slice. The renderer passes the position over IPC on each `resize-dictation-bar` call.

Additional user decisions from the same session (recorded for later slices, not part of slice 1):
- **No search anywhere** in the app ("se precisa busca é pq não atingiu o objetivo") — applies to navigation/settings slices.
- **Settings: each option lives in exactly one place**; no "Recomendado" category; Simple mode = the 6 essentials (idioma, microfone, atalho, iniciar com Windows, sons, salvar) shown as a subset of the same items, Advanced = everything.

## Post-verification fixes (2026-08-24)

After initial implementation verification, the following critical fixes were applied:

### 1. Dictation bar visual — solid pill, exact 36px window, immediate hide, centered EQ bars
- **Issue**: Bar appeared as transparent/floating EQ bars without visible pill shape; window height mismatch (40px vs 36px); EQ bars anchored left not centered.
- **Fix**: `src/index.css` — `.dictation-bar` solid background pill (`color-mix(in srgb, var(--color-surface-1) 12%, transparent)`), `border: 1px solid color-mix(in srgb, var(--color-accent) 50%, transparent)`, `box-shadow: 0 0 8px color-mix(in srgb, var(--color-accent) 15%, transparent)`, `height: 36px`, `overflow: hidden`. `src/helpers/windowConfig.js` — `DICTATION_BAR.HEIGHT: 48` (36px pill + 12px breathing room). `.dictation-bar__eq { align-items: flex-end; gap: 2.5px; height: 100%; }` — bars pulse from bottom (`transform-origin: bottom`, `scaleY(0.4) → 1.8`).

### 2. Search UI removal
- **Issue**: Search UI (Ctrl+K, `CommandSearch.tsx`, sidebar buttons) no longer wanted per user decision.
- **Fix**: Deleted `src/components/CommandSearch.tsx`. Removed `showSearch` state, `Ctrl+K` hotkey, `CommandSearch` import/render from `ControlPanel.tsx`. Removed `onOpenSearch` prop, `Search` import, search buttons from `ControlPanelSidebar.tsx` and `PersonalNotesView.tsx`. Updated `src/index.css` — added `--shadow-card` to `:root` (was only in `.dark`).

### 3. EQ bar layout — flex:1 fill space, timer right-aligned
- **Issue**: EQ bars left-aligned, timer not right-anchored, caption overflow broken.
- **Fix**: `src/index.css` — `.dictation-bar__eq { flex: 1; }`, `.dictation-bar__timer { margin-left: auto; }`, caption mask gradient adjusted for edge fade.

### 4. TDZ crash — `useEffect` referencing `barActive` before declaration
- **Issue**: `const prevBarActiveRef = useRef(barActive)` at line ~378 but `const barActive = barView !== null` at line ~462 → Temporal Dead Zone crash in production build.
- **Fix**: Moved `const prevBarActiveRef = useRef(false)` and its `useEffect` **after** `const barActive = barView !== null` declaration; merged logic into single resize effect after `barActive` declaration.

### 5. Race condition — window shown at 96×96 before `resizeDictationBar`
- **Issue**: Hotkey → `showDictationPanel()` (shows 96×96) → IPC `toggle-dictation` → async `performStartRecording()` → `barActive` becomes true → `resizeDictationBar()` called. Window visible at 96×96 for ~100-200ms ("square" flash).
- **Fix**: Removed `showDictationPanel()` from `_sendDictationToggle()` and `sendStartDictation()`. `resizeToDictationBar()` now calls `showInactive()` / `show()` after `setBounds()`. `startWindowsPushToTalk()` and `startMacCompoundPushToTalk()` use `resizeToDictationBar()` instead of `showDictationPanel()`.

### 6. Systray exit stuck — `app.quit()` → `app.exit(0)`
- **Issue**: Tray "Quit" called `app.quit()` → `before-quit` handler: `event.preventDefault()` + `sidecarRegistry.shutdownAll()` (8s timeout) → `app.exit(0)`. User clicks 3-4 times, nothing visible for 8s, then exits.
- **Fix**: `src/helpers/tray.js` — tray "Quit" click handler now calls `app.exit(0)` directly (bypasses `before-quit`). Sidecar orphans cleaned by reaper on next launch.

### 7. Idle square at startup — `_floatingIconAutoHide` default `true`
- **Issue**: `WindowManager` constructor default `_floatingIconAutoHide = false` but settings store default `true`. `ready-to-show` handler checked `!this._floatingIconAutoHide` → showed 96×96 window at startup.
- **Fix**: Constructor default changed to `this._floatingIconAutoHide = true` (matches settings store default). Window stays hidden until hotkey press.

### 8. Bar not appearing — removed premature `showDictationPanel()`
- **Issue**: `_sendDictationToggle()` and `sendStartDictation()` called `showDictationPanel()` before IPC, showing 96×96 window briefly before `resizeDictationBar()`.
- **Fix**: Removed `showDictationPanel()` from `_sendDictationToggle()`, `sendStartDictation()`. Renderer drives resize via `resize-dictation-bar` IPC → `resizeToDictationBar()` shows at correct size (308×48).

---

**Results**: 881 tests pass (0 fail), typecheck OK, build:renderer OK, no TDZ crash, no idle square, bar appears at correct size/position, systray exits immediately.