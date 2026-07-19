# Speed Up PR CI (Windows Packaging Job + Cache/Setup Fixes)

## Status
Implemented

## TL;DR

- **What's changing**: `build-and-notarize.yml` (the heavy Windows electron-builder job) currently
  runs the *exact same* full packaging pipeline — `nsis` + `portable` installer targets — on every
  `pull_request` event as it does on the real `push`-to-`main`/`develop` release build, then throws
  the PR-time output away. This spec makes the PR-time run build the cheap, unpacked `--dir` target
  instead (same renderer build, same native-module rebuild, same `extraResources`/`asarUnpack`
  copying, same `afterPack.js` validation that already fails the build if a bundled binary is
  missing — just skipping NSIS/portable installer compression, which adds cost but no extra
  correctness signal). The `push`/`workflow_dispatch` path (the actual signed release artifact) is
  untouched. Two smaller, low-risk fixes ride along: `tests.yml` (the workflow that runs on every
  PR commit) gets npm dependency caching it's currently missing, and the native-binary cache in
  `build-and-notarize.yml` gets a `restore-keys` fallback so an unrelated one-line edit to any single
  `scripts/download-*.js` file doesn't force re-downloading all 9 native binaries from scratch.
- **Concrete decisions**:
  - PR-time Windows build target: `--dir` (unpacked), not `nsis`+`portable`. Push/`workflow_dispatch`
    unchanged (still full signed `nsis`+`portable`).
  - `pull_request` trigger stays on `build-and-notarize.yml` — not removed. The signal it provides
    (packaging still succeeds + a downloadable test build) is preserved, just made cheaper.
  - Add `restore-keys: windows-x64-bin-` to the native-binary cache step (mirrors the existing
    "Cache Electron" step's pattern).
  - Add `cache: "npm"` to `tests.yml`'s `setup-node` step.
  - No changes to any workflow's `on:` triggers, to `codeql.yml`, `lockfile-lint.yml`, or any of the
    7 individual native-binary `workflow_dispatch`-only build workflows.
  - Missing lint/typecheck coverage in CI, and the "cached binary can go stale forever because most
    download scripts fetch GitHub's 'latest' release with no version pin" behavior, are both real
    but explicitly **not** addressed here — separate, non-speed concerns, called out in Non-goals.
- **No blocking open question** — this can proceed directly to `Approved`. One non-blocking design
  choice worth a quick nod: the PR-time artifact changes shape, from a single double-click
  `.exe` (today) to a zipped unpacked app folder (`EktosWhispr.exe` inside it, still directly
  runnable, just not a one-file download). See Open Questions for the one-line alternative
  (`portable`-only target) if that UX regression matters enough to trade back some of the savings.
- **Practical impact**: PR authors/reviewers see `build-and-notarize.yml` finish noticeably faster
  on every PR push (no NSIS compilation, no portable-exe archive creation — both currently run
  twice, once wastefully on PR, once for real on merge). `tests.yml` — the fast, always-on
  correctness gate — installs dependencies faster on every commit thanks to npm caching. No
  behavior changes for end users of the shipped app; this is CI-only.

## Problem / Goal

PR turnaround in this repo is slow because of avoidable duplication and misconfiguration in the
CI workflows that trigger on `pull_request`, not because of inherent multi-platform/matrix bloat
(confirmed below — there is none). Verified directly against the current workflow files (not
assumed from a prior report):

**Workflows triggering on `pull_request`** (`.github/workflows/*.yml`, confirmed by reading each
file's `on:` block):

1. `tests.yml` — `ubuntu-latest`, `npm ci --ignore-scripts` + `npm test`. Cheap (`node --test` over
   ~65 files in `test/helpers/`/`test/utils/`).
2. `lockfile-lint.yml` — `ubuntu-latest`, a single `npx lockfile-lint` invocation. Trivial.
3. `codeql.yml` — `ubuntu-latest`, CodeQL `autobuild` + `analyze` for `javascript-typescript`. Also
   runs on a weekly cron and on `push` to `main`; not the primary target of this spec (out of scope
   per the investigation's own framing — CodeQL's cost is inherent to what it does, not obviously
   misconfigured here).
4. `build-and-notarize.yml` — **`windows-latest`, single job, no OS/arch matrix** — confirmed: this
   file defines exactly one job (`build-windows`) with no `strategy.matrix`, so "multi-platform
   matrix bloat" is not a factor, contra a naive first guess. This is the heavy one, and the sole
   focus of the concrete changes below.

**`build-and-notarize.yml`'s actual current content** (line numbers as of this spec's writing —
verify against the live file before editing, in case of drift):

- Triggers (lines 3–16): `push` to `[main, develop]` (line 5) **and** `pull_request` to `[main]`
  (line 11), both with the same `paths-ignore` (docs/LICENSE/issue templates), plus
  `workflow_dispatch` (line 16). Confirmed: every PR run and every post-merge push run execute the
  identical job definition below, differing only in which branch of one `if` conditional they hit
  (see below).
- `actions/setup-node@v4` (lines 24–28) **does** set `cache: "npm"` (line 28) — this workflow
  already has npm caching; it's `tests.yml` that's missing it (see below).
- Line 30–31: `npm ci`.
- Line 33–34: an extra, unscripted `npm install @rollup/rollup-win32-x64-msvc
  lightningcss-win32-x64-msvc @tailwindcss/oxide-win32-x64-msvc --no-save` — confirmed present,
  runs on every invocation of this job (PR and push alike). Needed because the committed
  `package-lock.json` may have been regenerated on a non-Windows dev machine and therefore lack
  these Windows-only optional-dependency native bindings that Vite/Tailwind need on this runner.
  Already benefits from the npm cache above (see "Investigated and not changed" in Design) — not
  touched by this spec.
- Lines 36–40: a `Cache native binaries` step, `path: resources/bin`, single
  `key: windows-x64-bin-${{ hashFiles('scripts/download-*.js') }}`, **no `restore-keys`** —
  confirmed by reading the step; contrast with the `Cache Electron` step 50 lines later (line 92)
  which does have `restore-keys: windows-electron-`. This asymmetry is real and fixable (R2 below).
- Lines 42–85: exactly **9** separate `node scripts/download-*.js` steps — whisper.cpp,
  llama-server, sherpa-onnx, Qdrant, meeting-aec-helper, nircmd, windows-fast-paste,
  windows-key-listener, windows-mic-listener. Confirmed count and identity by reading every step.
  Each script's `downloadBinary()`/equivalent function checks `fs.existsSync(outputPath)` before
  downloading anything (confirmed in `scripts/download-whisper-cpp.js:71` and mirrored in the other
  8 scripts) — so a warm cache genuinely skips all network work for files that already exist.
- Lines 100–116: the `Build and Sign Application` step. Its shell conditional (lines 101–106) is
  the actual site of the PR-vs-push divergence:
  - `pull_request` branch (line 103): `npm run build:win -- --publish never --config
    electron-builder.unsigned-win.json`.
  - else branch, i.e. `push`/`workflow_dispatch` (line 105): `npm run build:win -- --publish
    never`.
  - `npm run build:win` = `npm run build:renderer && electron-builder --win` (`package.json` line
    40). `electron-builder.json`'s `win.target` is `["nsis", "portable"]` (line 158) — **both**
    targets, unconditionally, in both branches. `electron-builder.unsigned-win.json`'s only override
    is `win.azureSignOptions: null` (disables Azure Trusted Signing) — it does **not** change which
    targets get built. So today, a PR run and a post-merge push run both compile a full NSIS
    installer **and** a full portable .exe, every single time, for every PR — the only difference is
    whether the result gets signed. This is the confirmed duplication: identical, expensive,
    installer-format-specific compression work happens twice per merged PR, and the PR-time copy is
    thrown away (7-day-retention artifact, never referenced again once merged).
  - `npmRebuild: true` (electron-builder.json line 12) triggers a native-module rebuild pass
    (`better-sqlite3`, `onnxruntime-node`, `@napi-rs/keyring`) during packaging regardless of
    target — this and the `afterPack.js` hook (asar-unpack verification, onnxruntime binary
    stripping, meeting-aec-helper permission fix) are the parts of this job that actually catch
    "did I break Windows packaging" bugs; NSIS/portable archive creation itself adds compression
    time, not additional bug-catching signal.
- Lines 117–122: `Upload Artifacts`, unconditional, `path: dist/`, `retention-days: 7`. Confirmed no
  `if:` guard — this runs (and uploads whatever `dist/` contains) on every trigger.

**`tests.yml`'s actual current content** (21 lines total): `ubuntu-latest`, `setup-node@v4` with
`node-version-file: .nvmrc` (lines 11–13) and **no `cache:` key at all** — confirmed by reading the
file. `build-and-notarize.yml` has npm caching and `tests.yml` (which runs on every PR commit and
is the fast, cheap, most-frequently-consulted feedback loop) does not — backwards from where a fast
`npm ci` matters most for reviewer/author turnaround.

**Confirmed correct, not requiring changes** (verified, not assumed):

- No workflow currently runs `npm run lint`/`npm run typecheck`/`npm run quality-check` — a real
  coverage gap, but explicitly out of scope for *this* speed-focused spec (see Non-goals); noted
  here only so it isn't silently lost.
- `build-and-notarize.yml` is single-job, `windows-latest`-only, no matrix — nothing to trim there.
- Most `scripts/download-*.js` files (whisper.cpp, Qdrant, meeting-aec-helper, windows-fast-paste,
  windows-key-listener, windows-mic-listener, windows-system-audio-helper) fetch GitHub's *latest*
  release dynamically unless a `*_VERSION` env var pins them (confirmed via
  `scripts/download-whisper-cpp.js:17` and grep across `scripts/*.js` for `VERSION_OVERRIDE`); only
  `download-llama-server.js` hardcodes a static tag (`"b9763"`, line 18) by default. None of the CI
  workflows currently set any `*_VERSION` override. This means a warm cache can serve an
  indefinitely stale binary (the "may be needlessly stable" half of the original investigation's
  fact #4) — a real correctness/freshness concern, but a *policy* decision (when/how to pin
  versions) rather than a CI-speed bug, and explicitly out of scope here (see Non-goals). The
  concrete, in-scope half of that same finding — the cache key coalescing all 9 scripts into one
  all-or-nothing entry with no fallback — is addressed by R2 below.

## Requirements

- **R1 — Cheaper PR-time Windows packaging.** On `pull_request`-triggered runs of
  `build-and-notarize.yml` only, build the Windows target in electron-builder's unpacked `--dir`
  mode instead of the full `nsis`+`portable` target set, while leaving the renderer build, npm
  install, native-binary downloads, native-module rebuild (`npmRebuild: true`), `extraResources`/
  `asarUnpack` copying, and the `afterPack.js` validation hook (which already fails the job if
  `ffmpeg-static`, the ONNX worker script, the `ps-list` Windows vendor binary, or the
  meeting-aec-helper binary are missing from the packed output) fully intact and running exactly as
  today. `push`-triggered (main/develop) and `workflow_dispatch`-triggered runs are byte-for-byte
  unchanged: still the full, signed, `nsis`+`portable` build.
- **R2 — Native-binary cache fallback.** Add a `restore-keys` fallback to the `Cache native
  binaries` step in `build-and-notarize.yml`, mirroring the existing `Cache Electron` step's
  pattern, so an edit to any single `scripts/download-*.js` file (which changes the combined
  `hashFiles('scripts/download-*.js')` primary key) restores the most recent previous
  `resources/bin/` cache entry instead of starting from empty — letting each download script's
  existing "skip if the target file already exists" check do its job for the 8 binaries whose
  scripts didn't change, instead of re-fetching all 9 from scratch.
- **R3 — `tests.yml` npm caching.** Add `cache: "npm"` to `tests.yml`'s `actions/setup-node@v4`
  step, matching the pattern already used in `build-and-notarize.yml`, so the workflow that runs on
  every PR commit gets a warm npm cache instead of being the one PR-triggered workflow without one.
- **R4 — No trigger changes.** Do not add, remove, or narrow any `on:` block in any workflow file.
  `pull_request` stays wired to `build-and-notarize.yml`, `tests.yml`, `lockfile-lint.yml`, and
  `codeql.yml` exactly as today. This spec only changes what happens *inside* the existing
  PR-triggered `build-and-notarize.yml` job (R1) plus the two cache fixes (R2, R3).
- **R5 — Document, don't fix, the two out-of-scope gaps.** Record in this spec (done above, in
  Problem/Goal's "Confirmed correct, not requiring changes") that (a) no CI workflow runs
  lint/typecheck/quality-check today, and (b) most native-binary download scripts fetch "latest"
  with no version pin, so a long-lived warm cache can go stale indefinitely — both real, both
  explicitly deferred to a future, separately-scoped spec (see Non-goals), not silently dropped.

## Non-goals

- Removing the `pull_request` trigger from `build-and-notarize.yml`. The signal it provides
  (Windows packaging still succeeds; a downloadable test build exists for reviewers) is judged
  worth keeping — this spec makes it cheaper, not gone.
- Any change to the `push`-triggered (`main`/`develop`) or `workflow_dispatch`-triggered behavior of
  `build-and-notarize.yml` — both keep building the full signed `nsis`+`portable` targets exactly as
  today. This is the actual release/test-distribution artifact and must not regress.
- Adding `npm run lint` / `npm run typecheck` / `npm run quality-check` to any CI workflow. Real
  gap (R5a), separate concern from CI *speed*, deserves its own spec that can reason about which
  job should own it and what failure should block merge.
- Pinning `*_VERSION` env vars (e.g. `WHISPER_CPP_VERSION`, `QDRANT_VERSION`) to address the
  "cached binary can silently stay on an old 'latest' forever" staleness concern (R5b). That's a
  version-pinning *policy* decision (how often should CI refresh third-party binaries, and who
  decides), not a speed fix, and changing it without that policy discussion risks either constant
  cache-busting (slower CI, the opposite of this spec's goal) or an arbitrary refresh cadence nobody
  asked for.
- Restructuring `scripts/download-*.js` to write into per-tool subdirectories so each of the 9
  binaries could get its own independent cache entry. Considered and rejected: it would touch 9
  scripts' `BIN_DIR` logic plus `electron-builder.json`'s `extraResources` glob and every
  `prebuild*`/`predev*`/`prepack`/`predist` npm script that assumes a flat `resources/bin/` — a much
  larger, riskier change than this CI-speed spec's scope justifies, for a benefit (marginally faster
  cache-miss recovery for the *other* 8 binaries when one script changes) that R2's `restore-keys`
  fallback already captures in the common case at near-zero risk.
- Any change to `codeql.yml`, `lockfile-lint.yml`, `release.yml`, `auto-release.yml`,
  `update-nix.yml`, or the 7 individual native-binary build workflows
  (`build-windows-{key,mic,fast-paste,system-audio,text-monitor}-listener.yml`,
  `build-meeting-aec-helper.yml`, `build-linux-text-monitor.yml`) — none of the latter 7 trigger on
  `pull_request` (`workflow_dispatch`-only, confirmed), so they don't affect PR turnaround.
- Touching the "extra unscripted `npm install @rollup/...` " line (line 34) — it already benefits
  from this same job's existing `cache: "npm"` step (npm's package cache, keyed off
  `package-lock.json`, covers this ad-hoc install the same as `npm ci`), so there is no cache gap to
  fix there; leaving it as-is.
- Any change to application code, `electron-builder.json`'s `win.target` array, or
  `electron-builder.unsigned-win.json`'s content — this spec overrides the target *for PR runs
  only*, at the CLI-invocation level in the workflow file, not by editing either config file (see
  Design), so both configs continue to describe the "real" full-target build correctly for anyone
  running `npm run build:win`/`npm run dist` locally or via `workflow_dispatch`.

## Design

### R1 — PR-time `--dir` target for `build-and-notarize.yml`

**File**: `.github/workflows/build-and-notarize.yml`, the `Build and Sign Application` step
(currently lines 100–116).

Electron-builder's CLI exposes `--dir` as a standalone boolean flag ("Build unpacked dir. Useful to
test.", confirmed via `electron-builder --help`), independent of the `-w/--win` target-list flag —
i.e. `electron-builder --win --dir` builds the Windows platform in unpacked mode, overriding
`electron-builder.json`'s `win.target: ["nsis", "portable"]` for that invocation only, without
editing the config file itself. `npm run build:win` is defined as `build:renderer && electron-builder
--win` (`package.json` line 40), and `npm run <script> -- <extra args>` appends `<extra args>` to
the script's underlying command — so appending `--dir` to the args already passed on the
`pull_request` branch of the existing conditional is sufficient; no new npm script is needed.

Concretely: the `pull_request` branch of the step's shell conditional changes from invoking
`build:win` with `--publish never --config electron-builder.unsigned-win.json` to invoking it with
those same two flags **plus** `--dir`. The `else` branch (push/workflow_dispatch) is untouched —
still `--publish never` with no `--config` override, still the full signed `nsis`+`portable` build.

Whoever implements this must confirm empirically (see Validation Plan) exactly how the appended
`--dir` flag threads through `npm run build:win --` to the underlying `electron-builder --win`
invocation and that electron-builder's log output actually shows it built the unpacked target (not
silently ignoring the flag or erroring) — do not assume correctness from this description alone;
this is exactly the kind of CI-YAML change that needs a real run to prove, per the operational
caution about validating CI/CD pipeline changes rather than assuming a diff is correct.

**What stays identical between the old PR build and the new one**: renderer build
(`build:renderer`), `npm ci`, all 9 native-binary downloads, `npmRebuild: true`'s native-module
rebuild, `extraResources`/`asarUnpack` copying (all the whisper/llama/sherpa-onnx/qdrant/meeting-aec
binaries, models, native listener binaries), and the `afterPack.js` hook in full (its
`verifyUnpackedBinaries()`/`verifyMeetingAecHelper()`/`stripOnnxruntimeBinaries()` functions operate
on `context.appOutDir`, which is populated identically whether or not an installer is subsequently
built from it — confirmed by reading `scripts/afterPack.js`, whose hook registration in
`exports.default` has no target-specific branching).

**What changes**: no NSIS installer is compiled (skips `resources/nsis/installer.nsh` processing,
LZMA compression, uninstaller generation) and no portable single-exe archive is created. Output in
`dist/` becomes an unpacked `win-unpacked/` directory instead of `*-Setup.exe`/`*-portable.exe`
files. The subsequent `Upload Artifacts` step (unchanged, `path: dist/`) still succeeds and still
produces a downloadable `windows-build` artifact — reviewers get a zip of the unpacked app folder
(containing `EktosWhispr.exe`, directly runnable after unzipping) rather than a single installer or
portable executable. This is a real, if minor, UX change for anyone who downloads a PR's test
build; see Open Questions for the one-line alternative if this trade-off isn't acceptable.

**Residual risk, stated explicitly rather than hidden**: `resources/nsis/installer.nsh` and any
other NSIS-specific packaging logic is no longer exercised at PR time — only on the post-merge push
build. A regression introduced only in NSIS-specific config would now surface after merge, not
during review. Mitigation already available with zero new code: `workflow_dispatch` remains wired
on this workflow (confirmed, line 16), so a reviewer who is specifically touching
`electron-builder.json`'s `nsis` block, `resources/nsis/**`, or `electron-builder.unsigned-win.json`
can manually trigger a full-target run against their PR branch before merging, at the one-time cost
this spec otherwise removes from the default path.

### R2 — `restore-keys` for the native-binary cache

**File**: `.github/workflows/build-and-notarize.yml`, the `Cache native binaries` step (currently
lines 36–40).

Add a `restore-keys` entry with the same prefix already used for the primary key, minus the
`hashFiles(...)` suffix — i.e. `windows-x64-bin-` — directly below the existing `key:` line, in the
same style already used two steps later by `Cache Electron` (`restore-keys: windows-electron-`,
line 92). This is a same-shape, same-risk change to an already-established pattern in this exact
file, not a new caching approach.

Behavior after this change: on an exact-key cache hit (script files unchanged since last run),
nothing changes — full restore, all 9 download steps see their target files already present and
skip. On an exact-key miss (any `scripts/download-*.js` file changed at all) but a `restore-keys`
prefix match, the most recent previously-cached `resources/bin/` directory is restored instead of
starting empty; each of the 9 download steps then independently checks whether its own target
output file exists (confirmed logic in `scripts/download-whisper-cpp.js:71`, mirrored across the
other 8 scripts) and only re-downloads if it's actually missing or if the changed script now
expects a different output filename. Net effect: editing one download script's logic (bug fix,
retry tweak, unrelated typo) no longer forces re-downloading the other 8 binaries from scratch —
the previously all-or-nothing cache becomes best-effort-incremental without requiring any change to
the 9 download scripts themselves or to `electron-builder.json`'s `extraResources` glob.

Not addressed by this change (see Non-goals/R5b): a script that *hasn't* changed at all, whose
target binary is still fetched via GitHub's "latest release" (no `*_VERSION` pin), will keep
serving whatever was cached the first time, indefinitely, across both exact-key hits and
restore-keys fallback hits — this was already true before this change and remains a deliberate,
separate, out-of-scope tradeoff.

### R3 — `tests.yml` npm cache

**File**: `.github/workflows/tests.yml`, the `actions/setup-node@v4` step (currently lines 11–13).

Add `cache: "npm"` alongside the existing `node-version-file: .nvmrc` input — the identical input
key already used in `build-and-notarize.yml`'s equivalent step (line 28). No other change to this
workflow: `npm ci --ignore-scripts`, the `ELECTRON_OVERRIDE_DIST_PATH` env var, and the `npm test`
step are all untouched.

### Investigated and explicitly not changed

- Line 33–34's ad-hoc `npm install @rollup/rollup-win32-x64-msvc lightningcss-win32-x64-msvc
  @tailwindcss/oxide-win32-x64-msvc --no-save`: this job already has `cache: "npm"` (line 28,
  unaffected by R1–R3), so repeated installs of these three packages across runs already hit npm's
  local package cache rather than re-fetching from the registry each time. No incremental win
  available here without removing the step entirely, which would require first confirming
  `package-lock.json` reliably contains Windows-arch optional dependencies regardless of which OS
  last regenerated it — a lockfile-hygiene question orthogonal to this spec's scope.
- Per-tool cache subdirectories for `resources/bin/` — rejected as disproportionate scope; see
  Non-goals.
- Pinning `*_VERSION` env vars — rejected as a policy decision outside this spec's scope; see
  Non-goals.

## Validation Plan

### Automated

No local GitHub Actions runner exists in this environment, and this repo's `node --test` harness
(`test/helpers/*.test.js`, `test/utils/*.test.js`, run via `npm test`) has no precedent for
exercising `.github/workflows/*.yml` content directly — grepping the existing ~65 test files
confirms none touch CI workflow files, and no YAML-parsing library (`yaml`, `js-yaml`, etc.) is a
project dependency today, so adding a bespoke YAML-syntax-check test would mean introducing a new
dependency solely for this one-off check — not justified for a CI-config-only change. Per CLAUDE.md's
allowance for a documented, reviewed exception to the "every change needs an automated regression
test" rule: **the automated proof for this spec is GitHub Actions itself, exercised live** —
malformed workflow YAML fails the run immediately with a clear parse error, and the specific
behavioral claims this spec makes (PR builds skip NSIS/portable; push builds don't; the cache
restore-keys fallback works; `tests.yml` shows a warm npm cache) are only observable by watching a
real run, not by static inspection. This is exactly the "CI/CD pipeline change — validate by
observing a run, don't assume correctness from a diff" caution called out for this class of change.

### Manual

This spec's own implementation is required (per CLAUDE.md's mandatory Worktree + PR workflow) to
land via a dedicated worktree branch and a real PR against `main` — that PR's own CI run is the
validation vehicle; no extra process is being invented here beyond specifying what to look for in
it:

1. Open the PR that implements this spec's Design section. Confirm all four `pull_request`-triggered
   workflows complete: `tests.yml`, `lockfile-lint.yml`, `codeql.yml`, `build-and-notarize.yml`.
2. In that PR's `build-and-notarize.yml` run (Actions tab), inspect the `Build and Sign Application`
   step's log and confirm: (a) the `pull_request` branch of the shell conditional executed (visible
   in the step's own echoed command or surrounding log context); (b) electron-builder's log output
   shows it built the unpacked/`dir` target for `win` — i.e., no "building NSIS installer" /
   "building portable" log lines appear, and the produced path is a `win-unpacked` directory, not an
   installer/portable `.exe`. This is the concrete proof the `--dir` flag actually took effect, not
   just that the YAML parsed.
3. Confirm `afterPack.js`'s validation still ran and passed: its
   `"afterPack: verified unpacked bundled binaries"` log line (and the `stripOnnxruntimeBinaries`/
   `verifyMeetingAecHelper` output above it) appears in the same run's log — proving the
   packaging-correctness signal this PR-time build exists for is unchanged.
4. Confirm the `Cache native binaries` step's log shows either an exact-key hit, or (on the first
   run after this change lands, when the key format itself hasn't changed but this is a fresh
   observation point) a normal populate — and separately, as a forward-looking check for R2's actual
   payoff, that a *subsequent* PR which edits exactly one `scripts/download-*.js` file (any later PR,
   not necessarily this one) shows a `restore-keys` fallback restore in its cache step log rather
   than a fully cold `resources/bin/` directory.
5. Confirm the `Upload Artifacts` step still succeeds and produces a downloadable `windows-build`
   artifact from the PR run.
6. Compare this PR's `build-and-notarize.yml` job duration (Actions UI run summary) against a
   baseline run from `main` prior to this change (e.g. the most recent pre-change `push`-triggered
   run, or an earlier PR run) — record both durations as the quantified before/after proof the
   change reduced PR-time cost. Expect a meaningful reduction concentrated in the
   `Build and Sign Application` step specifically (NSIS + portable compression removed).
7. Confirm `tests.yml`'s `Install dependencies` step log shows an npm cache restore (a
   "Cache restored from key" / cache-hit line under the `setup-node` step's caching sub-step) rather
   than a fully cold `npm ci`, on this PR's run (first run after adding `cache: "npm"` may still show
   a cache-populate rather than a hit — a hit should appear on the PR's *next* commit push, if any,
   or on the following PR).
8. After merging this PR, watch the resulting `push`-triggered run of `build-and-notarize.yml` on
   `main` and confirm it is byte-for-byte unchanged in behavior from before this spec: the
   `Build and Sign Application` step's log shows the `else` branch executing, both an NSIS installer
   and a portable `.exe` appear in the `dist/` output, and Azure Trusted Signing credentials are
   exercised as before (no `azureSignOptions: null` override — that only applies via
   `electron-builder.unsigned-win.json`, which the `else` branch never references). This step is
   required to empirically prove R4 (push path unaffected), not just asserted by code inspection.

### Docs

- `docs/RECREATION_SPEC.md` §7.9 ("CI (`.github/workflows/`)"): update the one-line
  `build-and-notarize.yml` description — currently "push/PR, build Windows assinado via Azure
  Trusted Signing em push / não-assinado em PR" — to also note that the PR path now builds the
  unpacked `dir` target (not the full `nsis`+`portable` installer set), while push/`workflow_dispatch`
  remains the full signed `nsis`+`portable` build. The PR-vs-push divergence is now two axes
  (signing *and* target completeness), not signing alone.
- `docs/README.md`: no changes expected — it doesn't enumerate individual CI workflow behavior
  today; verify at execution time per its own "keeping this map accurate" note.
- `CLAUDE.md`: no changes expected — CLAUDE.md doesn't currently describe `build-and-notarize.yml`'s
  per-event target selection at all, so there's nothing stale to correct. If the executor judges a
  brief mention worthwhile (e.g. under "Build Issues"), that's a judgment call at execution time, not
  required by this spec.

## Open Questions

- **Non-blocking, but worth a quick confirmation before/at execution**: this spec's default design
  makes the PR-time artifact an unpacked `win-unpacked/` folder (still directly runnable —
  `EktosWhispr.exe` inside it — but not a single double-click installer/portable file like today).
  If preserving a one-file, double-click-runnable PR test build matters more than the extra
  packaging time it costs, the one-line alternative is to keep the `--dir`-free path but restrict
  `win.target` to `portable` only (drop `nsis`) for the `pull_request` branch instead of adding
  `--dir` — cheaper than today's `nsis`+`portable` combo (skips NSIS compilation specifically) while
  still producing a single self-contained `.exe` reviewers can run without unzipping a folder. This
  is a one-line swap in the same conditional this spec already touches, not a redesign — flagging it
  here so the project owner can pick either default at `Approved` time, or leave the spec's `--dir`
  choice as-is if the folder-based artifact is acceptable.
