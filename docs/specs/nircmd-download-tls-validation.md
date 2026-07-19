# Fix TLS Certificate Validation Bypass in nircmd.exe Download Fallback

## Status
Implemented

## Problem / Goal

`scripts/download-nircmd.js` downloads the third-party NirSoft `nircmd.exe` utility (from `https://www.nirsoft.net/utils/nircmd-x64.zip`, `NIRCMD_URL` at line 17) for use as a Windows clipboard-paste fallback. `nircmd.exe` is later executed directly via `spawn(nircmdPath, ["sendkeypress", "ctrl+v"])` (`src/helpers/clipboard.js:1088`, inside `pasteWithNircmd()`).

The primary download path (`downloadFile()` in `scripts/lib/download-utils.js`, using Node's built-in `https` module) uses default TLS certificate validation and is confirmed **not** affected by this issue — it has no cert-bypass code anywhere.

However, `main()` (`scripts/download-nircmd.js:66-103`) falls back to a PowerShell-based download (`downloadWithPowerShell()`, lines 21-44) whenever the primary path throws (line 73: `catch (nodeErr)`). That fallback explicitly disables certificate validation on two code paths:

- Line 28: `-SkipCertificateCheck` on `Invoke-WebRequest` (attempted first, targets PowerShell 6+).
- Line 37: `[Net.ServicePointManager]::ServerCertificateValidationCallback = {$true}` (PowerShell 5.1 fallback — disables certificate validation .NET-wide for that PowerShell process's lifetime, via a callback that unconditionally returns true).

A repo-wide search confirms this bypass pattern (`SkipCertificateCheck` / `ServerCertificateValidationCallback` / `rejectUnauthorized`) exists **only** in this one file — it is not duplicated in `scripts/lib/download-utils.js`, any other `scripts/download-*.js` file, or the separate runtime download module `src/helpers/downloadUtils.js`.

**Impact**: whenever this fallback is exercised, a network-position attacker (TLS interception on a corporate/public network, or a coffee-shop MITM) can serve an arbitrary executable in place of the real `nircmd.exe`, with zero certificate warnings surfaced anywhere. That file is later `spawn()`ed directly on the user's machine to send a keystroke — a malicious drop-in replacement is under no obligation to behave like `nircmd.exe` and runs with the same privileges as the app.

**Why this is safe to fix by tightening `download-nircmd.js` alone**: the confirmed Windows paste fallback chain already treats `nircmd.exe` as optional and best-effort:

1. Native `windows-fast-paste.exe` (SendInput) is tried first (`resolveWindowsFastPasteBinary()`, checked around `src/helpers/clipboard.js:808`).
2. If unavailable, `pasteWithNircmdOrPowerShell()` (`src/helpers/clipboard.js:1069`) calls `getNircmdPath()` (`src/helpers/clipboard.js:229`) — if `nircmd.exe` isn't found on disk, it returns `null` and the code falls straight through to `pasteWithPowerShell()`.
3. `main()`'s existing outer `catch` (`scripts/download-nircmd.js:98-103`) already treats a failed download as non-fatal: it logs a warning ("The app will use PowerShell as fallback for clipboard paste on Windows") and does not fail the build.

So making the download fail loudly instead of silently succeeding over an unvalidated channel requires no changes anywhere outside `scripts/download-nircmd.js` and a new test.

This is also today's actual, currently-shipping behavior — `docs/RECREATION_SPEC.md:1227` already documents it factually in the build-scripts table: `download-nircmd.js | nirsoft.net direto (não GitHub) | nircmd.exe (fallback PowerShell com bypass TLS)`.

**Root cause context** (git history): commit `0b8cec93` ("fix(build): fall back to PowerShell download for nircmd on SSL cert errors") shows the fallback's original, legitimate purpose: *"Node's https module doesn't use the Windows certificate store, so it fails on corporate networks with SSL inspection. PowerShell's Invoke-WebRequest does use the OS cert store and succeeds in those environments."* That stated goal never required *disabling* validation — only using an HTTP client that consults the OS/.NET trust store, which a corporate-managed machine's IT department has already seeded with its inspection proxy's root CA. The `-SkipCertificateCheck` / `ServerCertificateValidationCallback` bypass goes beyond what the goal needed and is the actual vulnerability introduced on top of it.

## Requirements

- **R1.** `scripts/download-nircmd.js` must never invoke any download mechanism with certificate validation disabled: no `-SkipCertificateCheck` flag and no `ServerCertificateValidationCallback` (or any equivalent .NET/PowerShell validation-bypass override) may appear anywhere in the file after this change.
- **R2.** When the primary Node `https` download (`downloadFile()`) fails, the PowerShell fallback must still be attempted, but using PowerShell's default (OS/.NET-trust-store-validated) certificate checking — i.e., a plain `Invoke-WebRequest` call with no certificate-related flags — preserving the original corporate-SSL-inspection use case documented in commit `0b8cec93` without disabling validation to achieve it.
- **R3.** If the PowerShell fallback's download fails for any reason (certificate validation failure, PowerShell missing, timeout, etc.), `downloadWithPowerShell()` must throw an `Error` whose message includes the PowerShell/.NET error detail (captured `stderr`), so the real cause is visible in build logs rather than a bare exit code.
- **R4.** The existing non-fatal handling in `main()` (lines 98-103: log a warning, skip writing `nircmd.exe`, continue without failing the build) must be preserved unchanged — a total download failure (both paths failing) must still exit the script successfully, matching today's graceful-degradation behavior.
- **R5.** The PowerShell command-string-building logic must be exposed for unit testing (via `module.exports`), and the file's top-level `main().catch(console.error)` invocation must be guarded so that `require`-ing the module does not itself trigger a real download — following the existing `if (require.main === module) { ... }` convention already used in `scripts/download-sherpa-onnx.js:367-369`.
- **R6.** A new automated test must assert that the generated PowerShell command string(s), for representative `url`/`dest` inputs, never contain the substrings `-SkipCertificateCheck` or `ServerCertificateValidationCallback`.
- **R7.** No other file's download behavior may change. `scripts/lib/download-utils.js` (`downloadFile()`, the primary, already-safe path) must remain unmodified by this fix.

## Non-goals

- **Version pinning nircmd's download** (e.g., switching to a tagged/versioned source via `fetchLatestRelease()`-style resolution, the way most other `scripts/download-*.js` files already do). `download-nircmd.js` fetches a static URL because NirSoft doesn't publish tagged releases the way GitHub-hosted projects do. This is a real, separate hardening opportunity, but it doesn't affect the certificate-validation bug either way. Flagged as follow-up work, not blocking this fix.
- **Post-download integrity/checksum verification** for `nircmd.exe` or any other downloaded binary. Confirmed during planning: no project-wide policy on this exists yet. A search for a "Non-Negotiable Product Premises" section in `CLAUDE.md` returned zero matches anywhere in the repo, and a search of `scripts/` for `checksum`/`sha256`/`integrity` found no downloaded-binary integrity verification utility — the `sha256` usages that do exist (e.g. `scripts/build-globe-listener.js:102`, `scripts/build-macos-fast-paste.js:97`, `scripts/lib/meeting-aec-build.js:429`, etc.) hash **local source files** to decide whether a recompile is needed, an unrelated use case. Bundling an org-wide checksum-infrastructure decision into this narrowly-scoped security fix risks delaying it on an unresolved, unrelated product decision. Recommend a separate future spec covering all downloaded binaries consistently, not just nircmd.
- **Removing the PowerShell fallback entirely.** Considered and rejected: per commit `0b8cec93`, the fallback exists to support corporate networks doing TLS inspection, where Node's bundled CA list doesn't include the proxy's injected root CA but the OS trust store does. Deleting the fallback would regress that legitimate case; this fix instead keeps the fallback but removes only the bypass.
- **Hardening the PowerShell `-Command` string against injection** via unescaped single-quote interpolation of `url`/`dest`. Both values are hardcoded, developer-controlled constants at every current call site (`NIRCMD_URL`, and `zipPath` built from `path.join(BIN_DIR, ...)`), not attacker- or user-influenced input, so there is no live injection vector today. Noted as a secondary, defense-in-depth observation for a future pass, not part of this fix's scope.
- **Changing `src/helpers/downloadUtils.js`** (the separate runtime download module used by `src/helpers/*.js` at app runtime — e.g. `parakeet.js`, `llamaCudaManager.js`, `diarization.js` — distinct from the build-time `scripts/lib/download-utils.js`). Confirmed by repo-wide grep: this bypass pattern is not duplicated there.
- **Adding an environment-variable override for `NIRCMD_URL`.** Manual verification (below) uses a temporary, never-committed local edit instead; adding a new override surface would itself slightly widen this security fix's footprint beyond what's needed.

## Design

Files touched: `scripts/download-nircmd.js` (modified). New file: `test/helpers/downloadNircmd.test.js`. No IPC channels, settings keys, or DB schema are involved — this is a build-time Node script, not application runtime code, so those template categories don't apply here.

### `scripts/download-nircmd.js`

Replace the current two-branch `downloadWithPowerShell(url, dest)` (a PowerShell-6+ attempt using `-SkipCertificateCheck` at line 28, then a PowerShell-5.1 fallback using the `ServerCertificateValidationCallback` override at line 37) with a single, non-bypassing attempt:

- Extract a pure, exported command-builder function — name it `buildNircmdPowerShellCommand(url, dest)` — that returns the exact PowerShell `-Command` string to run: `Invoke-WebRequest -Uri '<url>' -OutFile '<dest>' -UseBasicParsing`, and nothing else. No certificate-related flag or override of any kind appears in this string. Because there is no longer a PowerShell-6-only flag involved, the PS6-vs-PS5.1 branching present today is no longer needed: `-UseBasicParsing` alone is valid on both PowerShell 5.1 and 6+/7+, so one command form covers both.
- `downloadWithPowerShell(url, dest)` calls this builder once and `spawnSync`s `powershell -NoProfile -NonInteractive -Command <generated string>` exactly once, keeping the existing `{ stdio: "pipe", timeout: 60000 }` options (stderr must stay piped so it can be captured on failure).
- On a non-zero (or `null`, e.g. timeout) exit status, throw an `Error` whose message includes both the exit status and the captured `stderr` text (trimmed to a reasonable length) — e.g. along the lines of `PowerShell download failed (exit <status>): <stderr>` — so that whatever PowerShell/.NET actually reported (a TLS/certificate trust failure, a timeout, "powershell: command not found", etc.) is visible in the build log, not just a bare exit code.
- Export `buildNircmdPowerShellCommand` (and, if convenient for the test below, `downloadWithPowerShell` itself) via `module.exports`.
- Guard the file's existing top-level `main().catch(console.error);` (currently the last line, 106) behind `if (require.main === module) { main().catch(console.error); }`, matching the pattern already used in `scripts/download-sherpa-onnx.js:367-369`. This means `require`-ing the module for testing has no side effects (no real download, no `process.exit`).
- Nothing else in the file changes: `NIRCMD_URL` (line 17) stays a hardcoded constant; `main()`'s structure — including the inner `try`/`catch` around the two download attempts (lines 71-77) and the outer `try`/`catch` (lines 66-103) that treats total failure as non-fatal — is untouched, since `downloadWithPowerShell`'s call signature (`url`, `dest` in, throws or resolves) doesn't change.

### `test/helpers/downloadNircmd.test.js` (new)

Follow the style already established by `test/helpers/linuxLauncherSandbox.test.js` (which `require`s a `scripts/lib/*.js` module directly from `test/helpers/`) and `test/helpers/extractArchive.test.js` (which monkey-patches a `child_process` function to force a failure path, restoring it in a `finally`). Use `node:test` + `node:assert/strict` — this repo's only test framework; no mocking library is used elsewhere in `test/`.

- Require `scripts/download-nircmd.js` and call the exported command builder with at least two representative `url`/`dest` pairs, including at least one pair where a value contains a single quote or a space, to exercise the interpolation path realistically.
- Assert the returned string never contains `-SkipCertificateCheck`.
- Assert the returned string never contains `ServerCertificateValidationCallback`.
- Assert the returned string contains `-UseBasicParsing` and both the given `url` and `dest` values.
- Monkey-patch `child_process.spawnSync` (restored in a `finally`, matching the `extractArchive.test.js` pattern for `cp.execFile`) to return a non-zero `status` plus fixed `stderr` content, then assert (`assert.rejects` or equivalent) that the exported `downloadWithPowerShell` throws/rejects with a message containing that `stderr` content.
- Implicitly validate the `require.main === module` guard by confirming that simply requiring the module performs no filesystem writes and doesn't invoke `spawnSync` before the test explicitly calls an exported function.

This test file lands under `test/helpers/`, so it is automatically picked up by the existing `npm test` script (`node --test "test/helpers/*.test.js" "test/utils/*.test.js"`, `package.json:74`) — no `package.json` changes needed.

## Validation Plan

### Automated
- `test/helpers/downloadNircmd.test.js` (new): asserts everything listed under "Design" above — no cert-bypass substrings ever appear in the generated command, correct interpolation of `url`/`dest`, and that a failed `spawnSync` produces a thrown error carrying the captured `stderr`.
- Run `npm test` (`node --test "test/helpers/*.test.js" "test/utils/*.test.js"`) and confirm the new test passes alongside the existing suite.
- Run `npm run lint` and `npm run format:check` against the touched files.

### Manual
1. On a Windows machine, temporarily point `NIRCMD_URL` (local edit only — do not commit) at an HTTPS endpoint serving an invalid/self-signed/untrusted certificate. Delete any existing `resources/bin/nircmd.exe`, and run `node scripts/download-nircmd.js` against that endpoint (the primary Node `https` path will fail first, since the cert doesn't validate under Node's default trust store either, triggering the PowerShell fallback). Confirm: (a) no file is written to `resources/bin/nircmd.exe`; (b) the console shows a non-fatal warning (matching the existing `main()` catch behavior) rather than a silent success. Revert the temporary `NIRCMD_URL` edit afterward.
2. On the same or another Windows machine, with `NIRCMD_URL` reverted to the real value, delete `resources/bin/nircmd.exe` if present and run `npm run download:nircmd`. Confirm `resources/bin/nircmd.exe` is downloaded successfully via the (unaffected) primary Node `https` path.
3. If a machine/network that reproduces the original corporate-SSL-inspection scenario is available (a TLS-intercepting proxy whose root CA is installed in the Windows trust store), confirm the PowerShell fallback still succeeds there now that it uses default, non-bypassed certificate validation — i.e., the problem commit `0b8cec93` originally fixed remains fixed. If no such environment is available, state explicitly that this scenario is unverified rather than assuming success (see Open Questions).

### Docs
- `docs/RECREATION_SPEC.md:1227` — update the build-scripts table row for `download-nircmd.js` (currently `nircmd.exe (fallback PowerShell com bypass TLS)`) to reflect the corrected behavior (PowerShell fallback retained, but using default/OS-trust-store certificate validation, no bypass).
- `CLAUDE.md` — the "Build Scripts" list currently describes `download-nircmd.js` in one generic line ("Downloads nircmd.exe for Windows clipboard operations"); confirm during implementation whether this needs any addition (likely not, since it doesn't currently mention TLS handling either way).
- `docs/SECURITY.md` — "Supply chain attacks via dependencies or native compilation" is already listed in scope; no wording change expected, but sanity-check during implementation that nothing there implies the bypass was an accepted/documented risk.
- `docs/network-allowlist.md` — confirmed no existing entry for `nirsoft.net` (this doc covers outbound hosts contacted by the *running app*, and this script only runs at build time); confirm no update is needed.

## Open Questions

- Whether `nirsoft.net`'s real certificate validates cleanly under the OS/PowerShell default trust store on an ordinary (non-corporate-proxy) Windows machine was **not** empirically verified during this planning pass — no outbound network calls were made to third-party hosts from the planning environment. If the original "nirsoft.net has cert issues" comment (line 21) turns out to describe a genuinely broken/incomplete certificate chain that even the OS trust store's AIA chain-building can't repair (rather than purely a corporate-proxy scenario), this fix would cause `nircmd.exe` to stop being bundled at all on ordinary machines — still safe per the confirmed graceful-degradation chain, but a visible packaging change from today. Please confirm on a real Windows machine (manual validation step 2 above) before/while implementing, and decide whether that outcome (if it occurs) is acceptable, or whether nircmd should instead be vendored/mirrored from a source EktosWhispr controls (a larger, separate change).
- Please confirm the recommended scoping (certificate-bypass fix only; version pinning and checksum verification as separate follow-up work) is correct before approving — see Non-goals for the supporting evidence gathered.
