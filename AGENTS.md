# Repository Guidelines

## Project Overview

EktosWhispr is an Electron 41 desktop dictation application — an offline-first fork of OpenWhispr 1.7.5. Privacy-first: no telemetry, no cloud unless BYOK (Bring Your Own Key). Local speech-to-text via **whisper.cpp** and **NVIDIA Parakeet** (sherpa-onnx); local LLM reasoning/agent via **llama-server** (llama.cpp). Dual-window: overlay dictation window + control panel (settings/history/notes). Persistence via better-sqlite3.

## Architecture & Data Flow

```
+-----------------------+       IPC (window.api.*)        +-----------------------+
|  Renderer (src/)      | <-----------------------------> |  Main process (main.js)|
|  ESM / React 19 / TS  |                                 |  CommonJS             |
|  Vite dev/build       |                                 |  preload.js bridge    |
+-----------------------+                                 +-----------------------+
        |                                                          |
        | audio capture (getUserMedia / native helpers)            | sidecar lifecycle
        v                                                          v
  AudioManager (renderer)  ----------------------------->  whisperServer.js / parakeetWsServer.js / llamaServer.js
        |                                                       (lazy spawn, idle unload)
        | transcript text
        v
  window.api.* (preload)  ----------------------------->  ipcHandlers.js (~250 channels)
                                                                  |
                                                                  v
                                                          database.js (SQLite)
```

- **On-demand sidecars**: engines cold-start on hotkey-down, idle-unload after configurable timeout (`transcriptionIdleTimeoutMs` / `llmIdleTimeoutMs`, default 5 min). Nothing pre-warms at startup.
- **Settings two-source-of-truth**: renderer `localStorage` (`useSettings.ts`) ↔ main `.env` (`EnvironmentManager`). Synced via IPC at startup (renderer wins for never-persisted values).
- **Audio path**: OS mic (WebRTC `getUserMedia` or native helper) → AudioManager chunks → WAV assembly → IPC → sidecar → transcript → IPC back → insert via clipboard + paste or direct edit-injection.

## Key Directories

| Path | Purpose |
|---|---|
| `main.js` | Application entry; manager lifecycle, IPC wiring, single-instance lock |
| `preload.js` | Secure IPC bridge via `contextBridge`; typed in `src/types/ipc.d.ts` |
| `src/helpers/` | Main-process modules (CommonJS): engines, IPC, DB, audio, hotkeys, windows |
| `src/components/` | React UI: notes, settings, onboarding, chat, transforms, dictionary |
| `src/services/` | Renderer-side service layer (reasoning, audio, persistence) |
| `src/stores/` | State management (renderer) |
| `src/hooks/` | React hooks |
| `src/utils/` | Pure helpers (snippets, audio utils, formatting) |
| `src/models/` | JSON model registries + registry data tests |
| `src/config/` | Config (secret keys, channels, inference scopes) |
| `src/types/` | TypeScript types (IPC, channels, domain) |
| `src/locales/` | i18n strings (en, pt) |
| `src/lib/` | Renderer utilities |
| `test/` | Mirrors `src/` — helpers/utils/models = node:test; components = tsxRegister |
| `scripts/` | 30+ build/download scripts (afterPack, download-whisper-cpp, etc.) |
| `resources/` | Native sources (C/Swift/Python) + platform subdirs + `bin/` prebuilt |
| `docs/` | Architecture, specs, guides, platforms; start with `docs/README.md` |

## Development Commands

```bash
npm install              # root only; postinstall rebuilds native
npm start                # compile native + download meeting-aec-helper + electron .
npm run dev              # concurrent vite (renderer) + electron-vite (main)
npm test                 # node:test for helpers/utils/models + tsxRegister for components
npm run lint             # eslint . + cd src && eslint .
npm run typecheck        # tsc --noEmit (renderer only)
npm run format           # eslint --fix + prettier --write
npm run format:check     # CI-style check
npm run quality-check    # format:check + typecheck
npm run build            # vite build + electron-builder
npm run build:win        # Windows (NSIS)
npm run build:mac        # macOS (DMG)
npm run build:linux      # Linux (AppImage/deb/rpm/tar.gz)
npm run download:<engine># fetch whisper-cpp / llama-server / sherpa-onnx / diarization
npm run compile:<native> # build per-platform native helpers
```

**Single test file**: `node --test test/helpers/<name>.test.js` or `node --test --import ./test/setup/tsxRegister.js test/components/<name>.test.js`.

## Code Conventions & Common Patterns

- **Module systems**: Main process + helpers = **CommonJS** (`require`/`module.exports`). Renderer = **ESM** with TypeScript + React 19 + Tailwind v4. Never mix — a helper under `src/helpers/` cannot `import` from `src/components/`.
- **IPC contract**: every renderer↔main call goes through `preload.js`. Add channels in `src/types/ipc.d.ts` (typed) + handler in `src/helpers/ipcHandlers.js`. Use `window.api.<channel>(args)` from renderer.
- **Lazy sidecar pattern** (see `whisperServer.js`, `parakeetWsServer.js`, `llamaServer.js`):
  - Manager extends `EventEmitter`.
  - `start(options)` spawns sidecar on first transcribe; `stop()` drains in-flight then kills (`DRAIN_TIMEOUT_MS = 15000`).
  - Idle timer resets on use; configurable via `setIdleTimeoutMs(ms)` fed by settings.
  - Track `threadSignature` / `vadSignature` / `languageSignature` to avoid no-op restarts.
- **Manager pattern**: managers are class instances created in `main.js` after `app.whenReady()`, wired to IPC handlers. Each module has an `EventEmitter` for internal events (e.g. `WhisperServerManager.emit('transcript', ...)`).
- **Error handling**: prefer typed `class XxxError extends Error` (e.g. `ContextOverflowError` in `llamaServer.js`); classify transient vs fatal via `networkErrors.js` / `whisperErrorClassifier.js`. Never swallow rejections silently — log via `debugLogger.js`.
- **Async**: top-level `await` only in tests; main-process uses `async function` everywhere. Long-running IPC handlers return promises; cancel via AbortSignal where supported.
- **Naming**: PascalCase components/classes; camelCase functions/methods; `UPPER_SNAKE_CASE` for module-level constants. Tests mirror source filename + `.test.js`.
- **Lint** (`eslint.config.js`): flat config. Main process rules relaxed: `no-unused-vars: warn` (allow `_`/`event`/`err`/`error` prefix), `no-console: off`, `prefer-const: off`, `no-var: off`. Renderer has its own config under `src/`.
- **Format** (`.prettierrc`): `semi: true`, `singleQuote: false`, `tabWidth: 2`, `trailingComma: "es5"`, `printWidth: 100`, `bracketSpacing: true`, `arrowParens: "always"`, `endOfLine: "lf"`.
- **Side-effects**: native binaries in `resources/bin/`; download scripts extract there. Build hooks (`afterPack.js`) strip unused `onnxruntime-node` platform binaries (~150-180MB savings), wrap Linux binary in XWayland shell, verify required binaries.

## Important Files

| File | Role |
|---|---|
| `main.js` | Entry; manager init, IPC wiring, single-instance lock, power monitor |
| `preload.js` | `contextBridge` exposing `window.api.*` (typed in `src/types/ipc.d.ts`) |
| `src/helpers/ipcHandlers.js` | ~8700 lines; **all 250+ IPC channels registered here** |
| `src/helpers/whisperServer.js` | whisper.cpp sidecar; on-demand lifecycle, VAD, thread resolution |
| `src/helpers/parakeetWsServer.js` | NVIDIA Parakeet via sherpa-onnx WebSocket server |
| `src/helpers/llamaServer.js` | llama.cpp server; VRAM tuning, context-overflow retry |
| `src/helpers/database.js` | better-sqlite3 ops: history, notes, meetings, snippets, transforms |
| `src/helpers/audioManager.js` | Renderer audio capture, batching, peak normalization |
| `src/helpers/hotkeyManager.js` | Hotkey registration (Electron `globalShortcut` + native listeners) |
| `src/helpers/windowManager.js` | Dual-window orchestration |
| `src/helpers/environment.js` | `.env` load + IPC sync of settings |
| `src/helpers/modelManagerBridge.js` | Engine orchestration: prewarm, idle unload, context-overflow retry |
| `src/models/modelRegistryData.json` | Local model catalog (validates in `test/models/modelRegistryData.test.js`) |
| `src/types/ipc.d.ts` | IPC channel types — **edit when adding a channel** |
| `electron-builder.json` | Build config: NSIS (Win), DMG (macOS), AppImage/deb/rpm (Linux) |
| `.env.example` | All env vars (API keys, model paths, channels) |
| `scripts/afterPack.js` | Build hook: strip onnxruntime-node, wrap Linux binary, verify binaries |
| `RECREATION_SPEC.md` | Authoritative behavior; §0 lists divergences from CLAUDE.md — read first |

## Runtime/Tooling Preferences

- **Node**: `>=26` (pinned in `.nvmrc` — do not regenerate `package-lock.json` with a different major).
- **Package manager**: `npm` only (no yarn/pnpm; `package-lock.json` is committed).
- **Electron**: 41.
- **Renderer bundler**: Vite (`electron-vite`). Source in `src/`, output in `src/dist/`.
- **TypeScript**: strict mode, target ES2022, module NodeNext. Root `tsconfig.json` extends `@ektoswhispr/tsconfig/base.json`.
- **Test runner**: **Node built-in `node:test` + `node:assert`** (not vitest despite being in devDeps). Component tests use a custom TSX loader at `test/setup/tsxRegister.js` (esbuild + happy-dom).
- **Native binaries**: shipped prebuilt in `resources/bin/`; downloaded by `scripts/download-*.js` or compiled by `scripts/build-*.js`. List of all 16 binaries in `docs/architecture/native-binaries.md`.
- **Privacy constraint**: no network calls unless user opts in. No telemetry. All STT/LLM runs locally. Web search and cloud STT exist only as opt-in providers.
- **Platform constraints**:
  - Linux Wayland: append `--ozone-platform=x11` (handled by `afterPack.js` wrapper + `appendSwitch` fallback).
  - Windows: NSIS installer; Azure code signing optional (`electron-builder.unsigned-win.json` for unsigned).
  - macOS: DMG + notarization; Mach-O resource registration for native helpers.
- **Harness governance**: specs in `docs/specs/` drive work. Each spec needs TL;DR section (per `docs/specs/_template.md`). Pending work in `docs/PENDING.md`.

## Testing & QA

- **Frameworks**:
  - Helpers/utils/models: `node --test "test/<dir>/*.test.js"` with `node:assert`.
  - Components: `node --test --import ./test/setup/tsxRegister.js "test/components/*.test.js"` (happy-dom + esbuild for TSX).
  - `@testing-library/react` for component assertions.
- **Organization**: `test/` mirrors `src/`. One file per module. Schema/data tests under `test/models/`.
- **Setup**: `test/setup/tsxRegister.js` — registers happy-dom globals, installs esbuild TS/TSX transform, adds `@/` alias resolution, stubs `.svg`/`.css` imports.
- **Patterns**: use `node:test`'s `describe`/`it`/`beforeEach`/`afterEach`. For DB tests, pass a fake in-memory `DatabaseManager`. For components, mount via `require()` (CJS-style), stub `window.electronAPI` globally, wrap state changes in `act()`.
- **Coverage**: not configured. **Regression tests mandatory** for every bugfix/feature per project rules.
- **What to test**: behavior, boundaries, invariants, transitions, precedence, real errors. Don't test plumbing, source text, or incidental defaults. Match existing conventions; deterministic, isolated, full-suite safe.
- **CI**: `.github/workflows/build-and-notarize.yml` (PR checks, builds all platforms) and `release.yml` (release tags). Both download + cache native binaries.
