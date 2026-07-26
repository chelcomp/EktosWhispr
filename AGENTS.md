# AGENTS.md — Quick-Start for AI Assistants

Refer to `CLAUDE.md` for architecture and `docs/RECREATION_SPEC.md` §0 for divergence truths.

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
