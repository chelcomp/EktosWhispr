# Specifications Index

| Spec | Status | Description |
|------|--------|-------------|
| `on-demand-model-lifecycle.md` | Implemented | Whisper/Parakeet/llama-server cold-start on hotkey, idle-unload |
| `dictation-progressive-vad-batching.md` | Implemented | Progressive VAD chunking, merge-retry, tail-finalize budget |
| `active-window-screen-context.md` | Implemented | Windows screen capture + OCR → LLM prompt placeholder |
| `dynamic-prompt-vocabulary.md` | Implemented | Auto-mined vocab from history + screen-context (opt-in) |
| `auto-learn-dictionary.md` | Implemented | Post-paste text monitor → correction extraction → anti-oscillation |
| `voice-agent-hotkey.md` | Implemented | Dedicated hotkey → dictation agent route (bypasses cleanup) |
| `meeting-recording-manual.md` | Implemented | Manual meeting hotkey → note creation → dual-channel recording |
| `remove-qdrant-dependency.md` | Implemented | Removed Qdrant sidecar + MiniLM embeddings; FTS5-only search |
| `llama-server-vram-tuning.md` | Implemented | KV-cache q8_0, --fit on, auto context doubling up to 64K |
| `dictation-language-detection-fix.md` | Implemented | Whisper `--language` flag + language mismatch retry |
| `live-preview-vad-sensitivity.md` | Implemented | Separate "Live" VAD tab (energy-based) from Silero VAD tab |
| `prompt-template-placeholders.md` | Implemented | `{{screen-ocr}}` positional placeholder in system prompts |

---

## Spec Template

All specs follow this structure:

```markdown
# Spec: <slug>

## Status: Draft | Approved | Implemented

## TL;DR
(≤20 lines: what changes, decisions, open questions, user impact)

## Problem / Goal

## Requirements

## Design

## Validation Plan
- Automated regression test: <specific test file>
- Manual validation steps: ...

## Migration / Compatibility
```

See [`../workflow.md`](../../workflow.md) for the mandatory spec-driven pipeline.