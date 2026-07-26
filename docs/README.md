# EktosWhispr Documentation Map

This is the top-level index for all project documentation. Start here to find what you need.

---

## Core Reference

| Document | Purpose |
|----------|---------|
| [`CLAUDE.md`](../CLAUDE.md) | **Quick index** for AI assistants — commands, gotchas, key links |
| [`premises.md`](../premises.md) | 7 non-negotiable product premises (privacy, performance, speed, single-instance, graceful degradation, migration safety, data retention) |
| [`workflow.md`](../workflow.md) | Mandatory development workflow: spec-driven, worktree+PR, pr-reviewer gate |
| [`RECREATION_SPEC.md`](../RECREATION_SPEC.md) | **Authoritative current behavior** — §0 lists known divergences from CLAUDE.md |

---

## Architecture

| Document | Purpose |
|----------|---------|
| [`architecture/index.md`](architecture/index.md) | Architecture folder index |
| [`architecture/overview.md`](architecture/overview.md) | High-level: dual-window Electron, process separation, sidecars, data flow |
| [`architecture/file-map.md`](architecture/file-map.md) | Complete file tree with responsibilities |
| [`architecture/data-flow.md`](architecture/data-flow.md) | Index to detailed flow docs (dictation, meeting, screen-context, etc.) |
| [`architecture/ipc-registry.md`](architecture/ipc-registry.md) | Complete IPC channel registry (~250 channels) |
| [`architecture/settings-sync.md`](architecture/settings-sync.md) | Two-sources-of-truth pattern (localStorage ↔ .env) |
| [`architecture/native-binaries.md`](architecture/native-binaries.md) | All native binaries with build/download scripts |
| [`architecture/model-lifecycle.md`](architecture/model-lifecycle.md) | On-demand Whisper/Parakeet/llama-server lifecycle |

---

## Specifications (Target State)

| Document | Purpose |
|----------|---------|
| [`specs/index.md`](specs/index.md) | Specs folder index with template |
| [`specs/*.md`](specs/) | Individual implementation specs (see index for list) |

**Spec lifecycle**: Draft → Approved → Implemented — see `workflow.md`

---

## Platform-Specific

| Document | Purpose |
|----------|---------|
| [`platforms/index.md`](platforms/index.md) | Platform docs index |
| [`platforms/windows.md`](platforms/windows.md) | Windows: PTT, WASAPI, native binaries |
| [`platforms/macos.md`](platforms/macos.md) | macOS: Globe key, AudioTap, notarization |
| [`platforms/linux.md`](platforms/linux.md) | Linux: X11/Wayland, PipeWire, clipboard |
| [`platforms/wayland-hotkeys.md`](platforms/wayland-hotkeys.md) | GNOME/Hyprland/KDE D-Bus hotkeys |

---

## Development Guides

| Document | Purpose |
|----------|---------|
| [`guides/index.md`](guides/index.md) | Guides folder index |
| [`guides/development-workflow.md`](guides/development-workflow.md) | Spec-driven + worktree+PR + review gate |
| [`guides/testing.md`](guides/testing.md) | Test structure, runners, mandatory rules |
| [`guides/debugging.md`](guides/debugging.md) | Debug logging, log locations, common flows |
| [`guides/build.md`](guides/build.md) | Build, packaging, platform notes |
| [`guides/adding-features.md`](guides/adding-features.md) | IPC, settings, components, sidecars checklist |
| [`guides/common-issues.md`](guides/common-issues.md) | Troubleshooting audio, transcription, clipboard, build |

---

## How to Navigate

- **New to the project?** → Start with `CLAUDE.md` + `premises.md` + `workflow.md`
- **Need to understand architecture?** → `architecture/overview.md` → `architecture/file-map.md`
- **Implementing a feature?** → Create spec in `specs/` → follow `workflow.md`
- **Debugging?** → `guides/debugging.md` + `guides/common-issues.md`
- **Building?** → `guides/build.md`
- **Platform-specific?** → `platforms/` index
- **Current behavior diverges from docs?** → Check `RECREATION_SPEC.md` §0

---

## Documentation Update Rule

**Every spec implementation** updates:
1. The spec file → `Status: Implemented`
2. `RECREATION_SPEC.md` §0 (divergences) + relevant sections
3. Folder `index.md` files (this file, `architecture/index.md`, `specs/index.md`, `platforms/index.md`, `guides/index.md`)
4. `CLAUDE.md` if new commands/gotchas added

**No stale docs.** If it's not updated, the iteration isn't done.