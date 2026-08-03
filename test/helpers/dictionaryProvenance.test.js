const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const Module = require("node:module");

let userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), "ektoswhispr-dict-provenance-db-"));
const originalLoad = Module._load;

Module._load = function patchedLoad(request, parent, isMain) {
  if (request === "electron") {
    return {
      app: {
        getPath: () => userDataDir,
        getAppPath: () => process.cwd(),
        isReady: () => false,
      },
    };
  }
  return originalLoad.call(this, request, parent, isMain);
};

process.env.NODE_ENV = "test";

const DatabaseManager = require("../../src/helpers/database.js");

function isNativeBindingUnavailable(error) {
  const message = String(error?.message || error);
  return (
    message.includes("NODE_MODULE_VERSION") || message.includes("Could not locate the bindings file")
  );
}

function createDb(t) {
  userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), "ektoswhispr-dict-provenance-db-"));
  try {
    const BetterSqlite = require("better-sqlite3");
    const probe = new BetterSqlite(path.join(userDataDir, "probe.db"));
    probe.close();
    fs.rmSync(path.join(userDataDir, "probe.db"), { force: true });
  } catch (error) {
    if (isNativeBindingUnavailable(error)) {
      t.skip("better-sqlite3 native binding is not available for this Node runtime");
      return null;
    }
    throw error;
  }

  try {
    return new DatabaseManager();
  } catch (error) {
    if (isNativeBindingUnavailable(error)) {
      t.skip("better-sqlite3 native binding is not available for this Node runtime");
      return null;
    }
    throw error;
  }
}

test("setDictionary persists learned_from provenance only for newly-inserted learned words", (t) => {
  const db = createDb(t);
  if (!db) return;

  const provenance = new Map([["sinead", "Shunade"]]);
  db.setDictionary(["Sinead"], "learned", provenance);

  const rows = db.getDictionaryWithProvenance();
  const row = rows.find((r) => r.word === "Sinead");
  assert.ok(row, "expected Sinead row to exist");
  assert.equal(row.source, "learned");
  assert.equal(row.learned_from, "Shunade");
});

test("getPendingDictionary (the cloud-sync push payload) never exposes learned_from", (t) => {
  const db = createDb(t);
  if (!db) return;

  const provenance = new Map([["sinead", "Shunade"]]);
  db.setDictionary(["Sinead"], "learned", provenance);

  const pending = db.getPendingDictionary();
  const row = pending.find((r) => r.word === "Sinead");
  assert.ok(row, "expected the newly-learned word to be pending sync");
  assert.equal(
    Object.prototype.hasOwnProperty.call(row, "learned_from"),
    false,
    "learned_from must never be included in the cloud-sync push payload"
  );
});

test("manual additions never get learned_from populated, even if a provenance map is passed", (t) => {
  const db = createDb(t);
  if (!db) return;

  const provenance = new Map([["manualword", "ignored"]]);
  db.setDictionary(["ManualWord"], "manual", provenance);

  const rows = db.getDictionaryWithProvenance();
  const row = rows.find((r) => r.word === "ManualWord");
  assert.ok(row);
  assert.equal(row.source, "manual");
  assert.equal(row.learned_from, null);
});

test("existing setDictionary callers that omit the provenance argument are unaffected (back-compat)", (t) => {
  const db = createDb(t);
  if (!db) return;

  // Two-arg call, matching every pre-existing call site in the codebase.
  db.setDictionary(["hello", "world"], "manual");
  assert.deepEqual(db.getDictionary(), ["hello", "world"]);

  const rows = db.getDictionaryWithProvenance();
  assert.ok(rows.every((r) => r.learned_from === null));
});

test("routine manual re-sync of the full list preserves learned_from (regression: startup clobber)", (t) => {
  const db = createDb(t);
  if (!db) return;

  const provenance = new Map([["sinead", "Shunade"]]);
  db.setDictionary(["Sinead"], "learned", provenance);

  let row = db.getDictionaryWithProvenance().find((r) => r.word === "Sinead");
  assert.equal(row.learned_from, "Shunade");

  // Routine sync (startup hydration, agent-name sync, settings push) re-sends
  // the same flat list with the default 'manual' source. This must NOT promote
  // existing learned rows — it used to wipe learned_from on every startup.
  db.setDictionary(["Sinead"], "manual");

  row = db.getDictionaryWithProvenance().find((r) => r.word === "Sinead");
  assert.equal(row.source, "learned");
  assert.equal(row.learned_from, "Shunade");
});

test("migration safety: a pre-existing DB without learned_from upgrades without losing dictionary data", (t) => {
  userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), "ektoswhispr-dict-provenance-db-"));
  let legacyDb;
  try {
    const BetterSqlite = require("better-sqlite3");
    // Simulate a pre-upgrade DB: custom_dictionary table exists but predates the
    // learned_from column (and the other sync columns added over time).
    // Must match DatabaseManager's own filename resolution (transcriptions.db
    // outside development mode) so DatabaseManager opens this same pre-seeded file.
    const dbPath = path.join(userDataDir, "transcriptions.db");
    legacyDb = new BetterSqlite(dbPath);
    legacyDb.exec(`
      CREATE TABLE custom_dictionary (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        word TEXT NOT NULL UNIQUE,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);
    legacyDb.prepare("INSERT INTO custom_dictionary (word) VALUES (?)").run("legacyword");
    legacyDb.close();
  } catch (error) {
    if (isNativeBindingUnavailable(error)) {
      t.skip("better-sqlite3 native binding is not available for this Node runtime");
      return;
    }
    throw error;
  }

  // Opening via DatabaseManager runs the additive migration path.
  const db = new DatabaseManager();
  assert.deepEqual(db.getDictionary(), ["legacyword"]);

  const rows = db.getDictionaryWithProvenance();
  const legacyRow = rows.find((r) => r.word === "legacyword");
  assert.ok(legacyRow, "pre-existing dictionary word must survive the upgrade");
  assert.equal(legacyRow.learned_from, null);
  assert.equal(legacyRow.original_phrase, null);
  assert.equal(legacyRow.corrected_phrase, null);

  // The new column is fully usable post-migration.
  const provenance = new Map([["newword", "oldword"]]);
  const phrases = new Map([
    ["newword", { original_phrase: "the old word", corrected_phrase: "the new word" }],
  ]);
  db.setDictionary(["legacyword", "newword"], "learned", provenance, phrases);
  const newRow = db.getDictionaryWithProvenance().find((r) => r.word === "newword");
  assert.equal(newRow.learned_from, "oldword");
  assert.equal(newRow.original_phrase, "the old word");
  assert.equal(newRow.corrected_phrase, "the new word");
});

test("setDictionary persists phrase context only for newly-inserted learned words", (t) => {
  const db = createDb(t);
  if (!db) return;

  const provenance = new Map([["sinead", "Shunade"]]);
  const phrases = new Map([
    ["sinead", { original_phrase: "I met Shunade.", corrected_phrase: "I met Sinead." }],
  ]);
  db.setDictionary(["Sinead"], "learned", provenance, phrases);

  const row = db.getDictionaryWithProvenance().find((r) => r.word === "Sinead");
  assert.ok(row, "expected Sinead row to exist");
  assert.equal(row.source, "learned");
  assert.equal(row.learned_from, "Shunade");
  assert.equal(row.original_phrase, "I met Shunade.");
  assert.equal(row.corrected_phrase, "I met Sinead.");
});

test("routine manual re-sync preserves phrase context of learned rows (regression: startup clobber)", (t) => {
  const db = createDb(t);
  if (!db) return;

  const phrases = new Map([
    ["sinead", { original_phrase: "met Shunade", corrected_phrase: "met Sinead" }],
  ]);
  db.setDictionary(["Sinead"], "learned", new Map([["sinead", "Shunade"]]), phrases);

  let row = db.getDictionaryWithProvenance().find((r) => r.word === "Sinead");
  assert.equal(row.original_phrase, "met Shunade");
  assert.equal(row.corrected_phrase, "met Sinead");

  // The UI re-pushes the flat word list with the default 'manual' source on
  // routine syncs (startup, agent-name sync, settings push). Phrase context
  // must survive those syncs — the blanket promotion used to null it out.
  db.setDictionary(["Sinead"], "manual");

  row = db.getDictionaryWithProvenance().find((r) => r.word === "Sinead");
  assert.equal(row.source, "learned");
  assert.equal(row.learned_from, "Shunade");
  assert.equal(row.original_phrase, "met Shunade");
  assert.equal(row.corrected_phrase, "met Sinead");
});

test("auto-learn re-capture upgrades an existing manual row to learned with phrase context", (t) => {
  const db = createDb(t);
  if (!db) return;

  db.setDictionary(["Sinead"], "manual");
  let row = db.getDictionaryWithProvenance().find((r) => r.word === "Sinead");
  assert.equal(row.source, "manual");
  assert.equal(row.learned_from, null);

  // Auto-learn re-captures the same word (a previously-manual row, e.g. one
  // whose provenance was destroyed before the startup-clobber fix): the row
  // must be upgraded with source='learned' + provenance + phrase context.
  const provenance = new Map([["sinead", "Shunade"]]);
  const phrases = new Map([
    ["sinead", { original_phrase: "I met Shunade.", corrected_phrase: "I met Sinead." }],
  ]);
  db.setDictionary(["Sinead"], "learned", provenance, phrases);

  row = db.getDictionaryWithProvenance().find((r) => r.word === "Sinead");
  assert.equal(row.source, "learned");
  assert.equal(row.learned_from, "Shunade");
  assert.equal(row.original_phrase, "I met Shunade.");
  assert.equal(row.corrected_phrase, "I met Sinead.");
});

test("learned re-capture without new phrases keeps the row's existing phrase context", (t) => {
  const db = createDb(t);
  if (!db) return;

  const provenance = new Map([["sinead", "Shunade"]]);
  const phrases = new Map([
    ["sinead", { original_phrase: "I met Shunade.", corrected_phrase: "I met Sinead." }],
  ]);
  db.setDictionary(["Sinead"], "learned", provenance, phrases);

  // Re-capture with provenance but no phrase map (sentence extraction failed):
  // the existing phrases must be preserved, not nulled out.
  db.setDictionary(["Sinead"], "learned", new Map([["sinead", "Shunade2"]]));

  const row = db.getDictionaryWithProvenance().find((r) => r.word === "Sinead");
  assert.equal(row.source, "learned");
  assert.equal(row.learned_from, "Shunade2");
  assert.equal(row.original_phrase, "I met Shunade.");
  assert.equal(row.corrected_phrase, "I met Sinead.");
});

test("an auto-learn save merely including an existing manual word leaves it manual (regression: EktosWhispr flip)", (t) => {
  const db = createDb(t);
  if (!db) return;

  db.setDictionary(["EktosWhispr"], "manual");
  const provenance = new Map([["kaue", "Cauê"]]);
  const phrases = new Map([
    ["kaue", { original_phrase: "Cauê, vamos fazer um teste.", corrected_phrase: "Kaue, vamos fazer um teste." }],
  ]);
  // Auto-learn save: the existing manual word is in the pushed list but was not
  // re-captured this call — it must not flip to 'learned'.
  db.setDictionary(["EktosWhispr", "Kaue"], "learned", provenance, phrases);

  const ektos = db.getDictionaryWithProvenance().find((r) => r.word === "EktosWhispr");
  assert.equal(ektos.source, "manual");
  assert.equal(ektos.learned_from, null);

  const kaue = db.getDictionaryWithProvenance().find((r) => r.word === "Kaue");
  assert.equal(kaue.source, "learned");
  assert.equal(kaue.learned_from, "Cauê");
  assert.equal(kaue.original_phrase, "Cauê, vamos fazer um teste.");
  assert.equal(kaue.corrected_phrase, "Kaue, vamos fazer um teste.");
});
