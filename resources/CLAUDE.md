# Native Resources

This directory contains C/Swift source files for platform-specific native binaries.

## Source Files

- `windows-key-listener.c`: Windows low-level keyboard hook (Push-to-Talk)
- `windows-system-audio-helper.c`: WASAPI process-loopback system audio capture (meeting transcription)
- `globe-listener.swift`: macOS Globe/Fn key detection
- `windows-active-window-info.c`: Active-window screen-context capture helper (§20)

## Binary Directory

- `bin/`: Compiled native binaries (whisper-cpp, nircmd, key listeners)

## Build Process

Native resources are compiled via scripts in `scripts/`:
- `build-windows-key-listener.js`
- `build-windows-active-window-info.js`
- `build-globe-listener.js`

Prebuilt binaries are downloaded from GitHub releases when local compilation is unavailable.
