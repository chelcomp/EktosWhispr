# Build & Packaging

## Prerequisites

- **Node 26** (pinned in `.nvmrc`; CI reads via `node-version-file`)
- Never regenerate `package-lock.json` with different major version
- Use `nvm exec 26 npm install` if local Node differs

## Development Build

```bash
# Full dev (compiles natives + downloads deps + starts Electron + Vite)
npm run dev

# Renderer only (Vite)
npm run dev:renderer

# Main only (Electron)
npm run dev:main
```

## Pre-Build (Required)

```bash
# Compile all native binaries
npm run compile:native

# Download runtime binaries for current platform
npm run download:whisper-cpp
npm run download:llama-server
npm run download:sherpa-onnx
npm run download:meeting-aec-helper
npm run download:whisper-vad-model
npm run download:diarization-models -- --output-dir resources/bin/diarization-models
```

## Packaging

| Command | Output | Signing |
|---------|--------|---------|
| `npm run pack` | Unsigned `dist/win-unpacked/` etc. | `CSC_IDENTITY_AUTO_DISCOVERY=false` (skipped) |
| `npm run build` | Signed + installer | Requires certs (Apple Developer, Windows EV, etc.) |
| `npm run build:mac` / `:win` / `:linux` | Platform-specific | Same |

## Build Scripts (package.json)

| Script | Purpose |
|--------|---------|
| `prebuild` | Compile natives + download all binaries (current platform) |
| `build:renderer` | `cd src && vite build` |
| `build` | `build:renderer` + `electron-builder` |
| `prepack` | Same as `prebuild` |
| `pack` | `build:renderer` + `electron-builder --dir` (unsigned) |
| `predist` | Same as `prebuild` |
| `dist` | `build:renderer` + `electron-builder` (signed) |

## Electron Builder Config

Key points (in `package.json` → `build`):
- `asarUnpack: ["**/node_modules/ffmpeg-static/**"]` — FFmpeg must be outside ASAR
- `extraResources: ["resources/bin/**"]` — native binaries bundled
- `afterSign.js` — skips signing when `CSC_IDENTITY_AUTO_DISCOVERY=false`

## Platform-Specific

### Windows (NSIS)
- `prebuild:win` adds: nircmd, windows-key-listener, windows-fast-paste, windows-system-audio-helper, windows-active-window-info
- Installer: NSIS

### macOS (DMG + .app)
- `prebuild:mac` adds: globe-listener, macOS fast-paste, audio-tap
- `compile:mac-icon` for .icns
- Notarization: `@electron/notarize` (requires Apple Developer)

### Linux (AppImage / deb / rpm / tar.gz)
- `prebuild:linux` same as base + linux binaries
- AppImage default; `build:linux:deb` etc. for packages

## Common Issues

| Issue | Fix |
|-------|-----|
| `package-lock.json` mismatch CI | `nvm exec 26 npm install` |
| FFmpeg not found | `asarUnpack` config + `ffmpeg-static` in deps |
| Native binary missing | Run `npm run compile:native` + download scripts |
| Signing fails | `CSC_IDENTITY_AUTO_DISCOVERY=false` for unsigned dev builds |

## Binary Download Scripts

All in `scripts/` — use `GITHUB_TOKEN` env for higher rate limits:
```bash
GITHUB_TOKEN=ghp_xxx npm run download:whisper-cpp
```