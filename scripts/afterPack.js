// electron-builder afterPack hook
//
// Runs after electron-builder assembles the output directory but before the
// final NSIS installer is created. Operates only on the output directory —
// never touches source node_modules/.
//
// 1. Strips non-win32 binaries and non-target architectures from
//    onnxruntime-node (saves 150–180 MB per build).
// 2. Verifies the Windows meeting-aec helper is present (optional).
// 3. Fails the build if required binaries (ffmpeg-static, ps-list vendor exe,
//    onnx worker script) are missing from app.asar.unpacked/.

const fs = require("fs");
const path = require("path");
const { Arch } = require("app-builder-lib");

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function resolveResourcesDir(context) {
  // app-builder context.outDir is the platform-specific output dir (e.g. win-unpacked).
  // appOut is the path containing resources/, app.asar, etc.
  if (context.appOutDir) return context.appOutDir;
  if (context.outputDir) {
    return path.join(
      context.outputDir,
      `${context.packager.appInfo.productFilename || "app"}-${context.electronPlatformName}-${Arch[context.arch]}`
    );
  }
  return context.outDir;
}

// ---------------------------------------------------------------------------
// onnxruntime-node binary stripping (Windows-only)
// ---------------------------------------------------------------------------

function stripOnnxruntimeBinaries(context) {
  if (context.electronPlatformName !== "win32") return;

  const archName = Arch[context.arch]; // x64 | arm64 | ia32

  const resourcesDir = resolveResourcesDir(context);
  const onnxBinDir = path.join(
    resourcesDir,
    "app.asar.unpacked",
    "node_modules",
    "onnxruntime-node",
    "bin",
    "napi-v6"
  );

  if (!fs.existsSync(onnxBinDir)) return;

  // Build the list of arch dirs to keep for the current Windows target.
  const keepArchs =
    archName === "x64"
      ? ["x64"]
      : archName === "arm64"
        ? ["arm64"]
        : [archName];

  const platformDirs = fs.readdirSync(onnxBinDir);
  let totalRemoved = 0;

  for (const dir of platformDirs) {
    const fullPath = path.join(onnxBinDir, dir);
    if (!fs.statSync(fullPath).isDirectory()) continue;

    // Windows is the only supported target — strip every other platform dir.
    if (dir !== "win32") {
      fs.rmSync(fullPath, { recursive: true, force: true });
      totalRemoved++;
      continue;
    }

    // Right platform — strip non-target architectures.
    const archDirs = fs.readdirSync(fullPath);
    for (const arch of archDirs) {
      const archPath = path.join(fullPath, arch);
      if (!fs.statSync(archPath).isDirectory()) continue;
      if (!keepArchs.includes(arch)) {
        fs.rmSync(archPath, { recursive: true, force: true });
        totalRemoved++;
      }
    }
  }

  if (totalRemoved > 0) {
    console.log(
      `  afterPack: stripped ${totalRemoved} non-target onnxruntime-node directories (keeping win32/${keepArchs.join(",")})`
    );
  }
}

// ---------------------------------------------------------------------------
// Windows meeting-aec helper presence check (optional)
// ---------------------------------------------------------------------------

function verifyMeetingAecHelper(context) {
  if (context.electronPlatformName !== "win32") return;

  const archName = Arch[context.arch];
  const binaryName = `meeting-aec-helper-win32-${archName}.exe`;
  const resourcesDir = resolveResourcesDir(context);
  const binaryPath = path.join(resourcesDir, "bin", binaryName);

  if (!fs.existsSync(binaryPath)) {
    console.warn(`  afterPack: missing optional meeting AEC helper (${binaryName})`);
  }
}

// ---------------------------------------------------------------------------
// Unpacked-binary verification (required)
// ---------------------------------------------------------------------------

function verifyUnpackedBinaries(context) {
  if (context.electronPlatformName !== "win32") return;

  const unpackedDir = path.join(resolveResourcesDir(context), "app.asar.unpacked");
  const unpackedModulesDir = path.join(unpackedDir, "node_modules");

  const ffmpegPath = path.join(unpackedModulesDir, "ffmpeg-static", "ffmpeg.exe");
  if (!fs.existsSync(ffmpegPath)) {
    throw new Error(
      `afterPack: missing ${ffmpegPath} — ffmpeg-static was not unpacked from app.asar (asarUnpack/packaging failure); the packed app cannot spawn FFmpeg`
    );
  }

  const onnxWorkerPath = path.join(unpackedDir, "src", "workers", "onnxWorker.js");
  if (!fs.existsSync(onnxWorkerPath)) {
    throw new Error(
      `afterPack: missing ${onnxWorkerPath} — src/workers was not unpacked from app.asar (asarUnpack/packaging failure); the ONNX utility process would crash-loop in the packed app`
    );
  }

  const psListVendorDir = path.join(unpackedModulesDir, "ps-list", "vendor");
  const hasFastlist =
    fs.existsSync(psListVendorDir) &&
    fs.readdirSync(psListVendorDir).some((name) => /^fastlist-.*\.exe$/.test(name));
  if (!hasFastlist) {
    throw new Error(
      `afterPack: no fastlist-*.exe in ${psListVendorDir} — ps-list vendor executable was not unpacked from app.asar (asarUnpack/packaging failure); Windows process detection would break`
    );
  }

  console.log("  afterPack: verified unpacked bundled binaries");
}

// ---------------------------------------------------------------------------
// Main hook
// ---------------------------------------------------------------------------

exports.default = async function (context) {
  stripOnnxruntimeBinaries(context);
  verifyMeetingAecHelper(context);
  verifyUnpackedBinaries(context);
};
