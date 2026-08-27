const { clipboard } = require("electron");
const { spawn, spawnSync } = require("child_process");
const { killProcess } = require("../utils/process");
const path = require("path");
const fs = require("fs");
const debugLogger = require("./debugLogger");

const CACHE_TTL_MS = 30000;

class ClipboardManager {
  constructor() {

    this.commandAvailabilityCache = new Map();
    this.nircmdPath = null;
    this.nircmdChecked = false;
    this.winFastPastePath = null;
    this.winFastPasteChecked = false;
    this.pasteQueue = Promise.resolve();
  }



  _saveClipboard() {
    const formats = clipboard.availableFormats();
    const data = {};

    const text = clipboard.readText();
    if (text) data.text = text;

    if (formats.includes("text/html")) {
      const html = clipboard.readHTML();
      if (html) data.html = html;
    }

    if (formats.includes("text/rtf") || formats.includes("public.rtf")) {
      const rtf = clipboard.readRTF();
      if (rtf) data.rtf = rtf;
    }

    if (formats.some((f) => f.startsWith("image/"))) {
      const image = clipboard.readImage();
      if (image && !image.isEmpty()) data.image = image;
    }

    const keys = Object.keys(data);
    if (keys.length === 1 && keys[0] === "image") {
      return { type: "image", data: data.image };
    }
    if (keys.length === 1 && keys[0] === "text") {
      return { type: "text", data: data.text };
    }
    if (keys.length > 0) return { type: "formats", data };

    return { type: "text", data: text };
  }

  _restoreClipboard(original) {
    if (!original) return;
    if (original.type === "formats") {
      clipboard.write(original.data);
    } else if (original.type === "image") {
      clipboard.writeImage(original.data);
    } else {
      clipboard.writeText(original.data);
    }
    this.safeLog("🔄 Clipboard restored");
  }

  async _restoreClipboardAfterDelay(original, { delayMs, expectedText, restore } = {}) {
    if (!original) return;
    await new Promise((resolve) => setTimeout(resolve, delayMs));

    if (typeof expectedText === "string") {
      let currentText = null;
      try {
        currentText = clipboard.readText();
      } catch {}

      if (currentText !== expectedText) {
        debugLogger.debug(
          "Skipping clipboard restore because clipboard changed",
          {
            expectedLength: expectedText.length,
            currentLength: typeof currentText === "string" ? currentText.length : null,
          },
          "clipboard"
        );
        return;
      }
    }

    if (restore) {
      restore();
      return;
    }

    this._restoreClipboard(original);
  }

  safeLog(...args) {
    if (process.env.NODE_ENV === "development") {
      try {
        console.log(...args);
      } catch (error) {
        // Silently ignore EPIPE errors in logging
        if (error.code !== "EPIPE") {
          process.stderr.write(`Log error: ${error.message}\n`);
        }
      }
    }
  }

  commandExists(cmd) {
    const now = Date.now();
    const cached = this.commandAvailabilityCache.get(cmd);
    if (cached && now < cached.expiresAt) {
      return cached.exists;
    }
    try {
      const res = spawnSync("sh", ["-c", `command -v ${cmd}`], {
        stdio: "ignore",
      });
      const exists = res.status === 0;
      this.commandAvailabilityCache.set(cmd, {
        exists,
        expiresAt: now + CACHE_TTL_MS,
      });
      return exists;
    } catch {
      this.commandAvailabilityCache.set(cmd, {
        exists: false,
        expiresAt: now + CACHE_TTL_MS,
      });
      return false;
    }
  }

  async pasteText(text, options = {}) {
    const previousPaste = this.pasteQueue.catch(() => {});
    let markRestoreComplete;
    const restoreGate = new Promise((resolve) => {
      markRestoreComplete = resolve;
    });

    this.pasteQueue = previousPaste.then(() => restoreGate).catch(() => {});
    await previousPaste;

    try {
      const result = await this._pasteText(text, options);
      Promise.resolve(result?.restoreComplete).then(markRestoreComplete, markRestoreComplete);
    } catch (error) {
      markRestoreComplete();
      throw error;
    }
  }

  async _pasteText(text, options = {}) {
    const startTime = Date.now();
    const platform = process.platform;
    let method = "unknown";
    const webContents = options.webContents;

    try {
      const shouldRestore = options.restoreClipboard !== false;
      const originalClipboard = shouldRestore ? this._saveClipboard() : null;
      if (shouldRestore) {
        this.safeLog("💾 Saved original clipboard:", originalClipboard.type);
      }

      clipboard.writeText(text);
      this.safeLog("📋 Text copied to clipboard:", text.substring(0, 50) + "...");

      const winFastPaste = this.resolveWindowsFastPasteBinary();
      if (winFastPaste) {
        method = "sendinput";
      } else {
        const nircmdPath = this.getNircmdPath();
        method = nircmdPath ? "nircmd" : "powershell";
      }
      const pasteResult = await this.pasteWindows(originalClipboard, { expectedClipboardText: text });

      this.safeLog("✅ Paste operation complete", {
        platform,
        method,
        elapsedMs: Date.now() - startTime,
        textLength: text.length,
      });
      return pasteResult || { restoreComplete: Promise.resolve() };
    } catch (error) {
      this.safeLog("❌ Paste operation failed", {
        platform,
        method,
        elapsedMs: Date.now() - startTime,
        error: error.message,
      });
      throw error;
    }
  }


  async pasteWindows(originalClipboard, options = {}) {
    const fastPastePath = this.resolveWindowsFastPasteBinary();

    if (fastPastePath) {
      return this.pasteWithFastPaste(fastPastePath, originalClipboard, options);
    }

    return this.pasteWithNircmdOrPowerShell(originalClipboard, options);
  }

  async pasteWithFastPaste(fastPastePath, originalClipboard, options = {}) {
    return new Promise((resolve, reject) => {
      setTimeout(() => {
        let hasTimedOut = false;
        const startTime = Date.now();

        this.safeLog("⚡ Windows fast-paste starting");

        const pasteProcess = spawn(fastPastePath, [], {
          stdio: ["ignore", "pipe", "pipe"],
          windowsHide: true,
        });

        let stdoutData = "";
        let stderrData = "";

        pasteProcess.stdout.on("data", (data) => {
          stdoutData += data.toString();
        });

        pasteProcess.stderr.on("data", (data) => {
          stderrData += data.toString();
        });

        pasteProcess.on("close", (code) => {
          if (hasTimedOut) return;
          clearTimeout(timeoutId);

          const elapsed = Date.now() - startTime;
          const output = stdoutData.trim();

          if (code === 0) {
            this.safeLog("✅ Windows fast-paste success", {
              elapsedMs: elapsed,
              output,
            });
            if (originalClipboard != null) {
              resolve({
                restoreComplete: this._restoreClipboardAfterDelay(originalClipboard, {
                  delayMs: RESTORE_DELAYS.win32_nircmd,
                  expectedText: options.expectedClipboardText,
                }),
              });
            } else {
              resolve({ restoreComplete: Promise.resolve() });
            }
          } else {
            this.safeLog(
              `❌ Windows fast-paste failed (code ${code}), falling back to nircmd/PowerShell`,
              { elapsedMs: elapsed, stderr: stderrData.trim() }
            );
            this.pasteWithNircmdOrPowerShell(originalClipboard, options)
              .then(resolve)
              .catch(reject);
          }
        });

        pasteProcess.on("error", (error) => {
          if (hasTimedOut) return;
          clearTimeout(timeoutId);
          this.safeLog("❌ Windows fast-paste error, falling back to nircmd/PowerShell", {
            elapsedMs: Date.now() - startTime,
            error: error.message,
          });
          this.pasteWithNircmdOrPowerShell(originalClipboard, options).then(resolve).catch(reject);
        });

        const timeoutId = setTimeout(() => {
          hasTimedOut = true;
          this.safeLog("⏱️ Windows fast-paste timeout, falling back to nircmd/PowerShell");
          killProcess(pasteProcess, "SIGKILL");
          pasteProcess.removeAllListeners();
          this.pasteWithNircmdOrPowerShell(originalClipboard, options).then(resolve).catch(reject);
        }, 2000);
      }, PASTE_DELAYS.win32_fast);
    });
  }

  async pasteWithNircmdOrPowerShell(originalClipboard, options = {}) {
    const nircmdPath = this.getNircmdPath();
    if (nircmdPath) {
      return this.pasteWithNircmd(nircmdPath, originalClipboard, options);
    }
    return this.pasteWithPowerShell(originalClipboard, options);
  }

  async pasteWithNircmd(nircmdPath, originalClipboard, options = {}) {
    return new Promise((resolve, reject) => {
      const pasteDelay = PASTE_DELAYS.win32_nircmd;
      const restoreDelay = RESTORE_DELAYS.win32_nircmd;

      setTimeout(() => {
        let hasTimedOut = false;
        const startTime = Date.now();

        this.safeLog(`⚡ nircmd paste starting (delay: ${pasteDelay}ms)`);

        const pasteProcess = spawn(nircmdPath, ["sendkeypress", "ctrl+v"]);

        let errorOutput = "";

        pasteProcess.stderr.on("data", (data) => {
          errorOutput += data.toString();
        });

        pasteProcess.on("close", (code) => {
          if (hasTimedOut) return;
          clearTimeout(timeoutId);

          const elapsed = Date.now() - startTime;

          if (code === 0) {
            this.safeLog(`✅ nircmd paste success`, {
              elapsedMs: elapsed,
              restoreDelayMs: restoreDelay,
            });
            if (originalClipboard != null) {
              resolve({
                restoreComplete: this._restoreClipboardAfterDelay(originalClipboard, {
                  delayMs: restoreDelay,
                  expectedText: options.expectedClipboardText,
                }),
              });
            } else {
              resolve({ restoreComplete: Promise.resolve() });
            }
          } else {
            this.safeLog(`❌ nircmd failed (code ${code}), falling back to PowerShell`, {
              elapsedMs: elapsed,
              stderr: errorOutput,
            });
            this.pasteWithPowerShell(originalClipboard, options).then(resolve).catch(reject);
          }
        });

        pasteProcess.on("error", (error) => {
          if (hasTimedOut) return;
          clearTimeout(timeoutId);
          const elapsed = Date.now() - startTime;
          this.safeLog(`❌ nircmd error, falling back to PowerShell`, {
            elapsedMs: elapsed,
            error: error.message,
          });
          this.pasteWithPowerShell(originalClipboard, options).then(resolve).catch(reject);
        });

        const timeoutId = setTimeout(() => {
          hasTimedOut = true;
          const elapsed = Date.now() - startTime;
          this.safeLog(`⏱️ nircmd timeout, falling back to PowerShell`, { elapsedMs: elapsed });
          killProcess(pasteProcess, "SIGKILL");
          pasteProcess.removeAllListeners();
          this.pasteWithPowerShell(originalClipboard, options).then(resolve).catch(reject);
        }, 2000);
      }, pasteDelay);
    });
  }

  async pasteWithPowerShell(originalClipboard, options = {}) {
    return new Promise((resolve, reject) => {
      const pasteDelay = PASTE_DELAYS.win32_pwsh;
      const restoreDelay = RESTORE_DELAYS.win32_pwsh;

      setTimeout(() => {
        let hasTimedOut = false;
        const startTime = Date.now();

        this.safeLog(`🪟 PowerShell paste starting (delay: ${pasteDelay}ms)`);

        const pasteProcess = spawn("powershell.exe", [
          "-NoProfile",
          "-NonInteractive",
          "-WindowStyle",
          "Hidden",
          "-ExecutionPolicy",
          "Bypass",
          "-Command",
          "[void][System.Reflection.Assembly]::LoadWithPartialName('System.Windows.Forms');[System.Windows.Forms.SendKeys]::SendWait('^v')",
        ]);

        let errorOutput = "";

        pasteProcess.stderr.on("data", (data) => {
          errorOutput += data.toString();
        });

        pasteProcess.on("close", (code) => {
          if (hasTimedOut) return;
          clearTimeout(timeoutId);

          const elapsed = Date.now() - startTime;

          if (code === 0) {
            this.safeLog(`✅ PowerShell paste success`, {
              elapsedMs: elapsed,
              restoreDelayMs: restoreDelay,
            });
            if (originalClipboard != null) {
              resolve({
                restoreComplete: this._restoreClipboardAfterDelay(originalClipboard, {
                  delayMs: restoreDelay,
                  expectedText: options.expectedClipboardText,
                }),
              });
            } else {
              resolve({ restoreComplete: Promise.resolve() });
            }
          } else {
            this.safeLog(`❌ PowerShell paste failed`, {
              code,
              elapsedMs: elapsed,
              stderr: errorOutput,
            });
            reject(
              new Error(
                `Windows paste failed with code ${code}. Text is copied to clipboard - please paste manually with Ctrl+V.`
              )
            );
          }
        });

        pasteProcess.on("error", (error) => {
          if (hasTimedOut) return;
          clearTimeout(timeoutId);
          const elapsed = Date.now() - startTime;
          this.safeLog(`❌ PowerShell paste error`, {
            elapsedMs: elapsed,
            error: error.message,
          });
          reject(
            new Error(
              `Windows paste failed: ${error.message}. Text is copied to clipboard - please paste manually with Ctrl+V.`
            )
          );
        });

        const timeoutId = setTimeout(() => {
          hasTimedOut = true;
          const elapsed = Date.now() - startTime;
          this.safeLog(`⏱️ PowerShell paste timeout`, { elapsedMs: elapsed });
          killProcess(pasteProcess, "SIGKILL");
          pasteProcess.removeAllListeners();
          reject(
            new Error(
              "Paste operation timed out. Text is copied to clipboard - please paste manually with Ctrl+V."
            )
          );
        }, 5000);
      }, pasteDelay);
    });
  }

  // Pre-warm the Windows fast-paste binary lookup so the first paste doesn't
  // pay the filesystem probe. (Was: macOS accessibility + Linux fast-paste
  // pre-warm. Windows is the only target now, so this is intentionally cheap.)
  preWarmAccessibility() {
    this.resolveWindowsFastPasteBinary();
  }

  async readClipboard() {
    return clipboard.readText();
  }

  async writeClipboard(text, _webContents = null) {
    clipboard.writeText(text);
    return { success: true };
  }

  checkPasteTools() {
    const winFastPaste = this.resolveWindowsFastPasteBinary();
    return {
      platform: "win32",
      available: true,
      method: winFastPaste ? "sendinput" : "powershell",
      requiresPermission: false,
      terminalAware: !!winFastPaste,
      tools: [],
    };
  }
}

module.exports = ClipboardManager;
