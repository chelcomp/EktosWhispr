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