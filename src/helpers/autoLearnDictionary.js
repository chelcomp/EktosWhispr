const { extractCorrections } = require("../utils/correctionLearner");
const debugLogger = require("./debugLogger");

/**
 * Extract the sentence containing `word` from `text`.
 * Sentences are delimited by `.`, `!`, or `?`.
 * Returns the trimmed sentence including the trailing punctuation,
 * or the full `text` if no sentence boundary is found.
 */
function extractSentence(text, word) {
  const lowerWord = word.toLowerCase();
  const lowerText = text.toLowerCase();

  // Find the word in the text (case-insensitive)
  const wordIdx = lowerText.indexOf(lowerWord);
  if (wordIdx === -1) return null;

  // Find the start of the sentence: look backward for `.`, `!`, `?`, or start of text
  let sentenceStart = 0;
  for (let i = wordIdx - 1; i >= 0; i--) {
    if (text[i] === "." || text[i] === "!" || text[i] === "?") {
      sentenceStart = i + 1;
      break;
    }
  }

  // Find the end of the sentence: look forward for `.`, `!`, `?`, or end of text
  let sentenceEnd = text.length;
  for (let i = wordIdx; i < text.length; i++) {
    if (text[i] === "." || text[i] === "!" || text[i] === "?") {
      sentenceEnd = i + 1;
      break;
    }
  }

  return text.slice(sentenceStart, sentenceEnd).trim();
}

/**
 * Core logic behind the text-monitor "auto-learn" pipeline: given the
 * originally-pasted text and the field's value after the user finished
 * editing it (already debounced by the caller — see ipcHandlers.js's
 * AUTO_LEARN_DEBOUNCE_MS), extract {from, to} correction pairs and persist
 * the surviving ones into the custom dictionary.
 *
 * Deliberately free of any Electron/IPC dependency (only touches the
 * `databaseManager` it's given) so it's unit-testable without spinning up
 * the full IPCHandlers class — see test/helpers/autoLearnDictionary.test.js.
 *
 * Anti-oscillation guard: before persisting a new learned correction
 * {from, to}, checks whether an existing source='learned' row already has
 * word=from (case-insensitive) and learned_from=to (case-insensitive) — i.e.
 * the exact reverse correction was learned previously. If so, the pair is
 * skipped (not persisted) and logged at debug level. This is a heuristic
 * safeguard against oscillation/reversal, not a guarantee against more
 * complex cycles (A→B→C→A) — see spec Edge Cases.
 *
 * @param {object} params
 * @param {string} params.originalText - The text that was pasted.
 * @param {string} params.newFieldValue - The field's value after user edits.
 * @param {{getDictionary: Function, getDictionaryWithProvenance?: Function, setDictionary: Function}} params.databaseManager
 * @returns {{learned: string[], skippedOscillations: Array<{from: string, to: string}>, error?: string}}
 */
function processAutoLearnCorrections({ originalText, newFieldValue, databaseManager }) {
  const currentDict = (() => {
    try {
      return databaseManager.getDictionary();
    } catch {
      return [];
    }
  })();

  const pairs = extractCorrections(originalText, newFieldValue, currentDict);
  if (pairs.length === 0) {
    return { learned: [], skippedOscillations: [] };
  }

  let learnedRows = [];
  try {
    learnedRows = databaseManager.getDictionaryWithProvenance?.() || [];
  } catch {
    learnedRows = [];
  }

  // lower(word)::lower(learned_from) -> true, for existing source='learned' rows only.
  const learnedReverseKeys = new Set(
    learnedRows
      .filter((r) => r?.source === "learned" && r.learned_from)
      .map((r) => `${r.word.toLowerCase()}::${r.learned_from.toLowerCase()}`)
  );

  const survivors = [];
  const skippedOscillations = [];
  const provenance = new Map();
  const phrasesByLowerWord = new Map();

  for (const { from, to } of pairs) {
    const reverseKey = `${from.toLowerCase()}::${to.toLowerCase()}`;
    if (learnedReverseKeys.has(reverseKey)) {
      skippedOscillations.push({ from, to });
      debugLogger.debug("[AutoLearn] Skipped likely oscillation", { from, to });
      continue;
    }
    survivors.push(to);
    provenance.set(to.toLowerCase(), from);

    // Extract sentence-level phrases for display context.
    const originalPhrase = extractSentence(originalText, from);
    const correctedPhrase = extractSentence(newFieldValue, to);
    if (originalPhrase && correctedPhrase && originalPhrase !== from && correctedPhrase !== to) {
      phrasesByLowerWord.set(to.toLowerCase(), { original_phrase: originalPhrase, corrected_phrase: correctedPhrase });
    }
  }

  if (survivors.length === 0) {
    return { learned: [], skippedOscillations };
  }

  const updatedDict = [...currentDict, ...survivors];
  const saveResult = databaseManager.setDictionary(updatedDict, "learned", provenance, phrasesByLowerWord);

  if (saveResult?.success === false) {
    return { learned: [], skippedOscillations, error: saveResult.error };
  }

  return { learned: survivors, skippedOscillations };
}

module.exports = { processAutoLearnCorrections };
