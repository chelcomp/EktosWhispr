import i18n, { normalizeUiLanguage } from "../../i18n";
import { useSettingsStore } from "../../stores/settingsStore";
import { en as enPrompts } from "../../locales/prompts";
import { getLanguageInstruction } from "../../utils/languageSupport";
import { PROMPT_KINDS, type PromptKind } from "./registry";

export { PROMPT_KINDS, PROMPT_KIND_LIST, type PromptKind } from "./registry";

export interface ResolvePromptOptions {
  agentName: string | null;
  uiLanguage?: string;
  language?: string;
  customDictionary?: string[];
  // Threaded straight into applySubstitutions()'s {{screen-ocr}} placeholder —
  // see docs/specs/prompt-template-placeholders.md's "New mechanism" Design
  // section. null/undefined/empty all resolve the placeholder to "".
  screenContextText?: string | null;
}

export function resolvePrompt(kind: PromptKind, opts: ResolvePromptOptions): string {
  const custom = useSettingsStore.getState().customPrompts[kind];
  const template = custom || getDefaultPromptText(kind, opts.uiLanguage);
  return applySubstitutions(template, opts);
}

export function getDefaultPromptText(kind: PromptKind, uiLanguage?: string): string {
  const def = PROMPT_KINDS[kind];
  if (!def.i18nKey) return def.fallback;
  const locale = normalizeUiLanguage(uiLanguage || "en");
  const t = i18n.getFixedT(locale, "prompts");
  return t(def.i18nKey, { defaultValue: def.fallback });
}

function buildLanguageBlock(language?: string): string {
  const instruction = getLanguageInstruction(language);
  return instruction ? "\n\n" + instruction : "";
}

function buildDictionaryBlock(customDictionary?: string[], uiLanguage?: string): string {
  if (!customDictionary?.length) return "";
  const locale = normalizeUiLanguage(uiLanguage || "en");
  const suffix = i18n.getFixedT(locale, "prompts")("dictionarySuffix", {
    defaultValue: enPrompts.dictionarySuffix,
  });
  return suffix + customDictionary.join(", ");
}

// Mirrors buildDictionaryBlock() — a no-op when there's no screen text
// (feature off/gated-off/capture-or-OCR failed). See
// docs/specs/active-window-screen-context.md's "Threading OCR text into the
// LLM context" Design section for where screenContextText itself comes from.
function buildScreenContextBlock(screenText?: string | null, uiLanguage?: string): string {
  if (!screenText?.trim()) return "";
  const locale = normalizeUiLanguage(uiLanguage || "en");
  const leadIn = i18n.getFixedT(locale, "prompts")("screenContextLeadIn", {
    defaultValue: enPrompts.screenContextLeadIn,
  });
  return `${leadIn}\n<screen_context>\n${screenText}\n</screen_context>`;
}

// Thin wrapper kept for existing call sites (e.g. actionProcessingStore.ts's
// note-formatting prompt assembly) that append the dictionary block directly
// onto an arbitrary prompt string outside the {{user-dictionary}} placeholder
// mechanism below.
export function appendDictionarySuffix(
  prompt: string,
  customDictionary?: string[],
  uiLanguage?: string
): string {
  return prompt + buildDictionaryBlock(customDictionary, uiLanguage);
}

// Thin wrapper kept for test/components/prompts.screenContext.test.js and any
// other direct caller expecting the old prompt+block append shape.
export function appendScreenContextSuffix(
  prompt: string,
  screenText?: string | null,
  uiLanguage?: string
): string {
  return prompt + buildScreenContextBlock(screenText, uiLanguage);
}

// Pure, positional placeholder substitution — no append-if-missing. A token
// absent from `template` contributes nothing; each present token is replaced
// with its block (or "" when the block is empty, so the token cleanly
// disappears with no surrounding artifact). See
// docs/specs/prompt-template-placeholders.md Requirement 5.
export function applyPromptPlaceholders(
  template: string,
  blocks: { languageBlock: string; dictionaryBlock: string; screenContextBlock: string }
): string {
  return template
    .replace(/\{\{languages\}\}/g, blocks.languageBlock)
    .replace(/\{\{user-dictionary\}\}/g, blocks.dictionaryBlock)
    .replace(/\{\{screen-ocr\}\}/g, blocks.screenContextBlock);
}

function applySubstitutions(template: string, opts: ResolvePromptOptions): string {
  const name = opts.agentName?.trim() || "Assistant";
  const prompt = template.replace(/\{\{agentName\}\}/g, name);

  const languageBlock = buildLanguageBlock(opts.language);
  const dictionaryBlock = buildDictionaryBlock(opts.customDictionary, opts.uiLanguage);
  const screenContextBlock = buildScreenContextBlock(opts.screenContextText, opts.uiLanguage);

  return applyPromptPlaceholders(prompt, { languageBlock, dictionaryBlock, screenContextBlock });
}
