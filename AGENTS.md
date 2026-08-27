# Repository Guidelines

## Project Overview

EktosWhispr is a privacy-first, Electron-based desktop dictation app using `whisper.cpp` for local speech-to-text, with optional `sherpa-onnx` Parakeet (WebSocket) and `llama.cpp` llama-server for on-device LLM transforms. No telemetry, no silent network calls; cloud transcription and remote LLMs are explicit BYOK (Bring Your Own Key).

Stack: Electron 43 + React 19 + Vite 8 + Node 26. Main process and helpers are CommonJS JS; the renderer (`src/`) is TypeScript + ESM with a few legacy `.jsx` files.

Performance envelope: idle budget ≤300 MB RAM, <2% CPU; raw transcription must be ≤500 ms for fast engines (tiny/base Parakeet GPU). All optional binaries have a fallback.

## Architecture & Data Flow

- **Process model**: three tiers — main (Node, CommonJS, owns DB/clipboard/hotkey/audio/engines/OCR/tray), preload (`preload.js` — `contextBridge.exposeInMainWorld('electronAPI', ...)`), renderer (Vite-built React SPA in `src/`).
- **Single instance & lifecycle**: `main.js` calls `app.requestSingleInstanceLock()` as the first meaningful action; on secondary launch it restores the control panel. Channel/userData isolation via `EKTOSWHISPR_CHANNEL` env (development|staging|production) → `EktosWhispr-<channel>` userData on non-production. Lifecycle: `app.whenReady()` → `initializeCoreManagers()` (env, window, db, clipboard, whisper, parakeet, diarization, hotkey, ...) → IPC registration → main window → control panel → `initializeDeferredManagers()` (tray, clipboard warmup, update check). `before-quit` runs `performSyncTeardown()` + `sidecarRegistry.shutdownAll()`.
- **IPC bridge**: ALL renderer↔main traffic funnels through `src/helpers/ipcHandlers.js` (`setupHandlers()` registers ~150+ `ipcMain.handle/on` channels). Push events use `broadcastToWindows(channel, payload)` which iterates `BrowserWindow.getAllWindows()` and calls `webContents.send`. Broadcast channel names: `transcription-added/updated/deleted/cleared`, `note-added/updated/deleted`, `folder-created/renamed/deleted`, `action-created/updated/deleted`, `dictionary-updated`, `snippets-updated`, `corrections-learned`, `theme-updated`, `conversation-deleted`, `cuda-fallback-notification`. Renderer side reaches main only via `window.electronAPI.*` (defined in `preload.js`, no Node primitives in renderer).
- **STT pipeline (mic → engine → DB → paste)**: hotkey/click/auto-meeting → `audioManager` MediaStream → IPC `dictation-realtime-start` or `transcribe-local-whisper`/`transcribe-local-parakeet` (Blob) → main process → `whisperManager.transcribe()` / `parakeetManager.transcribe()` (lazy engine start) → optional `transformManager` (LLM cleanup) → `db-save-transcription` → `paste-text` IPC → `clipboardManager` writes via `electron.clipboard.writeText` then simulates paste through platform helper (`windows-fast-paste`). Result also surfaces in `TranscriptionPreviewOverlay.tsx` for in-app review/edit.

## Key Directories

- `main.js`, `preload.js` — Electron entry + `contextBridge` surface (`window.electronAPI`).
- `src/helpers/` — main-process CommonJS managers: `ipcHandlers.js` (all IPC), `whisperServer.js`, `parakeetWsServer.js`, `llamaServer.js` (engine lifecycles), `database.js` (better-sqlite3 schema/CRUD + FTS5 notes index), `windowManager.js`, `tray.js`, `screenContext*`, `audio*`, `modelManagerBridge.js`, `tesseractOcrManager.js`. Mixed TS files (e.g. `clipboardCopyFallback.ts`, `ModelManager.ts`, `llamaCppInstaller.ts`) live alongside JS when consumed by TS components.
- `src/` — renderer: React 19 + Radix + TipTap. Subdirs: `components/`, `stores/` (Zustand), `hooks/`, `services/`, `utils/`, `models/` (incl. `modelRegistryData.json`), `ai/`, `chat/`, `config/`, `notes/`, `settings/`, `transforms/`, `ui/`, `types/`, `workers/`. `src/main.jsx` + `src/App.jsx` + `src/AppRouter.jsx` + `src/updater.js` + `src/components/DictationBar.jsx` are legacy `.jsx`.
- `test/` — Node built-in test runner. `test/helpers/` (90 files, CJS, vanilla `node --test`), `test/utils/` (12), `test/models/` (1), `test/components/` (13 — go through `test/setup/tsxRegister.js` for TSX/JSX + happy-dom), `test/setup/tsxRegister.js` (the custom esbuild + happy-dom loader).
- `scripts/` — referenced by `package.json` lifecycle hooks (afterPack, download:*, build-*).
- `resources/bin/` — extraResources shipped via electron-builder (whisper-cpp, llama-server, sherpa-onnx, platform helpers, diarization models, whisper-vad).
- `electron-builder.json` + `electron-builder.unsigned-win.json` — packaging config.
- `.github/` — workflows (`tests.yml`, `build-and-notarize.yml`, `release.yml`, `auto-release.yml`, `lockfile-lint.yml`, `codeql.yml`, `opencode.yml`, per-platform `build-*.yml`), `dependabot.yml`, `copilot-instructions.md` (existing rule file), `CONTRIBUTING.md` (local-fork flavor).

## Development Commands

All from `package.json` scripts. Use the exact strings; do not invent.

- Install (root only): `npm install` (runs `postinstall` → `electron-builder install-app-deps` to rebuild `better-sqlite3`, `@napi-rs/keyring`).
- Dev (renderer + main concurrently): `npm run dev` (uses `concurrently` → `dev:renderer` on 127.0.0.1:5183 strictPort + `dev:main` via `node scripts/run-electron.js --dev`).
- Lint: `npm run lint` — two-pass `eslint . && cd src && eslint .` (root config ignores `src/**`; renderer config owns `src/`).
- Typecheck (renderer only): `npm run typecheck` — `cd src && tsc --noEmit`. Main process is JS-only and NOT type-checked.
- Format: `npm run format` (alias of `format:js`) — `eslint . --fix && cd src && eslint . --fix && prettier --write "**/*.{js,jsx,ts,tsx,json,css,md}"`. Check-only: `npm run format:check`. Combined gate: `npm run quality-check` (format:check + typecheck).
- Test (single command, two stages): `npm test` — first `node --test "test/helpers/*.test.js" "test/utils/*.test.js" "test/models/*.test.js"`, then `node --test --import ./test/setup/tsxRegister.js "test/components/*.test.js"`. One file: `node --test test/helpers/autoLearnDictionary.test.js` (or any glob). Component test: `node --test --import ./test/setup/tsxRegister.js test/components/<name>.test.js`.
- Build packaged app: `npm run build` — `cd src && vite build && cd .. && electron-builder`. Platform-specific: `npm run build:win`. Each prebuild chain compiles native helpers + downloads engine binaries.
- Pack (unpackaged): `npm run pack` — `vite build + electron-builder --dir` (with `CSC_IDENTITY_AUTO_DISCOVERY=false`).
- Clean: `npm run clean` — runs `node cleanup.js`.
- Lifecycle hooks (do NOT run these manually): `prestart`, `predev`, `predev:main`, `prebuild` (compile:native + download:meeting-aec-helper), `prebuild:win` (prebuild + platform extras), `prepack`, `predist`, `postinstall` (`electron-builder install-app-deps`).

## Code Conventions & Common Patterns

- **Module system**: CommonJS (`require`/`module.exports`) in `main.js`, `preload.js`, and most of `src/helpers/`. ESM with TypeScript in `src/` renderer; legacy `.jsx` for `src/main.jsx`, `src/App.jsx`, `src/AppRouter.jsx`, `src/updater.js`, `src/components/DictationBar.jsx`. Never mix the two in one file.
- **TypeScript config**: `src/tsconfig.json` only (`target: ES2022`, `module: ESNext`, `moduleResolution: bundler`, `jsx: react-jsx`, `allowJs: true`, `checkJs: false`, `strict: false`, `noEmit: true`, `paths: { "@/*": ["./*"] }` — mirrors Vite alias). No `jsconfig.json`.
- **Naming**: React components PascalCase `.tsx`; hooks `useXxx.ts`; Zustand stores `xxxStore.ts`; main-process managers CamelCase `.js`; test files `*.test.js` (CJS, no JSX — components rendered via `React.createElement`).
- **Linting nuances**: root ESLint (`eslint.config.js`) is CommonJS, `ecmaVersion: 2022`, ignores `src/**`; renderer ESLint (`src/eslint.config.js`) is three blocks (ignores + `**/*.{js,jsx}` + `**/*.{ts,tsx}`) using `react-hooks` + `react-refresh` + `typescript-eslint`. `no-unused-vars` is relaxed with `^_` ignore prefix; `no-console: off`; `prefer-const: off`; `no-var: off` in the root config. Renderer rules-of-hooks is `error`; `exhaustive-deps` is `warn`.
- **Prettier**: `semi: true`, `singleQuote: false` (double quotes), `tabWidth: 2`, `trailingComma: "es5"`, `printWidth: 100`, `bracketSpacing: true`, `arrowParens: "always"`, `endOfLine: "lf"`. `.prettierignore` covers `node_modules`, `dist`, `build`, `src/dist`, `*.min.js`, `package-lock.json`.
- **Error handling**: main-process managers expose `try/catch` around engine operations; in-flight request draining pattern uses `_drainActiveRequests()` (whisper/parakeet/llama); `_intentionalStop` flag suppresses crash-respawn on process `'close'`. `llamaServer` detects `ContextOverflowError` and retries once with capability flags stripped. `audioManager` recordings guarded by `recordingGuard` + `recordingValidation` (asserts on state, not strings).
- **Async patterns**: main process uses `async/await`; engines expose `start()` / `stop()` / `transcribe()` and emit status. Render-side: Zustand stores for state; `useAudioRecording.js` is a JS hook. IPC push events flow one-way via `broadcastToWindows()`.
- **Dependency injection**: managers are instantiated in `main.js#startApp()` (~25 classes) and passed to the IPC handler registration; no DI container. Each engine manager (whisper/parakeet/llama) is structurally identical: `setIdleTimeoutMs(ms)`, `resetIdleTimer()` on every request → `setTimeout(stop, idleTimeoutMs)`, `_drainActiveRequests()`, `_intentionalStop`, `getStatus()`.
- **State management**: Zustand stores in `src/stores/`. Persistence is via `electron-store` + better-sqlite3; never write to disk from the renderer.
- **Privacy/network**: no silent network calls. `powerMonitor.on('resume')` schedules `WHISPER_WAKE_REWARM_DELAY_MS=3000` then `whisperManager.stopServer()` to invalidate stale CUDA context on resume.
- **Idempotency**: every fix and every new feature must ship a regression test (`test/helpers/...` or `test/components/...`).

## Important Files

- `main.js` — Electron entry: single-instance lock, channel/userData isolation, ~25 manager instantiation, IPC registration, lifecycle. ~1168 lines.
- `preload.js` — `contextBridge` surface; only renderer↔main bridge. ~823 lines. `registerListener` helper attaches `ipcRenderer.on` with cleanup.
- `src/helpers/ipcHandlers.js` — central IPC class; `setupHandlers()` registers all `ipcMain.handle/on`. `broadcastToWindows(channel, payload)` for push events. ~7500 lines.
- `src/helpers/database.js` — better-sqlite3 schema/CRUD; tables: `transcriptions`, `vocabulary_stats`, `custom_dictionary` (sync columns), `snippets`, `notes` + `notes_fts` (FTS5), `folders` (seeded Personal/Meetings), `actions`, `agent_conversations`, `agent_messages`, `contacts`, `speaker_profiles`, `speaker_mappings`, `note_speaker_embeddings`. Drops obsolete `google_*` tables on boot; sync columns backfilled on first run.
- `src/helpers/whisperServer.js` — whisper-server lifecycle. `PORT_RANGE 8178-8199`, `STARTUP_TIMEOUT 30s`, `DRAIN 15s`, `DEFAULT_IDLE_TIMEOUT_MS = 5*60*1000` (overridable via `transcriptionIdleTimeoutMs` setting).
- `src/helpers/parakeetWsServer.js` — sherpa-onnx Parakeet WS lifecycle. `PORT_RANGE 6006-6029`, `STARTUP_TIMEOUT_MS 60s`, `DRAIN 15s`, `STREAMING_DRAIN 300s`, `DEFAULT_IDLE_TIMEOUT_MS = 5*60*1000` (overridable). CUDA auto-enabled only when NVIDIA + CUDA binary present.
- `src/helpers/llamaServer.js` — llama.cpp OpenAI-compat server. `PORT_RANGE 8221-8240`, `DEFAULT_IDLE_TIMEOUT_MS = 5*60*1000` (overridable via `llmIdleTimeoutMs`). `getBackendChain(gpuMode)` → CUDA/Vulkan/CPU. Retries once with capability flags stripped.
- `package.json` — `engines.node: ">=26"`, all lifecycle hooks, all dev/build/test scripts. **Never regenerate `package-lock.json` with a different major.**
- `.nvmrc` — single line `26`; `.npmrc` sets `engine-strict=true`.
- `electron-builder.json` + `electron-builder.unsigned-win.json` — packaging (`appId: com.gizmolabs.ektoswhispr`, `afterPack: scripts/afterPack.js`, asarUnpack for native modules, win target, GitHub release publish).
- `src/vite.config.mjs` — alias `@` → `src/`; base `'./'` (file://); manualChunks splits `vendor-radix` and `vendor-icons`; externalises electron + native modules.
- `test/setup/tsxRegister.js` — esbuild + happy-dom loader for component tests. Registers happy-dom globals, adds `.tsx`/`.jsx`/`.ts` require hooks via `esbuild.transformSync({ loader:"tsx", jsx:"automatic", format:"cjs", target:"node26" })`, aliases `@` → `src/`, stubs `.svg` and `.css`, calls `GlobalRegistrator.unregister()` in `after()`.
- `.github/copilot-instructions.md` — the project's primary existing rule file; AGENTS.md defers to it on privacy/performance/IPC/lifecycle rules. See "Rule precedence" below.

## Runtime/Tooling Preferences

- **Runtime**: Node 26 ONLY. Enforced via `engines.node: ">=26"`, `.npmrc engine-strict=true`, and CI `node-version-file: .nvmrc`. Use `nvm use` (or Volta/asdf equivalent) before any command.
- **Package manager**: npm. **Never** regenerate `package-lock.json` with a different major Node (copilot-instructions rule). `lockfile-lint.yml` CI checks `--validate-https --allowed-hosts npm --validate-integrity`.
- **Browsers / shells**: N/A (Electron desktop).
- **Bun / Deno / pnpm / yarn**: NOT used. Do not introduce.
- **Electron / Vite / React / TypeScript versions** (from `package.json`, treat as constraints): `electron ^43.1.1`, `electron-builder ^26.4.0`, `vite ^8.x`, `react 19`, `typescript 6`, `typescript-eslint 8.58`, `@vitejs/plugin-react 6.0`, `eslint 10`, `prettier 3.8`, `esbuild 0.28`.
- **Editor**: `.vscode/settings.json` enables `editor.formatOnSave`, `editor.defaultFormatter: prettier`, `editor.codeActionsOnSave.fixAll.eslint`, and pins `typescript.tsdk`. If using VS Code, this works out of the box.
- **CI gates**: `tests.yml` (Node 26, `npm test`, `ELECTRON_OVERRIDE_DIST_PATH=/tmp`), `lockfile-lint.yml`, `codeql.yml`, `build-and-notarize.yml` (signed on push, unsigned on PR via `electron-builder.unsigned-win.json`).

## Testing & QA

- **Single runner**: `node:test` (Node built-in). No Vitest/Jest/Mocha; no `vitest.config.*`, `jest.config.*`, `.c8rc*`, `.nycrc*`. Do not introduce one.
- **One command**: `npm test`. Two stages — first `node --test "test/helpers/*.test.js" "test/utils/*.test.js" "test/models/*.test.js"`, then `node --test --import ./test/setup/tsxRegister.js "test/components/*.test.js"`. Each stage prints `# tests`, `# pass`, `# fail`, `# skipped`, `# todo`, summary.
- **One file**: `node --test test/<dir>/<name>.test.js`. Component test: `node --test --import ./test/setup/tsxRegister.js test/components/<name>.test.js`.
- **Layout**: ~116 files total — `test/helpers/` (90), `test/utils/` (12), `test/models/` (1), `test/components/` (13). Mirror the source tree: helpers for main-process modules, utils for renderer utilities, models for data fixtures, components for React UI.
- **Style**: CommonJS `.test.js` (no JSX in test files — use `React.createElement(Component, props)`). Imports:
  ```js
  const test = require("node:test");
  const assert = require("node:assert/strict");
  // component tests additionally:
  const { render, screen, cleanup, fireEvent, waitFor, renderHook, act } =
    require("@testing-library/react");
  const React = require("react");
  ```
- **Component test setup**: DOM via `happy-dom` (registered/unregistered by `tsxRegister.js`); TSX/JSX compiled on-the-fly by esbuild inside the loader; `.svg` returns a base64 placeholder, `.css` returns `{}`; `@` aliased to `src/`. Always call `cleanup()` in `test.afterEach`.
- **TS source from a test**: either `require("../../src/helpers/foo.js")` for CJS or `await import("../../src/utils/foo.ts")` (Node 22.6+ native type-stripping — no separate tsx loader needed for plain `.ts`).
- **Coverage**: not configured (no `c8`/`nyc`/`--experimental-test-coverage`). Do not add a coverage gate without explicit ask.
- **What to test**: behavior, boundaries, invariants, transitions, precedence, real errors (e.g. `audioManagerStopRace`, `hotkeySlotRollback`, `recordingGuard`, `whisperWakeRewarm`). Not plumbing or source text.
- **Regression rule**: every bugfix and every new feature must ship a regression test in the matching test directory.

## Rule precedence

1. `RECREATION_SPEC.md` §0 — known divergences from `CLAUDE.md`. (File is referenced by `.github/copilot-instructions.md` and `src/helpers/database.js:345` but is NOT present in this checkout; treat the rule as a documented convention.)
2. `.github/copilot-instructions.md` — primary project rules (privacy, performance, single-instance lock, graceful degradation, Node 26 pin, IPC bridge, on-demand model lifecycle, screen-context Windows default, lockfile major pin, "reuse existing patterns", regression test per fix/feature).
3. `AGENTS.md` (this file) — must NOT contradict either above.
