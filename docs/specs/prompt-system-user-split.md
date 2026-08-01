# System/User Prompt Template Split

## Status
Implemented

> Approved by project owner on 2026-08-01. This spec extends
> `docs/specs/prompt-template-placeholders.md` (which stays the source of truth for the
> three `{{...}}` system-context tokens) by splitting the cleanup route's *message
> assembly*: the system template and the user template are resolved independently and sent
> as separate `[system, user]` messages. The user template never receives system-template
> text and the system template never receives the raw transcription.

## TL;DR

Today the cleanup route assembles messages in one of two shapes, both of which mix
template text with the raw dictated speech in a way the owner asked to stop:

- `ReasoningService.callChatCompletionsApi()` (`isCleanup` branch) resolves the **combined**
  system+user template (system instructions + the `cleanupPrompt` user template) and sends it
  as a single `role: "user"` message, with the transcription already substituted into
  `{{user-transcription}}`. The request has no `role: "system"` message at all.
- Every chat provider (`openai`, `anthropic`, `gemini`, `local`, `enterprise`) sends the
  resolved system template as the system message and the **raw `text`** as the user message —
  the user template (`cleanupPrompt`, with `##user-transcription##` + `{{user-transcription}}`)
  is never actually used; the transcription is injected without its wrapper.

This spec makes both paths consistent and correct:

1. `resolvePrompt()` is split into `resolveSystemPrompt(kind, opts)` (system template only)
   and `resolveUserPrompt(kind, opts)` (user template only), each running the same
   placeholder substitution over its own template. `resolvePrompt()` remains as a
   convenience that joins both — unchanged for callers that still want one combined string
   (dictation agent, chat agent).
2. `BaseReasoningService` exposes `getUserPrompt(agentName, screenContextText?,
   userTranscription?)` next to the existing `getSystemPrompt(...)`, and
   `ProviderContext` gains the matching method.
3. The cleanup route sends **two** messages: `{ role: "system", content: resolvedSystem }`
   and `{ role: "user", content: resolvedUser }` where `resolvedUser` is the user template
   with `{{user-transcription}}` → the dictated text (wrapped in the template's own
   `<transcription>` markup). The system message never carries the transcription; the user
   message never carries system-template text.
4. All chat providers use `config.userPrompt`/`ctx.getUserPrompt(...)` for the user message
   instead of raw `text` when no `systemPrompt` override exists (the cleanup path). The
   agent path (`config.systemPrompt` set) keeps raw `text` as the user message.

**Owner decisions:** no concatenation of any kind — only placeholder substitution; the
system template supplies only system-message text, the user template only user-message
text. Nothing is appended to either field beyond what its own template contains.

**Practical impact**: cleanup requests now carry the transcription inside the user
template's `<transcription>` wrapper as a proper user message, with a real system message.
Model-visible text is the same for default templates; the structure matches what the model
already expects ("clean the dictated speech located inside the `<transcription>` section" —
the `<transcription>` reference in the system template now actually describes the user
message).

## Problem / Goal

The cleanup prompt is authored as two distinct templates (system instructions +
`cleanupPrompt` user template) and both are edited separately in the UI, but the cleanup
route never sends them as a matched pair:

- The `callChatCompletionsApi` fallback path (used by groq/lan and any provider routing
  through it) sends the combined resolved string as the user message and no system message.
- The five chat providers send the system template as system and the **raw text** as user —
  silently dropping the user template entirely and leaving the transcription unwrapped.

Either way the model sees the same template text, but neither matches the authoring model
(two templates → two messages) and the raw-text path loses the user template's structure.
The owner explicitly asked: the user content must be the user template filled in the UI and
saved, with placeholders replaced, sent to the AI exactly as the system template is — no
concatenation of anything directly.

## Requirements

1. `resolvePrompt(kind, opts)` is split into `resolveSystemPrompt(kind, opts)` and
   `resolveUserPrompt(kind, opts)`. Each resolves **only its own template** (custom via
   `customSystemInstructions[kind]`/`customPrompts[kind]`, else the default) and runs the
   full placeholder substitution (including `{{user-transcription}}`) over it. The system
   template's substitution must not be fed the raw transcription text (it only resolves if
   the author placed `{{user-transcription}}` in their system template); the user template's
   substitution is fed `userTranscription` so `{{user-transcription}}` → the dictated text.
2. `resolvePrompt` remains exported and returns the joined `system\n\nuser` string when both
   exist (its exact current behavior — used by dictation-agent/chat-agent routes). Kinds
   with no system template (e.g. `chatAgent`) resolve to the user template alone.
3. `getCleanupSystemPrompt(...)` resolves via `resolveSystemPrompt("cleanup", ...)` and
   `getCleanupUserPrompt(...)` (new, same parameter signature) resolves via
   `resolveUserPrompt("cleanup", ...)`, both forwarding `screenContextText` and
   `userTranscription`.
4. `BaseReasoningService`:
   - `getSystemPrompt(agentName, screenContextText?)` resolves the system template only
     (drops the `userTranscription` parameter — no longer part of the system message).
   - new `getUserPrompt(agentName, screenContextText?, userTranscription?)` resolves the
     user template only.
5. `ProviderContext` gains `getUserPrompt(agentName, screenContextText?, userTranscription?)`.
6. `ReasoningService.callChatCompletionsApi`'s `isCleanup` branch sends
   `[{ role: "system", content: resolvedSystem }, { role: "user", content: resolvedUser }]`
   instead of the single combined user message.
7. Chat providers (`openai`, `anthropic`, `gemini`, `local`, `enterprise`): when no
   `systemPrompt` override is set (the cleanup path), the user message is
   `ctx.getUserPrompt(agentName, config.screenContextText, text)`; when an override exists
   (the agent path), it stays raw `text`. `systemPrompt` continues to gate which path is
   active — no new config flag.
8. No concatenation anywhere: neither message field appends dictionary/screen-context/language
   blocks or the transcription outside of the template's own placeholder tokens. The
   no-append-if-missing rule from `prompt-template-placeholders.md` Requirement 5 applies to
   both templates.

## Non-goals

- No change to the default template *text* (system instructions, `cleanupPrompt`) — only to
  how the resolved fields are shipped.
- No change to dictation-agent (`fullPrompt`), chat-agent, or tool-calling message assembly.
- No change to the three system-context tokens (`{{languages}}`, `{{user-dictionary}}`,
  `{{screen-ocr}}`) or their substitution — covered by `prompt-template-placeholders.md`.
- No new settings, no UI change, no migration.

## Design

### Message shapes after the change

Cleanup route (`config.systemPrompt` unset), both `callChatCompletionsApi` and the chat
providers:

```
messages = [
  { role: "system", content: <resolveSystemPrompt("cleanup", opts)> },
  { role: "user",   content: <resolveUserPrompt("cleanup", optsWithUserTranscription)> },
]
```

Agent route (`config.systemPrompt` set): unchanged —
`{ role: "system", content: config.systemPrompt }`, `{ role: "user", content: text }`.

### Code map

- `src/config/prompts/index.ts`: extract `resolveSystemPrompt`/`resolveUserPrompt` from the
  body of `resolvePrompt`; both call the shared `applySubstitutions` over their own
  template. `getDefaultSystemInstructions`/`getDefaultPromptText` select the template;
  `customSystemInstructions[kind]`/`customPrompts[kind]` override (same precedence as
  today).
- `src/config/prompts.ts`: re-export both new resolvers; `getCleanupSystemPrompt` delegates
  to `resolveSystemPrompt`; new `getCleanupUserPrompt` delegates to `resolveUserPrompt`.
- `src/services/BaseReasoningService.ts`: `getSystemPrompt` loses `userTranscription`; new
  `getUserPrompt` added.
- `src/services/ai/inferenceProviders/types.ts`: `ProviderContext.getUserPrompt` added.
- `src/services/ReasoningService.ts`: constructor binds `getUserPrompt`; the
  `callChatCompletionsApi` `isCleanup` branch and `processTextStreamed` build the two-message
  shape; the debug-log block logs both resolved fields.
- `src/services/ai/inferenceProviders/{openai,anthropic,gemini,local,enterprise}.ts`:
  `userContent = config.systemPrompt ? text : ctx.getUserPrompt(...)`.

## Validation Plan

### Automated

- `test/components/promptPlaceholders.test.js` (extended):
  - System and user templates resolve independently: with custom `customSystemInstructions`
    and `customPrompts` for `cleanup` set, `resolveSystemPrompt` returns only the custom
    system text (no user-template text, no transcription) and `resolveUserPrompt` returns
    only the custom user text with `{{user-transcription}}` substituted.
  - Placeholders substitute within their own template with no cross-field injection: the
    resolved system carries the dictionary/language/screen-context blocks; the resolved user
    (default template) carries neither.
- `test/components/promptSystemUserSplit.test.js` (new):
  - `openaiProvider.call` (cleanup path, mocked `fetch`) sends exactly two messages:
    `system.content === resolveSystemPrompt("cleanup", {agentName})` (never containing the
    dictated text) and `user.content === resolveUserPrompt("cleanup", {userTranscription:
    text})` (containing the text, with the template's own wrapper).
  - `openaiProvider.call` with a `systemPrompt` override sends the override as system and raw
    `text` as user (agent path unchanged).
- Existing suite: `npm test` passes in full; `npm run typecheck` passes.

### Manual

1. Dictate a phrase with a non-empty Custom Dictionary; confirm via debug logs that the
   cleanup request has a `system` message (resolved system template, no transcription) and a
   `user` message (user template with the transcription inside its `<transcription>`
   wrapper), for both a provider (e.g. OpenAI-compatible) and the groq/lan path through
   `callChatCompletionsApi`.
2. Save a custom cleanup *user* template (PromptStudio) and confirm the saved text (with its
   placeholders substituted) is what lands in the user message; save a custom cleanup
   *system* template and confirm it lands in the system message — and neither field contains
   the other's text.

### Docs

- `docs/RECREATION_SPEC.md` — update the `callChatCompletionsApi`/`processTextStreamed` and
  `resolvePrompt`/`getCleanupSystemPrompt` descriptions to describe the two-message shape and
  the new `resolveSystemPrompt`/`resolveUserPrompt`/`getCleanupUserPrompt`/`getUserPrompt`
  split.
- `docs/specs/prompt-template-placeholders.md` — unchanged (still authoritative for the
  placeholder tokens); this spec is additive to it.

## Open Questions

- None.
