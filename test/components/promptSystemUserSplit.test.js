// Verifies the system/user template split guarantee from
// docs/specs/prompt-system-user-split.md: the cleanup route sends TWO separate
// messages — a system message built ONLY from the resolved system template and
// a user message built ONLY from the resolved user template (with
// {{user-transcription}} substituted). No raw transcription concatenation, no
// template cross-leak. Run via the tsxRegister loader.
const test = require("node:test");
const assert = require("node:assert/strict");

const { openaiProvider } = require("../../src/services/ai/inferenceProviders/openai.ts");
const { resolveSystemPrompt, resolveUserPrompt } = require("../../src/config/prompts/index.ts");

function makeCtx(overrides = {}) {
  return {
    getApiKey: async () => "test-key",
    getSystemPrompt: (agentName, screenContextText) =>
      resolveSystemPrompt("cleanup", { agentName, screenContextText }),
    getUserPrompt: (agentName, screenContextText, userTranscription) =>
      resolveUserPrompt("cleanup", { agentName, screenContextText, userTranscription }),
    getCustomDictionary: () => [],
    getPreferredLanguage: () => "en",
    getUiLanguage: () => "en",
    callChatCompletionsApi: async () => "",
    calculateMaxTokens: () => 4096,
    ...overrides,
  };
}

test("openai provider sends system = resolved system template and user = resolved user template (cleanup path)", async () => {
  const previousFetch = global.fetch;
  let sentBody = null;
  global.fetch = async (url, init) => {
    sentBody = JSON.parse(init.body);
    return {
      ok: true,
      status: 200,
      json: async () => ({ choices: [{ message: { content: "cleaned output" } }] }),
    };
  };
  try {
    const result = await openaiProvider.call({
      text: "the dictated text",
      model: "gpt-4o-mini",
      agentName: null,
      config: {
        baseUrl: "http://localhost:9999/v1/chat/completions",
        provider: "custom",
      },
      ctx: makeCtx(),
    });

    assert.equal(result, "cleaned output");
    assert.ok(sentBody, "no request body captured");
    assert.equal(sentBody.messages.length, 2);

    const [systemMsg, userMsg] = sentBody.messages;
    assert.equal(systemMsg.role, "system");
    assert.equal(userMsg.role, "user");

    // System message: ONLY the resolved system template — never the raw
    // transcription, never the user template's transcription wrapper.
    const expectedSystem = resolveSystemPrompt("cleanup", { agentName: null });
    assert.equal(systemMsg.content, expectedSystem);
    assert.ok(!systemMsg.content.includes("the dictated text"));
    assert.ok(
      !systemMsg.content.includes("<user-transcription>\nthe dictated text"),
      "user wrapper leaked into system"
    );

    // User message: the resolved user template with {{user-transcription}}
    // replaced — no system-template content appended or concatenated.
    const expectedUser = resolveUserPrompt("cleanup", {
      agentName: null,
      userTranscription: "the dictated text",
    });
    assert.equal(userMsg.content, expectedUser);
    assert.ok(userMsg.content.includes("the dictated text"));
    assert.ok(!userMsg.content.includes("{{user-transcription}}"));
  } finally {
    global.fetch = previousFetch;
  }
});

test("openai provider sends the raw text as user content when a systemPrompt override exists (agent path)", async () => {
  const previousFetch = global.fetch;
  let sentBody = null;
  global.fetch = async (url, init) => {
    sentBody = JSON.parse(init.body);
    return {
      ok: true,
      status: 200,
      json: async () => ({ choices: [{ message: { content: "reply" } }] }),
    };
  };
  try {
    await openaiProvider.call({
      text: "typed message",
      model: "gpt-4o-mini",
      agentName: null,
      config: {
        baseUrl: "http://localhost:9999/v1/chat/completions",
        provider: "custom",
        systemPrompt: "AGENT SYSTEM PROMPT",
      },
      ctx: makeCtx(),
    });

    const [systemMsg, userMsg] = sentBody.messages;
    assert.equal(systemMsg.content, "AGENT SYSTEM PROMPT");
    assert.equal(userMsg.content, "typed message");
  } finally {
    global.fetch = previousFetch;
  }
});
