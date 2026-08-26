// Regression tests for the Windows push-to-talk state machine
// (windowManager.startWindowsPushToTalk / handleWindowsPushKeyUp):
// a lost KEY_UP must never wedge the session — the next press of the same
// key recovers, and a 30s watchdog force-stops a held session.
const test = require("node:test");
const assert = require("node:assert/strict");
const Module = require("node:module");

const originalLoad = Module._load;

Module._load = function patchedLoad(request, parent, isMain) {
  if (request === "electron") {
    return {
      app: { getPath: () => process.cwd(), getAppPath: () => process.cwd(), isReady: () => false, getVersion: () => "0.0.0", on: () => {} },
      screen: {
        getDisplayNearestPoint: () => ({ workArea: { x: 0, y: 0, width: 1920, height: 1040 } }),
      },
      ipcMain: { handle: () => {}, on: () => {} },
      shell: {},
      BrowserWindow: function BrowserWindow() {},
      dialog: { showMessageBox: async () => ({ response: 0 }) },
      nativeTheme: { on: () => {} },
    };
  }
  return originalLoad.call(this, request, parent, isMain);
};
test.after(() => {
  Module._load = originalLoad;
});

const WindowManager = require("../../src/helpers/windowManager.js");

function createWindowManager() {
  const wm = Object.create(WindowManager.prototype);
  wm._sent = [];
  wm.hotkeyManager = { isInListeningMode: () => false };
  wm.resizeToDictationBar = () => {};
  wm.hideDictationPanel = () => {
    wm._hidPanel = (wm._hidPanel || 0) + 1;
  };
  wm.mainWindow = {
    isDestroyed: () => false,
    getBounds: () => ({ x: 0, y: 0, width: 96, height: 96 }),
    setBounds: () => {},
    showInactive: () => {},
    show: () => {},
    webContents: {
      send: (channel) => {
        wm._sent.push(channel);
      },
    },
  };
  return wm;
}

test("a second press of the same key while still held recovers the lost KEY_UP and opens a fresh idle session", () => {
  const wm = createWindowManager();
  wm.startWindowsPushToTalk("F9");
  assert.equal(wm.winPushState.active, true);

  // KEY_UP was lost; the same key goes down again.
  wm.startWindowsPushToTalk("F9");

  // Stale session was torn down (not yet recording -> panel hidden, no stop)
  // and a brand-new session is armed instead of swallowing the press.
  assert.equal(wm.winPushState.active, true);
  assert.equal(wm.winPushState.key, "F9");
  assert.equal(wm.winPushState.isRecording, false);
  assert.equal(wm._sent.includes("stop-dictation"), false);
  assert.ok(wm._hidPanel >= 1);

  // Clear the live watchdog so the test process doesn't linger.
  wm.handleWindowsPushKeyUp("F9");
});

test("recovery stops the recording when the stale session had already started dictation", () => {
  const wm = createWindowManager();
  wm.startWindowsPushToTalk("F9");
  wm.winPushState.isRecording = true;

  wm.startWindowsPushToTalk("F9");

  assert.equal(wm.winPushState.active, true);
  assert.equal(wm.winPushState.isRecording, false);
  assert.equal(wm._sent.filter((c) => c === "stop-dictation").length, 1);

  // Clear the live watchdog so the test process doesn't linger.
  wm.handleWindowsPushKeyUp("F9");
});

test("a press of a different key is still ignored while another push session is held", () => {
  const wm = createWindowManager();
  wm.startWindowsPushToTalk("F9");
  const stale = wm.winPushState;
  const downTime = stale.downTime;

  wm.startWindowsPushToTalk("F10");

  assert.equal(wm.winPushState, stale);
  assert.equal(wm.winPushState.downTime, downTime);
  assert.equal(wm._sent.length, 0);

  // Clear the live watchdog so the test process doesn't linger.
  wm.handleWindowsPushKeyUp("F9");
});

test("watchdog force-stops a held session after 30s without KEY_UP", () => {
  test.mock.timers.enable({ apis: ["setTimeout"] });
  try {
    const wm = createWindowManager();
    wm.startWindowsPushToTalk("F9");

    // Past MIN_HOLD_DURATION_MS: recording started.
    test.mock.timers.tick(200);
    assert.equal(wm.winPushState.isRecording, true);
    assert.equal(wm._sent.includes("start-dictation"), true);

    // Still held at the 30s mark: watchdog force-stops.
    test.mock.timers.tick(30000 - 200);
    assert.equal(wm.winPushState, null);
    assert.equal(wm._sent.includes("stop-dictation"), true);
  } finally {
    test.mock.timers.reset();
  }
});

test("normal release clears the watchdog so it cannot fire afterwards", () => {
  test.mock.timers.enable({ apis: ["setTimeout"] });
  try {
    const wm = createWindowManager();
    wm.startWindowsPushToTalk("F9");
    // Release before MIN_HOLD_DURATION_MS: nothing was recording.
    wm.handleWindowsPushKeyUp("F9");
    assert.equal(wm.winPushState, null);
    assert.equal(wm._sent.length, 0);

    // The cleared watchdog must not resurrect/stop anything later.
    test.mock.timers.tick(60000);
    assert.equal(wm.winPushState, null);
    assert.equal(wm._sent.length, 0);
  } finally {
    test.mock.timers.reset();
  }
});
