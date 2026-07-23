const test = require("node:test");
const assert = require("node:assert/strict");
const Module = require("node:module");
const os = require("node:os");

const modulePath = require.resolve("../../src/helpers/activeWindowOcr");
const originalLoad = Module._load;

// Installs the mock Module._load and returns the freshly-required module
// PLUS a `restore()` callback. `runTesseractOcr`/`runNativeOcr` call
// `require("tesseract.js")`/spawn asynchronously — after `require()` itself
// returns — so the mock must stay installed for the whole async operation,
// not just for the synchronous `require()` call.
function loadWithMocks({ execFileImpl, tesseractImpl } = {}) {
  delete require.cache[modulePath];
  delete require.cache[require.resolve("../../src/helpers/activeWindowCapture")];

  Module._load = function loadWithMocks(request, parent, isMain) {
    if (request === "child_process") {
      return {
        ...originalLoad.call(this, request, parent, isMain),
        execFile: execFileImpl || (() => {}),
      };
    }
    if (request === "electron") {
      return { app: { getPath: () => os.tmpdir() } };
    }
    if (request === "tesseract.js") {
      if (!tesseractImpl) throw new Error("tesseract.js should not be required in this test");
      return tesseractImpl;
    }
    return originalLoad.call(this, request, parent, isMain);
  };
  const activeWindowOcr = require("../../src/helpers/activeWindowOcr");
  return { activeWindowOcr, restore: () => (Module._load = originalLoad) };
}

async function runOcrWithMocks(mocks, pngBuffer, options) {
  const { activeWindowOcr, restore } = loadWithMocks(mocks);
  try {
    return await activeWindowOcr.runOcr(pngBuffer, options);
  } finally {
    restore();
  }
}

function fakeTesseractManager({ downloaded }) {
  return {
    isDownloaded: () => downloaded,
    getAssetPaths: () => ["/fake/tesseract-core-simd.wasm.js", "/fake/eng.traineddata"],
    assetDir: "/fake",
  };
}

const FAKE_PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47]);

test("auto: falls back to Tesseract when native OCR spawn errors/rejects", async () => {
  const text = await runOcrWithMocks(
    {
      execFileImpl: (bin, args, opts, cb) => cb(new Error("native OCR unavailable")),
      tesseractImpl: { recognize: async () => ({ data: { text: "tesseract result" } }) },
    },
    FAKE_PNG,
    {
      engine: "auto",
      tesseractOcrManager: fakeTesseractManager({ downloaded: true }),
    }
  );

  assert.equal(text, "tesseract result");
});

test("auto: resolves to null/empty (not throwing) when both strategies fail", async () => {
  const text = await runOcrWithMocks(
    {
      execFileImpl: (bin, args, opts, cb) => cb(new Error("native OCR unavailable")),
    },
    FAKE_PNG,
    {
      engine: "auto",
      tesseractOcrManager: fakeTesseractManager({ downloaded: false }),
    }
  );

  assert.equal(text, null);
});

test('engine "native": never invokes Tesseract, even on native failure (no silent fallback)', async () => {
  let tesseractCalls = 0;
  const text = await runOcrWithMocks(
    {
      execFileImpl: (bin, args, opts, cb) => cb(new Error("native OCR unavailable")),
      tesseractImpl: {
        recognize: async () => {
          tesseractCalls++;
          return { data: { text: "should never be reached" } };
        },
      },
    },
    FAKE_PNG,
    {
      engine: "native",
      tesseractOcrManager: fakeTesseractManager({ downloaded: true }),
    }
  );

  assert.equal(text, null);
  assert.equal(tesseractCalls, 0, "Tesseract must never be invoked in forced-native mode");
});

test('engine "tesseract": never invokes the native PowerShell bridge, even with native available', async () => {
  let nativeCalls = 0;
  const text = await runOcrWithMocks(
    {
      execFileImpl: (bin, args, opts, cb) => {
        nativeCalls++;
        cb(null, JSON.stringify({ text: "native result" }));
      },
      tesseractImpl: { recognize: async () => ({ data: { text: "tesseract only result" } }) },
    },
    FAKE_PNG,
    {
      engine: "tesseract",
      tesseractOcrManager: fakeTesseractManager({ downloaded: true }),
    }
  );

  assert.equal(text, "tesseract only result");
  assert.equal(
    nativeCalls,
    0,
    "native PowerShell bridge must never be spawned in forced-tesseract mode"
  );
});

test("an unrecognized/corrupt engine value falls back to auto behavior", async () => {
  const text = await runOcrWithMocks(
    {
      execFileImpl: (bin, args, opts, cb) => cb(null, JSON.stringify({ text: "native result" })),
    },
    FAKE_PNG,
    {
      engine: "bogus",
      tesseractOcrManager: fakeTesseractManager({ downloaded: false }),
    }
  );

  assert.equal(text, "native result", "falls back to auto's native-first behavior");
});

test("tesseract strategy is treated as unavailable (skipped, no throw) when assets aren't downloaded", async () => {
  const text = await runOcrWithMocks(
    {
      execFileImpl: (bin, args, opts, cb) => cb(new Error("native unavailable")),
    },
    FAKE_PNG,
    {
      engine: "tesseract",
      tesseractOcrManager: fakeTesseractManager({ downloaded: false }),
    }
  );

  assert.equal(text, null);
});

test("runOcr resolves null for an empty/missing PNG buffer without throwing", async () => {
  const { activeWindowOcr, restore } = loadWithMocks({});
  try {
    assert.equal(await activeWindowOcr.runOcr(null), null);
    assert.equal(await activeWindowOcr.runOcr(Buffer.alloc(0)), null);
  } finally {
    restore();
  }
});
