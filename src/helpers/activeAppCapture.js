/**
 * Cross-platform detection of the foreground application name.
 *
 * detectAsync() is designed to run CONCURRENTLY with the window-blur delay in the
 * paste-text IPC handler (see ipcHandlers.js). After mainWindow.blur(), the target
 * app becomes the OS foreground within ~20ms. detectAsync() resolves within the
 * existing 80ms blur wait so it adds zero paste latency.
 */

const { execFile } = require("child_process");
const path = require("path");
const fs = require("fs");
const debugLogger = require("./debugLogger");

let _lastAppName = null;
let _fastPasteBinResolved = false;
let _fastPasteBin = null;

function getLastAppName() {
  return _lastAppName;
}

/**
 * Detect the current foreground application asynchronously.
 * Returns a Promise<string|null> that resolves with the app name (lowercase).
 */
function detectAsync() {
  return _detectWindowsAsync();
}


function _resolveFastPasteBinary() {
  if (_fastPasteBinResolved) return _fastPasteBin;
  _fastPasteBinResolved = true;

  const binaryName = "windows-fast-paste.exe";
  const candidates = new Set([
    path.join(__dirname, "..", "..", "resources", "bin", binaryName),
    path.join(__dirname, "..", "..", "resources", binaryName),
  ]);

  if (process.resourcesPath) {
    [
      path.join(process.resourcesPath, binaryName),
      path.join(process.resourcesPath, "bin", binaryName),
      path.join(process.resourcesPath, "resources", binaryName),
      path.join(process.resourcesPath, "resources", "bin", binaryName),
      path.join(process.resourcesPath, "app.asar.unpacked", "resources", binaryName),
      path.join(process.resourcesPath, "app.asar.unpacked", "resources", "bin", binaryName),
    ].forEach((c) => candidates.add(c));
  }

  for (const candidate of candidates) {
    try {
      if (fs.statSync(candidate).isFile()) {
        _fastPasteBin = candidate;
        debugLogger.debug("[ActiveAppCapture] Found binary", { path: candidate });
        return _fastPasteBin;
      }
    } catch {}
  }

  debugLogger.info("[ActiveAppCapture] windows-fast-paste.exe not found", {
    searched: [...candidates],
  });
  return null;
}

function _detectWindowsAsync() {
  return new Promise((resolve) => {
    const bin = _resolveFastPasteBinary();
    if (!bin) return resolve(null);

    execFile(bin, ["--detect-only"], { timeout: 2000 }, (err, stdout, stderr) => {
      if (err) {
        debugLogger.debug("[ActiveAppCapture] detect-only failed", { error: err.message, stderr });
        return resolve(null);
      }
      const name = _parseWindowsOutput(stdout);
      if (name) _lastAppName = name;
      resolve(name);
    });
  });
}

function _parseWindowsOutput(stdout) {
  const exeMatch = stdout.match(/^EXE_NAME (.+)$/m);
  if (exeMatch) {
    const name = path.basename(exeMatch[1].trim(), ".exe").toLowerCase();
    debugLogger.info("[ActiveAppCapture] Detected Windows app", { name });
    return name;
  }
  const classMatch = stdout.match(/^WINDOW_CLASS (.+)$/m);
  if (classMatch) {
    const name = classMatch[1].trim().toLowerCase();
    debugLogger.info("[ActiveAppCapture] Detected Windows app (class fallback)", { name });
    return name;
  }
  return null;
}

module.exports = { detectAsync, getLastAppName };
