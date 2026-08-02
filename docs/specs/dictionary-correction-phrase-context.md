# Dictionary Correction Phrase Context

> **Status:** ✅ Implemented (2026-08-02) — see "Implementation Record" below.

## Goal

On the dictionary screen, show each learned correction with its **original word and phrase** and its **corrected word and phrase**. One sentence may contain multiple corrections — capture and save them all. For now, the transcription/dictation pipeline keeps using only the corrected word as it does today (phrase data is display-only, no behavioral change).

## Current State (ground truth, post-implementation)

### Storage — `custom_dictionary` table (`src/helpers/database.js`)
- Columns (relevant): `word` (case-sensitive unique), `source` (`'manual' | 'learned'`), `learned_from` (nullable — the mis-transcribed word a learned entry replaced), `original_phrase` / `corrected_phrase` (nullable — sentence-level display context), plus sync columns.
- Migration: additive, idempotent `ALTER TABLE custom_dictionary ADD COLUMN original_phrase TEXT` / `corrected_phrase TEXT` next to the `learned_from` migration (`database.js` ~`:551`), following the duplicate-column `try/catch` pattern.
- `getDictionary()` → `string[]` (words only). `getDictionaryWithProvenance()` → `{word, source, learned_from, original_phrase, corrected_phrase}[]`; exposed over IPC as `db-get-dictionary-with-provenance` (`ipcHandlers.js`), surfaced as `window.electronAPI.getDictionaryWithProvenance()` (`preload.js`, typed in `src/types/electron.ts`).
- `setDictionary(words, sourceForNewWords = "manual", learnedFromByLowerWord = null, phrasesByLowerWord = null)` — diff-based upsert; both maps are `Map<lower('to'), …>`. For brand-new `'learned'` rows the values are stored on insert; when auto-learn RE-CAPTURES an EXISTING word — `sourceForNewWords === 'learned'` AND the word is a key in `learnedFromByLowerWord` that call — the row is upgraded in place (`source` → `'learned'`, `learned_from`/phrases refreshed; new values win, absent values keep the row's current ones). A word merely INCLUDED in the pushed list is left untouched (plain casing update), so a manual word never becomes 'learned' just by co-occurring in an auto-learn save (regression: EktosWhispr flip, 2026-08-02). Routine `'manual'` pushes never touch provenance; there is deliberately no promote learned→manual rewrite (a flat re-sync must not wipe provenance — see `database.js` comment).
- `learned_from` + phrase columns are local-only: excluded from the cloud sync push payload (`database.js:968`).

### Auto-learn pipeline
1. **Trigger** — `ipcHandlers.js`: after hotkey paste, `textEditMonitor.startMonitoring(text, 30000, { targetPid })` watches the target field ~30s.
2. **Event** — monitor emits `text-edited` `{originalText, newFieldValue}`; `ipcHandlers.js:905` debounces `AUTO_LEARN_DEBOUNCE_MS` (1500ms), keeps latest, calls `_processCorrections()`.
3. **Diff** — `src/utils/correctionLearner.js:141 extractCorrections(originalText, fieldValue, existingDictionary)` → `[{from, to}]` (mechanism unchanged; the "already in the dictionary" filter was removed 2026-08-02 so re-corrections refresh an existing row's provenance):
   - `findEditedRegion` (`:39`): locates the edited region via sliding-window word overlap (≥30%) when field grew beyond 1.5x; ignores surrounding new text.
   - Word-level LCS (`findSubstitutions`, `:83`) finds `[origWord, null]+[null, editedWord]` substitution pairs.
   - Filters: >50% words changed = rewrite (skip); duplicate, identical, <3 chars (skip); normalized Levenshtein distance >0.65 (skip; phonetic corrections like "Shunade"→"Sinead" at 0.57 pass). Words already in the dictionary are NOT filtered out — the pair is still reported so auto-learn can refresh the existing row's `learned_from` + phrase context (the word list is unchanged; `setDictionary` dedupes).
4. **Persist** — `src/helpers/autoLearnDictionary.js processAutoLearnCorrections`:
   - Anti-oscillation guard: skips pair if a `source='learned'` row already has `word=from` + `learned_from=to` (case-insensitive reverse).
   - Phrase capture: `extractSentence(text, word)` — the sentence containing the word, from the first letter after the previous `.`/`!`/`?` through the trailing punctuation; fallback to the full text when no boundary exists. Stored only when the sentence is longer than the word alone.
   - Survivors: `setDictionary([...dict, ...survivors], "learned", provenance, phrasesByLowerWord)`. Only `to` is added; `from` is provenance only, never a find/replace rule.
   - On success: `broadcastToWindows("dictionary-updated", getDictionary())` + toast (`ipcHandlers.js:946`).

### Renderer
- `settingsStore.ts` `customDictionary: string[]` mirrors SQLite; unchanged.
- `DictionaryView.tsx` fetches provenance via `window.electronAPI.getDictionaryWithProvenance()` on mount and on each `dictionary-updated` event. Learned rows with phrases show a `BookOpen` icon; clicking toggles the `original_phrase`/`corrected_phrase` reveal. Manual rows show the word only (no icon). The list always shows only the corrected word value.

## Requirement Details

- Capture per learned correction: original word + original phrase; corrected word + corrected phrase.
- Multiple corrections within one sentence are captured together and displayed together (grouped by phrase).
- Continue persisting only the corrected word into the operative hint list (no change to transcription behavior).

## Open Question (resolved)

**What counts as a "phrase"?** → **Sentence-level, from first letter to sentence-ending punctuation (`.`, `!`, `?`).**

The existing `extractCorrections` mechanism stays unchanged apart from removing the "already in the dictionary" filter (2026-08-02), so re-correcting a word that's already in the dictionary can refresh its phrase context.

**Rationale:**
- Respects natural linguistic boundaries (sentences) rather than arbitrary word windows
- Punctuation-delimited sentences are already present in most dictated text
- Reduces storage volume by storing only the altered sentence, not the full pasted text
- The `originalText` (pasted transcription) is the source of truth for phrase extraction; the `newFieldValue` (user-edited text) provides the corrected phrase

**Implementation approach for phrase extraction:**
1. After `extractCorrections` returns `[{from, to}]` pairs, for each pair:
   - Find the sentence in `originalText` containing `from` (split on `.`, `!`, `?` boundaries)
   - Find the corresponding sentence in `newFieldValue` containing `to`
   - Store both as `original_phrase` and `corrected_phrase`
2. Only store the phrase if it differs from the word alone (i.e., the sentence contains more than just the corrected word)
3. If no sentence boundary punctuation exists, fall back to the full `originalText` as the phrase

## Display design (resolved)

1. First column shows only the corrected word value (no phrase text inline).
2. A `BookOpen` icon next to learned corrections reveals `original_phrase` / `corrected_phrase` on click; phrases hidden by default.
3. Manual rows (`source='manual'`) show the word only — no icon.
4. Corrected and original words always highlighted when revealed.

## Implementation Record

1. ✅ Database schema: `original_phrase`/`corrected_phrase` columns (idempotent additive migration).
2. ✅ `setDictionary` accepts `phrasesByLowerWord` and persists phrases for new learned rows; auto-learn re-capture upgrades existing rows in place (source → 'learned', provenance + phrases refreshed). The former "promote learned→manual on routine sync" rewrite was removed 2026-08-02 — it clobbered learned rows on every startup (see `database.js` comment).
3. ✅ `getDictionaryWithProvenance` returns the phrase columns; exposed over IPC (`db-get-dictionary-with-provenance`) + preload + `electron.ts` types.
4. ✅ `autoLearnDictionary.js`: `extractSentence()` + phrase map passed to `setDictionary`; `extractCorrections` no longer filters out words already in the dictionary (2026-08-02), so a re-correction of an existing word recaptures its phrase context.
5. ✅ `DictionaryView.tsx`: provenance fetch on mount/updates, BookOpen reveal, manual rows without icon; en/pt locale keys added.
6. ✅ Tests: `test/helpers/autoLearnDictionary.test.js` (sentence capture, no-punctuation fallback, multiple corrections in one sentence, manual→learned upgrade on re-capture) and `test/helpers/dictionaryProvenance.test.js` (phrase persistence, re-capture upgrade keeps/refreshes provenance, routine manual re-sync preserves provenance — regression, migration covers new columns).
7. ✅ `npm test`: 753 pass / 1 pre-existing environmental failure (`activeWindowCapture.test.js` "missing binary" — local gitignored `resources/bin/windows-active-window-info.exe` build artifact is found by `_resolveBinary`; unrelated to this feature) / 30 skipped (better-sqlite3 native binding + others).
8. ✅ `npm run typecheck`: clean.
