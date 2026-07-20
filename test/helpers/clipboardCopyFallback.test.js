const test = require("node:test");
const assert = require("node:assert/strict");

const load = () => import("../../src/helpers/clipboardCopyFallback.ts");

test("electron clipboard write succeeds -> returns success without calling navigator fallback", async () => {
  const { copyTextWithFallback } = await load();

  let navigatorCalled = false;
  const result = await copyTextWithFallback("hello", {
    electronWrite: async () => ({ success: true }),
    navigatorWrite: async () => {
      navigatorCalled = true;
    },
    logWarn: () => {},
  });

  assert.deepEqual(result, { success: true, method: "electron" });
  assert.equal(navigatorCalled, false);
});

test("electron clipboard write throws -> falls back to navigator, which succeeds", async () => {
  const { copyTextWithFallback } = await load();

  const result = await copyTextWithFallback("hello", {
    electronWrite: async () => {
      throw new Error("electron write failed");
    },
    navigatorWrite: async () => {},
    logWarn: () => {},
  });

  assert.deepEqual(result, { success: true, method: "navigator" });
});

test("electron clipboard write returns {success:false} -> falls back to navigator, which succeeds", async () => {
  const { copyTextWithFallback } = await load();

  const result = await copyTextWithFallback("hello", {
    electronWrite: async () => ({ success: false }),
    navigatorWrite: async () => {},
    logWarn: () => {},
  });

  assert.deepEqual(result, { success: true, method: "navigator" });
});

test("both paths fail -> returns failure and calls the injected logger exactly once with a warning", async () => {
  const { copyTextWithFallback } = await load();

  let warnCalls = 0;
  const result = await copyTextWithFallback("hello", {
    electronWrite: async () => {
      throw new Error("electron write failed");
    },
    navigatorWrite: async () => {
      throw new Error("navigator write failed");
    },
    logWarn: () => {
      warnCalls += 1;
    },
  });

  assert.deepEqual(result, { success: false });
  assert.equal(warnCalls, 1, "logger must be called exactly once — never silently swallowed");
});

test("electron write function absent entirely -> falls straight through to navigator without throwing", async () => {
  const { copyTextWithFallback } = await load();

  const result = await copyTextWithFallback("hello", {
    electronWrite: undefined,
    navigatorWrite: async () => {},
    logWarn: () => {},
  });

  assert.deepEqual(result, { success: true, method: "navigator" });
});
