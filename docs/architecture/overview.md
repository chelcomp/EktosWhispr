# Architecture Overview

## High-Level

EktosWhispr is an **Electron 41** desktop dictation app with **dual-window** architecture:

```
┌─────────────────────────────────────────────────────────────────┐
│                        Main Process                              │
│  main.js → initializes all managers, IPC handlers, windows     │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ src/helpers/ipcHandlers.js — centralized IPC (~8700 lines)│   │
│  │ whisperServer.js, parakeetWsServer.js, llamaServer.js    │   │
│  │ hotkeyManager.js, audioManager.js, database.js, ...      │   │
│  └─────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
                              │ IPC (contextBridge)
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                       Renderer Process                           │
│  React 19 + TypeScript + Vite + Tailwind v4                      │
│  ┌─────────────────┐  ┌─────────────────────────────────────┐   │
│  │ Main Window     │  │ Control Panel (separate BrowserWin) │   │
│  │ (overlay, dictation)  │ (settings, history, models)       │   │
│  └─────────────────┘  └─────────────────────────────────────┘   │
│  Components: App.jsx, ControlPanel.tsx, SettingsPage.tsx, ...   │
│  Hooks: useAudioRecording, useSettings, useHotkey, ...          │
│  Stores: Zustand (meetingRecordingStore, settingsStore)         │
└─────────────────────────────────────────────────────────────────┘
```

## Process Separation

| Process | Responsibility | Key Files |
|---------|----------------|-----------|
| **Main** | App lifecycle, native integrations, IPC, DB, sidecar management | `main.js`, `src/helpers/*.js` |
| **Renderer** | UI, React state, user interaction | `src/components/`, `src/hooks/`, `src/stores/` |
| **Preload** | Secure IPC bridge (`contextBridge.exposeInMainWorld`) | `preload.js` |
| **ONNX Worker** | `onnxruntime-node` inference (speaker embeddings) — lazy-spawned | `src/workers/onnxWorker.js` + `src/helpers/onnxWorkerClient.js` |

## On-Demand Sidecars (Lazy-Spawned)

| Sidecar | Trigger | Idle Unload | Binary |
|---------|---------|-------------|--------|
| **Whisper** (`whisperServer.js`) | Dictation/Meeting/Upload hotkey | `transcriptionIdleTimeoutMs` (default 5 min) | `whisper-cpp-*-x64.exe` |
| **Parakeet** (`parakeetWsServer.js`) | Same as Whisper when provider=`nvidia` | Shared `transcriptionIdleTimeoutMs` | `sherpa-onnx-ws-*-x64.exe` |
| **llama-server** (`llamaServer.js`) | First LLM request (cleanup/agent) | `llmIdleTimeoutMs` (default 5 min) | `llama-server-*.exe` |
| **ONNX Worker** | First speaker embedding request | Never (process-lifetime) | `onnxruntime-node` (Node addon) |

**No engine pre-warms at startup** — `initializeAtStartup()` only does stale-download cleanup + dependency logging.

## IPC Pattern

```
Renderer: window.api.channelName(args)
    │
    ▼ preload.js (contextBridge)
Main:   ipcMain.handle('channelName', handler)
    │
    ▼ src/helpers/ipcHandlers.js (centralized)
```

- All channels registered in `ipcHandlers.js`
- Preload exposes `window.api.*` with TypeScript types in `src/types/ipc.d.ts`
- Main process validates/sanitizes; preload is trust boundary

## Data Flow (Dictation)

```
Hotkey Press
    │
    ▼
useAudioRecording.js → MediaRecorder (MediaStream API)
    │
    ▼ (audio chunks)
IPC: start-dictation-preview / send-audio-chunk / stop-dictation-preview
    │
    ▼
Main: audioManager.js → temp file → whisperServer.js / parakeetWsServer.js
    │
    ▼ (progressive VAD batching — see dictation-progressive-vad-batching.md)
Transcript chunks → merge/retry on low confidence → final transcript
    │
    ▼
AudioManager.processTranscription() → (optional) Cleanup/Agent LLM
    │
    ▼
Paste via clipboard.js (platform-specific)
```

## Settings: Two Sources of Truth

| Scope | Storage | Sync Mechanism |
|-------|---------|----------------|
| **Renderer** | `localStorage` (via `useSettings.ts` / `settingsStore.ts`) | `sync-startup-preferences` IPC → main |
| **Main** | `.env` file (via `environment.js` / `EnvironmentManager`) | `saveAllKeysToEnvFile()` on changes |

Sync helpers: `audioRetentionSync.js`, `modelIdleTimeoutSync.js` — pure functions resolving conflicts at startup (renderer wins for never-persisted values).

See `settings-sync.md` for details.