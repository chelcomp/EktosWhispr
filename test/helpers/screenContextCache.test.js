const test = require("node:test");
const assert = require("node:assert/strict");
const {
  ScreenContextCache,
  resolveScreenContextWithCache,
  OCR_REUSE_WINDOW_MS,
} = require("../../src/helpers/screenContextCache");

function mockIdentify(appIdentifier) {
  return async () => appIdentifier;
}

function mockCaptureAndOcr(appIdentifier, ocrText) {
  let calls = 0;
  const fn = async () => {
    calls++;
    return { appIdentifier, ocrText };
  };
  fn.calls = () => calls;
  return fn;
}

test("same app, second hotkey-down within the reuse window: full capture+OCR invoked once, cached text reused", async () => {
  const cache = new ScreenContextCache();
  const capture1 = mockCaptureAndOcr("notepad.exe", "first turn OCR text");

  const first = await resolveScreenContextWithCache({
    cache,
    identify: mockIdentify("notepad.exe"),
    captureAndOcr: capture1,
    hotkeyDownTimestamp: 1000,
  });
  assert.equal(first.text, "first turn OCR text");
  assert.equal(first.reused, false);
  assert.equal(capture1.calls(), 1);
  cache.recordRecordingStopped(1500);

  const capture2 = mockCaptureAndOcr("notepad.exe", "should never be reached");
  const second = await resolveScreenContextWithCache({
    cache,
    identify: mockIdentify("notepad.exe"),
    captureAndOcr: capture2,
    hotkeyDownTimestamp: 1500 + OCR_REUSE_WINDOW_MS - 100,
  });

  assert.equal(second.text, "first turn OCR text");
  assert.equal(second.reused, true);
  assert.equal(capture2.calls(), 0, "full capture+OCR must not run on the second turn");
});

test("same app, second hotkey-down beyond the reuse window: full capture+OCR runs twice", async () => {
  const cache = new ScreenContextCache();
  const capture1 = mockCaptureAndOcr("notepad.exe", "turn 1 text");
  await resolveScreenContextWithCache({
    cache,
    identify: mockIdentify("notepad.exe"),
    captureAndOcr: capture1,
    hotkeyDownTimestamp: 1000,
  });
  cache.recordRecordingStopped(1500);

  const capture2 = mockCaptureAndOcr("notepad.exe", "turn 2 text");
  const second = await resolveScreenContextWithCache({
    cache,
    identify: mockIdentify("notepad.exe"),
    captureAndOcr: capture2,
    hotkeyDownTimestamp: 1500 + OCR_REUSE_WINDOW_MS + 500,
  });

  assert.equal(second.text, "turn 2 text");
  assert.equal(second.reused, false);
  assert.equal(capture2.calls(), 1, "beyond the reuse window, capture+OCR must run again");
});

test("different app within the reuse window: cache is not reused across an app switch", async () => {
  const cache = new ScreenContextCache();
  const capture1 = mockCaptureAndOcr("notepad.exe", "notepad text");
  await resolveScreenContextWithCache({
    cache,
    identify: mockIdentify("notepad.exe"),
    captureAndOcr: capture1,
    hotkeyDownTimestamp: 1000,
  });
  cache.recordRecordingStopped(1500);

  const capture2 = mockCaptureAndOcr("chrome.exe", "chrome text");
  const second = await resolveScreenContextWithCache({
    cache,
    identify: mockIdentify("chrome.exe"),
    captureAndOcr: capture2,
    hotkeyDownTimestamp: 1500 + 100, // well within the window
  });

  assert.equal(second.text, "chrome text");
  assert.equal(second.reused, false);
  assert.equal(capture2.calls(), 1, "an app switch must never reuse the prior cache entry");
});

test("no prior cached entry (first-ever dictation): full capture+OCR runs, seeds the cache", async () => {
  const cache = new ScreenContextCache();
  const capture = mockCaptureAndOcr("notepad.exe", "seed text");

  const result = await resolveScreenContextWithCache({
    cache,
    identify: mockIdentify("notepad.exe"),
    captureAndOcr: capture,
    hotkeyDownTimestamp: 1000,
  });

  assert.equal(result.text, "seed text");
  assert.equal(result.reused, false);
  assert.equal(capture.calls(), 1);
  assert.deepEqual(
    cache.lastScreenContext.appIdentifier,
    "notepad",
    "stored in normalized (lowercased, .exe-stripped) form for cross-format comparison"
  );
  assert.equal(cache.lastScreenContext.ocrText, "seed text");
});

test("identity comparison is case/`.exe`-suffix insensitive (identify-only vs. full-capture identifier formats)", async () => {
  const cache = new ScreenContextCache();
  // Full capture path reports the raw executable filename, original case.
  const capture1 = mockCaptureAndOcr("Notepad.exe", "first turn text");
  await resolveScreenContextWithCache({
    cache,
    identify: mockIdentify("Notepad.exe"),
    captureAndOcr: capture1,
    hotkeyDownTimestamp: 1000,
  });
  cache.recordRecordingStopped(1500);

  // Identify-only path reports a lowercased, ".exe"-stripped name.
  const capture2 = mockCaptureAndOcr("notepad.exe", "should never be reached");
  const second = await resolveScreenContextWithCache({
    cache,
    identify: mockIdentify("notepad"),
    captureAndOcr: capture2,
    hotkeyDownTimestamp: 1500 + 100,
  });

  assert.equal(
    second.reused,
    true,
    "differing case/.exe-suffix formats must still match the same app"
  );
  assert.equal(capture2.calls(), 0);
});

test("a failed/null fresh capture does not overwrite a prior valid cache entry", async () => {
  const cache = new ScreenContextCache();
  await resolveScreenContextWithCache({
    cache,
    identify: mockIdentify("notepad.exe"),
    captureAndOcr: mockCaptureAndOcr("notepad.exe", "valid cached text"),
    hotkeyDownTimestamp: 1000,
  });
  cache.recordRecordingStopped(1500);

  // Beyond the reuse window, so a fresh capture is attempted — but it fails.
  const failingCapture = async () => ({ appIdentifier: "notepad.exe", ocrText: null });
  const result = await resolveScreenContextWithCache({
    cache,
    identify: mockIdentify("notepad.exe"),
    captureAndOcr: failingCapture,
    hotkeyDownTimestamp: 1500 + OCR_REUSE_WINDOW_MS + 500,
  });

  assert.equal(result.text, null, "this turn's LLM pass gets no context per Requirement 7");
  assert.equal(cache.lastScreenContext.ocrText, "valid cached text", "prior cache entry survives");
});
