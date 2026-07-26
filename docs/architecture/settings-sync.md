# Settings Sync — Two Sources of Truth

## The Problem

Settings exist in **two places** that must stay in sync:

| Scope | Storage | Access |
|-------|---------|--------|
| **Renderer** | `localStorage` (via `useSettings.ts` / `settingsStore.ts`) | React hooks, instant UI |
| **Main** | `.env` file (via `environment.js` / `EnvironmentManager`) | Sidecars, native binaries, IPC handlers |

## Sync Mechanism

### At Startup
1. Main process starts → loads `.env` into `process.env`
2. Renderer starts → reads `localStorage` → `initializeSettings()`
3. Renderer calls `get-audio-retention-sync-state` (and similar for model timeouts)
4. **Pure resolver** (`audioRetentionSync.js` / `modelIdleTimeoutSync.js`) decides:
   - If main has never persisted → renderer pushes its value (renderer wins)
   - If main has value → renderer pulls (main wins)
5. Result written to both sides

### On Change
- Renderer changes setting → `save-setting` IPC → main updates `.env` via `saveAllKeysToEnvFile()`
- Main changes setting (rare) → broadcasts `settings-updated` event → renderer reloads

## Settings with Dual Sync

| Setting | Renderer Key | Main Env Var | Sync Helper |
|---------|--------------|--------------|-------------|
| Audio retention | `audioRetentionDays` | `AUDIO_RETENTION_DAYS` | `audioRetentionSync.js` |
| Transcription idle timeout | `transcriptionIdleTimeoutMs` | `TRANSCRIPTION_IDLE_TIMEOUT_MS` | `modelIdleTimeoutSync.js` |
| LLM idle timeout | `llmIdleTimeoutMs` | `LLM_IDLE_TIMEOUT_MS` | `modelIdleTimeoutSync.js` |
| Screen context retention | `screenContextRetentionDays` | `SCREEN_CONTEXT_RETENTION_DAYS` | `screenContextRetentionSync.js` |

## Key Files

| File | Role |
|------|------|
| `src/hooks/useSettings.ts` | Renderer settings state + `initializeSettings()` |
| `src/stores/settingsStore.ts` | Zustand persist middleware → localStorage |
| `src/helpers/environment.js` | `EnvironmentManager` — `.env` read/write, `safeStorage` for secrets |
| `src/helpers/audioRetentionSync.js` | Pure startup resolver for `audioRetentionDays` |
| `src/helpers/modelIdleTimeoutSync.js` | Pure startup resolver for idle timeouts |
| `src/helpers/screenContextRetentionSync.js` | Pure startup resolver for screen context retention |
| `src/helpers/ipcHandlers.js` | IPC handlers: `get-audio-retention-sync-state`, `save-audio-retention-days`, etc. |

## Golden Rule

**Never read `.env` directly in renderer.** Always go through IPC. The main process owns `.env`; renderer owns `localStorage`. Sync helpers are pure functions — testable in isolation.