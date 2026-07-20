# Whisper Binary Missing UX (Copy-Error Button + Missing whisper-server Recovery)

## Status
Implemented

## TL;DR
Two related fixes from the same debug session where a "Transcription Error" toast
("whisper-server binary not found...") appeared with no way to recover or even copy the
error text reliably:

- **Copy-error button**: the destructive toast's Copy icon (`Toast.tsx`) silently
  swallows clipboard failures (bare `try {} catch {}`, `navigator.clipboard.writeText`
  only). Fix: try the existing IPC-exposed `window.electronAPI.writeClipboard` (backed
  by `clipboard.js`, already used by `TranscriptionPreviewOverlay.tsx`) first, fall back
  to `navigator.clipboard`, and if both fail, show a visible failure state instead of
  swallowing the error.
- **Missing whisper-server binary**: today this is a dead end — a hard error with no
  recovery path other than a dev-only npm script. Fix: add a user-triggered, in-toast
  "Download" action that fetches the missing `whisper-server` binary at runtime from the
  same GitHub release build scripts already use, with a visible progress indicator, into
  a user-writable location (`userData/bin/`) that `WhisperServerManager` already knows to
  check (mirrors the existing CUDA-binary lookup there).
- Scope is explicitly limited to `whisper-server` (the reported case). `llama-server`
  hits the identical unstructured-error gap and is called out as a documented follow-up,
  not implemented here.
- No blocking open question — both fixes reuse existing, already-shipped mechanisms
  (`writeClipboard` IPC, the `download-whisper-model` progress-event pattern, the
  `userData/bin` binary lookup precedent). One design call made without escalating:
  the runtime download always fetches whisper.cpp's **latest** GitHub release (no
  version pinning at runtime) — see Design for the accepted-risk reasoning.
- Practical impact: users whose install is missing the whisper-server binary (partial
  install, AV quarantine, manual deletion) get a working "Download" button right in the
  error toast instead of being stuck; the Copy-error button now reliably works or visibly
  tells the user it didn't.

## Problem / Goal

1. `src/components/ui/Toast.tsx`'s `handleCopyError` (~line 195-202) wraps
   `navigator.clipboard.writeText(description)` in `try {} catch {}` with zero feedback
   on failure. In an Electron renderer, `navigator.clipboard.writeText` can silently fail
   depending on focus/permission state. The app already has a more reliable path
   (`window.electronAPI.writeClipboard` → `src/helpers/clipboard.js`, IPC-registered in
   `ipcHandlers.js` at `write-clipboard`) that other components
   (`TranscriptionPreviewOverlay.tsx`, `src/services/tools/clipboardTool.ts`) already use,
   but `Toast.tsx` doesn't.

2. When `WhisperServerManager.isAvailable()` is false (binary missing from
   `resources/bin/`), `WhisperManager.transcribeLocalWhisper()`
   (`src/helpers/whisper.js:311`) throws `"whisper-server binary not found. Please ensure
   the app is installed correctly."` with no recovery path besides the dev-only
   `npm run download:whisper-cpp` script. Compounding this, the error's structured
   `code` is dropped along the way:
   - `ipcHandlers.js`'s `transcribe-local-whisper` handler's catch block pattern-matches
     specific substrings (`"FFmpeg not found"`, `"whisper.cpp not found"`/`"whisper-cpp"`,
     `"model" + "not downloaded"`) to return a structured `{success:false, error, message}`
     — but the actual thrown message ("whisper-server binary not found...") doesn't match
     any branch, so it falls through to an unstructured `throw error`.
   - Even if it matched, `audioManager.js`'s `transcribeLocalWhisper()` caller re-wraps the
     error twice (`throw new Error(result.message || result.error || ...)` then, in the
     outer catch, `throw new Error(\`Local Whisper failed: ${error.message}\`)`) without
     ever copying a `.code` property forward, so `useAudioRecording.js`'s `onError` handler
     and `recordingErrors.ts`'s `getRecordingErrorTitle`/`getRecordingErrorDescription`
     (which already branch on `error.code` for `NETWORK_ERROR`, `AUTH_EXPIRED`, etc.) have
     no way to recognize this case today even if we wanted to.

## Requirements

### Issue 1 — Copy-error button
- R1.1: `Toast.tsx`'s copy-error action must try `window.electronAPI.writeClipboard` (when
  present) before falling back to `navigator.clipboard.writeText`.
- R1.2: If both paths fail, the user must see a visible failure indication (not a silent
  no-op) — the Copy icon swaps to a distinct "failed" state for ~2s (mirroring the
  existing success-state `Check` icon swap), and the failure is logged via the app's
  existing debug logger path so it's visible in Settings → Developer logs, not just
  `console.warn`.
- R1.3: The clipboard-write-with-fallback logic must be extracted into a small,
  dependency-injected pure function so it's unit-testable without a DOM/Electron
  renderer harness (there is none in this repo's `test/` — see Validation Plan).

### Issue 2 — Missing whisper-server binary recovery
- R2.1: When `WhisperServerManager`'s missing-binary error reaches the renderer, it must
  carry a recognizable `code` (`WHISPER_SERVER_BINARY_MISSING`) end-to-end: from the
  throw site, through `ipcHandlers.js`'s catch-block classification, through
  `audioManager.js`'s two rethrow points, to `useAudioRecording.js`'s `onError` handler.
- R2.2: The destructive toast shown for this code must include a "Download" action
  button (using the toast's existing `action` slot, same pattern as the
  "Undo"-correction toast in `App.jsx`) that triggers a runtime download+install of the
  missing `whisper-server` binary for the current platform/arch.
- R2.3: The download must show visible progress (percent) in the toast, must be
  triggered only by explicit user click (never automatic/background), and must not retry
  automatically in a loop on failure — one click, one attempt; the user can click again
  to retry.
- R2.4: On success, show a follow-up toast telling the user the fix is installed and to
  try dictating again (no automatic re-trigger of a recording).
- R2.5: The downloaded binary must land in a location `WhisperServerManager` already
  checks or is extended to check, without requiring elevated permissions (packaged app's
  `resources/bin/` may not be writable post-install on some platforms/installers).
- R2.6: Scope is `whisper-server` only. `llama-server` (`modelManagerBridge.js`, same
  exact message shape and same missing-`.code` gap) is explicitly out of scope; call out
  as a documented follow-up in this spec, not implemented now.
- R2.7: No new polling or always-on background service; the existing startup
  `logDependencyStatus()` single check in `WhisperManager.init()` is unchanged.

## Non-goals

- Not implementing the analogous fix for `llama-server` or `sherpa-onnx` binaries in this
  spec (follow-up).
- Not adding a general-purpose "Settings → Diagnostics → Repair All" panel; the fix is
  scoped to the in-toast action for this one error, though the new download plumbing is
  written so a future diagnostics panel could call the same IPC handler.
- Not changing whisper-server's CLI args, model-download flow, or any other part of the
  transcription pipeline.
- Not adding version pinning/rollback for the runtime-downloaded binary — always fetches
  latest matching the same `OpenWhispr/whisper.cpp` release build scripts already target.

## Design

### Issue 1 — Copy-error button

New file `src/helpers/clipboardCopyFallback.ts` (or `.js`; TS preferred to match
`recordingErrors.ts`'s convention of small renderer-side pure-logic files under
`src/utils/` — place this one under `src/helpers/` alongside `clipboard.js` since it's
clipboard-specific, or `src/utils/` if that reads more consistently with
`recordingErrors.ts`; either is acceptable, `spec-executor` should follow whichever
existing sibling file naming reads more naturally at implementation time and stay
consistent with nearby imports). It exports a single async function, something like
`copyTextWithFallback(text, deps)`, where `deps` supplies the two write functions plus a
logger, all defaulted to the real `window.electronAPI.writeClipboard` /
`navigator.clipboard.writeText` / the app's `debugLogger`-equivalent renderer logging
path, but override-able by tests. Behavior:

1. If an Electron clipboard-write function is available, try it first; treat both a
   thrown error and a `{success: false}}`-shaped result as failure (matching
   `TranscriptionPreviewOverlay.tsx`'s existing `handleCopy` precedent at line ~206-220,
   which already implements exactly this precedence and is the reference implementation
   to follow/extract from — consider refactoring `TranscriptionPreviewOverlay.tsx` to use
   the same extracted helper instead of keeping two near-duplicate implementations, since
   it already has the identical two-tier fallback).
2. If that fails or is unavailable, try `navigator.clipboard.writeText`.
3. If both fail, call the injected logger with a warning (not swallowed) and return a
   failure result; do not throw.

`Toast.tsx`'s `handleCopyError` calls this helper. On success it keeps the existing
`copied` state swap (Copy → Check icon, ~2s). On failure, add a sibling `copyFailed`
state that swaps the icon to a distinct failure affordance (e.g. `AlertTriangle` from
`lucide-react`, already a dependency) for ~2s, so the user gets visible feedback either
way — no toast-within-a-toast needed, keeping this self-contained within the `Toast`
component (it does not need `useToast()`/`ToastContext` for this).

### Issue 2 — Missing whisper-server binary recovery

**Error code plumbing (R2.1):**

- `src/helpers/whisperServer.js`: at the two throw sites for a missing binary
  (`_doStart()`'s `if (!serverBinary) throw new Error(...)`, and any equivalent in
  `isAvailable()`-adjacent callers), attach `err.code = "WHISPER_SERVER_BINARY_MISSING"`
  to the thrown `Error` before throwing.
- `src/helpers/whisper.js`: `transcribeLocalWhisper()`'s existing
  `if (!this.serverManager.isAvailable())` throw gets the same `.code` attached.
- `ipcHandlers.js`'s `transcribe-local-whisper` catch block: extract the existing
  substring-matching classification (FFmpeg/whisper-cpp/model-not-downloaded branches)
  into a small pure function, e.g. `src/helpers/whisperErrorClassifier.js` exporting
  `classifyLocalWhisperError(error)` → `{success:false, error, code, message}` (or
  `null` if unrecognized, in which case the handler still does `throw error` as today).
  Add a new branch recognizing `error.code === "WHISPER_SERVER_BINARY_MISSING"` (checked
  before/alongside the message-substring checks) that returns
  `{success:false, error:"whisper_server_binary_missing", code:"WHISPER_SERVER_BINARY_MISSING", message: error.message}`.
  This both fixes today's silent fall-through for this exact message and makes the
  classification logic unit-testable directly (see Validation Plan) without needing an
  ipcHandlers-level test harness (none exists in this repo today).
- `src/helpers/audioManager.js`'s `processTranscription`-adjacent local-whisper path: at
  both rethrow points identified in Problem/Goal, copy `code` forward onto the new
  `Error` object (`newErr.code = result.code` in the inner rethrow,
  `newErr.code = error.code` in the outer `"Local Whisper failed: ..."` wrap) so it
  survives both layers of wrapping.
- `src/utils/recordingErrors.ts`: add a branch in both `getRecordingErrorTitle` and
  `getRecordingErrorDescription` for `error.code === "WHISPER_SERVER_BINARY_MISSING"`,
  returning new i18n keys (see below) instead of the generic passthrough.

**Runtime download (R2.2-R2.5):**

- New file `src/helpers/whisperBinaryInstaller.js` (main-process, CommonJS, matching
  sibling helpers' style). It owns:
  - A `BINARIES` map identical in shape to `scripts/download-whisper-cpp.js`'s (same
    zip/binary names per `platform-arch`), so both build-time and runtime installs target
    the exact same release assets from `OpenWhispr/whisper.cpp`.
  - A `downloadServerBinary(onProgress)` method that: resolves the current
    `platform-arch`, fetches the latest release from `OpenWhispr/whisper.cpp` (reusing
    `fetchLatestRelease`, `downloadFile`, `extractZip`, `findBinaryInDir`,
    `setExecutable` — port the specific functions needed from
    `scripts/lib/download-utils.js` into this new runtime-safe helper rather than
    `require()`-ing across the `scripts/` → `src/` boundary, since `scripts/` is a
    dev/build-time tree with no packaging guarantee inside the ASAR; keep the two copies
    logically identical and note the duplication in a code comment pointing at the
    build-time source of truth, since deduplicating them into one shared module is a
    reasonable but separate refactor, not required for this fix), reports progress via
    the `onProgress(percent)` callback (adapt `downloadFile`'s current
    `process.stdout.write` progress reporting to invoke a callback instead), extracts to
    a temp dir under `app.getPath("userData")`, and copies the resulting binary to
    `path.join(app.getPath("userData"), "bin", <binaryName>)`, matching the existing
    naming convention `getServerBinaryPath()` already uses for the CUDA binary at that
    same `userData/bin` location. Sets it executable via the existing
    `setExecutable`-equivalent (`fs.chmodSync(..., 0o755)` on non-Windows).
  - No retry loop inside this method — a single attempt; the caller (IPC handler) does
    not auto-retry either.
- `WhisperServerManager.getServerBinaryPath()`: extend the existing candidate list to
  also check `path.join(app.getPath("userData"), "bin", binaryName)` (non-CUDA, generic
  binary name) as a candidate after the `resources/bin` ones, mirroring how the
  CUDA-specific `preferCuda` branch already looks in `userData/bin` — so a
  runtime-installed binary is picked up by `isAvailable()`/`_doStart()` with no other
  changes needed.
- New IPC handler `download-whisper-server-binary` in `ipcHandlers.js` (same file/section
  as the existing `download-whisper-model` handler, following its exact progress-event
  pattern): invokes `whisperBinaryInstaller.downloadServerBinary(percent => event.sender.send("whisper-server-download-progress", {type:"progress", percent}))`, sending a
  `{type:"complete"}` event on success or `{type:"error", error: err.message}` on
  failure, and returning `{success, error}` to the awaiting renderer call (mirrors
  `download-whisper-model`'s dual reporting: streamed events for live UI + a final
  resolved promise). Register the corresponding `downloadWhisperServerBinary` /
  `onWhisperServerDownloadProgress` bindings in `preload.js`, matching the existing
  `download-whisper-model`/`whisper-download-progress` pair's naming style.

**Toast UI (R2.2-R2.4):**

- `useAudioRecording.js`'s `onError` handler: when `error.code ===
"WHISPER_SERVER_BINARY_MISSING"`, pass an `action` into the `toast({...})` call — a small
  button (styled like `App.jsx`'s existing "Undo" action button) whose `onClick`:
  1. Calls `window.electronAPI.downloadWhisperServerBinary()`.
  2. Subscribes to `onWhisperServerDownloadProgress` to update button/toast text with the
     percent while in flight (e.g. swap the button label to `Downloading… 42%`).
  3. On `{type:"complete"}`/resolved success, dismiss the current toast and fire a new
     success-variant toast (e.g. "Whisper is ready — try dictating again").
  4. On failure, leave the original destructive toast in place (or replace with a fresh
     one) showing the failure message; the button remains clickable for a manual retry
     (no automatic retry timer).
- New i18n keys under `en`/`pt` `translation.json` for: the new error title/description
  (`hooks.audioRecording.errorTitles.whisperServerBinaryMissing` /
  a matching description key), the action button's idle/in-progress/label text, and the
  success-follow-up toast copy.

**Compliance with Non-Negotiable Product Premises:**

- **#1 Privacy**: the download is a direct fetch from the project's own GitHub release
  (`OpenWhispr/whisper.cpp`), the identical repo/assets already fetched at build time by
  `scripts/download-whisper-cpp.js` — not a third-party or telemetry endpoint. It fires
  only on explicit user click of the toast's "Download" button, never automatically or
  in the background, satisfying "visible to and controlled by the user, not fired
  automatically without notice."
- **#2 Performance/idle budget**: no new polling loop or always-on service; this is a
  one-shot action gated on user click. `WhisperManager.init()`'s existing single
  dependency-status check at startup is unchanged.
- **#5 Graceful degradation**: this spec *is* the missing fallback path called for by
  this premise. Because whisper-server is not optional for local transcription (it's the
  default engine, not a nice-to-have), the correct "fallback" here is a guided repair
  action rather than a silent no-op/degrade — consistent with the premise's own framing
  that failures "must never crash the app or block its core function," which today it
  does (dead-end error) until this fix lands.
- **#6 Migration safety**: no settings/schema/persisted-format change; not applicable.
- Accepted risk, stated explicitly: the runtime download always targets whisper.cpp's
  *latest* GitHub release, with no version pinning (unlike
  `scripts/download-whisper-cpp.js`'s `WHISPER_CPP_VERSION` override, which is a
  build/CI-time-only concern). This means a runtime-repaired install could end up on a
  slightly newer whisper-server build than one from an older packaged release. This is
  judged acceptable because: whisper-server's CLI flags used by
  `buildWhisperServerArgs()` are stable across recent releases, and the alternative
  (pinning to the exact version last known at app-build time, which isn't recorded
  anywhere at runtime today) would require new bookkeeping for no clear benefit — flagged
  here rather than silently decided.

**Follow-up (explicitly out of scope, documented per R2.6):** `llama-server`
(`src/helpers/modelManagerBridge.js` lines ~95 and ~334) throws the identical
unstructured `"llama-server binary not found. Please ensure the app is installed
correctly."` message with the same missing-`.code` gap. A near-identical fix (attach a
`LLAMA_SERVER_BINARY_MISSING` code, classify it in whatever IPC handler surfaces it,
extend `LlamaServerManager`'s binary lookup to check `userData/bin`, add a parallel
`download-llama-server-binary` IPC action) is a reasonable follow-up spec, not bundled
into this one to keep this change reviewable and scoped to the one reported error.

## Validation Plan

### Automated

- `test/helpers/clipboardCopyFallback.test.js` (new, `node --test`, mirrors the
  dependency-injection convention in `test/helpers/audioRetentionSync.test.js` /
  `llamaServer.test.js`):
  - Electron clipboard write succeeds → returns `{success:true, method:"electron"}`
    without ever calling the navigator fallback.
  - Electron clipboard write throws/returns `{success:false}` → falls back to navigator
    write, which succeeds → returns `{success:true, method:"navigator"}`.
  - Both paths fail → returns `{success:false}` and the injected logger was called
    exactly once with a warning (regression-locks "never silently swallow," which is the
    exact bug being fixed — this test fails against today's bare `try{}catch{}` and
    passes after the fix).
  - Electron write function absent entirely (e.g. non-Electron/test context) → falls
    straight through to navigator without throwing.

- `test/helpers/whisperErrorClassifier.test.js` (new): unit tests for
  `classifyLocalWhisperError()` covering:
  - The exact message `"whisper-server binary not found. Please ensure the app is
    installed correctly."` with `.code === "WHISPER_SERVER_BINARY_MISSING"` set →
    returns `{success:false, error:"whisper_server_binary_missing",
    code:"WHISPER_SERVER_BINARY_MISSING", message}` (this is the regression test for
    today's silent fall-through — fails before the fix, since no branch currently
    recognizes this message/code combination, and passes after).
  - Existing FFmpeg/model-not-downloaded cases continue to classify as before (protects
    against regressing the working branches while refactoring them into the new pure
    function).
  - An unrecognized error returns `null` (handler still rethrows raw).

- `test/helpers/whisperServer.test.js` (new, following the `llamaServer.test.js`
  mocking pattern for `WhisperServerManager`): `_doStart()` throws an `Error` whose
  `.code === "WHISPER_SERVER_BINARY_MISSING"` when `getServerBinaryPath()` resolves to
  `null` (mock `fs.existsSync`/candidates to simulate no binary present in any
  candidate location, including the new `userData/bin` candidate).

- `test/helpers/whisperBinaryInstaller.test.js` (new): `downloadServerBinary()`'s
  progress-callback plumbing and single-attempt-no-retry behavior, using an injected
  fake `downloadFile`/`extractZip`/`fetchLatestRelease` (same mocking style as
  `llamaServer.test.js`'s fake `spawn`) — asserts progress callback receives increasing
  percentages, asserts a failure rejects without retrying internally, and asserts the
  final binary path matches `userData/bin/<expected-name>`.

- `getServerBinaryPath()`'s new `userData/bin` candidate: extend the existing
  `whisperServerVadArgs.test.js` or add a small case in the new `whisperServer.test.js`
  asserting a binary present only at the `userData/bin` candidate path (not
  `resources/bin`) is still found and returned.

### Manual

1. Rename/move the local `whisper-server` binary out of `resources/bin/` (or point
   `getServerBinaryPath()`'s candidates at a temp dir for testing) and start a
   dictation. Confirm the destructive toast now shows a "Download" action button.
2. Click "Download". Confirm the button/toast shows live progress percentages, and that
   no recording auto-starts during or immediately after the download.
3. Confirm on completion a success toast appears, and that the binary is now present at
   `<userData>/bin/whisper-server-<platform>-<arch>` (or generic name) and executable.
4. Start a dictation again without any other change; confirm it now transcribes
   successfully (no restart required).
5. Simulate a download failure (e.g. disconnect network mid-download) and confirm the
   toast shows a clear failure message, the button remains clickable for a manual retry,
   and no automatic retry loop occurs.
6. In the destructive toast for any other error containing a long message, click the
   Copy icon: confirm the message lands on the OS clipboard (paste into another app). If
   `window.electronAPI.writeClipboard` is forced to fail (e.g. via a temporary console
   override for manual testing) and `navigator.clipboard` also unavailable, confirm the
   icon visibly swaps to a failure state instead of doing nothing.

### Docs

- `CLAUDE.md`: no changes required to this exact section, but if implemented, add a short
  note under "Debug Mode"/"Common Issues and Solutions" §2 ("Transcription Fails")
  pointing at the new in-toast recovery flow as the first thing to try before
  `npm run download:whisper-cpp`.
- `docs/RECREATION_SPEC.md`: update §0/relevant section once implemented to reflect that
  a missing whisper-server binary now has a runtime repair path (current behavior:
  dead-end error) — this is exactly the kind of "current vs. target" divergence that
  section tracks.

## Open Questions

- None blocking. The only judgment call made without escalating (runtime download always
  targets the latest whisper.cpp release, no version pinning) is documented above under
  Design's "Accepted risk" paragraph — flagged for visibility, not blocking approval.
