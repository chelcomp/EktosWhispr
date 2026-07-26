# File Map

## Root

| File | Purpose |
|------|---------|
| `main.js` | App entry point; initializes managers, windows, IPC, single-instance lock |
| `preload.js` | Secure IPC bridge (`contextBridge.exposeInMainWorld('api', ...)`) |
| `package.json` | Scripts, deps, Node 26 engine pin |
| `.nvmrc` | Node version (26) — CI reads via `node-version-file` |
| `cleanup.js` | Dev cleanup script |

## `src/` — Renderer (ESM + TypeScript)

```
src/
├── App.jsx                      # Main dictation overlay window
├── ControlPanel.tsx             # Settings/history/models panel
├── main.tsx                     # React root
├── index.css                    # Tailwind v4 entry
├── components/
│   ├── ui/                      # shadcn/ui primitives (Button, Card, Input, ...)
│   ├── App.jsx                  # (duplicate? check) — dictation UI
│   ├── ControlPanel.tsx
│   ├── SettingsPage.tsx         # All settings tabs
│   ├── OnboardingFlow.tsx       # First-run wizard (dynamic steps)
│   ├── PostMigrationOnboarding.tsx
│   ├── WhisperModelPicker.tsx
│   ├── VocabularyStatsView.tsx  # Dynamic prompt vocab stats
│   └── notes/
│       ├── PersonalNotesView.tsx
│       └── MeetingNotesView.tsx
├── hooks/
│   ├── useAudioRecording.js     # MediaRecorder wrapper
│   ├── useSettings.ts           # Settings state + IPC sync
│   ├── useHotkey.js             # Hotkey state from main
│   ├── useClipboard.ts
│   ├── useDialogs.ts
│   ├── useLocalStorage.ts
│   ├── usePermissions.ts        # OS permission checks + settings links
│   └── useWhisper.ts            # Whisper binary availability
├── stores/
│   ├── settingsStore.ts         # Zustand: settings + persistence
│   └── meetingRecordingStore.ts # Meeting/note recording state
├── services/
│   └── ReasoningService.ts      # AI cleanup/agent orchestration
├── models/
│   ├── modelRegistryData.json   # Single source of truth for all models
│   └── ModelRegistry.ts         # TS wrapper + helpers
├── utils/
│   ├── languages.ts             # 58 language codes + reasoning providers
│   ├── transcriptionQualityHeuristics.js # Low-quality detection
│   ├── correctionLearner.js     # LCS-based correction extraction
│   └── dictationRouting.js      # Route kind: dictation / cleanup / agent
├── config/
│   ├── prompts/index.ts         # System prompt templates + placeholders
│   └── inferenceScopes.ts       # 4 LLM scopes: dictationCleanup, dictationAgent, noteFormatting, chatIntelligence
├── types/
│   └── ipc.d.ts                 # window.api TypeScript declarations
├── locales/
│   ├── en/translation.json      # en-US (only maintained UI lang)
│   └── pt/translation.json      # pt-BR (only maintained UI lang)
└── workers/
    └── onnxWorker.js            # ONNX Runtime inference (speaker embeddings)
```

## `src/helpers/` — Main Process (CommonJS)

```
src/helpers/
├── ipcHandlers.js               # Centralized IPC registration (~8700 lines)
├── whisperServer.js             # Whisper.cpp WebSocket server management
├── parakeetWsServer.js          # Parakeet/sherpa-onnx WebSocket server
├── llamaServer.js               # llama.cpp server management
├── database.js                  # better-sqlite3: transcriptions, dictionary, vocab_stats
├── audioManager.js              # Audio pipeline: recording → transcription → LLM → paste
├── hotkeyManager.js             # Global hotkeys (4 slots: dictation, agent, voiceAgent, meeting)
├── environment.js               # Env vars, API keys (safeStorage), .env persistence
├── windowsKeyManager.js         # Windows PTT via native key listener
├── gnomeShortcut.js             # GNOME Wayland hotkeys (D-Bus + gsettings)
├── hyprlandShortcut.js          # Hyprland Wayland hotkeys (D-Bus + hyprctl)
├── kdeShortcut.js               # KDE Wayland hotkeys (D-Bus + KGlobalAccel)
├── clipboard.js                 # Cross-platform paste (AppleScript / PS+nircmd / XTest+xdotool/wtype/ydotool)
├── debugLogger.js               # File logging with rotation (daily, no retention yet)
├── devServerManager.js          # Vite dev server integration
├── dragManager.js               # Window dragging (frameless overlay)
├── menuManager.js               # App menu + tray
├── tray.js                      # System tray icon/menu
├── windowConfig.js              # Window bounds/state persistence
├── windowManager.js             # BrowserWindow creation/lifecycle
├── cliBridge.js                 # Loopback HTTP 8200-8219 (CLI ↔ desktop)
├── postMigrationDetector.js     # Bundle-ID migration sentinel
├── textEditMonitor.js           # Platform text monitor (UIA/AT-SPI2/AX) for auto-learn
├── manualMeetingLauncher.js     # Manual meeting recording flow
├── meetingAecManager.js         # Acoustic echo cancellation for meetings
├── windowsLoopbackAudioManager.js
├── linuxPortalAudioManager.js
├── audioTapManager.js           # macOS Core Audio Process Tap
├── whisper.js                   # whisper.cpp CLI wrapper (legacy? check)
├── parakeet.js                  # Parakeet model management
├── parakeetServer.js            # sherpa-onnx CLI wrapper
├── llamaCudaManager.js          # CUDA runtime downloader for llama-server
├── llamaVulkanManager.js        # Vulkan runtime downloader for llama-server
├── tesseractOcrManager.js       # Tesseract.js WASM+data downloader (screen context)
├── activeWindowCapture.js       # Windows screen capture (PrintWindow)
├── activeWindowOcr.js           # OCR orchestration (native WinRT → Tesseract fallback)
├── screenContextCache.js        # In-memory OCR reuse cache (≤2s)
├── screenContextStorage.js      # On-disk screenshot persistence + retention
├── screenContextRetentionSync.js
├── autoLearnDictionary.js       # Core auto-learn logic (testable, no Electron deps)
├── dictationBatchingSession.js  # Progressive VAD batching (engine-agnostic)
├── previewVadConfig.js          # Live preview VAD settings resolution
├── whisperVadConfig.js          # Silero VAD settings resolution
├── audioCleanupPolicy.js        # Pure: decideAudioCleanup(ts, retentionDays)
├── audioRetentionSync.js        # Startup sync for audioRetentionDays
├── modelIdleTimeoutSync.js      # Startup sync for transcription/llm idle timeouts
├── dictationRouting.js          # resolveDictationRouteKind() → 'dictation'|'cleanup'|'agent'
├── parakeetModelMigration.js    # Migrate removed online models → parakeet-tdt-0.6b-v3
├── whisperBinaryInstaller.js    # Runtime whisper binary download (toast action)
├── sidecarRegistry.js           # Sidecar lifecycle registry (register/stop all)
├── sidecarPidFile.js            # PID file tracking for sidecars
├── sidecarReaper.js             # Orphaned sidecar cleanup on startup
└── onnxWorkerClient.js          # IPC client for ONNX worker process
```

## `resources/` — Native Sources & Binaries

```
resources/
├── bin/                         # Compiled/downloaded binaries (gitignored)
│   ├── whisper-cpp-win32-x64.exe
│   ├── sherpa-onnx-ws-win32-x64.exe
│   ├── llama-server-win32-x64.exe
│   ├── windows-key-listener.exe
│   ├── windows-active-window-info.exe
│   ├── windows-fast-paste.exe
│   ├── windows-system-audio-helper.exe
│   ├── nircmd.exe
│   ├── globe-listener (macOS)
│   ├── linux-key-listener
│   ├── linux-fast-paste
│   ├── linux-system-audio-helper
│   └── text-monitor (Linux/Win/macOS)
├── windows-key-listener.c       # WH_KEYBOARD_LL low-level hook
├── windows-system-audio-helper.c # WASAPI process-loopback capture
├── windows-active-window-info.c  # PrintWindow/BitBlt screenshot
├── globe-listener.swift         # macOS Globe/Fn key detection
├── linux-key-listener.c         # Linux uinput key listener
├── linux-fast-paste.c           # XTest fast paste
├── linux-system-audio-helper.c  # PipeWire loopback
├── text-monitor.c               # Cross-platform text field monitor
└── media-remote.c               # Media session integration
```

## `scripts/` — Build & Download Automation

```
scripts/
├── download-whisper-cpp.js          # GitHub releases → resources/bin/
├── download-llama-server.js
├── download-sherpa-onnx.js
├── download-nircmd.js
├── download-windows-key-listener.js
├── download-windows-fast-paste.js
├── download-windows-system-audio-helper.js
├── download-windows-active-window-info.js
├── download-meeting-aec-helper.js
├── download-diarization-models.py
├── download-whisper-vad-model.js
├── build-globe-listener.js          # swiftc compile
├── build-windows-key-listener.js    # MSVC/MinGW compile
├── build-windows-active-window-info.js
├── build-linux-key-listener.js
├── build-linux-fast-paste.js
├── build-linux-system-audio.js
├── build-text-monitor.js
├── build-media-remote.js
├── build-macos-fast-paste.js
├── build-macos-audio-tap.js
├── build-windows-fast-paste.js
├── compile-macos-icon.js
├── run-electron.js                  # Dev launcher with env cleanup
├── check-i18n.js                    # i18n key completeness check
└── lib/
    └── download-utils.js            # Shared: fetchLatestRelease, downloadFile, extractZip
```

## `test/` — Tests (Mirror `src/` Structure)

```
test/
├── helpers/
│   ├── autoLearnDictionary.test.js
│   ├── dictationBatchingSession.test.js
│   ├── parakeetModelMigration.test.js
│   ├── whisperParseResult.test.js
│   ├── pasteTextMonitorInvariant.test.js
│   ├── dictationRouting.test.js
│   ├── screenContextRetentionSettings.test.js
│   ├── screenContextRetentionSync.test.js
│   ├── tesseractOcrManager.test.js
│   ├── activeWindowCapture.test.js
│   ├── activeWindowOcr.test.js
│   ├── screenContextCache.test.js
│   ├── screenContextStorage.test.js
│   └── ipcHandlers.screenContextCleanup.test.js
├── utils/
│   ├── transcriptionQualityHeuristics.test.js
│   ├── languageSupport.test.js
│   └── correctionLearner.test.js
├── components/
│   ├── parakeetModelMigration.test.js
│   ├── prompts.screenContext.test.js
│   └── SettingsPage.test.tsx
├── models/
│   └── modelRegistry.test.js
├── setup/
│   └── tsxRegister.js               # Vitest + tsx for component tests
└── README.md
```

## `docs/` — Documentation

```
docs/
├── README.md                        # Documentation index
├── RECREATION_SPEC.md               # Authoritative current behavior (§0 = divergences)
├── architecture/
│   ├── index.md                     # This folder's index
│   ├── overview.md                  # High-level architecture
│   ├── file-map.md                  # This file
│   ├── data-flow.md
│   ├── ipc-registry.md
│   ├── settings-sync.md
│   ├── native-binaries.md
│   └── model-lifecycle.md
├── platforms/
│   ├── index.md
│   ├── windows.md
│   ├── macos.md
│   ├── linux.md
│   └── wayland-hotkeys.md
├── specs/
│   ├── index.md
│   ├── README.md
│   ├── on-demand-model-lifecycle.md
│   ├── dictation-progressive-vad-batching.md
│   ├── active-window-screen-context.md
│   ├── dynamic-prompt-vocabulary.md
│   ├── auto-learn-dictionary.md
│   ├── voice-agent-hotkey.md
│   ├── meeting-recording-manual.md
│   ├── remove-qdrant-dependency.md
│   ├── llama-server-vram-tuning.md
│   ├── dictation-language-detection-fix.md
│   ├── live-preview-vad-sensitivity.md
│   └── prompt-template-placeholders.md
├── guides/
│   ├── index.md
│   ├── development-workflow.md
│   ├── testing.md
│   ├── debugging.md
│   ├── build.md
│   ├── adding-features.md
│   └── common-issues.md
└── platforms/
    └── ... (see platforms/index.md)
```