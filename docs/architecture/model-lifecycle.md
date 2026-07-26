# Model Lifecycle — On-Demand Whisper/Parakeet/llama-server

## Core Principle

**Nothing loads at startup.** All three engines cold-start on first use, idle-unload after configurable timeout.

| Engine | Manager | Idle Timeout Setting | Default |
|--------|---------|---------------------|---------|
| Whisper | `WhisperServerManager` (`whisperServer.js`) | `transcriptionIdleTimeoutMs` | 300000 (5 min) |
| Parakeet | `ParakeetWsServer` (`parakeetWsServer.js`) | `transcriptionIdleTimeoutMs` (shared) | 300000 |
| llama-server | `LlamaServerManager` (`llamaServer.js`) | `llmIdleTimeoutMs` | 300000 |

## Warm-Up Triggers (Fire-and-Forget)

| Trigger | Code Location | Engines Warmed |
|---------|---------------|----------------|
| Dictation hotkey-down | `useAudioRecording.js:performStartRecording` → `audioManager.warmupTranscriptionEngine()` + `warmupReasoningServer()` | Whisper/Parakeet + llama-server |
| Meeting/Note hotkey-down | `meetingRecordingStore.ts:startRecording()` → `audioManager.warmupTranscriptionEngine()` | Whisper/Parakeet only |
| Upload file select | `UploadAudioView.tsx:handleBrowse/handleDrop` → `audioManager.warmupUploadTranscriptionEngine()` | Whisper/Parakeet only |
| Language change (Whisper) | `useSettings.ts` sync → `ipcHandlers` compares `languageSignature` → unloads if different | Whisper only (unload only; reload on next trigger) |

**Model/provider switch**: Unloads stale process immediately; never reloads proactively — next trigger cold-starts.

## Idle Unload

- Each manager tracks `activeRequestCount`
- On `stop()` (idle timeout or settings switch): waits `DRAIN_TIMEOUT_MS` (15s; Parakeet streaming: 5min) for in-flight requests
- If process exits unexpectedly (`_intentionalStop === false`): logged at `error` level; **no auto-respawn** — next trigger cold-starts

## Wake-from-Sleep

`main.js` listens `powerMonitor.on('resume')` → calls `whisperManager.stopServer()` (clean unload; CUDA context dead after sleep). Next hotkey press cold-starts normally.

## Language Signature (Whisper Only)

`whisperServer.js` tracks `languageSignature` (resolved base language code). On warm-up, `whisperServerStart(modelName, language)` passes `--language` CLI flag. Per-request `language` field also sent (always correct). Mismatch → unload on next warm-up.

## Settings Persistence

- Renderer: `transcriptionIdleTimeoutMs` / `llmIdleTimeoutMs` in `localStorage` (via `settingsStore.ts`)
- Main: Mirrored to `.env` as `TRANSCRIPTION_IDLE_TIMEOUT_MS` / `LLM_IDLE_TIMEOUT_MS` via `saveAllKeysToEnvFile()`
- Startup sync: `modelIdleTimeoutSync.js` (pure resolver, same pattern as `audioRetentionSync.js`)
- IPC: `save-transcription-idle-timeout-ms` → calls `setIdleTimeoutMs()` on both Whisper + Parakeet managers; `save-llm-idle-timeout-ms` → llama-server only

## No Pinned/Always-Warm Engine

Previous spec (`transcription-engine-lifecycle.md`) proposed a pinned engine — **rejected**. Current design: purely on-demand, idle-unload, no proactive restart.

## Crash Handling

- Unexpected exit → logged distinctively at `error` level
- No backoff counter, no scheduled respawn
- Next on-demand trigger → normal cold start

## Key Files

| File | Role |
|------|------|
| `src/helpers/whisperServer.js` | WhisperServerManager |
| `src/helpers/parakeetWsServer.js` | ParakeetWsServer |
| `src/helpers/llamaServer.js` | LlamaServerManager |
| `src/helpers/audioManager.js` | `warmupTranscriptionEngine()`, `warmupReasoningServer()`, `warmupUploadTranscriptionEngine()` |
| `src/hooks/useAudioRecording.js` | Dictation hotkey → warmup calls |
| `src/stores/meetingRecordingStore.ts` | Meeting/Note hotkey → warmup |
| `src/components/UploadAudioView.tsx` | Upload file select → warmup |
| `src/helpers/modelIdleTimeoutSync.js` | Startup sync for idle timeouts |
| `docs/specs/on-demand-model-lifecycle.md` | Full spec |