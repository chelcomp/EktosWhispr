#!/usr/bin/env node
/**
 * Downloads nircmd.exe for Windows builds.
 *
 * nircmd is a small utility for Windows that allows sending keyboard input
 * and other system commands. Used for fast clipboard paste operations.
 *
 * Source: https://www.nirsoft.net/utils/nircmd.html
 * License: Free for non-commercial use
 */

const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");
const { downloadFile, extractZip } = require("./lib/download-utils");

const NIRCMD_URL = "https://www.nirsoft.net/utils/nircmd-x64.zip";
const BIN_DIR = path.join(__dirname, "..", "resources", "bin");
const NIRCMD_PATH = path.join(BIN_DIR, "nircmd.exe");

// Use PowerShell as a fallback download mechanism (PowerShell's Invoke-WebRequest
// consults the Windows/.NET certificate store, so it succeeds on corporate
// networks with SSL-inspecting proxies where Node's bundled CA list doesn't
// include the proxy's injected root CA). Certificate validation is NOT
// disabled here: -UseBasicParsing alone is valid on both PowerShell 5.1 and
// 6+/7+, so a single command form covers both without any cert-bypass flag.
function buildNircmdPowerShellCommand(url, dest) {
  return `Invoke-WebRequest -Uri '${url}' -OutFile '${dest}' -UseBasicParsing`;
}

async function downloadWithPowerShell(url, dest) {
  const result = spawnSync(
    "powershell",
    ["-NoProfile", "-NonInteractive", "-Command", buildNircmdPowerShellCommand(url, dest)],
    { stdio: "pipe", timeout: 60000 }
  );
  if (result.status === 0) return;

  const stderr = (result.stderr ? result.stderr.toString() : "").trim().slice(0, 2000);
  throw new Error(`PowerShell download failed (exit ${result.status}): ${stderr}`);
}

async function main() {
  // Skip if not Windows and not building for all platforms
  if (process.platform !== "win32" && !process.argv.includes("--all")) {
    console.log("\nSkipping nircmd.exe download (Windows-only utility)\n");
    return;
  }

  console.log("\nDownloading nircmd.exe for Windows...\n");

  // Create bin directory
  fs.mkdirSync(BIN_DIR, { recursive: true });

  // Check if already exists
  if (fs.existsSync(NIRCMD_PATH)) {
    console.log("  nircmd.exe already exists, skipping\n");
    return;
  }

  const zipPath = path.join(BIN_DIR, "nircmd-x64.zip");

  try {
    console.log(`  Downloading from ${NIRCMD_URL}`);

    // Try Node https first; fall back to PowerShell (uses Windows cert store,
    // works on corporate networks with SSL inspection).
    try {
      await downloadFile(NIRCMD_URL, zipPath);
    } catch (nodeErr) {
      console.log(`  Node https failed (${nodeErr.message}), retrying with PowerShell...`);
      if (fs.existsSync(zipPath)) fs.unlinkSync(zipPath);
      await downloadWithPowerShell(NIRCMD_URL, zipPath);
    }

    console.log("  Extracting...");
    const extractDir = path.join(BIN_DIR, "temp-nircmd");
    fs.mkdirSync(extractDir, { recursive: true });
    await extractZip(zipPath, extractDir);

    // Copy nircmd.exe to bin directory
    const extractedPath = path.join(extractDir, "nircmd.exe");
    if (fs.existsSync(extractedPath)) {
      fs.copyFileSync(extractedPath, NIRCMD_PATH);
      const stats = fs.statSync(NIRCMD_PATH);
      console.log(`  ✓ nircmd.exe downloaded (${Math.round(stats.size / 1024)}KB)\n`);
    } else {
      console.error("  ✗ nircmd.exe not found in archive\n");
      process.exit(1);
    }

    // Cleanup
    fs.rmSync(extractDir, { recursive: true, force: true });
    fs.unlinkSync(zipPath);
  } catch (error) {
    if (fs.existsSync(zipPath)) fs.unlinkSync(zipPath);
    console.warn(`  ⚠ Could not download nircmd.exe: ${error.message}`);
    console.warn("  The app will use PowerShell as fallback for clipboard paste on Windows.\n");
    // Non-fatal: nircmd is optional, clipboard.js falls back to PowerShell automatically.
  }
}

module.exports = {
  buildNircmdPowerShellCommand,
  downloadWithPowerShell,
};

// Only run main() when executed directly
if (require.main === module) {
  main().catch(console.error);
}
