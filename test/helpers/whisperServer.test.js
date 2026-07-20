const test = require("node:test");
const assert = require("node:assert/strict");
const Module = require("node:module");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const whisperServerPath = require.resolve("../../src/helpers/whisperServer");
const originalLoad = Module._load;

function loadWhisperServerManager({ userDataDir } = {}) {
  delete require.cache[whisperServerPath];

  Module._load = function loadWithMocks(request, parent, isMain) {
    if (request === "electron") {
      return { app: { getPath: () => userDataDir || os.tmpdir() } };
    }
    return originalLoad.call(this, request, parent, isMain);
  };

  try {
    const WhisperServerManager = require("../../src/helpers/whisperServer");
    return new WhisperServerManager();
  } finally {
    Module._load = originalLoad;
  }
}

// This dev checkout may have real whisper-server binaries already downloaded
// into resources/bin/ (`npm run download:whisper-cpp`), which would otherwise
// make these "no binary anywhere"/"only in userData/bin" tests environment-
// dependent. Stub fs.existsSync so only the paths each test cares about
// resolve as present, regardless of what's actually on disk in resources/bin.
function withStubbedExistsSync(shouldExist, fn) {
  const original = fs.existsSync;
  fs.existsSync = (candidatePath) => shouldExist(candidatePath.toString());
  try {
    return fn();
  } finally {
    fs.existsSync = original;
  }
}

test("_doStart() throws an error with .code === WHISPER_SERVER_BINARY_MISSING when no binary is found in any candidate location", async () => {
  const emptyUserDataDir = fs.mkdtempSync(path.join(os.tmpdir(), "ektoswhispr-test-userdata-"));
  const manager = loadWhisperServerManager({ userDataDir: emptyUserDataDir });

  await withStubbedExistsSync(
    () => false,
    async () => {
      assert.equal(manager.getServerBinaryPath(), null);

      await assert.rejects(
        () => manager._doStart("/nonexistent/model.bin", {}),
        (err) => {
          assert.equal(err.code, "WHISPER_SERVER_BINARY_MISSING");
          return true;
        }
      );
    }
  );

  fs.rmSync(emptyUserDataDir, { recursive: true, force: true });
});

test("getServerBinaryPath() finds a binary present only at the userData/bin candidate (not resources/bin)", () => {
  const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), "ektoswhispr-test-userdata-"));
  const binDir = path.join(userDataDir, "bin");
  fs.mkdirSync(binDir, { recursive: true });

  const binaryName =
    process.platform === "win32"
      ? `whisper-server-${process.platform}-${process.arch}.exe`
      : `whisper-server-${process.platform}-${process.arch}`;
  const binaryPath = path.join(binDir, binaryName);
  fs.writeFileSync(binaryPath, "");

  const manager = loadWhisperServerManager({ userDataDir });

  withStubbedExistsSync(
    (candidatePath) => candidatePath === binaryPath,
    () => {
      assert.equal(manager.getServerBinaryPath(), binaryPath);
    }
  );

  fs.rmSync(userDataDir, { recursive: true, force: true });
});
