# AGENTS.md — Quick-Start for AI Assistants

# EktosWhispr — AI Assistant Reference (Index)

**This file is an index only.** For ground-truth current behavior see [`docs/RECREATION_SPEC.md`](docs/RECREATION_SPEC.md) §0. For target state see [`docs/specs/`](docs/specs/).

---

## Quick Links

| Topic | Location |
|-------|----------|
| **Architecture & file map** | [`docs/architecture/`](docs/architecture/) |
| **Non-negotiable premises** | [`docs/premises.md`](docs/premises.md) |
| **Development workflow (spec-driven, worktree+PR, pr-reviewer)** | [`docs/workflow.md`](docs/workflow.md) |
| **Testing guide** | [`docs/testing.md`](docs/testing.md) |
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

# Native binaries
npm run compile:native
npm run download:whisper-cpp
```


## Non-Negotiable Rules
1. **Privacy**: Zero external telemetry/calls. Local services must bind to `127.0.0.1`/`localhost` only.
2. **Performance**: Idle budget ≤300 MB RAM, <2% CPU. Lazy-spawn sidecars on-demand.
3. **Single instance**: Do not break `app.requestSingleInstanceLock()`.
4. **Graceful degradation**: Missing helper binaries must not crash the app.
5. **Migration safety**: Scheme/key changes must ship migrations. Existing data must survive.

## Git Worktree (Mandatory)
Branch from `main` before editing: `git worktree add ../ektoswhispr-<desc> -b <branch>`
- Never edit directly in main checkouts. Run `npm test` and `npm run typecheck` in the worktree.
- Push branch and use `gh pr create` (no direct push to `main`).

## Test & Verification Gotchas
- **Test Runner**: Node built-in (`node --test`).
- **Component Tests**: Run with: `node --test --import ./test/setup/tsxRegister.js test/components/SomeComponent.test.js`
- **Root/Src Linting**: ESLint runs separately for root and `src/`. Run both: `eslint . && cd src && eslint .` (or `npm run lint`).
- **Quality Gates**: `npm run quality-check` runs format + typecheck but not tests/lint. Run all before PR.

## Code/Engine Gotchas
- **CommonJS/ESM**: CommonJS in `src/helpers/`/`main.js`, ESM in `src/` renderer.
- **On-Demand Lifecycle**: Engines cold-start on hotkey-down, idle-unload after 5 mins.
- **Dynamic Prompt Vocabulary**: Mines transcript history for prompt words; separate from Custom Dictionary.
