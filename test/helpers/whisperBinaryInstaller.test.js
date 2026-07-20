const test = require("node:test");
const assert = require("node:assert/strict");
const Module = require("node:module");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const installerPath = require.resolve("../../src/helpers/whisperBinaryInstaller");
const originalLoad = Module._load;

function loadInstaller({ userDataDir }) {
  delete require.cache[installerPath];

  Module._load = function loadWithMocks(request, parent, isMain) {
    if (request === "electron") {
      return { app: { getPath: () => userDataDir } };
    }
    return originalLoad.call(this, request, parent, isMain);
  };

  try {
    return require("../../src/helpers/whisperBinaryInstaller");
  } finally {
    Module._load = originalLoad;
  }
}

function makeFakeRelease(zipName) {
  return {
    tag: "v1.0.0",
    url: "https://example.invalid/release",
    assets: [{ name: zipName, url: "https://example.invalid/download.zip" }],
  };
}

test("downloadServerBinary() reports increasing progress percentages and installs to userData/bin", async () => {
  const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), "ektoswhispr-test-userdata-"));
  const { downloadServerBinary, BINARIES } = loadInstaller({ userDataDir });

  const platformArch = `${process.platform}-${process.arch}`;
  const config = BINARIES[platformArch];
  assert.ok(config, `expected a BINARIES entry for ${platformArch}`);

  const progressCalls = [];
  const fakeExtractedBinaryPath = path.join(userDataDir, "fake-extracted-binary");
  fs.writeFileSync(fakeExtractedBinaryPath, "fake binary contents");

  const result = await downloadServerBinary((percent) => progressCalls.push(percent), {
    fetchLatestReleaseFn: async () => makeFakeRelease(config.zipName),
    downloadFileFn: async (url, dest, onProgress) => {
      onProgress?.(25);
      onProgress?.(60);
      onProgress?.(100);
      fs.writeFileSync(dest, "fake zip contents");
    },
    extractZipFn: async () => {
      // no-op — findBinaryInDirFn below returns the pre-written fake binary
    },
    findBinaryInDirFn: () => fakeExtractedBinaryPath,
    setExecutableFn: () => {},
  });

  assert.deepEqual(progressCalls, [25, 60, 100]);
  assert.ok(
    progressCalls.every((p, i) => i === 0 || p >= progressCalls[i - 1]),
    "non-decreasing"
  );

  const expectedPath = path.join(userDataDir, "bin", config.outputName);
  assert.equal(result.success, true);
  assert.equal(result.binaryPath, expectedPath);
  assert.ok(fs.existsSync(expectedPath), "binary should be installed at userData/bin");

  fs.rmSync(userDataDir, { recursive: true, force: true });
});

test("downloadServerBinary() rejects without retrying internally on failure", async () => {
  const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), "ektoswhispr-test-userdata-"));
  const { downloadServerBinary, BINARIES } = loadInstaller({ userDataDir });
  const platformArch = `${process.platform}-${process.arch}`;
  const config = BINARIES[platformArch];

  let downloadAttempts = 0;

  await assert.rejects(
    () =>
      downloadServerBinary(undefined, {
        fetchLatestReleaseFn: async () => makeFakeRelease(config.zipName),
        downloadFileFn: async () => {
          downloadAttempts += 1;
          throw new Error("network error");
        },
        extractZipFn: async () => {},
        findBinaryInDirFn: () => null,
        setExecutableFn: () => {},
      }),
    /network error/
  );

  assert.equal(downloadAttempts, 1, "must not retry internally — single attempt only");

  fs.rmSync(userDataDir, { recursive: true, force: true });
});
