const test = require("node:test");
const assert = require("node:assert/strict");
const Module = require("node:module");

const modulePath = require.resolve("../../src/helpers/windowConfig");
const originalLoad = Module._load;

function loadWindowConfig() {
  delete require.cache[modulePath];
  Module._load = function patchedLoad(request, parent, isMain) {
    if (request === "electron") {
      return { app: { getPath: () => require("os").tmpdir(), getAppPath: () => __dirname } };
    }
    return originalLoad.call(this, request, parent, isMain);
  };
  try {
    return require(modulePath);
  } finally {
    Module._load = originalLoad;
  }
}

const fullHd = { workArea: { x: 0, y: 0, width: 1920, height: 1040 } };

test("getDictationBarPosition anchors right by default (same side as the idle ball), width = 20% of workArea, height 48", () => {
  const { WindowPositionUtil } = loadWindowConfig();
  const pos = WindowPositionUtil.getDictationBarPosition(fullHd, "bottom");
  assert.equal(pos.width, 384); // round(1920 * 0.2)
  assert.equal(pos.height, 48);
  assert.equal(pos.x, 1920 - 384 - 2);
});

test("getDictationBarPosition honors alignX left/center anchors", () => {
  const { WindowPositionUtil } = loadWindowConfig();
  assert.equal(WindowPositionUtil.getDictationBarPosition(fullHd, "bottom", "left").x, 2);
  assert.equal(
    WindowPositionUtil.getDictationBarPosition(fullHd, "bottom", "center").x,
    Math.round((1920 - 384) / 2)
  );
});

test("getDictationBarPosition bottom sits 2px above the workArea bottom edge", () => {
  const { WindowPositionUtil } = loadWindowConfig();
  const pos = WindowPositionUtil.getDictationBarPosition(fullHd, "bottom");
  assert.equal(pos.y, 1040 - 48 - 2);
});

test("getDictationBarPosition top sits 2px below the workArea top edge, right-anchored (respects multi-monitor origin)", () => {
  const { WindowPositionUtil } = loadWindowConfig();
  const display = { workArea: { x: -1920, y: 40, width: 1920, height: 1000 } };
  const pos = WindowPositionUtil.getDictationBarPosition(display, "top");
  assert.equal(pos.x, -1920 + 1920 - 384 - 2);
  assert.equal(pos.y, 42);
});

test("getDictationBarPosition never leaves the workArea horizontally", () => {
  const { WindowPositionUtil } = loadWindowConfig();
  const display = { workArea: { x: 0, y: 0, width: 250, height: 200 } }; // 20% = 50px
  const pos = WindowPositionUtil.getDictationBarPosition(display, "bottom");
  assert.ok(pos.x >= 0);
  assert.ok(pos.x + pos.width <= 250);
  assert.ok(pos.y >= 0);
});

test("getDictationBarPosition falls back to display.bounds when workArea is missing", () => {
  const { WindowPositionUtil } = loadWindowConfig();
  const display = { bounds: { x: 0, y: 0, width: 1000, height: 800 } };
  const pos = WindowPositionUtil.getDictationBarPosition(display, "bottom");
  assert.equal(pos.y, 800 - 48 - 2);
});

const originalPlatform = process.platform;
function setPlatform(platform) {
  Object.defineProperty(process, "platform", { value: platform });
}

test("applyMica is a no-op on non-Windows", () => {
  setPlatform("linux");
  try {
    const { applyMica } = loadWindowConfig();
    const calls = [];
    assert.equal(applyMica({ setBackgroundMaterial: (m) => calls.push(m) }), false);
    assert.equal(calls.length, 0);
  } finally {
    setPlatform(originalPlatform);
  }
});

test("applyMica is a no-op when the window has no setBackgroundMaterial", () => {
  setPlatform("win32");
  try {
    const { applyMica } = loadWindowConfig();
    assert.equal(applyMica({}), false);
  } finally {
    setPlatform(originalPlatform);
  }
});

test("applyMica requests mica material on Win32", () => {
  setPlatform("win32");
  try {
    const { applyMica } = loadWindowConfig();
    const calls = [];
    assert.equal(applyMica({ setBackgroundMaterial: (m) => calls.push(m) }), true);
    assert.deepEqual(calls, ["mica"]);
  } finally {
    setPlatform(originalPlatform);
  }
});

test("applyMica swallows API failures", () => {
  setPlatform("win32");
  try {
    const { applyMica } = loadWindowConfig();
    assert.equal(applyMica({ setBackgroundMaterial: () => { throw new Error("unsupported"); } }), false);
  } finally {
    setPlatform(originalPlatform);
  }
});
