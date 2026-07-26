# IPC Channel Registry

## Pattern
All channels registered in `src/helpers/ipcHandlers.js` with `ipcMain.handle()`.
Preload exposes via `contextBridge.exposeInMainWorld('api', { ... })`.
Renderer calls `window.api.channelName(args)`.

## Categories

### Dictation (Preview/Batching)
| Channel | Handler | Direction | Description |
|---------|---------|-----------|-------------|
| `start-dictation-preview` | `_handleStartDictationPreview` | R→M | Start VAD-batched dictation |
| `send-audio-chunk` | `_handleSendAudioChunk` | R→M | Send PCM chunk |
| `stop-dictation-preview` | `_handleStopDictationPreview` | R→M | Stop, get final transcript |
| `get-dictation-preview` | `_handleGetDictationPreview` | R→M | Request partial transcript (overlay) |

### Transcription (Upload/Meeting)
| Channel | Handler | Direction | Description |
|---------|---------|-----------|-------------|
| `transcribe-audio` | `_handleTranscribeAudio` | R→M | Single-file transcription |
| `meeting-transcription-prepare` | `_handleMeetingTranscriptionPrepare` | R→M | Init meeting recording |
| `meeting-transcription-start` | `_handleMeetingTranscriptionStart` | R→M | Start recording (mic + system) |
| `meeting-transcription-send` | `_handleMeetingTranscriptionSend` | R→M | Send audio chunk |
| `meeting-transcription-stop` | `_handleMeetingTranscriptionStop` | R→M | Stop, finalize |
| `meeting-transcription-cancel` | `_handleMeetingTranscriptionCancel` | R→M | Cancel, discard |

### LLM / Reasoning
| Channel | Handler | Direction | Description |
|---------|---------|-----------|-------------|
| `process-text` | `_handleProcessText` | R→M | Cleanup/agent/note formatting |
| `chat-with-agent` | `_handleChatWithAgent` | R→M | Agent overlay conversation |
| `search-notes` | `_handleSearchNotes` | R→M | FTS5 keyword search |

### Settings / Config
| Channel | Handler | Direction | Description |
|---------|---------|-----------|-------------|
| `get-settings` | `_handleGetSettings` | R→M | Full settings dump |
| `save-setting` | `_handleSaveSetting` | R→M | Single setting |
| `save-all-keys-to-env` | `_handleSaveAllKeysToEnvFile` | R→M | Persist API keys to .env |
| `get-audio-retention-sync-state` | `_handleGetAudioRetentionSyncState` | R→M | Startup sync |
| `save-audio-retention-days` | `_handleSaveAudioRetentionDays` | R→M | Update retention |
| `save-transcription-idle-timeout-ms` | `_handleSaveTranscriptionIdleTimeoutMs` | R→M | Update Whisper/Parakeet idle |
| `save-llm-idle-timeout-ms` | `_handleSaveLlmIdleTimeoutMs` | R→M | Update llama-server idle |

### Models / Providers
| Channel | Handler | Direction | Description |
|---------|---------|-----------|-------------|
| `get-whisper-models` | `_handleGetWhisperModels` | R→M | List downloaded/available |
| `download-whisper-model` | `_handleDownloadWhisperModel` | R→M | Download GGML model |
| `delete-whisper-model` | `_handleDeleteWhisperModel` | R→M | Remove model |
| `get-parakeet-models` | `_handleGetParakeetModels` | R→M | List Parakeet models |
| `download-parakeet-model` | `_handleDownloadParakeetModel` | R→M | Download Parakeet |
| `set-local-transcription-provider` | `_handleSetLocalTranscriptionProvider` | R→M | whisper ↔ nvidia |
| `get-reasoning-providers` | `_handleGetReasoningProviders` | R→M | Available LLM providers |
| `get-reasoning-models` | `_handleGetReasoningModels` | R→M | Models for provider |

### Hotkeys
| Channel | Handler | Direction | Description |
|---------|---------|-----------|-------------|
| `get-hotkey-mode-info` | `_handleGetHotkeyModeInfo` | R→M | GNOME/Hyprland/KDE/native status |
| `update-dictation-hotkey` | `_handleUpdateDictationHotkey` | R→M | Change dictation hotkey |
| `update-agent-hotkey` | `_handleUpdateAgentHotkey` | R→M | Change agent hotkey |
| `update-voice-agent-hotkey` | `_handleUpdateVoiceAgentHotkey` | R→M | Change voice agent hotkey |
| `update-meeting-hotkey` | `_handleUpdateMeetingHotkey` | R→M | Change meeting hotkey |
| `get-voice-agent-key` | `_handleGetVoiceAgentKey` | R→M | Get current voice agent key |

### Dictionary / Vocabulary
| Channel | Handler | Direction | Description |
|---------|---------|-----------|-------------|
| `get-dictionary` | `_handleGetDictionary` | R→M | Custom dictionary words |
| `set-dictionary` | `_handleSetDictionary` | R→M | Update dictionary |
| `get-dynamic-vocabulary-prompt` | `_handleGetDynamicVocabularyPrompt` | R→M | Built vocab prompt |
| `get-vocabulary-stats` | `_handleGetVocabularyStats` | R→M | Vocab stats table |

### Screen Context
| Channel | Handler | Direction | Description |
|---------|---------|-----------|-------------|
| `get-screen-context-config` | `_handleGetScreenContextConfig` | R→M | Settings |
| `save-screen-context-config` | `_handleSaveScreenContextConfig` | R→M | Update settings |
| `clear-all-screen-context-screenshots` | `_handleClearAllScreenContextScreenshots` | R→M | Manual purge |

### History / Database
| Channel | Handler | Direction | Description |
|---------|---------|-----------|-------------|
| `get-transcriptions` | `_handleGetTranscriptions` | R→M | Paginated history |
| `delete-transcription` | `_handleDeleteTranscription` | R→M | Single delete |
| `clear-all-transcriptions` | `_handleClearAllTranscriptions` | R→M | Wipe history |

### System / Utilities
| Channel | Handler | Direction | Description |
|---------|---------|-----------|-------------|
| `open-microphone-settings` | `_handleOpenMicrophoneSettings` | R→M | OS mic privacy |
| `open-sound-input-settings` | `_handleOpenSoundInputSettings` | R→M | OS sound input |
| `open-accessibility-settings` | `_handleOpenAccessibilitySettings` | R→M | macOS accessibility |
| `open-external` | `_handleOpenExternal` | R→M | Shell open URL |
| `show-save-dialog` | `_handleShowSaveDialog` | R→M | File save dialog |
| `get-app-version` | `_handleGetAppVersion` | R→M | Version string |
| `get-dependency-status` | `_handleGetDependencyStatus` | R→M | Binary availability |
| `download-whisper-binary` | `_handleDownloadWhisperBinary` | R→M | Runtime binary install |

### Debug / Dev
| Channel | Handler | Direction | Description |
|---------|---------|-----------|-------------|
| `debug-log` | `_handleDebugLog` | R→M | Renderer log → main log file |
| `get-debug-log` | `_handleGetDebugLog` | R→M | Read log file |

---

## Adding a New Channel

1. **Main** (`ipcHandlers.js`): Add `ipcMain.handle('channel-name', handler)`
2. **Preload** (`preload.js`): Add to `contextBridge.exposeInMainWorld('api', { channelName: (args) => ipcRenderer.invoke('channel-name', args) })`
3. **Types** (`src/types/ipc.d.ts`): Add to `WindowAPI` interface
4. **Renderer**: Call `window.api.channelName(args)`