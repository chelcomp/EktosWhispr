const test = require("node:test");
const assert = require("node:assert/strict");
const { renderHook, act, cleanup } = require("@testing-library/react");
const React = require("react");
const { useNativeAccent } = require("../../src/hooks/useNativeAccent.ts");

function makeElectronApiStub() {
  const listeners = {};
  return {
    listeners,
    getAccentColor: async () => "#67c0ff",
    onThemeUpdated(callback) {
      listeners.onThemeUpdated = callback;
      return () => { delete listeners.onThemeUpdated; };
    },
  };
}

test.afterEach(cleanup);

test("useNativeAccent applies the accent from IPC to --color-accent", async () => {
  const stub = makeElectronApiStub();
  window.electronAPI = stub;
  await act(async () => {
    renderHook(() => useNativeAccent());
  });
  assert.equal(
    document.documentElement.style.getPropertyValue("--color-accent"),
    "#67c0ff"
  );
});

test("useNativeAccent updates --color-accent when the OS accent changes", async () => {
  const stub = makeElectronApiStub();
  window.electronAPI = stub;
  await act(async () => {
    renderHook(() => useNativeAccent());
  });
  await act(async () => {
    stub.listeners.onThemeUpdated({ dark: false, accent: "#abc123" });
  });
  assert.equal(
    document.documentElement.style.getPropertyValue("--color-accent"),
    "#abc123"
  );
});
