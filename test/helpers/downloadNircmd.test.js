const test = require("node:test");
const assert = require("node:assert/strict");
const cp = require("child_process");

const MODULE_PATH = require.resolve("../../scripts/download-nircmd");

// Requiring the module must not perform any downloads or filesystem writes
// (guarded by `if (require.main === module)` in scripts/download-nircmd.js).
function freshRequire() {
  delete require.cache[MODULE_PATH];
  return require(MODULE_PATH);
}

const { buildNircmdPowerShellCommand } = freshRequire();

test("buildNircmdPowerShellCommand never disables certificate validation", () => {
  const cases = [
    { url: "https://www.nirsoft.net/utils/nircmd-x64.zip", dest: "C:\\dev\\bin\\nircmd-x64.zip" },
    {
      url: "https://example.com/path with space/it's-nircmd.zip",
      dest: "C:\\dev\\bin\\it's dest.zip",
    },
  ];

  for (const { url, dest } of cases) {
    const command = buildNircmdPowerShellCommand(url, dest);

    assert.doesNotMatch(command, /-SkipCertificateCheck/);
    assert.doesNotMatch(command, /ServerCertificateValidationCallback/);
    assert.match(command, /-UseBasicParsing/);
    assert.ok(command.includes(url), "command should include the given url");
    assert.ok(command.includes(dest), "command should include the given dest");
  }
});

test("downloadWithPowerShell throws with captured stderr on failure", async () => {
  const origSpawnSync = cp.spawnSync;
  const fakeStderr =
    "Invoke-WebRequest : The underlying connection was closed: Could not establish trust.";
  cp.spawnSync = function () {
    return { status: 1, stderr: Buffer.from(fakeStderr) };
  };

  try {
    const { downloadWithPowerShell } = freshRequire();
    await assert.rejects(
      () =>
        downloadWithPowerShell(
          "https://www.nirsoft.net/utils/nircmd-x64.zip",
          "C:\\dest\\nircmd.zip"
        ),
      (err) => {
        assert.match(err.message, /exit 1/);
        assert.ok(err.message.includes(fakeStderr), "error message should include captured stderr");
        return true;
      }
    );
  } finally {
    cp.spawnSync = origSpawnSync;
    freshRequire();
  }
});

test("downloadWithPowerShell resolves on success without throwing", async () => {
  const origSpawnSync = cp.spawnSync;
  cp.spawnSync = function () {
    return { status: 0, stderr: Buffer.from("") };
  };

  try {
    const { downloadWithPowerShell } = freshRequire();
    await assert.doesNotReject(() =>
      downloadWithPowerShell("https://www.nirsoft.net/utils/nircmd-x64.zip", "C:\\dest\\nircmd.zip")
    );
  } finally {
    cp.spawnSync = origSpawnSync;
    freshRequire();
  }
});
