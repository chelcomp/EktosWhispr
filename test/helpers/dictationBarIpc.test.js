const test = require("node:test");
const assert = require("node:assert/strict");
const Module = require("node:module");

const originalLoad = Module._load;
const registeredHandlers = new Map();

Module._load = function patchedLoad(request, parent, isMain) {
  if (request === "electron") {
    return {
      app: { getPath: () => process.cwd(), getAppPath: () => process.cwd(), isReady: () => false, getVersion: () => "0.0.0", on: () => {} },
      ipcMain: {
        handle: (name, fn) => { registeredHandlers.set(name, fn); },
        on: (name, fn) => { registeredHandlers.set(name, fn); },
      },
      shell: {},
      BrowserWindow: function BrowserWindow() {},
      systemPreferences: { subscribeWorkspaceNotification: () => {} },
      net: {},
    };
  }
  return originalLoad.call(this, request, parent, isMain);
};
test.after(() => {
  Module._load = originalLoad;
});

const IPCHandlers = require("../../src/helpers/ipcHandlers.js");

test("resize-dictation-bar forwards the position to windowManager", () => {
  const calls = [];
  const instance = Object.create(IPCHandlers.prototype);
  instance.windowManager = {
    resizeToDictationBar: (position) => {
      calls.push(position);
      return { success: true, bounds: { x: 1, y: 2, width: 384, height: 40 } };
    },
  };
  instance.setupHandlers();

  const handler = registeredHandlers.get("resize-dictation-bar");
  assert.ok(handler, "resize-dictation-bar handler registered");
  const result = handler({}, "top");
  assert.deepEqual(calls, ["top"]);
  assert.equal(result.success, true);
});
