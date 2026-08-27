const { spawnSync } = require("child_process");
const path = require("path");
const fs = require("fs");
const debugLogger = require("./debugLogger");

class MediaPlayer {
  constructor() {
    this._nircmdChecked = false;
    this._nircmdPath = null;
    this._didPause = false; // Whether we sent a pause via toggle fallback
    this._pausedWinApps = []; // GSMTC app IDs we paused (Windows)
  }

  pauseMedia() {
    try {
      return this._pauseWindows();
    } catch (err) {
      debugLogger.warn("Media pause failed", { error: err.message }, "media");
    }
    return false;
  }

  resumeMedia() {
    try {
      return this._resumeWindows();
    } catch (err) {
      debugLogger.warn("Media resume failed", { error: err.message }, "media");
    }
    return false;
  }

  toggleMedia() {
    try {
      return this._toggleWindows();
    } catch (err) {
      debugLogger.warn("Media toggle failed", { error: err.message }, "media");
    }
    return false;
  }

  _resolveNircmd() {
    if (this._nircmdChecked) return this._nircmdPath;
    this._nircmdChecked = true;

    const candidates = [
      path.join(process.resourcesPath || "", "bin", "nircmd.exe"),
      path.join(__dirname, "..", "..", "resources", "bin", "nircmd.exe"),
    ];

    for (const candidate of candidates) {
      try {
        if (fs.existsSync(candidate)) {
          this._nircmdPath = candidate;
          return candidate;
        }
      } catch {
        continue;
      }
    }
    return null;
  }

  // --- Windows: GSMTC-aware pause/resume ---

  // WinRT IAsyncOperation objects appear as opaque System.__ComObject in
  // PowerShell, so .GetAwaiter() isn't available directly. This preamble
  // loads the System.Runtime.WindowsRuntime bridge and defines an Await
  // helper that converts IAsyncOperation<T> to a .NET Task via AsTask().
  _gsmtcPreamble() {
    return `Add-Type -AssemblyName System.Runtime.WindowsRuntime
  $asTaskGeneric = ([System.WindowsRuntimeSystemExtensions].GetMethods() | Where-Object {
    $_.Name -eq 'AsTask' -and $_.GetParameters().Count -eq 1 -and
    $_.GetParameters()[0].ParameterType.Name -eq 'IAsyncOperation\`1'
  })[0]
  function Await($WinRtTask, $ResultType) {
    $asTask = $asTaskGeneric.MakeGenericMethod($ResultType)
    $netTask = $asTask.Invoke($null, @($WinRtTask))
    $netTask.Wait(-1) | Out-Null
    $netTask.Result
  }
  $null = [Windows.Media.Control.GlobalSystemMediaTransportControlsSessionManager, Windows.Media.Control, ContentType=WindowsRuntime]
  $m = Await ([Windows.Media.Control.GlobalSystemMediaTransportControlsSessionManager]::RequestAsync()) ([Windows.Media.Control.GlobalSystemMediaTransportControlsSessionManager])`;
  }

  _gsmtcPauseScript() {
    const preamble = this._gsmtcPreamble();
    return `
try {
  ${preamble}
  $paused = @()
  foreach ($s in $m.GetSessions()) {
    try {
      $pi = $s.GetPlaybackInfo()
      if ($pi.PlaybackStatus -eq 4) {
        $ok = Await ($s.TryPauseAsync()) ([bool])
        if ($ok) { $paused += $s.SourceAppUserModelId }
      }
    } catch { continue }
  }
  $paused -join '|'
} catch {
  Write-Output 'GSMTC_FAIL'
}`.trim();
  }

  _gsmtcResumeScript(appIds) {
    const idList = appIds.map((id) => `'${id.replace(/'/g, "''")}'`).join(",");
    const preamble = this._gsmtcPreamble();
    return `
try {
  ${preamble}
  $ids = @(${idList})
  foreach ($s in $m.GetSessions()) {
    try {
      if ($ids -contains $s.SourceAppUserModelId) {
        $null = Await ($s.TryPlayAsync()) ([bool])
      }
    } catch { continue }
  }
  Write-Output 'OK'
} catch {
  Write-Output 'GSMTC_FAIL'
}`.trim();
  }

  _sendWindowsMediaKey() {
    const nircmd = this._resolveNircmd();
    if (nircmd) {
      const result = spawnSync(nircmd, ["sendkeypress", "0xB3"], {
        stdio: "pipe",
        timeout: 3000,
      });
      if (result.status === 0) return true;
    }

    const result = spawnSync(
      "powershell",
      [
        "-NoProfile",
        "-NonInteractive",
        "-Command",
        "Add-Type -TypeDefinition 'using System.Runtime.InteropServices; public class KB { [DllImport(\"user32.dll\")] public static extern void keybd_event(byte bVk, byte bScan, int dwFlags, int dwExtraInfo); }'; [KB]::keybd_event(0xB3, 0, 1, 0); [KB]::keybd_event(0xB3, 0, 3, 0)",
      ],
      {
        stdio: "pipe",
        timeout: 5000,
      }
    );
    return result.status === 0;
  }

  _pauseWindows() {
    this._pausedWinApps = [];
    this._didPause = false;

    // Use GSMTC (Windows 10 1809+) — state-aware, targets specific apps
    const result = spawnSync(
      "powershell",
      ["-NoProfile", "-NonInteractive", "-Command", this._gsmtcPauseScript()],
      { stdio: "pipe", timeout: 5000 }
    );

    if (result.status === 0) {
      const output = (result.stdout?.toString() || "").trim();
      if (output === "GSMTC_FAIL") {
        debugLogger.debug("GSMTC unavailable, falling back to media key", {}, "media");
        return this._pauseWindowsFallback();
      }
      this._pausedWinApps = output.split("|").filter(Boolean);
      if (this._pausedWinApps.length > 0) {
        debugLogger.debug("Media paused via GSMTC", { apps: this._pausedWinApps }, "media");
        return true;
      }
      debugLogger.debug("GSMTC found no playing sessions", {}, "media");
      return false;
    }

    const stderr = (result.stderr?.toString() || "").trim();
    debugLogger.debug(
      "GSMTC PowerShell failed, falling back to media key",
      {
        status: result.status,
        signal: result.signal,
        stderr: stderr ? stderr.slice(0, 200) : undefined,
      },
      "media"
    );
    return this._pauseWindowsFallback();
  }

  _pauseWindowsFallback() {
    if (this._sendWindowsMediaKey()) {
      this._didPause = true;
      debugLogger.debug("Media paused via media key fallback", {}, "media");
      return true;
    }
    return false;
  }

  _resumeWindows() {
    // Resume via GSMTC if we paused that way
    if (this._pausedWinApps && this._pausedWinApps.length > 0) {
      const apps = this._pausedWinApps;
      this._pausedWinApps = [];

      const result = spawnSync(
        "powershell",
        ["-NoProfile", "-NonInteractive", "-Command", this._gsmtcResumeScript(apps)],
        { stdio: "pipe", timeout: 5000 }
      );

      if (result.status === 0) {
        debugLogger.debug("Media resumed via GSMTC", { apps }, "media");
        return true;
      }

      // GSMTC resume failed, fall back to media key
      debugLogger.debug("GSMTC resume failed, falling back to media key", {}, "media");
      return this._sendWindowsMediaKey();
    }

    // Resume via media key toggle if we paused with the fallback
    if (this._didPause) {
      this._didPause = false;
      if (this._sendWindowsMediaKey()) {
        debugLogger.debug("Media resumed via media key fallback", {}, "media");
        return true;
      }
    }

    return false;
  }

  _toggleWindows() {
    if (this._sendWindowsMediaKey()) {
      debugLogger.debug("Media toggled via Windows media key", {}, "media");
      return true;
    }
    return false;
  }
}

module.exports = new MediaPlayer();
