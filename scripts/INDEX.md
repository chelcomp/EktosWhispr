# Scripts Contents Index

Build scripts, download scripts, and CDP validation tools for EktosWhispr.

---

## Build & Download Scripts

### Windows Build Scripts
| File | Purpose |
|------|---------|
| `build-windows-fast-paste.js` | Build Windows fast-paste native helper |
| `build-windows-key-listener.js` | Build Windows key listener native helper |
| `build-windows-text-monitor.js` | Build Windows text monitor native helper |
| `build-windows-system-audio.js` | Build Windows system audio helper |
| `download-windows-fast-paste.js` | Download prebuilt Windows fast-paste binary |
| `download-windows-key-listener.js` | Download prebuilt Windows key listener |
| `download-windows-system-audio-helper.js` | Download Windows system audio helper |

### macOS Build Scripts
| File | Purpose |
|------|---------|
| `build-macos-audio-tap.js` | Build macOS audio tap |
| `build-macos-fast-paste.js` | Build macOS fast-paste helper |
| `build-macos-text-monitor.js` | Build macOS text monitor |
| `compile-macos-icon.js` | Compile macOS app icon |
| `download-macos-fast-paste.js` | Download macOS fast-paste binary |

### Linux Build Scripts
| File | Purpose |
|------|---------|
| `build-linux-fast-paste.js` | Build Linux fast-paste helper |
| `build-linux-key-listener.js` | Build Linux key listener |
| `build-linux-system-audio.js` | Build Linux system audio helper |
| `build-linux-text-monitor.js` | Build Linux text monitor |

### Cross-Platform Scripts
| File | Purpose |
|------|---------|
| `afterPack.js` | Electron-builder hook: strip unused binaries, wrap Linux binary, verify binaries |
| `download-whisper-cpp.js` | Download whisper.cpp binaries |
| `download-llama-server.js` | Download llama-server binaries |
| `download-sherpa-onnx.js` | Download sherpa-onnx models |
| `download-diarization-models.js` | Download diarization models |
| `complete-uninstall.sh` | Uninstall script for all components |
| `run-electron.js` | Run Electron app |

---

## Model & Asset Download Scripts
| File | Purpose |
|------|---------|
| `download-windows-active-window-info.js` | Download Windows active window info binary |
| `download-meeting-aec-helper.js` | Download meeting AEC helper binary |
| `download-whisper-vad-model.js` | Download Whisper VAD model |

---

## CDP Validation Scripts (Chrome DevTools Protocol)
| File | Purpose |
|------|---------|
| `cdp_check.js` | Basic CDP connection test |
| `cdp_check2.js` | CDP validation with assertions |
| `cdp_v2.js` | UI validation via CDP Runtime.evaluate |
| `cdp_v3.js` | UI validation variant |
| `cdp_v4.js` | UI validation variant |
| `cdp_final.js` | Final verification script |
| `cdp_final2.js` | Final verification variant |
| `cdp_settings_smoke.js` | Settings persistence smoke test |
| `check_css.js` | CSS layout verification |

---

## Library Scripts (internal tools)
| File | Purpose |
|------|---------|
| `lib/download-utils.js` | Download utility functions |
| `lib/linux-launcher.js` | Linux app launcher wrapper |
| `lib/meeting-aec-build.js` | Meeting AEC helper builder |

---

## Related

- [`../docs/architecture/native-binaries.md``](../docs/architecture/native-binaries.md) — All native binaries

---

## Usage Convention

- **build-*.js**: Compile native source from `resources/native/`
- **download-*.js**: Fetch prebuilt binaries or models from releases
- **cdp-*.js**: Validate Electron UI via Chrome DevTools Protocol without vision
- **check-*.js**: Verification/validation scripts