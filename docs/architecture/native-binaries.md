# Native Binaries Reference

## Table

| Binary | Source | Build Script | Download Script | Platform | Purpose |
|--------|--------|--------------|-----------------|----------|---------|
| `whisper-cpp-*-x64.exe` | whisper.cpp | — | `download-whisper-cpp.js` | Win | Local STT |
| `sherpa-onnx-ws-*-x64.exe` | sherpa-onnx | — | `download-sherpa-onnx.js` | Win | Parakeet STT |
| `llama-server-*-x64.exe` | llama.cpp | — | `download-llama-server.js` | All | Local LLM |
| `windows-key-listener.exe` | `resources/windows-key-listener.c` | `build-windows-key-listener.js` | `download-windows-key-listener.js` | Win | PTT (WH_KEYBOARD_LL) |
| `windows-active-window-info.exe` | `resources/windows-active-window-info.c` | `build-windows-active-window-info.js` | `download-windows-active-window-info.js` | Win | Screen context capture |
| `nircmd.exe` | NirSoft | — | `download-nircmd.js` | Win | Clipboard fallback |
| `windows-fast-paste.exe` | — | `build-windows-fast-paste.js` | `download-windows-fast-paste.js` | Win | Fast paste |
| `windows-system-audio-helper.exe` | `resources/windows-system-audio-helper.c` | — | `download-windows-system-audio-helper.js` | Win | WASAPI loopback |
| `globe-listener` | `resources/globe-listener.swift` | `build-globe-listener.js` | — | macOS | Globe/Fn key |
| `linux-key-listener` | `resources/linux-key-listener.c` | `build-linux-key-listener.js` | — | Linux | uinput key listener |
| `linux-fast-paste` | `resources/linux-fast-paste.c` | `build-linux-fast-paste.js` | — | Linux | XTest paste |
| `linux-system-audio-helper` | `resources/linux-system-audio-helper.c` | `build-linux-system-audio.js` | — | Linux | PipeWire loopback |
| `text-monitor` | `resources/text-monitor.c` | `build-text-monitor.js` | — | All | Post-paste text monitor |
| `media-remote` | `resources/media-remote.c` | `build-media-remote.js` | — | All | Media session integration |

## Build vs Download Strategy

- **Compile-first**: Windows binaries (key listener, active window info, fast paste) — try local MSVC/MinGW/Clang build first, fall back to GitHub release download
- **Download-only**: whisper.cpp, sherpa-onnx, llama-server, nircmd — no local toolchain needed
- **Platform-native**: macOS (Swift), Linux (C) — compile on target platform only

## All Binaries Target

`resources/bin/` (gitignored) — copied into app at build time via `extraResources` in `electron-builder` config.

## Compile Scripts (run via `npm run compile:native`)

```bash
npm run compile:winkeys          # windows-key-listener
npm run compile:active-window-info  # windows-active-window-info
npm run compile:winpaste         # windows-fast-paste
npm run compile:globe            # globe-listener (macOS)
npm run compile:linuxkeys        # linux-key-listener
npm run compile:linux-paste      # linux-fast-paste
npm run compile:linux-system-audio # linux-system-audio-helper
npm run compile:text-monitor     # text-monitor
npm run compile:media-remote     # media-remote
```

## Download Scripts

```bash
npm run download:whisper-cpp              # current platform
npm run download:whisper-cpp:all          # all platforms
npm run download:sherpa-onnx              # current
npm run download:sherpa-onnx:all          # all
npm run download:sherpa-onnx:cuda         # CUDA variant
npm run download:llama-server             # current
npm run download:nircmd
npm run download:windows-key-listener
npm run download:windows-fast-paste
npm run download:windows-system-audio-helper
npm run download:windows-active-window-info
npm run download:meeting-aec-helper       # current
npm run download:meeting-aec-helper:all   # all
npm run download:diarization-models       # pyannote models
npm run download:whisper-vad-model        # Silero VAD
```