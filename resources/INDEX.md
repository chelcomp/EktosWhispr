# Resources Contents Index

Native source code, binaries, and build artifacts for EktosWhispr.

---

## Native Sources

| File | Language | Purpose |
|------|----------|---------|
| `windows*.c` | C | Windows native helpers (fast-paste, key-listener, text-monitor, system-audio, active-window-info) |
| `macos*.swift` | Swift | macOS native helpers (audio-tap, fast-paste, media-remote, globe-listener) |
| `linux*.c` | C | Linux native helpers (text-monitor, key-listener, system-audio) |
| `linux-text-monitor.py` | Python | Alternative Linux text monitor script |

---

## Build Artifacts

| Folder | Contents |
|--------|----------|
| `bin/` | Prebuilt native binaries (.exe, .dll, .so) |
| `bin/diarization-models/` | AI diarization model files |
| `bin/whisper-vad/` | Whisper VAD model files |
| `mac/` | macOS entitlements plist |
| `linux/` | Linux post-install/remove scripts |
| `nsis/` | NSIS installer script |

---

## Key Reference

- [`CLAUDE.md`] — Resource-specific notes and conventions
- [`../docs/architecture/native-binaries.md`](../docs/architecture/native-binaries.md) — All native binaries catalog

---

## Build Scripts

Build/download scripts live in [`scripts/`](../../scripts/). Common pattern:

```bash
npm run build:<platform>        # Compile native source
npm run download:<platform>     # Download prebuilt binary
```