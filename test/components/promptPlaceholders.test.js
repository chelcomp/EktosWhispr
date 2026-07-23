// Exercises the pure placeholder-substitution mechanism introduced by
// docs/specs/prompt-template-placeholders.md ({{languages}}, {{user-dictionary}},
// {{screen-ocr}}), plus the default-template and chatAgent regression guarantees
// from that spec's Validation Plan. Run via the tsxRegister loader (package.json's
// test script already wires `--import ./test/setup/tsxRegister.js` for
// test/components/*.test.js), since src/config/prompts/index.ts is TS/ESM.
const test = require("node:test");
const assert = require("node:assert/strict");

const {
  applyPromptPlaceholders,
  resolvePrompt,
} = require("../../src/config/prompts/index.ts");
const enPrompts = require("../../src/locales/en/prompts.json");
const ptPrompts = require("../../src/locales/pt/prompts.json");
const { PROMPT_KINDS } = require("../../src/config/prompts/registry.ts");

test("applyPromptPlaceholders substitutes each token in place when present with a non-empty block", () => {
  const template = "before {{languages}} mid {{user-dictionary}} mid2 {{screen-ocr}} after";
  const result = applyPromptPlaceholders(template, {
    languageBlock: "[LANG]",
    dictionaryBlock: "[DICT]",
    screenContextBlock: "[SCREEN]",
  });
  assert.equal(result, "before [LANG] mid [DICT] mid2 [SCREEN] after");
});

test("applyPromptPlaceholders resolves an empty block to a clean removal (no stray artifacts)", () => {
  assert.equal(
    applyPromptPlaceholders("A{{languages}}B", {
      languageBlock: "",
      dictionaryBlock: "",
      screenContextBlock: "",
    }),
    "AB"
  );
  assert.equal(
    applyPromptPlaceholders("A{{user-dictionary}}B", {
      languageBlock: "",
      dictionaryBlock: "",
      screenContextBlock: "",
    }),
    "AB"
  );
  assert.equal(
    applyPromptPlaceholders("A{{screen-ocr}}B", {
      languageBlock: "",
      dictionaryBlock: "",
      screenContextBlock: "",
    }),
    "AB"
  );
});

test("no append-if-missing: a template with none of the three tokens is returned unchanged even when all blocks are non-empty", () => {
  const template = "Just a plain prompt with no placeholders at all.";
  const result = applyPromptPlaceholders(template, {
    languageBlock: "\n\nRespond in English.",
    dictionaryBlock: "\n\nCustom Dictionary: foo, bar",
    screenContextBlock: "\n\nScreen context lead-in\n<screen_context>\nsome text\n</screen_context>",
  });
  assert.equal(result, template);
});

test("no append-if-missing: a template with none of the three tokens is returned unchanged when all blocks are empty", () => {
  const template = "Just a plain prompt with no placeholders at all.";
  const result = applyPromptPlaceholders(template, {
    languageBlock: "",
    dictionaryBlock: "",
    screenContextBlock: "",
  });
  assert.equal(result, template);
});

test("mixed case: a placed token substitutes while omitted tokens (even with non-empty blocks) never appear", () => {
  const template = "Intro. {{user-dictionary}} Rest of the prompt.";
  const result = applyPromptPlaceholders(template, {
    languageBlock: "\n\nRespond in English.",
    dictionaryBlock: "\n\nCustom Dictionary: foo, bar",
    screenContextBlock: "\n\nScreen context lead-in\n<screen_context>\nsome text\n</screen_context>",
  });
  assert.equal(result, "Intro. \n\nCustom Dictionary: foo, bar Rest of the prompt.");
  assert.ok(!result.includes("Respond in English."));
  assert.ok(!result.includes("screen_context"));
});

test("default cleanupPrompt/fullPrompt (en, pt) contain all three placeholder tokens", () => {
  for (const [locale, bundle] of [
    ["en", enPrompts],
    ["pt", ptPrompts],
  ]) {
    for (const key of ["cleanupPrompt", "fullPrompt"]) {
      for (const token of ["{{languages}}", "{{user-dictionary}}", "{{screen-ocr}}"]) {
        assert.ok(
          bundle[key].includes(token),
          `${locale}.${key} is missing ${token}`
        );
      }
    }
  }
});

test("default cleanupPrompt (en, pt) no longer references the <transcript> tag", () => {
  for (const [locale, bundle] of [
    ["en", enPrompts],
    ["pt", ptPrompts],
  ]) {
    assert.ok(!bundle.cleanupPrompt.includes("<transcript>"), `${locale}.cleanupPrompt still has <transcript>`);
    assert.ok(!bundle.cleanupPrompt.includes("</transcript>"), `${locale}.cleanupPrompt still has </transcript>`);
  }
});

test("chatAgent prompt resolution is unaffected: no dictionary/language/screen-context content appears", () => {
  const result = resolvePrompt("chatAgent", { agentName: null });
  assert.equal(result, PROMPT_KINDS.chatAgent.fallback);
});
