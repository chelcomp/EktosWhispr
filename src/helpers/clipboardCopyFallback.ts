/**
 * Shared clipboard-write-with-fallback logic, extracted so it's unit-testable
 * without a DOM/Electron renderer harness.
 *
 * Precedence (mirrors TranscriptionPreviewOverlay.tsx's handleCopy, the
 * reference implementation this was extracted from):
 *   1. window.electronAPI.writeClipboard (Electron IPC -> clipboard.js) when
 *      available. Both a thrown error and a `{success: false}`-shaped result
 *      are treated as failure.
 *   2. navigator.clipboard.writeText as a fallback.
 *   3. If both fail, the injected logger is called with a warning (never
 *      silently swallowed) and a failure result is returned; this function
 *      never throws.
 */

export type CopyMethod = "electron" | "navigator";

export interface CopyTextResult {
  success: boolean;
  method?: CopyMethod;
}

export interface CopyTextWithFallbackDeps {
  /** Electron IPC clipboard write, e.g. window.electronAPI.writeClipboard */
  electronWrite?: (text: string) => Promise<{ success: boolean } | void>;
  /** navigator.clipboard.writeText fallback */
  navigatorWrite?: (text: string) => Promise<void>;
  /** Logger called with (message, meta) on total failure. Never throws. */
  logWarn?: (message: string, meta?: unknown) => void;
}

const defaultElectronWrite = (text: string) => window.electronAPI?.writeClipboard?.(text);

const defaultNavigatorWrite = (text: string) => navigator.clipboard.writeText(text);

const defaultLogWarn = (message: string, meta?: unknown) => {
  // Lazily require to avoid pulling logger.ts into non-renderer test contexts
  // that don't need it (deps are always injected in tests).
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const logger = require("../utils/logger").default;
  logger.warn(message, meta, "clipboard");
};

export async function copyTextWithFallback(
  text: string,
  deps: CopyTextWithFallbackDeps = {}
): Promise<CopyTextResult> {
  const electronWrite = Object.prototype.hasOwnProperty.call(deps, "electronWrite")
    ? deps.electronWrite
    : defaultElectronWrite;
  const navigatorWrite = Object.prototype.hasOwnProperty.call(deps, "navigatorWrite")
    ? deps.navigatorWrite
    : defaultNavigatorWrite;
  const logWarn = deps.logWarn ?? defaultLogWarn;

  if (electronWrite) {
    try {
      const result = await electronWrite(text);
      if (!(result && result.success === false)) {
        return { success: true, method: "electron" };
      }
    } catch {
      // fall through to navigator fallback
    }
  }

  if (navigatorWrite) {
    try {
      await navigatorWrite(text);
      return { success: true, method: "navigator" };
    } catch {
      // fall through to failure below
    }
  }

  logWarn("Failed to copy text to clipboard via both Electron and navigator paths", {
    textLength: text.length,
  });
  return { success: false };
}
