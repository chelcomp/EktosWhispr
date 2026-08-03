const test = require("node:test");
const assert = require("node:assert/strict");

const { processAutoLearnCorrections } = require("../../src/helpers/autoLearnDictionary.js");

/**
 * Minimal in-memory stand-in for DatabaseManager's dictionary surface, mirroring
 * the diff-based upsert semantics of the real setDictionary() closely enough to
 * exercise processAutoLearnCorrections() end-to-end without a real SQLite DB
 * (the DB-level provenance/migration behavior itself is covered separately in
 * test/helpers/dictionaryProvenance.test.js).
 */
function createFakeDatabaseManager(seedRows = []) {
  // rows: [{ word, source, learned_from }]
  const rows = seedRows.map((r) => ({ learned_from: null, ...r }));
  const setDictionaryCalls = [];

  return {
    rows,
    setDictionaryCalls,
    getDictionary() {
      return rows.map((r) => r.word);
    },
    getDictionaryWithProvenance() {
      return rows.map((r) => ({ ...r }));
    },
    setDictionary(words, sourceForNewWords, learnedFromByLowerWord, phrasesByLowerWord) {
      setDictionaryCalls.push({
        words: [...words],
        sourceForNewWords,
        learnedFromByLowerWord,
        phrasesByLowerWord,
      });
      const existingByLower = new Map(rows.map((r) => [r.word.toLowerCase(), r]));
      for (const word of words) {
        const lower = word.toLowerCase();
        const existing = existingByLower.get(lower);
        if (existing) {
          // Mirror the real setDictionary: an auto-learn RE-CAPTURE (the word
          // is a key in the provenance map this call) upgrades the existing
          // row's provenance (new values win, absent ones keep the current).
          // Words merely included in the saved list are left untouched.
          if (
            sourceForNewWords === "learned" &&
            learnedFromByLowerWord &&
            learnedFromByLowerWord.has(lower)
          ) {
            const learnedFrom = learnedFromByLowerWord.get(lower) || existing.learned_from || null;
            const phrases = phrasesByLowerWord ? phrasesByLowerWord.get(lower) : null;
            existing.source = "learned";
            existing.learned_from = learnedFrom;
            if (phrases) {
              existing.original_phrase = phrases.original_phrase;
              existing.corrected_phrase = phrases.corrected_phrase;
            }
          }
          continue;
        }
        const learnedFrom =
          sourceForNewWords === "learned" && learnedFromByLowerWord
            ? learnedFromByLowerWord.get(lower) || null
            : null;
        const phrases =
          sourceForNewWords === "learned" && phrasesByLowerWord
            ? phrasesByLowerWord.get(lower) || null
            : null;
        const row = {
          word,
          source: sourceForNewWords,
          learned_from: learnedFrom,
          original_phrase: phrases ? phrases.original_phrase : null,
          corrected_phrase: phrases ? phrases.corrected_phrase : null,
        };
        rows.push(row);
        existingByLower.set(lower, row);
      }
      return { success: true };
    },
  };
}

test("a genuine correction is persisted into the dictionary with learned_from provenance", () => {
  const db = createFakeDatabaseManager([]);

  const result = processAutoLearnCorrections({

    originalText: "Shunade came to visit",
    newFieldValue: "Sinead came to visit",
    databaseManager: db,
  });

  assert.deepEqual(result.learned, ["Sinead"]);
  assert.deepEqual(result.skippedOscillations, []);

  assert.equal(db.setDictionaryCalls.length, 1);
  const call = db.setDictionaryCalls[0];
  assert.ok(call.words.includes("Sinead"));
  assert.equal(call.sourceForNewWords, "learned");
  assert.equal(call.learnedFromByLowerWord.get("sinead"), "Shunade");

  const savedRow = db.rows.find((r) => r.word === "Sinead");
  assert.ok(savedRow, "expected Sinead to be persisted");
  assert.equal(savedRow.source, "learned");
  assert.equal(savedRow.learned_from, "Shunade");
});

test("re-correcting a word already in the dictionary as manual upgrades it to learned with phrase context", () => {
  const db = createFakeDatabaseManager([{ word: "Sinead", source: "manual" }]);

  const result = processAutoLearnCorrections({
    originalText: "Yesterday I met Shunade. She was great.",
    newFieldValue: "Yesterday I met Sinead. She was great.",
    databaseManager: db,
  });

  assert.deepEqual(result.learned, ["Sinead"]);
  const call = db.setDictionaryCalls[0];
  assert.ok(call.words.includes("Sinead"));
  assert.equal(call.sourceForNewWords, "learned");
  assert.equal(call.learnedFromByLowerWord.get("sinead"), "Shunade");
  assert.deepEqual(call.phrasesByLowerWord.get("sinead"), {
    original_phrase: "Yesterday I met Shunade.",
    corrected_phrase: "Yesterday I met Sinead.",
  });

  const savedRow = db.rows.find((r) => r.word === "Sinead");
  assert.equal(savedRow.source, "learned");
  assert.equal(savedRow.learned_from, "Shunade");
  assert.equal(savedRow.original_phrase, "Yesterday I met Shunade.");
  assert.equal(savedRow.corrected_phrase, "Yesterday I met Sinead.");
});

test("no correction detected: dictionary is left untouched", () => {
  const db = createFakeDatabaseManager([]);

  const result = processAutoLearnCorrections({
    originalText: "hello world",
    newFieldValue: "hello world",

    databaseManager: db,
  });

  assert.deepEqual(result.learned, []);
  assert.equal(db.setDictionaryCalls.length, 0);
});

test("an auto-learn save merely including an existing manual word leaves it manual (regression: EktosWhispr flip)", () => {
  const db = createFakeDatabaseManager([{ word: "EktosWhispr", source: "manual" }]);

  processAutoLearnCorrections({
    originalText: "Yesterday I met Shunade. She was great.",
    newFieldValue: "Yesterday I met Sinead. She was great.",
    databaseManager: db,
  });

  const incidental = db.rows.find((r) => r.word === "EktosWhispr");
  assert.equal(incidental.source, "manual");
  assert.equal(incidental.learned_from, null);
  assert.equal(incidental.original_phrase ?? null, null);

  const learned = db.rows.find((r) => r.word === "Sinead");
  assert.equal(learned.source, "learned");
  assert.equal(learned.learned_from, "Shunade");
});

test("oscillation guard: exact reverse of a previously-learned correction is skipped", () => {
  // Previously learned: "Sinead" replacing "Shunade" (word="Sinead", learned_from="Shunade").
  const db = createFakeDatabaseManager([
    { word: "Sinead", source: "learned", learned_from: "Shunade" },
  ]);

  // Now the user "corrects" Sinead back to Shunade in a new dictation — the exact reverse pair.
  const result = processAutoLearnCorrections({
    originalText: "Sinead came to visit",
    newFieldValue: "Shunade came to visit",
    databaseManager: db,
  });

  assert.deepEqual(result.learned, []);
  assert.equal(result.skippedOscillations.length, 1);
  assert.deepEqual(result.skippedOscillations[0], { from: "Sinead", to: "Shunade" });

  // The dictionary must not flip back — no setDictionary call, "Sinead" row unchanged.
  assert.equal(db.setDictionaryCalls.length, 0);
  const sineadRow = db.rows.find((r) => r.word === "Sinead");
  assert.equal(sineadRow.learned_from, "Shunade");
});

test("oscillation guard is case-insensitive on both word and learned_from", () => {
  const db = createFakeDatabaseManager([{ word: "sinead", source: "learned", learned_from: "shunade" }]);

  const result = processAutoLearnCorrections({
    originalText: "meeting with Sinead today",
    newFieldValue: "meeting with Shunade today",
    databaseManager: db,
  });

  assert.deepEqual(result.learned, []);
  assert.equal(result.skippedOscillations.length, 1);
  assert.equal(db.setDictionaryCalls.length, 0);
});

test("a non-reverse correction proceeds normally even when unrelated learned rows exist", () => {
  const db = createFakeDatabaseManager([{ word: "Sinead", source: "learned", learned_from: "Shunade" }]);

  const result = processAutoLearnCorrections({
    originalText: "Jonathon signed up",
    newFieldValue: "Jonathan signed up",
    databaseManager: db,
  });

  assert.deepEqual(result.learned, ["Jonathan"]);
  assert.equal(result.skippedOscillations.length, 0);
  const savedRow = db.rows.find((r) => r.word === "Jonathan");
  assert.equal(savedRow.learned_from, "Jonathon");
});

test("propagates a save failure without reporting a learned correction", () => {
  const db = createFakeDatabaseManager([]);
  db.setDictionary = () => ({ success: false, error: "disk full" });

  const result = processAutoLearnCorrections({
    originalText: "Shunade came to visit",
    newFieldValue: "Sinead came to visit",
    databaseManager: db,
  });

  assert.deepEqual(result.learned, []);
  assert.equal(result.error, "disk full");
});

test("sentence-level phrases are captured and passed to setDictionary", () => {
  const db = createFakeDatabaseManager([]);

  const result = processAutoLearnCorrections({
    originalText: "Yesterday I met Shunade. She was great.",
    newFieldValue: "Yesterday I met Sinead. She was great.",
    databaseManager: db,
  });

  assert.deepEqual(result.learned, ["Sinead"]);
  const call = db.setDictionaryCalls[0];
  assert.deepEqual(call.phrasesByLowerWord.get("sinead"), {
    original_phrase: "Yesterday I met Shunade.",
    corrected_phrase: "Yesterday I met Sinead.",
  });

  const savedRow = db.rows.find((r) => r.word === "Sinead");
  assert.equal(savedRow.original_phrase, "Yesterday I met Shunade.");
  assert.equal(savedRow.corrected_phrase, "Yesterday I met Sinead.");
});

test("no sentence-ending punctuation: the full text is used as the phrase", () => {
  const db = createFakeDatabaseManager([]);

  const result = processAutoLearnCorrections({
    originalText: "Shunade came to visit",
    newFieldValue: "Sinead came to visit",
    databaseManager: db,
  });

  assert.equal(result.learned.length, 1);
  const phrases = db.setDictionaryCalls[0].phrasesByLowerWord.get("sinead");
  assert.deepEqual(phrases, {
    original_phrase: "Shunade came to visit",
    corrected_phrase: "Sinead came to visit",
  });
});

test("multiple corrections in the same sentence each get the sentence as their phrase", () => {
  const db = createFakeDatabaseManager([]);

  const result = processAutoLearnCorrections({
    originalText: "Shunade and Jonathon are here.",
    newFieldValue: "Sinead and Jonathan are here.",
    databaseManager: db,
  });

  assert.equal(result.learned.length, 2);
  const call = db.setDictionaryCalls[0];
  assert.deepEqual(call.phrasesByLowerWord.get("sinead"), {
    original_phrase: "Shunade and Jonathon are here.",
    corrected_phrase: "Sinead and Jonathan are here.",
  });
  assert.deepEqual(call.phrasesByLowerWord.get("jonathan"), {
    original_phrase: "Shunade and Jonathon are here.",
    corrected_phrase: "Sinead and Jonathan are here.",
  });
});
