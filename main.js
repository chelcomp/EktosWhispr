const {
  app,
  desktopCapturer,
  globalShortcut,
  BrowserWindow,
  dialog,
  ipcMain,
  net,
  session,
} = require("electron");
const path = require("path");
const http = require("http");
const tls = require("tls");
require("dotenv").config({ path: path.join(__dirname, ".env") });

// Extend Node's TLS trust with the OS store so ws and https.get see corporate
// CAs that Chromium already trusts.
try {
  const currentCAs = tls.getCACertificates();
  const systemCAs = tls.getCACertificates("system");
  if (systemCAs?.length) {
    tls.setDefaultCACertificates([...currentCAs, ...systemCAs]);
  }
} catch (err) {
  require("./src/helpers/debugLogger").warn("System CA merge failed; using existing CA list", {
    error: err?.message,
  });
}

const VALID_CHANNELS = new Set(["development", "staging", "production"]);
const BASE_WINDOWS_APP_ID = "com.gizmolabs.ektoswhispr";

function isElectronBinaryExec() {
  const execPath = (process.execPath || "").toLowerCase();
  return (
    execPath.includes("/electron.app/contents/macos/electron") ||
    execPath.endsWith("/electron") ||
    execPath.endsWith("\\electron.exe")
  );
}

function inferDefaultChannel() {
  if (process.env.NODE_ENV === "development" || process.defaultApp || isElectronBinaryExec()) {
    return "development";
  }
  return "production";
}

function resolveAppChannel() {
  const rawChannel = (process.env.EKTOSWHISPR_CHANNEL || process.env.VITE_EKTOSWHISPR_CHANNEL || "")
    .trim()
    .toLowerCase();

  if (VALID_CHANNELS.has(rawChannel)) {
    return rawChannel;
  }

  return inferDefaultChannel();
}

const APP_CHANNEL = resolveAppChannel();
process.env.EKTOSWHISPR_CHANNEL = APP_CHANNEL;

function configureChannelUserDataPath() {
  if (APP_CHANNEL === "production") {
    return;
  }

  const isolatedPath = path.join(app.getPath("appData"), `EktosWhispr-${APP_CHANNEL}`);
  app.setPath("userData", isolatedPath);
}

configureChannelUserDataPath();

// Load userData .env (contains DICTATION_KEY, API keys, etc.) early — before
// hotkey registration, which needs DICTATION_KEY before the renderer loads.
require("dotenv").config({
  path: path.join(app.getPath("userData"), ".env"),
  override: false,
});

// Cap V8 old-space per process. Without this Electron's default is ~1.5GB on 64-bit,
// leaving hundreds of MB of committed virtual heap that the app never needs.
app.commandLine.appendSwitch("js-flags", "--max-old-space-size=256");


// Group all windows under single taskbar entry on Windows
if (process.platform === "win32") {
  const windowsAppId =
    APP_CHANNEL === "production" ? BASE_WINDOWS_APP_ID : `${BASE_WINDOWS_APP_ID}.${APP_CHANNEL}`;
  app.setAppUserModelId(windowsAppId);
}


const gotSingleInstanceLock = app.requestSingleInstanceLock();

if (!gotSingleInstanceLock) {
  app.exit(0);
}

const isLiveWindow = (window) => window && !window.isDestroyed();

// Ensure the OS process name and menus use the correct app name on all platforms
if (app.getName() !== "EktosWhispr") {
  app.setName("EktosWhispr");
}

// Add global error handling for uncaught exceptions
process.on("uncaughtException", (error) => {
  console.error("Uncaught Exception:", error);
  // Don't exit the process for EPIPE errors as they're harmless
  if (error.code === "EPIPE") {
    return;
  }
  // For other errors, log and continue
  console.error("Error stack:", error.stack);
});

process.on("unhandledRejection", (reason, promise) => {
  console.error("Unhandled Rejection at:", promise, "reason:", reason);
});

// Import helper module classes (but don't instantiate yet - wait for app.whenReady())
const EnvironmentManager = require("./src/helpers/environment");
const WindowManager = require("./src/helpers/windowManager");
const DatabaseManager = require("./src/helpers/database");
const ClipboardManager = require("./src/helpers/clipboard");
const WhisperManager = require("./src/helpers/whisper");
const ParakeetManager = require("./src/helpers/parakeet");
const DiarizationManager = require("./src/helpers/diarization");
const TrayManager = require("./src/helpers/tray");
const IPCHandlers = require("./src/helpers/ipcHandlers");
const CliBridge = require("./src/helpers/cliBridge");
const UpdateManager = require("./src/updater");
const WindowsKeyManager = require("./src/helpers/windowsKeyManager");
const TextEditMonitor = require("./src/helpers/textEditMonitor");
const WhisperCudaManager = require("./src/helpers/whisperCudaManager");
const WindowsLoopbackAudioManager = require("./src/helpers/windowsLoopbackAudioManager");
const MeetingAecManager = require("./src/helpers/meetingAecManager");
const ManualMeetingLauncher = require("./src/helpers/manualMeetingLauncher");
const { i18nMain, changeLanguage } = require("./src/helpers/i18nMain");
const sidecarRegistry = require("./src/helpers/sidecarRegistry");
const { reapStaleSidecars } = require("./src/helpers/sidecarReaper");
const TransformManager = require("./src/helpers/transformManager");

// Manager instances - initialized after app.whenReady()
let debugLogger = null;
let environmentManager = null;
let windowManager = null;
let hotkeyManager = null;
let databaseManager = null;
let clipboardManager = null;
let whisperManager = null;
let parakeetManager = null;
let diarizationManager = null;
let trayManager = null;
let updateManager = null;
let windowsKeyManager = null;
let textEditMonitor = null;
let whisperCudaManager = null;
let manualMeetingLauncher = null;
let windowsLoopbackAudioManager = null;
let meetingAecManager = null;
let transformManager = null;
let ipcHandlers = null;
let cliBridge = null;
let isShuttingDown = false;
let wakeRewarmTimer = null;
const WHISPER_WAKE_REWARM_DELAY_MS = 3000;




// Phase 1: Initialize managers + IPC handlers before window content loads
function initializeCoreManagers() {

  debugLogger = require("./src/helpers/debugLogger");
  debugLogger.ensureFileLogging();

  environmentManager = new EnvironmentManager();
  const uiLanguage = environmentManager.getUiLanguage();
  process.env.UI_LANGUAGE = uiLanguage;
  changeLanguage(uiLanguage);
  debugLogger.refreshLogLevel();

  windowManager = new WindowManager();
  hotkeyManager = windowManager.hotkeyManager;
  databaseManager = new DatabaseManager();
  clipboardManager = new ClipboardManager();
  whisperManager = new WhisperManager();
  whisperCudaManager = new WhisperCudaManager();
  parakeetManager = new ParakeetManager();
  diarizationManager = new DiarizationManager();

  manualMeetingLauncher = new ManualMeetingLauncher(windowManager, databaseManager);
  windowManager.manualMeetingLauncher = manualMeetingLauncher;
  updateManager = new UpdateManager();
  updateManager.setWindowManager(windowManager);
  windowsKeyManager = new WindowsKeyManager();
  textEditMonitor = new TextEditMonitor();
  windowsLoopbackAudioManager = new WindowsLoopbackAudioManager();
  meetingAecManager = new MeetingAecManager();
  windowManager.textEditMonitor = textEditMonitor;
  windowManager.windowsKeyManager = windowsKeyManager;

  transformManager = new TransformManager(windowManager, clipboardManager);

  // IPC handlers must be registered before window content loads
  ipcHandlers = new IPCHandlers({
    environmentManager,
    databaseManager,
    clipboardManager,
    whisperManager,
    parakeetManager,
    diarizationManager,
    windowManager,
    updateManager,
    windowsKeyManager,
    textEditMonitor,
    whisperCudaManager,
    manualMeetingLauncher,
    windowsLoopbackAudioManager,
    meetingAecManager,
    getTrayManager: () => trayManager,

  });

  ipcHandlers.registerTransformHandlers(transformManager);
}

function registerSidecars() {
  if (whisperManager) sidecarRegistry.register("whisper", () => whisperManager.stopServer());
  if (parakeetManager) sidecarRegistry.register("parakeet", () => parakeetManager.stopServer());
  if (diarizationManager) {
    sidecarRegistry.register("diarization", () => diarizationManager.shutdown());
  }
  const modelManager = require("./src/helpers/modelManagerBridge").default;
  sidecarRegistry.register("llama", () => modelManager.stopServer());
  const onnxWorkerClient = require("./src/helpers/onnxWorkerClient");
  sidecarRegistry.register("onnx", () => onnxWorkerClient.stop());
  const micMuteManager = require("./src/helpers/micMuteManager");
  sidecarRegistry.register("mic-mute-helper", () => micMuteManager.stop());
}

// Phase 2: Non-critical setup after windows are visible
function initializeDeferredManagers() {
  // Warm Windows loopback capability cache so first meeting start doesn't pay the probe spawn.
  clipboardManager.preWarmAccessibility();
  trayManager = new TrayManager();
}



// Main application startup
async function startApp() {
  reapStaleSidecars();

  // Phase 1: Core managers + IPC handlers before windows
  initializeCoreManagers();
  await environmentManager.init();
  registerSidecars();

  // One-time, best-effort cleanup of local data left behind by the removed
  // Qdrant sidecar / MiniLM embedding subsystem (docs/specs/remove-qdrant-dependency.md).
  require("./src/helpers/qdrantDataCleanup")
    .cleanupOrphanedQdrantData(debugLogger)
    .catch(() => {});

  windowManager.setActivationModeCache(environmentManager.getActivationMode());
  windowManager.setFloatingIconAutoHide(environmentManager.getFloatingIconAutoHide());
  windowManager.setPanelStartPosition(environmentManager.getPanelStartPosition());

  ipcMain.on("activation-mode-changed", (_event, mode) => {
    windowManager.setActivationModeCache(mode);
    environmentManager.saveActivationMode(mode);
  });

  ipcMain.on("floating-icon-auto-hide-changed", (_event, enabled) => {
    windowManager.setFloatingIconAutoHide(enabled);
    environmentManager.saveFloatingIconAutoHide(enabled);
    // Relay to the floating icon window so it can react immediately
    if (windowManager.mainWindow && !windowManager.mainWindow.isDestroyed()) {
      windowManager.mainWindow.webContents.send("floating-icon-auto-hide-changed", enabled);
    }
  });

  ipcMain.on("start-minimized-changed", (_event, enabled) => {
    if (debugLogger) debugLogger.info("Start minimized changed", { enabled });
    environmentManager.saveStartMinimized(enabled);
  });

  ipcMain.on("panel-start-position-changed", (_event, position) => {
    windowManager.setPanelStartPosition(position);
    environmentManager.savePanelStartPosition(position);
  });


  // In development, wait for Vite dev server to be ready
  if (process.env.NODE_ENV === "development") {
    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  // Create windows FIRST so the user sees UI as soon as possible
  // Don't honor the setting if the user still needs to see the post-migration
  // permissions modal (PostMigrationOnboarding) — a minimized window would hide it.
  const postMigrationDetector = require("./src/helpers/postMigrationDetector");
  const needsPostMigrationOnboarding = postMigrationDetector.isReturningFromOldBundle();
  const startMinimized = environmentManager.getStartMinimized() && !needsPostMigrationOnboarding;
  if (debugLogger) debugLogger.info("Start minimized", { enabled: startMinimized, needsPostMigrationOnboarding });
  await windowManager.createMainWindow();
  // "Start minimized" means: launch without the control panel window — the app
  // lives in the tray plus the floating dictation panel. When it's off, open the
  // control panel on launch. The floating dictation panel is always shown by
  // createMainWindow(), independent of this setting.
  if (!startMinimized) {
    await windowManager.createControlPanelWindow();
  }
  // The agent window is created on first use (lazy) to reduce startup RAM.
  // toggleAgentOverlay() handles lazy creation internally.

  const agentHotkeyCallback = () => {
    if (hotkeyManager.isInListeningMode()) return;
    windowManager.toggleAgentOverlay();
  };
  windowManager._agentHotkeyCallback = agentHotkeyCallback;

  const savedAgentKey = environmentManager.getAgentKey?.() || "";
  if (savedAgentKey) {
    const result = await hotkeyManager.registerSlot("agent", savedAgentKey, agentHotkeyCallback);
    if (!result.success) {
      debugLogger.warn("Failed to restore agent hotkey", { hotkey: savedAgentKey }, "hotkey");
    }
  }

  // Set up voice agent hotkey (dictation routed straight to the dictation
  // agent, bypassing cleanup)
  const voiceAgentHotkeyCallback = () => {
    windowManager.sendToggleVoiceAgent();
  };
  windowManager._voiceAgentHotkeyCallback = voiceAgentHotkeyCallback;

  const savedVoiceAgentKey = environmentManager.getVoiceAgentKey?.() || "";
  if (savedVoiceAgentKey) {
    const result = await hotkeyManager.registerSlot(
      "voiceAgent",
      savedVoiceAgentKey,
      voiceAgentHotkeyCallback
    );
    if (!result.success) {
      debugLogger.warn(
        "Failed to restore voice agent hotkey",
        { hotkey: savedVoiceAgentKey },
        "hotkey"
      );
    }
  }

  // Set up meeting mode hotkey
  const meetingHotkeyCallback = () => {
    if (hotkeyManager.isInListeningMode()) return;
    debugLogger.info("Meeting hotkey triggered", {}, "meeting");
    manualMeetingLauncher?.startManualMeeting();
  };

  const savedMeetingKey = environmentManager.getMeetingKey?.() || "";
  if (savedMeetingKey) {
    const result = await hotkeyManager.registerSlot(
      "meeting",
      savedMeetingKey,
      meetingHotkeyCallback
    );
    debugLogger.info(
      "Meeting hotkey startup registration",
      { savedMeetingKey, ...result },
      "meeting"
    );
  }

  ipcMain.handle("register-meeting-hotkey", async (_event, hotkey) => {
    if (hotkey) {
      const result = await hotkeyManager.registerSlot("meeting", hotkey, meetingHotkeyCallback, {
        atomic: true,
      });
      windowManager.reconcileNativeKeyListeners();
      if (result.success) {
        environmentManager.saveMeetingKey(hotkey);
        return { success: true };
      }
      return { success: false, message: result.error };
    } else {
      hotkeyManager.unregisterSlot("meeting");
      environmentManager.saveMeetingKey("");
      windowManager.reconcileNativeKeyListeners();
      return { success: true };
    }
  });

  // Phase 2: Initialize remaining managers after windows are visible
  initializeDeferredManagers();

  app.on("browser-window-focus", () => {});

  const { powerMonitor } = require("electron");
  powerMonitor.on("resume", () => {
    // R9 (docs/specs/on-demand-model-lifecycle.md): sleep leaves the
    // whisper-server *process* running with a now-dead CUDA context (unlike a
    // clean idle-timeout stop), so a naive "do nothing" risks a silently
    // broken first post-wake transcription. Rather than reloading (R1/R7
    // forbid proactive loading), proactively *unload* it instead — genuinely
    // equivalent to an idle-timeout eviction. The next Dictation hotkey press
    // cold-starts it normally via the on-demand warm-up trigger (R2).
    // Unconditional on every resume: stop() on an already-stopped/CPU server
    // is a cheap no-op, so there's no need to gate on "was CUDA loaded".
    if (wakeRewarmTimer) clearTimeout(wakeRewarmTimer);
    wakeRewarmTimer = setTimeout(() => {
      wakeRewarmTimer = null;
      whisperManager?.stopServer().catch((err) => {
        debugLogger.debug("whisper post-wake unload error (non-fatal)", { error: err.message });
      });
    }, WHISPER_WAKE_REWARM_DELAY_MS);
  });

  // R1 (docs/specs/on-demand-model-lifecycle.md): nothing pre-warms at
  // startup, for any of the three engines (Whisper, Parakeet, llama-server).
  // Loading is instead kicked off on-demand — hotkey-down for Dictation/
  // Meeting/Note Recording, file-selection for Upload (see
  // audioManager.js's warmupTranscriptionEngine()/warmupReasoningServer(),
  // and meetingRecordingStore.ts/UploadAudioView.tsx's equivalents) — or by
  // an actual transcription/inference request arriving with no engine
  // loaded. initializeAtStartup() itself is retained (and still called here)
  // for its non-pre-warm setup only — stale-download cleanup + dependency
  // logging — never a serverManager.start() call. llama-server's equivalent
  // startup pre-warm block (formerly here, gated on CLEANUP_PROVIDER/
  // DICTATION_AGENT_PROVIDER === "local") has been removed outright; it has
  // no non-pre-warm setup worth preserving at startup.
  whisperManager.initializeAtStartup().catch((err) => {
    debugLogger.debug("Whisper startup init error (non-fatal)", { error: err.message });
  });

  parakeetManager.initializeAtStartup().catch((err) => {
    debugLogger.debug("Parakeet startup init error (non-fatal)", { error: err.message });
  });

  // Auto-download diarization models if binary is available
  if (
    diarizationManager.getBinaryPath() &&
    (!diarizationManager.isModelDownloaded() || !diarizationManager.isVadModelDownloaded())
  ) {
    diarizationManager.downloadModels().catch((err) => {
      debugLogger.debug("Diarization model auto-download error (non-fatal)", {
        error: err.message,
      });
    });
  }

  if (process.platform === "win32") {
    const nircmdStatus = clipboardManager.getNircmdStatus();
    debugLogger.debug("Windows paste tool status", nircmdStatus);
  }

  trayManager.setWindows(windowManager.mainWindow, windowManager.controlPanelWindow);
  trayManager.setWindowManager(windowManager);
  trayManager.setCreateControlPanelCallback(() => windowManager.createControlPanelWindow());
  await trayManager.createTray();

  updateManager.setWindows(windowManager.mainWindow, windowManager.controlPanelWindow);
  updateManager.checkForUpdatesOnStartup();

  if (process.platform === "win32") {
    const nativeKeyManager = windowsKeyManager;
    debugLogger.debug("[Push-to-Talk] Native key listener setup starting");

    const dispatchNativeKeyDown = (key) => {
      if (hotkeyManager.slotHasHotkey("dictation", key)) {
        if (!isLiveWindow(windowManager.mainWindow)) return;
        if (windowManager.getActivationMode() === "push") {
          windowManager.startWindowsPushToTalk(key);
        } else {
          windowManager.sendToggleDictation();
        }
        return;
      }
      if (hotkeyManager.slotHasHotkey("voiceAgent", key)) {
        windowManager.sendToggleVoiceAgent();
      } else if (hotkeyManager.slotHasHotkey("agent", key)) {
        if (!hotkeyManager.isInListeningMode()) windowManager.toggleAgentOverlay();
      } else if (hotkeyManager.slotHasHotkey("meeting", key)) {
        if (!hotkeyManager.isInListeningMode()) manualMeetingLauncher?.startManualMeeting();
      }
    };

    const dispatchNativeKeyUp = (key) => {
      if (!hotkeyManager.slotHasHotkey("dictation", key)) return;
      if (windowManager.winPushState?.active) {
        windowManager.handleWindowsPushKeyUp(key);
      } else if (
        isLiveWindow(windowManager.mainWindow) &&
        windowManager.getActivationMode() === "push"
      ) {
        windowManager.handleWindowsPushKeyUp(key);
      }
    };

    nativeKeyManager.on("key-down", dispatchNativeKeyDown);
    nativeKeyManager.on("key-up", dispatchNativeKeyUp);

    nativeKeyManager.on("error", (error) => {
      debugLogger.warn("[Push-to-Talk] Native key listener error", { error: error.message });
      if (isLiveWindow(windowManager.mainWindow)) {
        windowManager.mainWindow.webContents.send("windows-ptt-unavailable", {
          reason: "error",
          message: error.message,
        });
      }
    });

    nativeKeyManager.on("unavailable", () => {
      debugLogger.debug(
        "[Push-to-Talk] Native key listener unavailable - falling back to toggle mode"
      );
      if (isLiveWindow(windowManager.mainWindow)) {
        windowManager.mainWindow.webContents.send("windows-ptt-unavailable", {
          reason: "binary_not_found",
          message: i18nMain.t("windows.pttUnavailable"),
        });
      }
    });

    nativeKeyManager.on("ready", () => {
      debugLogger.debug("[Push-to-Talk] Native key listener ready and listening");
    });

    const STARTUP_DELAY_MS = 3000;
    setTimeout(() => windowManager.reconcileNativeKeyListeners(), STARTUP_DELAY_MS);

    ipcMain.on("activation-mode-changed", () => {
      windowManager.resetWindowsPushState();
      windowManager.reconcileNativeKeyListeners();
    });

    ipcMain.on("hotkey-changed", () => {
      windowManager.resetWindowsPushState();
      windowManager.reconcileNativeKeyListeners();
    });
  }
}

// App event handlers
if (gotSingleInstanceLock) {
  app.on("second-instance", async (_event, commandLine) => {
    await app.whenReady();
    if (!windowManager) {
      return;
    }

    if (isLiveWindow(windowManager.controlPanelWindow)) {
      if (windowManager.controlPanelWindow.isMinimized()) {
        windowManager.controlPanelWindow.restore();
      }
      windowManager.controlPanelWindow.show();
      windowManager.controlPanelWindow.focus();
      if (windowManager.controlPanelWindow.webContents.isCrashed()) {
        windowManager.loadControlPanel();
      }
    } else {
      windowManager.createControlPanelWindow();
    }

    if (isLiveWindow(windowManager.mainWindow)) {
      windowManager.enforceMainWindowOnTop();
    } else {
      windowManager.createMainWindow();
    }

  });

  app
    .whenReady()
    .then(() => {
      if (process.platform === "win32") {
        session.defaultSession.setDisplayMediaRequestHandler((_request, callback) => {
          // Only the loopback audio track is used; the video source is
          // discarded by the renderer, so skip thumbnail generation.
          desktopCapturer
            .getSources({ types: ["screen"], thumbnailSize: { width: 0, height: 0 } })
            .then((sources) => {
              if (sources.length > 0) {
                callback({ video: sources[0], audio: "loopback" });
              } else {
                callback(null);
              }
            })
            .catch((error) => {
              console.error("Display media request failed:", error);
              callback(null);
            });
        });
      }

      startApp().catch((error) => {
        console.error("Failed to start app:", error);
        dialog.showErrorBox(
          i18nMain.t("startup.error.title"),
          i18nMain.t("startup.error.message", { error: error.message })
        );
        app.exit(1);
      });
    });

  app.on("window-all-closed", () => {
    app.quit();
  });

  app.on("browser-window-focus", (event, window) => {
    if (windowManager && isLiveWindow(windowManager.mainWindow)) {
      if (window === windowManager.mainWindow) {
        windowManager.enforceMainWindowOnTop();
      }
    }
  });

  app.on("before-quit", (event) => {
    if (isShuttingDown) return;
    isShuttingDown = true;
    if (updateManager && updateManager.isQuittingForUpdate) {
      // Quit must proceed for the installer to run, so no preventDefault;
      // sidecar shutdown is best-effort (the reaper cleans up orphans on relaunch).
      performSyncTeardown();
      sidecarRegistry.shutdownAll().catch(() => {});
      return;
    }
    event.preventDefault();
    performSyncTeardown();
    sidecarRegistry.shutdownAll().finally(() => app.exit(0));
  });
}

function performSyncTeardown() {
  if (wakeRewarmTimer) {
    clearTimeout(wakeRewarmTimer);
    wakeRewarmTimer = null;
  }

  if (cliBridge) {
    cliBridge.stop().catch(() => {});
    cliBridge = null;
  }
  if (windowManager && isLiveWindow(windowManager.agentWindow)) {
    windowManager.agentWindow.destroy();
  }
  if (windowManager && isLiveWindow(windowManager.transcriptionPreviewWindow)) {
    windowManager.transcriptionPreviewWindow.destroy();
  }
  if (hotkeyManager) {
    hotkeyManager.unregisterAll();
  } else {
    globalShortcut.unregisterAll();
  }
  if (windowsKeyManager) windowsKeyManager.stop();

  if (windowsLoopbackAudioManager) windowsLoopbackAudioManager.stop().catch(() => {});
  if (meetingAecManager) meetingAecManager.stop().catch(() => {});
  if (ipcHandlers) ipcHandlers._cleanupTextEditMonitor();
  if (textEditMonitor) textEditMonitor.stopMonitoring();
  if (updateManager) updateManager.cleanup();
}
