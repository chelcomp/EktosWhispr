import { getCleanupSystemPrompt } from "../config/prompts";
import { getSettings } from "../stores/settingsStore";
import { getDictionaryHintWords } from "../utils/snippets";

export interface ReasoningConfig {
  maxTokens?: number;
  temperature?: number;
  topP?: number;
  topK?: number;
  minP?: number;
  repeatPenalty?: number;
  contextSize?: number;
  systemPrompt?: string;
  // Threaded through from resolveReasoningRoute()'s "cleanup" branch, all the
  // way into resolvePrompt()'s ResolvePromptOptions.screenContextText, where
  // it substitutes the {{screen-ocr}} placeholder in place (see
  // docs/specs/prompt-template-placeholders.md). The agent route
  // (audioManager.js) threads it the same way via its own resolvePrompt()
  // call; the cleanup route has no systemPrompt override slot, so
  // getSystemPrompt() below forwards it to getCleanupSystemPrompt() instead.
  screenContextText?: string | null;
  lanUrl?: string;
  baseUrl?: string;
  customApiKey?: string;
  provider?: string;
  disableThinking?: boolean;
}

export abstract class BaseReasoningService {
  protected isProcessing = false;

  protected getCustomDictionary(): string[] {
    return getDictionaryHintWords(getSettings());
  }

  protected getPreferredLanguage(): string {
    return getSettings().preferredLanguage || "auto";
  }

  protected getUiLanguage(): string {
    return getSettings().uiLanguage || "en";
  }

  protected getSystemPrompt(agentName: string | null, screenContextText?: string | null): string {
    return getCleanupSystemPrompt(
      agentName,
      this.getCustomDictionary(),
      this.getPreferredLanguage(),
      this.getUiLanguage(),
      screenContextText
    );
  }

  protected calculateMaxTokens(
    textLength: number,
    minTokens = 100,
    maxTokens = 2048,
    multiplier = 2
  ): number {
    return Math.max(minTokens, Math.min(textLength * multiplier, maxTokens));
  }

  abstract isAvailable(): Promise<boolean>;

  abstract processText(
    text: string,
    modelId: string,
    agentName?: string | null,
    config?: ReasoningConfig
  ): Promise<string>;
}
