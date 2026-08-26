const test = require("node:test");
const assert = require("node:assert/strict");
const Module = require("node:module");

const modulePath = require.resolve("../../src/helpers/windowManager");
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
  wm.mainWindow = {
    isDestroyed: () => false,
    getBounds: () => ({ x: 0, y: 0, width: 96, height: 96 }),
    setBounds: (bounds) => {
      wm._applied = bounds;
    },
    showInactive: () => {
      wm._shown = true;
    },
    show: () => {
      wm._shown = true;
    },
  };
  return wm;
}

test("resizeToDictationBar centers horizontally (default), 20% width, 36px height, 2px above taskbar", () => {
  const wm = createWindowManager();
  const result = wm.resizeToDictationBar("bottom");
  assert.equal(result.success, true);
  assert.equal(wm._applied.width, 384);
  assert.equal(wm._applied.height, 36);
  assert.equal(wm._applied.y, 1040 - 36 - 2);
  assert.equal(wm._applied.x, Math.round((1920 - 384) / 2));
});

test("resizeToDictationBar centers horizontally when the idle ball is bottom-left", () => {
  const wm = createWindowManager();
  wm._panelStartPosition = "bottom-left";
  const result = wm.resizeToDictationBar("bottom");
  assert.equal(result.success, true);
  assert.equal(wm._applied.x, Math.round((1920 - 384) / 2));
});

test("resizeToDictationBar centers horizontally when the idle ball is centered", () => {
  const wm = createWindowManager();
  wm._panelStartPosition = "center";
  const result = wm.resizeToDictationBar("bottom");
  assert.equal(result.success, true);
  assert.equal(wm._applied.x, Math.round((1920 - 384) / 2));
});

test("resizeToDictationBar top anchors 2px from the top", () => {
  const wm = createWindowManager();
  const result = wm.resizeToDictationBar("top");
  assert.equal(result.success, true);
  assert.equal(wm._applied.y, 2);
});

test("resizeToDictationBar returns failure when the window is gone", () => {
  const wm = Object.create(WindowManager.prototype);
  wm.mainWindow = { isDestroyed: () => true, getBounds: () => { throw new Error("destroyed"); }, setBounds: () => {} };
  const result = wm.resizeToDictationBar("bottom");
  assert.equal(result.success, false);
});
