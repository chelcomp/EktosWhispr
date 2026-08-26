# EktosWhispr Documentation Index

**Chained reference from AGENTS.md** — Start here to navigate documentation.

---

## Quick Links

| File | Purpose |
|------|---------|
| `CLAUDE.md` | **Quick index** for AI assistants — commands, gotchas, key links |
| `premises.md` | 7 non-negotiable product premises (privacy, performance, speed, single-instance, graceful degradation, migration safety, data retention) |
| `workflow.md` | Mandatory development workflow: spec-driven, worktree+PR, pr-reviewer gate |
| `RECREATION_SPEC.md` | **Authoritative current behavior** — §0 lists known divergences from CLAUDE.md |

---

## Documentation Folders

| Folder | Index File | Contents |
|--------|------------|----------|
| `architecture/` | [`INDEX.md`](architecture/INDEX.md) | System architecture, IPC registry, model lifecycle |
| `specs/` | [`INDEX.md`](specs/INDEX.md) | Implementation specs (target: Implemented) |
| `guides/` | [`INDEX.md`](guides/INDEX.md) | Development guides and workflows |
| `platforms/` | [`INDEX.md`](platforms/INDEX.md) | Platform-specific documentation |
| `plans/` | [`INDEX.md`](plans/INDEX.md) | Active planning documents and work tracking |
| `superpowers/` | [`INDEX.md`](superpowers/INDEX.md) | Superpowers brainstorming and visual companion |
| `screenshots/` | N/A | UI screenshots for verification |

---

## How to Navigate

- **New to the project?** → `CLAUDE.md` + `premises.md` + `workflow.md`
- **Understanding architecture?** → `architecture/INDEX.md` → `architecture/overview.md`
- **Implementing a feature?** → Create spec in `specs/` → follow `workflow.md`
- **Debugging?** → `guides/debugging.md` + `guides/common-issues.md`
- **Building?** → `guides/build.md`
- **Current behavior diverges from docs?** → Check `RECREATION_SPEC.md` §0

---

## Documentation Update Rule (Per Iteration)

When a spec lands (`Implemented`):
1. Update the spec file → `Status: Implemented`
2. Update `RECREATION_SPEC.md` §0 (divergences) + relevant sections
3. Update folder `INDEX.md` files (this file + sub-folder indexes)
4. Update `CLAUDE.md` if new commands/gotchas added

**No stale docs.** If it's not updated, the iteration isn't done.