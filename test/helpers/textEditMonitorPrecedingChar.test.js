const test = require("node:test");
const assert = require("node:assert/strict");

const TextEditMonitor = require("../../src/helpers/textEditMonitor");

test("getPrecedingChar resolves to unknown for missing pid", async () => {
  const m = new TextEditMonitor();
  for (const pid of [null, undefined, 0]) {
    assert.deepEqual(await m.getPrecedingChar(pid), { state: "unknown" });
  }
});

test("getPrecedingChar returns unknown when the AX read fails or hangs", async () => {
  const m = new TextEditMonitor();
  // On Windows, getPrecedingChar short-circuits without shelling out, resolving
  // quickly with state "unknown".
  const start = Date.now();
  const result = await m.getPrecedingChar(99999999, 1500);
  assert.equal(result.state, "unknown");
  assert.ok(Date.now() - start < 3000);
});

test("activateTargetPid resolves false when no target PID was captured", async () => {
  const m = new TextEditMonitor();
  m.lastTargetPid = null;
  assert.equal(await m.activateTargetPid(), false);
});

test("activateTargetPid resolves false for an unmapped PID", async () => {
  const m = new TextEditMonitor();
  // On Windows, activateTargetPid short-circuits; the confirm poll can't make a
  // non-existent PID frontmost, so it times out and resolves to false.
  m.lastTargetPid = 99999999;
  const start = Date.now();
  const result = await m.activateTargetPid();
  assert.equal(result, false);
  assert.ok(Date.now() - start < 3000);
});

