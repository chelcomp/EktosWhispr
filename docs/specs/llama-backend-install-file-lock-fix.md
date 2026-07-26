# Fix EBUSY on llama-server backend binary install (CUDA/Vulkan) due to shared bin-dir DLL locks

## Status
Draft

## TL;DR
Downloading the CUDA (or Vulkan) llama-server binary can fail with `EBUSY: resource busy or
locked, copyfile ... ggml-base.dll` because CUDA, Vulkan, and CPU backends all share one `bin/`
directory, and any currently-running `llama-server-*.exe` (of *any* backend, not just the one
being installed) keeps the shared `ggml-*.dll` files memory-mapped, blocking Windows from
overwriting them.

- What's changing: before copying newly-downloaded binaries/libs into the shared `bin/`
  directory, forcibly clear **every** `llama-server*` process holding a lock on that directory —
  both the one this app session is tracking in memory (`serverManager`) and any **untracked
  orphan** (e.g. a process left over from a prior crashed/killed session, or one whose pid-file
  entry was already cleared by `sidecarReaper` at startup after only a fire-and-forget
  `SIGTERM`). The reproduced bug was caused by exactly this untracked-orphan case — the
  in-memory `activeBackend` check alone (today's code, and a same-shaped in-memory-only widening
  of it) cannot see or stop a process this session never spawned. Orphan termination is scoped
  strictly to processes whose executable **path** matches one of this app's own installed binaries
  under `bin/` — never by image/basename alone, since the CPU backend's binary is the unrenamed,
  stock `llama-server.exe` name, and an unrelated llama.cpp process the user is running for their
  own purposes must never be force-killed. Add a short retry-with-backoff
  around the copy step only as a secondary cushion for DLL-unmap lag after a kill, not as the
  primary mechanism. Failures surface a clear, actionable error instead of a raw `EBUSY` stack.
- Concrete decisions:
  - Replace the existing narrow, in-memory-only "stop server before download" guard
    (`activeBackend === "<thisBackend>"` in `download-llama-cuda-binary` /
    `download-llama-vulkan-binary` / the two `delete-llama-*-binary` handlers) with a single
    shared pre-install routine that does two things, in order: (1) stop the tracked server via
    `modelManager.stopServer()` regardless of which backend is currently active (the conflict is
    on the shared `bin/` dir, not backend identity), and (2) on Windows, enumerate running
    processes whose **full executable path** matches one of this app's own installed binaries
    under `bin/` (never by image name/basename alone — see below), not relying on the sidecar pid
    file, which may already be empty by this point, forcibly terminate any matches, and poll until
    they're confirmed gone (with a bounded timeout) before returning. Since the app enforces a
    single Electron instance, any process running one of *this app's own* binaries that this
    session isn't tracking is by definition a safe-to-kill orphan — but a same-named process
    running from elsewhere (e.g. a user's own llama.cpp) is not ours to touch.
  - Extract this into one shared helper (new small module, e.g.
    `src/helpers/llamaBinaryInstallLock.js`) used by both `llamaCudaManager`-triggering and
    `llamaVulkanManager`-triggering IPC handlers, rather than duplicating the logic — single
    choke point for any future backend.
  - Scope the OS-level process-scan-and-kill step to `win32` — this failure mode is specifically
    Windows' refusal to overwrite a memory-mapped DLL/exe; Linux generally permits overwriting a
    mapped `.so`/binary, so no equivalent scan is needed there.
  - Wrap the file-copy steps inside `LlamaCudaManager.download()` / `LlamaVulkanManager.download()`
    in a small retry-with-backoff (a few attempts, short fixed delays) as a secondary cushion for
    any residual OS-level unmap lag immediately after a kill, re-raising a clear, user-actionable
    error (e.g. "Could not install NVIDIA GPU binary: a running process still has the previous
    files open. Please try again.") only if retries are exhausted — never a raw `EBUSY` string
    reaching the Settings UI.
  - No auto-restart of the server after a successful install: leave it stopped and let the
    existing lazy-spawn-on-next-inference pattern (already how the app works) bring it back up,
    per CLAUDE.md §2 idle-budget philosophy. No new timer, no eager restart.
- No blocking open question — this is a scoped, mechanical fix; see Open Questions for one
  non-blocking judgment call (retry count/backoff values, and the OS-scan poll timeout) left to
  the executor's discretion within stated bounds.
- Practical impact: clicking "Download" for the CUDA or Vulkan binary in Settings → AI Models →
  Local Model will no longer intermittently fail with an EBUSY error when another backend's
  llama-server process is (or recently was) running; if a genuine external file lock still can't
  be cleared, the user sees an actionable message instead of a raw filesystem error.

## Problem / Goal

`LlamaCudaManager.download()` (and the structurally identical `LlamaVulkanManager.download()`)
extracts a freshly-downloaded llama.cpp release into a temp directory, then copies the server
binary and every shared `ggml-*.dll`/`.so` library into one common `bin/` directory
(`path.join(app.getPath("userData"), "bin")`) that is shared across **all** backends — CPU, CUDA,
Vulkan, and (on macOS) Metal.

The download IPC handlers in `ipcHandlers.js` (`download-llama-cuda-binary`,
`download-llama-vulkan-binary`, and their `delete-llama-*-binary` counterparts) already contain a
"stop the server first" guard, but it is scoped incorrectly:

```
if (modelManager.serverManager.activeBackend === "cuda") {
  await modelManager.stopServer()...
}
```

This only stops the server if the *currently active* backend matches the one being
installed/deleted. But the actual Windows file lock is on the **shared** `ggml-*.dll` files in
`bin/`, which are loaded by whichever backend's `llama-server-*.exe` happens to be running,
regardless of which backend a user is currently installing. Installing CUDA while a Vulkan (or a
still-running CPU) server is active — or vice versa — hits the identical EBUSY failure, and the
existing check does not catch it.

The confirmed reproduction in this session showed a `llama-server-cuda.exe` from an earlier
session still resident and holding the DLL lock even though the *current* session's in-memory
`serverManager.activeBackend` was `null`/not `"cuda"` — i.e., the lock came from a process this
session's `LlamaServerManager` singleton had **no live handle on at all**. This is the
discriminating fact that shapes the fix: if the process had been tracked (`activeBackend ===
"cuda"` with `serverManager.process` set), today's existing guard would already have stopped it
and the bug would not have reproduced. Since EBUSY still happened, the lock-holder was an orphan —
most likely a process whose `sidecarReaper.reapStaleSidecars()` pid-file entry was already cleared
(that reaper sends `SIGTERM` and immediately clears the pid-file entry without waiting for the
process to actually exit — see `src/helpers/sidecarReaper.js`), or a process from a session that
was never tracked in the pid file to begin with.

Because the single-instance lock (`app.requestSingleInstanceLock()`, CLAUDE.md §4) guarantees only
one Electron main process runs at a time, any `llama-server*.exe` OS process still alive that this
session's `serverManager` doesn't recognize as `this.process` is, by definition, safe to terminate
— it cannot belong to a legitimate concurrent session.

Goal: make the binary-install path robust to (a) any backend being active in this session's
tracked state, not just the matching one, **and** (b) untracked/orphaned `llama-server*.exe`
processes left over from a prior session — the actual cause of the reported bug — using a bounded
retry-with-backoff only as a secondary cushion for residual OS unmap lag after a kill, not as the
primary fix.

## Requirements

- Before any of the four operations — `download-llama-cuda-binary`, `download-llama-vulkan-binary`,
  `delete-llama-cuda-binary`, `delete-llama-vulkan-binary` — stop `modelManager.serverManager` if
  it currently has a running process (`serverManager.process` truthy / `serverManager.ready`),
  **regardless of which backend name is active**. Today's `activeBackend === "<name>"` check must
  be replaced, not merely supplemented.
- Additionally, and this is the primary fix for the reported bug: on `win32`, before the copy
  step, enumerate running processes and terminate only those whose **full executable path exactly
  matches** one of this app's own known binary paths under `bin/` (i.e.
  `getAllBackends().map((b) => b.getBinaryPath()).filter(Boolean)` from `llamaBackends.js`, which
  already covers CPU/CUDA/Vulkan and self-updates for any future backend) — regardless of whether
  this session's `serverManager` tracks them — then poll (bounded timeout) until none remain
  before proceeding to copy. **Matching must be scoped to full executable path, never image
  name/basename alone**: the CPU backend's binary is a stock, unrenamed `llama-server.exe`, so a
  user's own unrelated llama.cpp process (running from a different directory, with its own
  co-located DLLs) must never be touched — it cannot hold a lock on our `bin/` files, and killing
  it would be a destructive, unauthorized action against a process this app doesn't own (CLAUDE.md
  §5; org policy against unauthorized process termination). This must not depend on
  `sidecarPidFile`'s contents, since a stale entry may already have been cleared by `sidecarReaper`
  without the underlying process having actually exited.
- This "stop-before-install" logic (both the tracked-server stop and the untracked-orphan scan/
  kill) must live in one shared helper module/function, invoked identically from both the CUDA and
  Vulkan code paths in `ipcHandlers.js` (and any future backend download handler), rather than
  duplicated per-backend.
- `LlamaCudaManager.download()` and `LlamaVulkanManager.download()`'s copy-into-`bin/` steps
  (`fsPromises.copyFile` for the binary and for each shared lib) must retry on `EBUSY`/`EPERM`
  errors a small bounded number of times with a short fixed or backoff delay between attempts,
  before giving up.
- If all retries are exhausted, the error surfaced to the renderer (and returned from the IPC
  handler as `{ success: false, error: ... }`) must be a clear, actionable message — not the raw
  Node `EBUSY: resource busy or locked, copyfile '...' -> '...'` string — e.g. something like:
  "Could not install the NVIDIA GPU binary because another process still has the previous files
  open. Please close any running local-model session and try again." (Vulkan gets the equivalent
  wording.)
- Calling `stopServer()` when no server is currently running must remain a safe no-op (already
  true today via `LlamaServerManager.stop()`'s early return when `!this.process`) — do not
  regress this.
- If `stopServer()` itself throws for some reason, the download must still proceed to attempt the
  copy (relying on the retry-with-backoff as the fallback), not abort the whole download outright
  — matching CLAUDE.md §5 graceful degradation (a failed pre-step must not block a possibly-still-
  successful outcome, and must never crash the app).
- No change to what happens after a successful install: the server stays stopped; the existing
  lazy-spawn-on-next-inference-request path is unchanged (no new auto-restart feature).
- No new always-on timer, polling loop, or background service is introduced (CLAUDE.md §2).

## Non-goals

- Not restructuring `bin/` into per-backend subdirectories to eliminate the shared-DLL problem
  structurally — that's a larger change (would also affect `llamaBackends.js`'s path resolution,
  the CPU-binary download script, and packaging) and is out of scope for this bug fix. The
  stop-before-install + retry approach is the targeted fix.
- Not adding a UI toast/notification beyond the existing error-string surfacing already used by
  the Settings → AI Models → Local Model download flow.
- Not changing `LlamaServerManager.stop()`'s internal kill/timeout mechanics (SIGTERM → 5s →
  SIGKILL) — it is already adequate for tracked processes; this fix's retry-with-backoff is the
  answer for untracked ones.
- Not modifying `sidecarReaper.js` itself or its startup-time reaping behavior — this fix adds a
  separate, narrowly-scoped orphan scan/kill specific to the binary-install flow (see Design),
  rather than changing the general-purpose startup reaper's fire-and-forget `SIGTERM` behavior. A
  broader hardening of `sidecarReaper` (e.g. making it wait for exit, covering more sidecar types)
  is out of scope here.
- Not touching the CPU binary path — there is no user-triggered CPU binary download IPC handler
  (confirmed via search); the CPU binary is bundled at build time via
  `scripts/download-llama-server.js`, so this fix only needs to cover CUDA and Vulkan.

## Design

### 1. Shared "stop before install" helper

Add a small new helper, `src/helpers/llamaBinaryInstallLock.js`, exporting a single async function,
e.g. `stopServerBeforeInstall(modelManager)`, that performs two steps in order:

1. **Tracked server**: checks whether `modelManager.serverManager.process` (or equivalently
   `.ready`) indicates a server is currently running, for *any* backend. If so, calls
   `modelManager.stopServer()` and swallows/logs (via `debugLogger.warn`) any rejection rather
   than propagating it — mirroring today's `.catch((err) => debugLogger.warn(...))` pattern
   already used in the existing (too-narrow) checks — so a failure here never blocks the
   subsequent step or the copy attempt. If no server is tracked as running, this step is a no-op.

2. **Untracked/orphaned processes (Windows only)**: independent of step 1's outcome, when
   `process.platform === "win32"`, build the set of this app's own known binary full paths via
   `getAllBackends().map((b) => b.getBinaryPath()).filter(Boolean)` from `llamaBackends.js` (this
   already covers CPU, CUDA, and Vulkan, and will automatically include any future backend without
   code changes here). Enumerate running Windows processes **with their executable path** —
   `tasklist`'s default output does not include the full path, so use a path-aware query, e.g.
   PowerShell `Get-CimInstance Win32_Process | Select-Object ProcessId, ExecutablePath` (invoked
   via `child_process.execFileSync("powershell", [...])`) rather than `wmic` (deprecated/removed on
   recent Windows 11 builds — do not use it). For every running process whose `ExecutablePath`
   exactly matches (case-insensitive, resolved/normalized) one of this app's own binary paths,
   terminate it with `taskkill /PID <pid> /F` (or `process.kill(pid, "SIGKILL")` — prefer
   `taskkill` for parity with how Windows processes are otherwise force-stopped in this codebase).
   **Do not match by image name/basename alone** — a process named `llama-server.exe` (the stock
   CPU binary name) running from any directory other than our own `bin/` must be left untouched;
   only an exact full-path match to one of our own installed binaries qualifies. After issuing
   kills, poll (e.g. re-run the path-aware query every ~200ms, bounded to a few seconds total)
   until no matching process remains, then return. This does not consult `sidecarPidFile` — the
   whole point is to catch processes that pid-file-based tracking already lost track of.
- On non-Windows platforms, step 2 is skipped entirely (no-op) — see Non-goals/Design rationale:
  this failure mode is Windows-specific (refusal to overwrite a memory-mapped file).
- This helper must never throw: any error encountered during the `tasklist`/`taskkill` calls
  (e.g. tool not found, permission error) is logged via `debugLogger.warn` and treated as "best
  effort exhausted," falling through to let the subsequent copy-with-retry in
  `LlamaCudaManager`/`LlamaVulkanManager` be the last line of defense.

Update all four IPC handlers in `ipcHandlers.js` (`download-llama-cuda-binary`,
`download-llama-vulkan-binary`, `delete-llama-cuda-binary`, `delete-llama-vulkan-binary`) to call
this helper in place of today's `activeBackend === "cuda"` / `activeBackend === "vulkan"`
conditionals. The post-install "stop server so next inference picks up the new binary" calls
already present in the success branch of the two download handlers are unaffected (they remain,
since the server may have been legitimately restarted between the pre-install stop and the
completion of the download/extraction, however unlikely — cheap and idempotent either way).

### 2. Retry-with-backoff on the copy step

In both `LlamaCudaManager.download()` and `LlamaVulkanManager.download()`, wrap the two existing
copy call sites — the single `fsPromises.copyFile(binaryPath, outputPath)` for the server exe, and
the per-lib `fsPromises.copyFile(lib, dest)` inside the `for (const lib of libs)` loop — with a
small shared retry utility. Reuse or extend `src/helpers/downloadUtils.js` (where `downloadFile`,
`extractArchive`, etc. already live) with a new exported helper, e.g.
`copyFileWithRetry(src, dest, { retries, delayMs })`, rather than inlining bespoke retry loops in
each manager. Suggested bounds (executor may tune within reason — see Open Questions): 3 attempts
total, ~300ms fixed delay between attempts (small and bounded — this is a one-time install action,
not a hot path, so a short user-visible pause is acceptable and preferable to failing outright).
Retry only on `EBUSY`/`EPERM` error codes; any other error (e.g. `ENOENT`, disk full) should fail
immediately without retrying, since retrying those cannot help.

When retries are exhausted, throw a new `Error` with a clear, actionable message (see Requirements
above for suggested wording) instead of letting the raw `fs` error propagate. The existing
`ipcHandlers.js` `catch` blocks around `download-llama-cuda-binary` /
`download-llama-vulkan-binary` already return `{ success: false, error: error.message }`, so
producing a clear `error.message` at the throw site is sufficient — no handler-level changes needed
beyond what's already there.

### 3. No behavior change to post-install server state

Confirmed as correct today and unchanged by this fix: after a successful install, the handler
calls `modelManager.stopServer()` and does not restart it. The next inference request naturally
triggers `LlamaServerManager.start()` (lazy-spawn), which will pick up the freshly-installed
binary. This matches CLAUDE.md §2 and requires no new code.

### 4. Files touched

- `src/helpers/llamaBinaryInstallLock.js` — new, shared stop-before-install helper.
- `src/helpers/downloadUtils.js` — add `copyFileWithRetry()`.
- `src/helpers/llamaCudaManager.js` — use `copyFileWithRetry()` for both copy call sites in
  `download()`.
- `src/helpers/llamaVulkanManager.js` — same.
- `src/helpers/ipcHandlers.js` — replace the four narrow `activeBackend === "<name>"` guards with
  calls to `stopServerBeforeInstall()`.

## Validation Plan

### Automated

- New test file `test/helpers/llamaBinaryInstallLock.test.js`:
  - Asserts `stopServerBeforeInstall()` calls `modelManager.stopServer()` when
    `serverManager.process` is truthy, **even when `activeBackend` is a different backend name
    than the one being installed** (this is the tracked-process regression case: it must fail
    before the fix, since today's inline checks are backend-name-scoped, and pass after, once the
    shared helper replaces them) — mock `modelManager` with `serverManager.process = {}`,
    `serverManager.activeBackend = "vulkan"`, simulate installing CUDA, and assert `stopServer`
    was invoked.
  - Asserts it is a no-op for step 1 (does not call `stopServer`) when `serverManager.process` is
    falsy.
  - Asserts a rejection from `stopServer()` does not propagate/throw out of
    `stopServerBeforeInstall()` (it should resolve regardless, having logged a warning).
  - **The primary regression test for the reported bug**: mocks `child_process.execFileSync` (or
    whichever invocation wraps the path-aware Windows process query) so that it returns a process
    entry whose `ExecutablePath` matches one of `getAllBackends()`'s binary paths (e.g. the mocked
    CUDA binary path under a fake `binDir`) with a given PID, **while
    `modelManager.serverManager.process` is `null`/untracked** — i.e. simulating exactly the
    reproduction (an orphaned CUDA server this session never launched). Set `process.platform` to
    `"win32"` for this test (see the existing pattern in `test/helpers/llamaCudaManager.test.js`
    for mocking `process.platform`/`process.arch`). Assert that `stopServerBeforeInstall()` issues
    a kill (`taskkill`/`process.kill`) for that PID even though step 1 found nothing to stop, and
    that it polls/confirms the process is gone (mock the follow-up query returning empty) before
    resolving. This test must fail against the pre-fix code path (which only checks
    `activeBackend`, finds nothing, and does nothing) and pass once the Windows orphan-scan step
    is implemented.
  - **Negative/safety test**: mocks the same path-aware query returning a process with a matching
    image name/basename (e.g. `llama-server.exe`) but an `ExecutablePath` **outside** any of this
    app's own binary paths (simulating a user's unrelated llama.cpp process). Asserts
    `stopServerBeforeInstall()` does **not** attempt to kill that PID — this is the regression
    test for the path-vs-basename safety requirement.
  - Asserts the orphan-scan step is skipped entirely (no process-query/kill calls) when
    `process.platform !== "win32"`.
  - Asserts the helper does not throw when the process-query/kill mock throws (e.g. simulating the
    tool being unavailable) — falls through gracefully instead.
- Extend `test/helpers/llamaCudaManager.test.js` (and add the equivalent for
  `llamaVulkanManager.js` if no test file exists yet — confirm during execution) with:
  - A test that mocks `fsPromises.copyFile` to reject with an `EBUSY` error on the first N calls
    and succeed after, asserting `download()` ultimately succeeds (proves the retry path works).
  - A test that mocks `fsPromises.copyFile` to always reject with `EBUSY`, asserting `download()`
    rejects with a clear, actionable error message (not containing the raw `copyfile` path
    string/error code) — this is the concrete "fails before the fix, passes after" regression
    test: before the fix, `download()` rejects with the raw `EBUSY: resource busy or locked,
    copyfile '<path>' -> '<path>'` message; after the fix, it rejects with the new user-facing
    message.
  - A test that mocks `fsPromises.copyFile` to reject with a non-retryable error (e.g. `ENOENT`)
    and asserts `download()` rejects immediately without the retry delay (can assert call count
    on the mock, or via fake timers, that no retry delay elapsed).
- Run `node --test test/helpers/llamaBinaryInstallLock.test.js test/helpers/llamaCudaManager.test.js test/helpers/llamaVulkanManager.test.js`
  (create the Vulkan test file if missing) and the full `npm test` suite to confirm no regressions.

### Manual

1. On Windows, download and start the Vulkan (or CUDA) local-model binary so
   `llama-server-vulkan.exe` (or `-cuda.exe`) is running and idle (check Task Manager).
2. In Settings → AI Models → Local Model, click "Download" for the **other** backend (e.g. CUDA
   while Vulkan is running, or vice versa).
3. Confirm the download completes successfully with no EBUSY error, and that the previously-running
   process for the other backend has been stopped (no longer in Task Manager, or a fresh one spawns
   on next inference).
4. Repeat step 2 for "Delete" instead of "Download" on the currently-active backend's binary, and
   confirm it deletes cleanly.
5. Trigger a local-model inference afterward and confirm the server lazy-spawns correctly with the
   newly-installed binary (check the active backend reported in Settings matches the new install).
6. **Orphan-process reproduction** (the actual reported bug): start CUDA (or Vulkan) local-model
   inference so `llama-server-cuda.exe` is running, then force-kill the whole EktosWhispr app via
   Task Manager (not a graceful quit) so the child `llama-server-cuda.exe` is orphaned and keeps
   running with `ggml-base.dll` mapped. Relaunch EktosWhispr (a fresh session with no in-memory
   knowledge of that orphan). In Settings → AI Models → Local Model, click "Download" for the CUDA
   binary and confirm it succeeds without EBUSY, and that the orphaned process is gone afterward
   (check Task Manager).

### Docs

- No CLAUDE.md architecture-level change is needed (this is an internal bugfix within already-
  documented `llamaCudaManager.js`/`llamaVulkanManager.js`/`ipcHandlers.js` responsibilities); no
  new IPC channel, settings key, or schema is introduced. If `docs/RECREATION_SPEC.md` has a
  section describing today's (buggy) `activeBackend === "<name>"` stop-before-install behavior,
  update it to describe the corrected "stop whenever any backend is running" behavior — check
  during execution whether such a passage exists.

## Open Questions

- Retry count (suggested 3) and delay (suggested ~300ms fixed) for `copyFileWithRetry()` are a
  judgment call, not a blocking decision — any value in the low single digits with a short (100–
  500ms) delay satisfies the intent (bounded, user-imperceptible-ish pause, not a long hang). Left
  to spec-executor's discretion within that range; does not need project-owner sign-off.
