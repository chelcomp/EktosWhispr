# Development Workflow (Mandatory)

## Spec-Driven Development Pipeline

**Every change — feature, refactor, bugfix — starts from a spec.**

```
spec-planner (Plan) → User Approves (TL;DR review) → spec-executor (Implement) → pr-reviewer (Gate) → PR
```

### 1. Plan — `spec-planner`
- Reads/creates/updates `docs/specs/<slug>.md`
- Produces: Problem, Requirements, **Design**, **Validation Plan** (concrete automated tests)
- **Never edits application code**
- **Mandatory TL;DR section** (≤20 lines): what changes, decisions, open questions, user impact

### 2. Approve
- User reviews TL;DR in chat (not file) → approves
- Status: `Draft` → `Approved`

### 3. Execute — `spec-executor`
- Implements **exactly** per approved spec's Design section
- Runs Validation Plan (tests)
- Updates relevant docs (RECREATION_SPEC.md, folder index.md files, CLAUDE.md)
- Marks spec `Implemented`
- Invokes `pr-reviewer` before commit

### 4. Gate — `pr-reviewer` (Mandatory Pre-Commit)
Runs:
- `npm test` (full suite)
- `npm run lint`
- `npm run typecheck`
- `npm run format:check`
- Renderer build (`npm run build:renderer`)
- Diff review: bugs, regressions, missing test coverage
- **Premise compliance** (privacy, idle budget, 500ms budget)
- **CLAUDE.md + RECREATION_SPEC.md adherence** (hard pass/fail)

Returns `PASS` / `FAIL`. Only proceed on `PASS`.

---

## Worktree + PR Required (Every Code Change)

| Step | Action |
|------|--------|
| 1. Isolate | `EnterWorktree` → fresh git worktree from latest `main` |
| 2. Implement | `spec-executor` works inside worktree |
| 3. Gate | `pr-reviewer` runs inside worktree |
| 4. Ship | On `PASS`: push branch → `gh pr create` immediately |
| 5. Keep | `ExitWorktree` with `action: "keep"` until PR merged |

**No commits directly to `main`**. Docs-only changes exempt.

---

## Debug-First Rule

**Before and after every change:**
```bash
EKTOSWHISPR_LOG_LEVEL=debug npm run dev
```
Report git commit hash (`git log -1 --format="%H %s"`) so user can verify version.

---

## Documentation Update Rule (Per Iteration)

When a spec lands (`Implemented`):
- Update `docs/RECREATION_SPEC.md` §0 (divergences) + relevant sections
- Update folder `index.md` files (`docs/architecture/index.md`, `docs/specs/index.md`, etc.)
- Update `CLAUDE.md` if new commands/gotchas added
- Update the spec file itself to `Status: Implemented`

**No stale docs.** If it's not updated, the iteration isn't done.
---

## Index.md Requirement (Folder Contents Index)

**Every folder (except `src/` and `test/`) containing `.md` files and/or scripts MUST have an `INDEX.md` file.**

### Requirements
- **Purpose**: Index of folder contents with summary and instructions on when to use each file
- **Location**: Always named `INDEX.md` (uppercase, not `index.md`)
- **Structure**: Table of files with description and usage instructions
- **Maintenance**: Updated on every NEW file creation or file modification
- **Chained reference**: Used by `docs/AGENTS.md` as the lookup reference

### Template
```markdown
# <Folder Name> Contents Index

| File | Usage |
|------|-------|
| `file.md` | Brief description and when to use |
| `script.js` | Brief description and when to use |
```

### When to Update
- Create new `INDEX.md` when folder is created
- Add entry when new file is added to folder
- Update description when file's purpose changes
- Verify index is current before PR review

**No stale indexes.** If it's not updated, the iteration isn't done.