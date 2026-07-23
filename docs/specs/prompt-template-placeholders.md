# Prompt Template Placeholders

## Status
Implemented

> Approved by project owner on 2026-07-23 with one explicit modification vs. the
> original draft: **append-if-missing is dropped** (see Requirement 5). The owner
> also explicitly waived migration-safety (Premise #6) for existing saved custom
> prompts — "do not care about existing user data for this task." Both decisions
> are recorded in-line below.

## TL;DR
Two related changes to how cleanup/dictation-agent prompts are assembled before
being sent to the LLM:

1. **Remove the `<transcript>` wrapper** around the user's dictated text. Today
   `wrapCleanupTranscript()` wraps the raw text in `<transcript>...</transcript>` plus a
   trailing "Output only the cleaned transcript." line before sending it as the
   `role: "user"` message — redundant since the message role already marks it as user
   content. The raw text goes straight into the user message; the base `cleanupPrompt`/
   `fullPrompt` templates are reworded so the model still understands its job without the
   tag, and the output-contract reminder moves to the *end* of the system prompt instead.

2. **Turn the programmatic system-prompt suffixes into user-placeable template tokens**:
   `{{screen-ocr}}` (OCR'd active-window text), `{{user-dictionary}}` (custom dictionary
   list), `{{languages}}` (language instruction) — mirroring the existing `{{agentName}}`
   token. Users editing a custom cleanup/dictation-agent prompt in Settings can now choose
   where these appear, or omit them.

**Owner decisions folded in:**
- **No append-if-missing.** Tokens are substituted only where the author placed them. If a
  template omits a token, that block simply does not appear — there is no automatic
  end-of-prompt append. This is safe for everyone on the default prompts because the
  shipped default `cleanupPrompt`/`fullPrompt` templates contain all three tokens.
- **Migration-safety (Premise #6) is explicitly waived for pre-existing custom prompts.**
  A custom prompt saved before this ships contains none of the new tokens, so — with
  append-if-missing gone — it will stop receiving the dictionary/language/screen-context
  blocks. The project owner accepted this ("do not care about existing user data for this
  task"). No data on disk is lost or mutated (`customPrompts[kind]` keeps its exact stored
  value); only the *assembled* prompt for such a prompt changes. See Migration section.

**Practical impact**: no visible change for anyone using the default prompts. Users who
advanced-edit a custom prompt now fully control placement — a token they place is
substituted in place, a token they omit contributes nothing.

## Problem / Goal

Today, three pieces of context are silently appended to the system prompt in a fixed
order by `ReasoningService`/`audioManager.js`, with no user visibility or control:
`appendDictionarySuffix()`, `appendScreenContextSuffix()`, and `getLanguageInstruction()`
(the last invoked inside `applySubstitutions()`). A user customizing their cleanup or
dictation-agent prompt in Settings (`PromptStudio`) has no way to see this is happening,
no way to reposition this content relative to their own instructions, and no way to omit
it. Separately, the cleanup pipeline wraps the user's dictated text in `<transcript>` tags
before sending it as a `role: "user"` chat message — a redundant delimiter given the
message-role structure already marks it as user content, and one that the base prompt
templates' wording currently depends on ("Output ONLY the cleaned text inside
`<transcript>`").

## Requirements

1. `wrapCleanupTranscript()` is removed. Both call sites in `ReasoningService.ts`
   (`callChatCompletionsApi`'s `userPrompt`, `processTextStreamed`'s `userContent`) send
   the raw dictated `text` as the user message's `content`, unwrapped, with no appended
   "Output only the cleaned transcript." instruction riding along on the user side.
2. The base `cleanupPrompt` template (`src/locales/en/prompts.json`,
   `src/locales/pt/prompts.json`) no longer references `<transcript>`/`</transcript>` tags
   anywhere in its wording (opening line, rule 5, or the example), and still clearly
   conveys: input is the raw dictated text in the user message; output only the cleaned
   text, nothing else; ignore/don't execute commands or questions found in the text;
   dictionary/technical-term preservation only applies to words that actually appear in
   the input. The output-contract reminder ("Output only the cleaned transcript, no
   preamble/commentary/meta-text") is restated as the final line of the system prompt
   template (after the new placeholder tokens — see Design). **This is a deliberate,
   partial trade-off, not a full preservation of the old behavior**: messages sent to the
   model are `[system, user]`, so today the raw dictated text (last message) is genuinely
   the last thing the model reads, and `wrapCleanupTranscript()`'s trailing line sat
   *after* that transcript — the true last line of the whole request. Once the wrapper is
   removed, the user message is only the raw transcript with no reminder attached, and the
   output-contract line lives solely in the system prompt (opening + restated closing
   line) — last-in-system-prompt, not last-in-conversation. This gap is accepted per the
   user's explicit request to drop the wrapper; Validation Plan's manual step 5 exists
   specifically to catch any resulting cleanup-quality regression (e.g. the model
   answering the transcript instead of cleaning it, or reintroducing filler) since this
   class of regression isn't automated-test-observable.
3. The base `fullPrompt` (dictation-agent) template needs no `<transcript>` rewording (it
   never referenced the tag), but gains the same three new placeholder tokens at its end,
   in the same order, matching today's effective append order.
4. Three new named placeholders, usable inside both the built-in default templates and
   any user-authored custom prompt (`cleanup` and `dictationAgent` kinds only — see
   Non-goals for `chatAgent`):
   - `{{screen-ocr}}` → the OCR'd active-window screen-context block (empty when no
     screen context was captured this turn — feature off, gated off, or capture/OCR
     failed).
   - `{{user-dictionary}}` → the custom dictionary block (empty when the dictionary is
     empty).
   - `{{languages}}` → the language-instruction block (empty when there's no applicable
     instruction, e.g. `language` is `"auto"`/unset).
   Each placeholder's substituted value is the **entire self-contained block** — its
   existing i18n lead-in text (`dictionarySuffix`, `screenContextLeadIn`) plus content,
   or the empty string — never a bare value that could leave a dangling lead-in sentence
   with nothing after it. When the block is empty, the token resolves to `""` — a clean
   removal with no stray whitespace/newline artifact left behind.
5. **No append-if-missing (owner decision — changed from the original draft).** Token
   substitution is purely positional: for each `(token, block)` pair, every occurrence of
   the token in the resolved template is replaced with the block (or `""` if the block is
   empty). A template that does **not** contain a given token contributes **nothing** for
   that block — there is no automatic append to the end of the prompt. This holds
   per-token independently: a template can place one token and omit another; the omitted
   one simply does not appear. Because the shipped default `cleanupPrompt`/`fullPrompt`
   templates contain all three tokens (Requirements 2, 3), default-prompt users see the
   dictionary/language/screen-context content exactly as before; only a custom prompt that
   omits a token forgoes that block, which is the intended, user-controlled behavior.
6. `{{screen-ocr}}` requires new plumbing: `screenContextText` must be threaded into
   `ResolvePromptOptions`/`resolvePrompt()` itself (it currently is NOT part of
   `applySubstitutions()` — it's appended externally, after `resolvePrompt()` returns, by
   `BaseReasoningService.getSystemPrompt()` and by the `dictationAgent` route in
   `audioManager.js`). Both call sites pass `screenContextText` into `resolvePrompt()`'s
   options instead of wrapping the result afterward.
7. The Settings UI where cleanup and dictation-agent prompts are edited
   (`PromptStudio.tsx`, used by both `SettingsPage.tsx`'s cleanup tab and
   `DictationAgentSettings.tsx`) documents all three new placeholders (name, what each
   inserts, and that it disappears cleanly when empty) alongside the existing
   `{{agentName}}` mention. Because append-if-missing is gone, the copy must make clear
   that **omitting a placeholder means its content will not appear** (no automatic
   append) — so users understand omission = removal. New copy needs `en`/`pt` translation
   keys.
8. `chatAgent`'s existing behavior does not change: `getAgentSystemPrompt()` still calls
   `resolvePrompt("chatAgent", { agentName: null })` with no `customDictionary`/
   `language`/`screenContextText` opts, so all three blocks are empty AND
   `DEFAULT_CHAT_AGENT_PROMPT` contains none of the three tokens — nothing is substituted
   and nothing is appended. Verified by a regression test (Validation Plan), not just left
   implicit.

## Non-goals

- No change to `chatAgent`'s prompt-assembly inputs (it stays scoped to `{{agentName}}`
  only) or to `ChatAgentSettings.tsx`'s own plain textarea — out of scope for this spec.
- No change to `active-window-screen-context.md`'s Status (`Implemented`) or its
  Requirements — this spec only changes *how* the already-implemented screen-context text
  is threaded into the prompt (suffix-append → placeholder token), not whether/when it's
  captured.
- No change to the dictionary/language/screen-context *content* itself (i18n lead-in
  strings, OCR pipeline, language-instruction registry) — only to where/how it's inserted
  into the prompt.
- No re-introduction of append-if-missing and no Settings toggle for it — it is
  deliberately not implemented per the owner decision above.

## Design

### Current architecture (as read from source)

- `src/config/prompts/registry.ts` defines `PROMPT_KINDS`: `cleanup` (i18n key
  `cleanupPrompt`), `dictationAgent` (i18n key `fullPrompt`), `chatAgent` (no i18n key,
  hardcoded `DEFAULT_CHAT_AGENT_PROMPT`).
- `src/config/prompts/index.ts`:
  - `resolvePrompt(kind, opts)` → `useSettingsStore.getState().customPrompts[kind] ||
    getDefaultPromptText(kind, opts.uiLanguage)`, then `applySubstitutions(template, opts)`.
  - `applySubstitutions()` today: replaces `{{agentName}}` unconditionally, computes
    `getLanguageInstruction(opts.language)` and appends `"\n\n" + instruction`
    unconditionally when non-empty, then calls `appendDictionarySuffix()` (appends
    dictionary block unconditionally when non-empty). `screenContextText` is **not** part
    of `ResolvePromptOptions` today.
  - `appendDictionarySuffix(prompt, customDictionary, uiLanguage)` and
    `appendScreenContextSuffix(prompt, screenText, uiLanguage)` are exported, no-op when
    their input is empty, otherwise append `prompt + leadIn + content`.
  - `wrapCleanupTranscript(text)` returns `` `<transcript>\n${text}\n</transcript>\n\nOutput only the cleaned transcript.` ``.
- `src/config/prompts.ts` re-exports the above plus `getCleanupSystemPrompt(agentName,
  customDictionary?, language?, uiLanguage?)` → `resolvePrompt("cleanup", {...})`, and
  `getAgentSystemPrompt(availableTools?, noteContext?)` → `resolvePrompt("chatAgent",
  { agentName: null })` (+ tool-instruction/note-context appends, unrelated to this spec).
- `src/services/BaseReasoningService.ts`'s `getSystemPrompt(agentName, screenContextText?)`
  calls `getCleanupSystemPrompt(...)` then wraps the result with
  `appendScreenContextSuffix(base, screenContextText, uiLanguage)` — this is the external
  append Requirement 6 removes.
- `src/helpers/audioManager.js`'s `resolveReasoningRoute()`, `kind === "agent"` branch,
  builds `config.systemPrompt` as `appendScreenContextSuffix(resolvePrompt("dictationAgent",
  {agentName, language, customDictionary, uiLanguage}), screenContextText, uiLanguage)` —
  same external-append pattern, same removal.
- `src/services/ReasoningService.ts`: `callChatCompletionsApi()`'s `userPrompt = isCleanup
  ? wrapCleanupTranscript(text) : text`; `processTextStreamed()`'s
  `userContent = config.systemPrompt ? text : wrapCleanupTranscript(text)`.
  Both simplify to `text` directly (raw, unwrapped) once `wrapCleanupTranscript` is
  removed. `isCleanup`/`config.systemPrompt` presence continues to gate temperature and
  other request-shaping (unaffected).
- `src/components/ui/PromptStudio.tsx`: the shared prompt-editor component, rendered for
  `kind="cleanup"` and `kind="dictationAgent"`. Its "Edit" tab already shows a caution note
  mentioning `{{agentName}}` (`promptStudio.edit.cautionTextSuffix`, i18n). `chatAgent`
  uses its own separate plain `<textarea>` in `ChatAgentSettings.tsx` — not `PromptStudio`
  — confirming Requirement 8/Non-goals' scoping is structurally already separate.
- `src/stores/settingsStore.ts`: `customPrompts: Record<PromptKind, string>`, each
  defaulting to `""` (falls back to `getDefaultPromptText`) via
  `readString(`customPrompt.${kind}`, "")`. A non-empty saved value is used verbatim as
  the `template` fed into `applySubstitutions()`.

### New mechanism

1. **Extract a pure placeholder-substitution function**, e.g.
   `applyPromptPlaceholders(template, { languageBlock, dictionaryBlock, screenContextBlock })`
   in `src/config/prompts/index.ts`, called by `applySubstitutions()` after the existing
   `{{agentName}}` replace. For each of the three `(token, block)` pairs — `{{languages}}`/
   languageBlock, `{{user-dictionary}}`/dictionaryBlock, `{{screen-ocr}}`/screenContextBlock —
   replace **all** occurrences of the token with `block` (or `""` when `block` is empty, so
   the token cleanly disappears with no surrounding artifact). **A token not present in the
   template contributes nothing — there is no end-of-prompt append.** This single function
   is the one place Requirement 4's clean-disappearance behavior lives, and it is fully
   testable with plain string inputs — no store, no i18n, no IPC.
2. **Compute each block** via small helpers (reusing existing i18n lookups so the actual
   lead-in copy doesn't change):
   - `buildLanguageBlock(language)` → `"\n\n" + getLanguageInstruction(language)` if
     non-empty, else `""` (mirrors today's unconditional-append text exactly).
   - `buildDictionaryBlock(customDictionary, uiLanguage)` → same content
     `appendDictionarySuffix()` appends today (`dictionarySuffix` i18n string + joined
     list), or `""` when the dictionary is empty.
   - `buildScreenContextBlock(screenContextText, uiLanguage)` → same content
     `appendScreenContextSuffix()` appends today (`screenContextLeadIn` + `<screen_context>`
     wrapping), or `""` when there's no screen text.
   Keep `appendDictionarySuffix(prompt, dict, uiLanguage)` and
   `appendScreenContextSuffix(prompt, screenText, uiLanguage)` exported with their current
   signatures/behavior (`prompt + block`), now implemented as thin wrappers around the new
   `buildDictionaryBlock`/`buildScreenContextBlock` helpers — this keeps
   `test/components/prompts.screenContext.test.js` passing unmodified and preserves a
   public, directly-testable building block.
3. **Add `screenContextText?: string | null` to `ResolvePromptOptions`** (Requirement 6).
   `applySubstitutions()` now computes `screenContextBlock` from `opts.screenContextText`
   itself instead of relying on an external caller-side append.
4. **Update call sites** to stop the external append and instead pass
   `screenContextText` through `resolvePrompt()`'s options:
   - `src/config/prompts.ts`'s `getCleanupSystemPrompt()` gains a 5th parameter
     `screenContextText?: string | null`, forwarded into `resolvePrompt("cleanup", {...,
     screenContextText})`.
   - `BaseReasoningService.getSystemPrompt(agentName, screenContextText?)` calls
     `getCleanupSystemPrompt(agentName, this.getCustomDictionary(),
     this.getPreferredLanguage(), this.getUiLanguage(), screenContextText)` directly,
     returning its result with no further wrapping (drop the
     `appendScreenContextSuffix(...)` call around it). Update the file's existing comment
     block (currently explaining the external-append rationale) to describe the new
     placeholder-based threading instead.
   - `audioManager.js`'s `resolveReasoningRoute()`, `kind === "agent"` branch: pass
     `screenContextText` directly inside the `resolvePrompt("dictationAgent", {...})`
     options object; drop the `appendScreenContextSuffix(...)` wrapper call around it
     (and its now-unneeded import, if no other call site in the file uses it).
5. **Remove `wrapCleanupTranscript()`** entirely from `src/config/prompts/index.ts`
   (including its JSDoc-style rationale comment) and its re-export from
   `src/config/prompts.ts`. Update `ReasoningService.ts`'s two call sites
   (Requirement 1) to send `text` directly as the user message content.
6. **Rewrite the base prompt templates** (`src/locales/en/prompts.json` and
   `src/locales/pt/prompts.json` — both currently hold identical bilingual text for
   `cleanupPrompt`/`fullPrompt`; edit both files identically):
   - `cleanupPrompt`: remove every `<transcript>` reference (opening sentence, rule 5,
     the worked example's framing — the example's `Input:`/`Output:` lines themselves
     don't need to change, only the surrounding rule text that describes them via the
     tag). Reword rule 5 to gate dictionary/technical-term preservation on "words that
     actually appear in the dictated text" rather than "inside the `<transcript>`". Add
     `{{languages}}`, `{{user-dictionary}}`, `{{screen-ocr}}` (in that order, each on its
     own line) after the existing rules/examples, followed by a final line restating the
     output contract (e.g. "Output ONLY the cleaned transcript. No preamble, no
     commentary, no meta-text.") — this is the new home for the instruction that used to
     ride on `wrapCleanupTranscript()`'s trailing line. Per Requirement 2, this is a
     partial substitute, not equivalent.
   - `fullPrompt`: no `<transcript>` wording to remove. Append the same three tokens, same
     order, after the existing numbered "OUTPUT RULES" list (matching today's actual
     effective composition order — language, then dictionary, then screen-context).
7. **Settings UI documentation** (Requirement 7): in `PromptStudio.tsx`'s "Edit" tab,
   extend the existing caution/hint area (near the current `{{agentName}}` mention) to
   list all four placeholders and what each does, plus one sentence making explicit that a
   placeholder omitted from the template means its content will **not** appear (no
   automatic append). New i18n keys under `promptStudio.edit.*` in both
   `src/locales/en/translation.json` and `src/locales/pt/translation.json` (e.g.
   `placeholdersTitle`, and one key per placeholder + the omission note — exact key names
   left to spec-executor, following the existing `promptStudio.edit.*` naming pattern).

### Migration / back-compat

No settings-key rename, no schema change, no stored-data migration is performed —
`customPrompts[kind]` keeps its existing shape (a plain string, or `""` for "use default")
and its stored value is neither read differently nor mutated. **This spec deliberately does
NOT preserve behavior for pre-existing custom prompts**, and the project owner explicitly
waived CLAUDE.md Non-Negotiable Premise #6 (migration safety) for this case:

- A user on the **default** prompt (`customPrompts[kind] === ""`) is unaffected — the
  default templates ship with all three tokens, so dictionary/language/screen-context
  content resolves in place exactly as today.
- A user with a **saved custom prompt** authored before this change contains none of the
  three tokens. With append-if-missing removed, their assembled prompt no longer receives
  the dictionary/language/screen-context blocks. No stored data is lost or altered; the
  user can re-add the tokens (now documented in PromptStudio) to restore the content
  wherever they want it. This behavioral change for existing custom prompts is the
  owner-accepted cost of the simpler, fully-positional model.

This waiver is scoped strictly to *custom cleanup/dictation-agent prompts*. It does not
touch any other persisted user data (transcription history, dictionary, notes, hotkeys,
API keys, settings) — all of which are untouched by this change.

## Validation Plan

### Automated

- **New**: `test/components/promptPlaceholders.test.js` (must live under
  `test/components/`, not `test/config/` — `package.json`'s `test` script only wires the
  `--import ./test/setup/tsxRegister.js` TS/ESM loader for the `test/components/*.test.js`
  glob; a test importing `src/config/prompts/index.ts` from `test/config/` would fail to
  load, per the existing `test/components/prompts.screenContext.test.js`'s own comment
  documenting this constraint) — exercises the new pure substitution function
  (`applyPromptPlaceholders` or equivalent, imported directly from
  `src/config/prompts/index.ts`) with literal string inputs (no store/i18n coupling):
  - Each of `{{screen-ocr}}`, `{{user-dictionary}}`, `{{languages}}` present in a template
    with a non-empty block substitutes correctly, in place, at the token's position.
  - Each placeholder present with an **empty** block resolves to a clean removal — no
    dangling lead-in text, no stray whitespace/newline artifacts left behind — asserted
    for all three tokens individually.
  - **No append-if-missing**: a template containing **none** of the three tokens, with all
    three blocks non-empty, returns the template **unchanged** — none of the blocks is
    appended. (This directly locks in the owner's dropped-append-if-missing decision and is
    the inverse of what the original draft asserted.)
  - Same "no tokens present" template with all three blocks empty also returns the template
    unchanged.
  - Mixed case: a template with `{{user-dictionary}}` explicitly placed but no
    `{{languages}}`/`{{screen-ocr}}` tokens — asserts the dictionary block substitutes in
    place while the language/screen-context blocks (even when non-empty) do **not** appear
    anywhere in the output.
- **New**: assert the shipped default `cleanupPrompt` and `fullPrompt`, loaded from both
  `src/locales/en/prompts.json` and `src/locales/pt/prompts.json`, contain all three new
  placeholder tokens, and that `cleanupPrompt` in both locales contains neither
  `<transcript>` nor `</transcript>`. (May be a new `test/components/promptDefaults.test.js`
  or an extension of `test/components/prompts.screenContext.test.js` — spec-executor's
  choice. This test is what guarantees default-prompt users don't regress despite
  append-if-missing being gone.)
- **New**: a regression test reproducing Requirement 8 — call
  `resolvePrompt("chatAgent", { agentName: null })` (or `getAgentSystemPrompt()`) and
  assert the result equals `DEFAULT_CHAT_AGENT_PROMPT` with only the agent-name
  substitution applied (no dictionary/language/screen-context content appears, since no
  such opts are passed and the chat-agent template contains none of the tokens).
- **Update**: `test/components/prompts.screenContext.test.js` — no behavioral change
  expected (`appendScreenContextSuffix` keeps its existing signature/output as a thin
  wrapper over the new `buildScreenContextBlock` helper); run as-is to confirm it still
  passes unmodified. If spec-executor finds it needs a minor import-path tweak due to the
  refactor, that's an allowed mechanical update, not a behavior change.
- Existing suite: `npm test` must pass in full (no regressions from the
  `wrapCleanupTranscript` removal or the `ResolvePromptOptions`/`getCleanupSystemPrompt`
  signature changes); `npm run typecheck` must pass (new/changed TS signatures across
  `prompts/index.ts`, `prompts.ts`, `BaseReasoningService.ts`).

> **Note (dropped tests vs. the original draft):** the original draft's
> "none-of-the-tokens-present → append all three in order" test and its dedicated
> migration/back-compat regression test are intentionally **not** carried forward — they
> asserted append-if-missing, which no longer exists. The "no tokens → template unchanged"
> assertions above replace them.

### Manual

1. With no custom cleanup prompt saved (default), dictate a short phrase with a non-empty
   Custom Dictionary and (Windows) an app with visible on-screen text; confirm via debug
   logs (`REQUEST`/`_STREAM_START` `logReasoning` calls showing the full `messages` array)
   that the assembled system prompt contains the dictionary and screen-context blocks, and
   that the user message is the raw dictated text with no `<transcript>` wrapper.
2. In Settings, open the cleanup prompt editor (PromptStudio "Edit" tab) and confirm the
   new placeholder documentation is visible and legible in both English and Portuguese
   (switch UI language), including the "omitting a placeholder removes its content" note.
3. Save a custom cleanup prompt that explicitly includes `{{user-dictionary}}` positioned
   before the main instructions; dictate with a non-empty dictionary; confirm via debug
   logs the dictionary block now appears where placed, not appended at the end.
4. Save a custom cleanup prompt that **omits** `{{user-dictionary}}` entirely; dictate with
   a non-empty dictionary; confirm via debug logs the dictionary block does **not** appear
   anywhere — verifying the dropped-append-if-missing behavior end-to-end.
5. Run an actual cleanup pass end-to-end (real model) on a dictation with filler words and
   a self-correction; confirm the cleaned output still: strips filler, applies the
   self-correction rule, and does not answer/execute a question found in the dictated
   text — verifying the reworded system prompt (without the `<transcript>` tag or the
   user-message-side reminder) still enforces the same output contract. This step exists
   because LLM output-quality regressions from prompt wording changes are not
   automated-test-observable.

### Docs

- `docs/RECREATION_SPEC.md` — the `callChatCompletionsApi`/`processTextStreamed`
  description mentioning `wrapCleanupTranscript()` and `<transcript>...</transcript>`, and
  the `PROMPT_KINDS`/`resolvePrompt`/`applySubstitutions`/`wrapCleanupTranscript`
  description, must be updated to describe the new placeholder-token mechanism (positional,
  no append-if-missing), the `screenContextText` threading, and the removal of
  `wrapCleanupTranscript()`.
- `CLAUDE.md` has no existing section describing this prompt-assembly mechanism in detail —
  no mandatory update; spec-executor may add a short note if it judges the placeholder
  mechanism worth day-to-day-reference visibility.
- `docs/specs/active-window-screen-context.md` — do **not** edit its Status
  (`Implemented`) or Requirements. Leave it as historical record; rely on this spec + the
  `docs/RECREATION_SPEC.md` updates above as the current source of truth.

## Open Questions

- None. The two decisions the original draft flagged (append-if-missing, and the
  migration-safety implication) were resolved by the project owner: append-if-missing is
  dropped and Premise #6 is explicitly waived for pre-existing custom prompts.
