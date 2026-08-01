# AGENTS.md — Quick-Start for AI Assistants

Refer to `CLAUDE.md` for architecture and the spec-driven workflow, and `docs/RECREATION_SPEC.md` §0 for divergence truths (ground truth is the code, not the docs).

## Non-Negotiable Rules

1. **Privacy**: Zero external telemetry/calls. Local services must bind to `127.0.0.1`/`localhost` only.
2. **Performance**: Idle budget ≤300 MB RAM, <2% CPU. Lazy-spawn sidecars on-demand.
3. **Single instance**: Do not break `app.requestSingleInstanceLock()`.
4. **Graceful degradation**: Missing helper binaries must not crash the app.
5. **Migration safety**: Scheme/key changes must ship migrations. Existing data must survive.

## Mandatory Workflow (CLAUDE.md, docs/workflow.md)

- **Spec-driven**: Every code change starts with a spec `docs/specs/<slug>.md` (Problem, Design, Validation Plan, TL;DR ≤20 lines) → user approves → implement → `pr-reviewer` gates commit (test, lint, typecheck, format:check, renderer build, premises). No code without an approved spec.
- **Worktree + PR**: Branch from `main` via `git worktree add .wt/<desc> -b <branch>` (all worktrees live in `.wt/` at the repo root); never commit to `main`; push branch → `gh pr create` on `pr-reviewer` PASS. Docs-only changes are exempt.
- **Docs updated per iteration**: No stale docs — update `CLAUDE.md`, `docs/RECREATION_SPEC.md`, and folder `index.md` files alongside code.
- **Debug first**: Run `EKTOSWHISPR_LOG_LEVEL=debug npm run dev` before/after changes; report the git commit hash.

## Test & Verification Gotchas

- **Test Runner**: Node built-in (`node --test`). `npm test` runs helpers/utils/models first, then components.
- **Single test**: `node --test test/helpers/<file>.test.js`; component tests need the tsx register: `node --test --import ./test/setup/tsxRegister.js test/components/<file>.test.js`.
- **Lint/Format**: ESLint runs separately for root and `src/` (`npm run lint`). `format:check` also runs Prettier over `**/*.md` — doc edits must be prettier-clean.
- **Quality Gates**: `npm run quality-check` runs format + typecheck but NOT tests/lint. Run all before PR.

## Environment / Toolchain

- **Node 26 pinned** (`.nvmrc`, `engine-strict=true` in `.npmrc`). Never regenerate `package-lock.json` with another major (CI lockfile-lint).
- **First run**: `npm run dev`/`npm start` pre-hooks compile native helpers (`compile:*`) and download binaries/models — needs network + time on first run.

## Code/Engine Gotchas

- **CommonJS/ESM**: CommonJS in `src/helpers/`/`main.js`; ESM in `src/` renderer.
- **On-Demand Lifecycle**: Engines cold-start on hotkey-down, idle-unload after 5 mins.
- **Dynamic Prompt Vocabulary**: Mines transcript history for prompt words; separate from Custom Dictionary.
- **i18n**: Locale strings live in `src/locales/{en,pt}/` (`translation` + `prompts` namespaces); new keys/placeholders must be added to all languages — run `npm run i18n:check`.
