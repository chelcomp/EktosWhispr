# Debugging & Logging

## Enable Debug Logging

```bash
# CLI flag
npm run dev -- --log-level=debug

# Environment variable (persist in .env)
EKTOSWHISPR_LOG_LEVEL=debug npm run dev

# Or in .env file
EKTOSWHISPR_LOG_LEVEL=debug
```

## Log Levels

| Level | Use Case |
|-------|----------|
| `error` | Crashes, failed transcriptions, IPC failures |
| `warn` | Fallbacks triggered, missing optional binaries |
| `info` | Startup, model loads, hotkey registrations, cleanup runs |
| `debug` | Audio pipeline, VAD decisions, IPC payloads, LLM request/response |

## Log File Locations

| Platform | Path |
|----------|------|
| Windows | `%APPDATA%\EktosWhispr\logs\` (dev: `EktosWhispr-development`) |
| macOS | `~/Library/Logs/EktosWhispr/` |
| Linux | `~/.config/EktosWhispr/logs/` |

Files: `ektoswhispr-YYYY-MM-DD.log` (daily rotation). **No automatic retention yet** (gap per Premise #7).

## Key Log Categories (Prefix in Log Lines)

| Prefix | Subsystem |
|--------|-----------|
| `[audio]` | Recording, FFmpeg, temp files |
| `[whisper]` / `[parakeet]` | Model loading, transcription calls |
| `[llama]` | llama-server start/stop, inference |
| `[ipc]` | IPC handler invocations |
| `[hotkey]` | Global hotkey registration/events |
| `[meeting]` | Meeting/Note recording flow |
| `[screen-context]` | Window capture, OCR, cache hits |
| `[dictation-batching]` | VAD segmentation, merge/retry, tail finalize |
| `[auto-learn]` | Correction detection, oscillation guard |
| `[cleanup]` | Audio/screenshot retention purges |

## Common Debug Flows

### Audio Not Detected
1. Check `[audio]` logs for FFmpeg path resolution
2. Verify microphone permissions (OS)
3. Check audio levels in debug output

### Transcription Fails
1. `[whisper]` / `[parakeet]` for binary availability
2. Model downloaded? (`~/.cache/ektoswhispr/whisper-models/`)
3. Temp file creation permissions
4. FFmpeg executable

### Clipboard Not Working
- macOS: Accessibility permissions (AppleScript)
- Linux: `xdotool`/`wtype`/`ydotool` installed? XWayland vs native Wayland
- Windows: PowerShell SendKeys or `nircmd.exe` present?

### Build Issues
- `npm run pack` for unsigned (`CSC_IDENTITY_AUTO_DISCOVERY=false`)
- Signing needs Apple Developer account
- ASAR unpack for FFmpeg
- `npm run download:whisper-cpp` before packaging
- **Node 26** for `npm install` (matches CI via `.nvmrc`)

## Debugging Native Sidecars

Sidecars log to stderr (captured in main process logs). For verbose sidecar debugging, run binary directly:

```bash
# Whisper
./resources/bin/whisper-cpp-win32-x64.exe --help

# Parakeet
./resources/bin/sherpa-onnx-ws-win32-x64.exe --help

# llama-server
./resources/bin/llama-server-win32-x64.exe --help
```