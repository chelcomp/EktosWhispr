# EktosWhispr — AI Assistant Reference (Index)

**This file is an index only.** For ground-truth current behavior see [`docs/RECREATION_SPEC.md`](docs/RECREATION_SPEC.md) §0. For target state see [`docs/specs/`](docs/specs/).

---

## Quick Links

| Topic | Location |
|-------|----------|
| **Architecture & file map** | [`docs/architecture/`](docs/architecture/) |
| **Non-negotiable premises** | [`docs/premises.md`](docs/premises.md) |
| **Development workflow (spec-driven, worktree+PR, pr-reviewer)** | [`docs/workflow.md`](docs/workflow.md) |
| **Testing guide** | [`docs/TESTING.md`](docs/TESTING.md) |
| **Debugging & logging** | [`docs/debugging.md`](docs/debugging.md) |
| **Build & packaging** | [`docs/build.md`](docs/build.md) |
| **Platform specifics** | [`docs/platforms/`](docs/platforms/) |
| **Specs (target state)** | [`docs/specs/`](docs/specs/) |
| **Ground truth (actual behavior)** | [`docs/RECREATION_SPEC.md`](docs/RECREATION_SPEC.md) |
| **Documentation map** | [`docs/README.md`](docs/README.md) |

---

## Mandatory Rules (Summary)

1. **Spec-driven**: Every change starts with `spec-planner` → creates/updates `docs/specs/<slug>.md` → user approves → `spec-executor` implements → `pr-reviewer` gates commit.
2. **Worktree + PR**: All code changes in a git worktree branched from `main`; push branch → `gh pr create` on `pr-reviewer` PASS.
3. **Debug first**: Run app with `EKTOSWHISPR_LOG_LEVEL=debug` before/after changes; report git commit hash.
4. **Docs updated per iteration**: Folder `index.md` files + CLAUDE.md + RECREATION_SPEC.md + spec doc all updated when a spec lands.
5. **Node 26 pinned** (`.nvmrc`); never regenerate `package-lock.json` with another major.
6. **Premises are law** (docs/premises.md): privacy (no telemetry, loopback-only listeners), idle ≤300 MB RAM / <2% CPU, raw transcription ≤500 ms, single instance, graceful degradation of optional binaries, migration safety (never lose user data), data-retention (operational data never auto-purges). `pr-reviewer` hard-fails violations.
7. **Skills process**: Use the superpowers skill (brainstorming → plans → TDD → verification) and **ponytail in ULTRA mode — always** (laziest working solution, stdlib over deps, deletion over addition, YAGNI) for every discovery, planning, review, and implementation flow. Ponytail is permanently active at ULTRA; never drift to default/normal mode.
8. **Temp files**: Any temporary file needed in the project (e.g. PR bodies, scratch) goes in `{projectdir}\tmp` — never the OS temp dir.
9. **NO FAILING TESTS, EVER**: The test suite (`npm test`) must always be fully green. If any test fails — whether caused by the current change or pre-existing — fix it immediately. Do NOT commit, push, create a PR, or report a task as done while any test fails. Enter a fix loop until the entire suite passes, then re-run all quality gates.

---

## Code Review (always-on checklist)

> YAGNI + one-liners: the laziest solution that actually works. When a review is requested, run this checklist every time.

1. Review with **ponytail ULTRA** (hunt over-engineering, YAGNI, simpler stdlib/native alternatives; shortest working diff wins).
2. **Run the tests** (`npm test`).
3. **Build the app** (`npm run build:renderer` + `npm run typecheck` + `npm run lint` + `npm run format:check`).
4. **Compare against plan and spec requirements** (`docs/specs/<slug>.md` + `docs/RECREATION_SPEC.md`) — mark each item done/pending.
5. **Update the documentation**, marking what is complete vs pending.
6. **Create tasks** for every pending item and bug found (GH issues, see `docs/workflow.md`).
7. **Run review agents in parallel/background when possible** (multiple agents on independent concerns).
8. **On finding a bug: fix it, then restart the review** from step 1.

---

## Folder Index Files

Each folder under `docs/` has an `index.md` listing its contents and purpose:

- `docs/architecture/index.md`
- `docs/platforms/index.md`
- `docs/specs/index.md` (see also `docs/specs/README.md`)
- `docs/guides/index.md`

---

## Key Commands

```bash
# Debug run (always use before/after changes)
EKTOSWHISPR_LOG_LEVEL=debug npm run dev

# Quality gates
npm run lint && npm run typecheck && npm run format:check && npm test

# Single test
node --test test/helpers/autoLearnDictionary.test.js
# Single component test (needs the tsx register for .jsx/.tsx)
node --test --import ./test/setup/tsxRegister.js test/components/<file>.test.jsx

# Native binaries
npm run compile:native
npm run download:whisper-cpp
npm run build:renderer   # renderer build (also a pr-reviewer gate)
```

> `npm run dev` / `npm start` run `compile:native` + binary downloads via their `pre*` hooks — first run downloads binaries and compiles platform key-listener/paste helpers (needs network + time).
