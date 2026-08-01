const { spawn } = require("child_process");

/**
 * Cross-platform process termination
 * Windows doesn't support SIGTERM/SIGKILL signals the same way Unix does
 * @param {ChildProcess} proc - The process to kill
 * @param {string} signal - Signal name ('SIGTERM' or 'SIGKILL')
 */
function killProcess(proc, signal = "SIGTERM") {
  if (!proc || proc.exitCode !== null) return;

  try {
    if (process.platform === "win32") {
      if (signal === "SIGKILL") {
        const taskkill = spawn("taskkill", ["/pid", proc.pid.toString(), "/f", "/t"], {
          stdio: "ignore",
          windowsHide: true,
        });
        taskkill.on("error", () => {});
      } else {
        proc.kill();
      }
    } else {
      proc.kill(signal);
    }
  } catch (e) {
    // Process may already be dead
  }
}

// Signals the whole process group on Unix so grandchildren get reaped too.
// Windows' killProcess already passes /T, which covers the descendant tree.
function killProcessGroup(proc, signal = "SIGTERM") {
  if (!proc || proc.exitCode !== null) return;
  if (process.platform === "win32") {
    killProcess(proc, signal);
    return;
  }
  try {
    process.kill(-proc.pid, signal);
  } catch {
    killProcess(proc, signal);
  }
}
module.exports = {
  killProcess,
  killProcessGroup,
};