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
  resolveSystemPrompt,
  resolveUserPrompt,
} = require("../../src/config/prompts/index.ts");
const enPrompts = require("../../src/locales/en/prompts.json");
const ptPrompts = require("../../src/locales/pt/prompts.json");
const { PROMPT_KINDS } = require("../../src/config/prompts/registry.ts");
const { useSettingsStore } = require("../../src/stores/settingsStore.ts");

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
    screenContextBlock:
      "\n\nScreen context lead-in\n<screen_context>\nsome text\n</screen_context>",
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
    screenContextBlock:
      "\n\nScreen context lead-in\n<screen_context>\nsome text\n</screen_context>",
  });
  assert.equal(result, "Intro. \n\nCustom Dictionary: foo, bar Rest of the prompt.");
  assert.ok(!result.includes("Respond in English."));
  assert.ok(!result.includes("screen_context"));
});

test("default prompt bundles (en, pt) carry the placeholder tokens across the system/user split", () => {
  for (const [locale, bundle] of [
    ["en", enPrompts],
    ["pt", ptPrompts],
  ]) {
    for (const token of ["{{languages}}", "{{user-dictionary}}", "{{screen-ocr}}"]) {
      assert.ok(
        bundle.systemInstructions.includes(token),
        `${locale}.systemInstructions is missing ${token}`
      );
      assert.ok(bundle.fullPrompt.includes(token), `${locale}.fullPrompt is missing ${token}`);
    }
    assert.ok(
      bundle.cleanupPrompt.includes("{{user-transcription}}"),
      `${locale}.cleanupPrompt is missing {{user-transcription}}`
    );
    assert.ok(
      !bundle.cleanupPrompt.includes("{{systemInstructions}}"),
      `${locale}.cleanupPrompt still references {{systemInstructions}}`
    );
  }
});

test("cleanup resolution never leaks the literal {{systemInstructions}} token", () => {
  const result = resolvePrompt("cleanup", {
    agentName: null,
    userTranscription: "hello world",
  });
  assert.ok(
    !result.includes("{{systemInstructions}}"),
    "literal {{systemInstructions}} leaked into resolved cleanup prompt"
  );
  assert.ok(
    result.includes("hello world"),
    "user transcription not threaded into resolved cleanup prompt"
  );
  assert.ok(
    result.includes("<transcription>") && result.includes("</transcription>"),
    "transcription not wrapped in <transcription> tags"
  );
  assert.ok(
    !result.includes("{{user-transcription}}"),
    "literal {{user-transcription}} leaked into resolved cleanup prompt"
  );
  assert.ok(
    result.includes("transcription cleaning engine"),
    "cleanup system instructions missing from resolved prompt"
  );
});

test("no append-if-missing: a cleanup template without the {{user-transcription}} token does not receive the transcription", () => {
  const prev = useSettingsStore.getState().customPrompts;
  useSettingsStore.setState({
    customPrompts: { ...prev, cleanup: "Clean this dictated text." },
  });
  try {
    const result = resolvePrompt("cleanup", {
      agentName: null,
      userTranscription: "hello world",
    });
    assert.ok(
      !result.includes("hello world"),
      "transcription injected into a template that omits {{user-transcription}}"
    );
    assert.ok(!result.includes("{{user-transcription}}"), "literal token leaked");
  } finally {
    useSettingsStore.setState({ customPrompts: prev });
  }
});

test("dictationAgent resolution is not polluted by cleanup system instructions", () => {
  const result = resolvePrompt("dictationAgent", { agentName: null });
  assert.ok(!result.includes("transcription cleaning engine"));
});

test("default cleanupPrompt (en, pt) no longer references the <transcript> tag", () => {
  for (const [locale, bundle] of [
    ["en", enPrompts],
    ["pt", ptPrompts],
  ]) {
    assert.ok(
      !bundle.cleanupPrompt.includes("<transcript>"),
      `${locale}.cleanupPrompt still has <transcript>`
    );
    assert.ok(
      !bundle.cleanupPrompt.includes("</transcript>"),
      `${locale}.cleanupPrompt still has </transcript>`
    );
  }
});

test("chatAgent prompt resolution is unaffected: no dictionary/language/screen-context content appears", () => {
  const result = resolvePrompt("chatAgent", { agentName: null });
  assert.equal(result, PROMPT_KINDS.chatAgent.fallback);
});

test("system and user templates resolve independently: system gets only system-template text, user gets only user-template text", () => {
  const customSystem = "CUSTOM SYSTEM {{languages}} {{user-dictionary}} {{screen-ocr}}";
  const customUser = "CUSTOM USER {{user-transcription}}";
  const prevSys = useSettingsStore.getState().customSystemInstructions;
  const prevUser = useSettingsStore.getState().customPrompts;
  useSettingsStore.setState({
    customSystemInstructions: { ...prevSys, cleanup: customSystem },
    customPrompts: { ...prevUser, cleanup: customUser },
  });
  try {
    const system = resolveSystemPrompt("cleanup", {
      agentName: null,
      language: "en",
      customDictionary: ["alpha"],
      screenContextText: "screen text",
      userTranscription: "dictated words",
    });
    const user = resolveUserPrompt("cleanup", {
      agentName: null,
      language: "en",
      customDictionary: ["alpha"],
      screenContextText: "screen text",
      userTranscription: "dictated words",
    });

    // System message comes from the system template only — it must not carry the
    // user template's text nor its transcription.
    assert.ok(system.includes("CUSTOM SYSTEM"), "system template text missing");
    assert.ok(!system.includes("CUSTOM USER"), "user template leaked into system");
    assert.ok(!system.includes("dictated words"), "transcription leaked into system");
    assert.ok(!system.includes("{{languages}}"), "{{languages}} not substituted");
    assert.ok(!system.includes("{{user-dictionary}}"), "{{user-dictionary}} not substituted");
    assert.ok(!system.includes("{{screen-ocr}}"), "{{screen-ocr}} not substituted");

    // User message comes from the user template only — it must not carry the
    // system template's text, but its transcription placeholder is substituted.
    assert.ok(user.includes("CUSTOM USER"), "user template text missing");
    assert.ok(!user.includes("CUSTOM SYSTEM"), "system template leaked into user");
    assert.ok(user.includes("dictated words"), "{{user-transcription}} not substituted");
    assert.ok(!user.includes("{{user-transcription}}"), "literal token leaked");
  } finally {
    useSettingsStore.setState({
      customSystemInstructions: prevSys,
      customPrompts: prevUser,
    });
  }
});

test("system and user placeholders substitute within their own template (no cross-field injection)", () => {
  const system = resolveSystemPrompt("cleanup", {
    agentName: null,
    language: "en",
    customDictionary: ["alpha"],
    screenContextText: "screen text",
    userTranscription: "dictated words",
  });
  const user = resolveUserPrompt("cleanup", {
    agentName: null,
    language: "en",
    customDictionary: ["alpha"],
    screenContextText: "screen text",
    userTranscription: "dictated words",
  });

  // System template placeholders resolve to their blocks.
  assert.ok(!system.includes("{{user-dictionary}}"));
  assert.ok(!system.includes("{{languages}}"));
  assert.ok(!system.includes("{{screen-ocr}}"));
  assert.ok(system.includes("alpha"), "dictionary block not substituted");
  assert.ok(!system.includes("{{user-dictionary}}"), "{{user-dictionary}} leaked");

  // The default user template carries only the transcription; it must not receive
  // system-only blocks (language/dictionary/screen-context) via the shared tokens.
  assert.ok(!user.includes("alpha"), "dictionary block leaked into user");
  assert.ok(!user.includes("screen_context"), "screen block leaked into user");
});
