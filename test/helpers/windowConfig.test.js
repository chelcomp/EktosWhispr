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

test("getDictationBarPosition centers horizontally, width = 20% of workArea, height 40", () => {
  const { WindowPositionUtil } = loadWindowConfig();
  const pos = WindowPositionUtil.getDictationBarPosition(fullHd, "bottom");
  assert.equal(pos.width, 384); // round(1920 * 0.2)
  assert.equal(pos.height, 40);
  assert.equal(pos.x, Math.round((1920 - 384) / 2));
});

test("getDictationBarPosition bottom sits 2px above the workArea bottom edge", () => {
  const { WindowPositionUtil } = loadWindowConfig();
  const pos = WindowPositionUtil.getDictationBarPosition(fullHd, "bottom");
  assert.equal(pos.y, 1040 - 40 - 2);
});

test("getDictationBarPosition top sits 2px below the workArea top edge (respects multi-monitor origin)", () => {
  const { WindowPositionUtil } = loadWindowConfig();
  const display = { workArea: { x: -1920, y: 40, width: 1920, height: 1000 } };
  const pos = WindowPositionUtil.getDictationBarPosition(display, "top");
  assert.equal(pos.x, -1920 + Math.round((1920 - 384) / 2));
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
  assert.equal(pos.y, 800 - 40 - 2);
});
