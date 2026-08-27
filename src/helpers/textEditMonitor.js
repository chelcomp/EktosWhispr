const { spawn } = require("child_process");
const path = require("path");
const EventEmitter = require("events");
const fs = require("fs");
const debugLogger = require("./debugLogger");

const POLL_INTERVAL_MS = 500;

class TextEditMonitor extends EventEmitter {
  constructor() {
    super();
    this.process = null;
    this.currentOriginalText = null;
    this.timeout = null;
    this._lastValue = null;
    this._stdoutBuffer = "";
    this.lastTargetPid = null;
    this.lastTargetAppName = null;
  }

  /**
   * Stub kept for API compatibility. On Windows the target-app PID is read by
   * the windows-text-monitor binary at paste time; no pre-capture is needed.
   */
  captureTargetPid() {
    // no-op on Windows
  }

  /**
   * Stub kept for API compatibility. Returns false on Windows.
   */
  async activateTargetPid() {
    return false;
  }

  /**
   * Resolve the preceding character in the focused text field.
   * On Windows, the native binary is responsible for this; we return "unknown"
   * so the caller can fall back to append-mode spacing.
   */
  getPrecedingChar(pid, timeoutMs = 400) {
    return Promise.resolve({ state: "unknown" });
  }

  /**
   * Start monitoring the focused text field for edits after a paste.
   * Kills any existing monitor before starting a new one.
   * @param {string} originalText - The transcribed text that was pasted
   * @param {number} timeoutMs - How long to monitor (default 30s)
   */
  startMonitoring(originalText, timeoutMs = 30000, options = {}) {
    this.stopMonitoring();
    this.currentOriginalText = originalText;

    const resolved = this.resolveBinary();
    if (!resolved) {
      debugLogger.debug("[TextEditMonitor] No binary found for platform", {
        platform: process.platform,
      });
      this.currentOriginalText = null;
      return;
    }

    const { command, args } = resolved;
    debugLogger.debug("[TextEditMonitor] Resolved binary", { command, args });

    // For native binaries, verify executable permission
    if (command !== "python3") {
      try {
        fs.accessSync(command, fs.constants.X_OK);
      } catch {
        debugLogger.debug("[TextEditMonitor] Binary not executable", { command });
        this.currentOriginalText = null;
        return;
      }
    }

    debugLogger.debug("[TextEditMonitor] Spawning monitor", {
      textPreview: originalText.substring(0, 80),
    });

    this.process = spawn(command, args, {
      stdio: ["pipe", "pipe", "pipe"],
    });

    // Send original text via stdin
    this.process.stdin.write(originalText + "\n");
    this.process.stdin.end();

    this._stdoutBuffer = "";
    this.process.stdout.setEncoding("utf8");
    this.process.stdout.on("data", (chunk) => {
      debugLogger.debug("[TextEditMonitor] stdout", { data: chunk.trim() });
      this._handleProcessStdoutChunk(chunk);
    });

    this.process.stderr.setEncoding("utf8");
    this.process.stderr.on("data", (data) => {
      debugLogger.debug("[TextEditMonitor] stderr", { data: data.trim() });
    });

    this.process.on("error", (err) => {
      debugLogger.debug("[TextEditMonitor] Process error", { error: err.message });
      this.process = null;
    });

    this.process.on("exit", (code, signal) => {
      debugLogger.debug("[TextEditMonitor] Process exited", { code, signal });
      this.process = null;
    });

    // Safety net timeout (binary also self-exits after its own timeout)
    this.timeout = setTimeout(() => this.stopMonitoring(), timeoutMs);
  }

  stopMonitoring() {
    if (this.timeout) {
      clearTimeout(this.timeout);
      this.timeout = null;
    }
    this._lastValue = null;
    this._stdoutBuffer = "";
    if (this.process) {
      try {
        this.process.kill();
      } catch {
        // ignore
      }
      this.process = null;
    }
    this.currentOriginalText = null;
  }

  _handleProcessStdoutChunk(chunk) {
    this._stdoutBuffer += chunk;
    const lines = this._stdoutBuffer.split(/\r?\n/);
    this._stdoutBuffer = lines.pop() || "";

    for (const rawLine of lines) {
      if (!rawLine) continue;
      this._handleProcessLine(rawLine);
    }
  }

  _decodeBase64Payload(encoded) {
    try {
      return Buffer.from(encoded, "base64").toString("utf8");
    } catch (error) {
      debugLogger.debug("[TextEditMonitor] Failed to decode base64 payload", {
        error: error.message,
      });
      return null;
    }
  }

  _emitTextEdited(newFieldValue) {
    if (typeof newFieldValue !== "string" || this.currentOriginalText === null) {
      return;
    }

    debugLogger.debug("[TextEditMonitor] Text changed", {
      newFieldValue: newFieldValue.substring(0, 80),
    });
    this.emit("text-edited", {
      originalText: this.currentOriginalText,
      newFieldValue,
    });
  }

  _handleProcessLine(line) {
    if (line.startsWith("CHANGED_B64:")) {
      const decoded = this._decodeBase64Payload(line.slice("CHANGED_B64:".length));
      if (decoded !== null) {
        this._emitTextEdited(decoded);
      }
      return;
    }

    if (line.startsWith("CHANGED:")) {
      this._emitTextEdited(line.slice("CHANGED:".length));
      return;
    }

    if (line === "NO_ELEMENT" || line === "NO_VALUE") {
      debugLogger.debug("[TextEditMonitor] No target element", { status: line });
      this.stopMonitoring();
    }
  }

  /**
   * Resolve the platform-specific binary.
   * Returns { command, args } or null if unavailable.
   */
  resolveBinary() {
    const binaryPath = this._findFile("windows-text-monitor.exe");
    return binaryPath ? { command: binaryPath, args: [] } : null;
  }

  _findFile(fileName) {
    const candidates = new Set([
      path.join(__dirname, "..", "..", "resources", "bin", fileName),
      path.join(__dirname, "..", "..", "resources", fileName),
    ]);

    if (process.resourcesPath) {
      [
        path.join(process.resourcesPath, fileName),
        path.join(process.resourcesPath, "bin", fileName),
        path.join(process.resourcesPath, "resources", fileName),
        path.join(process.resourcesPath, "app.asar.unpacked", "resources", fileName),
        path.join(process.resourcesPath, "app.asar.unpacked", "resources", "bin", fileName),
      ].forEach((c) => candidates.add(c));
    }

    for (const candidate of candidates) {
      try {
        if (fs.statSync(candidate).isFile()) return candidate;
      } catch {
        continue;
      }
    }

    return null;
  }
}

module.exports = TextEditMonitor;
