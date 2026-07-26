# GitHub Copilot Instructions for EktosWhispr

## Project Overview

EktosWhispr is an Electron-based desktop dictation application using whisper.cpp for speech-to-text transcription. Privacy-first, no telemetry, no cloud unless BYOK (Bring Your Own Key).

## Key Rules

1. **Privacy**: No data leaves the user's PC unless explicitly opted in. No telemetry. No silent network calls.
2. **Performance**: Idle budget ≤300 MB RAM, <2% CPU. Prefer event-driven APIs over polling.
3. **Speed**: Raw transcription must be ≤500 ms for fast engines (tiny/base Parakeet GPU).
4. **Single Instance**: Never break `app.requestSingleInstanceLock()`.
5. **Graceful Degradation**: Every optional binary must have a fallback.

## Development Commands

```bash
npm install          # Install dependencies (root only)
npm start            # Start Electron app
npm test             # Run tests (Node built-in test runner)
npm run lint         # Lint code
npm run typecheck    # TypeScript type checking
```

## Architecture

- **Electron 41** dual-window: main (overlay dictation) + control panel (settings/history)
- **CommonJS** in `src/helpers/` and main process; **ESM** in `src/` renderer; **TypeScript** for React
- **IPC** is the only bridge: `preload.js` exposes `window.api.*`
- **Local STT**: whisper.cpp and Parakeet via sherpa-onnx; both lazy-loaded on demand
- **Local LLM**: llama-server; on-demand with idle timeout
- **Database**: better-sqlite3 for transcription history

## File Structure

- `main.js` - Application entry point
- `src/helpers/ipcHandlers.js` - Centralized IPC handler registration
- `src/helpers/whisperServer.js` - Whisper integration
- `src/helpers/parakeetWsServer.js` - Parakeet integration
- `src/helpers/llamaServer.js` - LLM server
- `src/helpers/database.js` - SQLite operations
- `src/components/` - React components
- `test/` - Test files (Node built-in test runner)

## Testing

- Test runner: Node built-in test runner (`node:test` + `node:assert`)
- Test files: `test/` directory, mirrored structure
- Run single test: `node --test test/helpers/autoLearnDictionary.test.js`
- Component tests use `@testing-library/react` and `vitest`
- Every bugfix and new feature must ship a regression test

## Important Notes

- Node version pinned to 26 in `.nvmrc`
- Never regenerate `package-lock.json` with a different major version
- `RECREATION_SPEC.md` §0 lists known divergences from `CLAUDE.md` — check it first
- Screen context (§20) is Windows-only, default ON
- On-demand model lifecycle: engines cold-start on hotkey-down, idle-unload after timeout