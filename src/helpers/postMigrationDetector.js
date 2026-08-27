const fs = require("fs");
const path = require("path");
const { app } = require("electron");

const SENTINEL_FILENAME = ".bundle-migrated";
const DISMISSED_FILENAME = ".bundle-migrated-dismissed";


function getSentinelPath() {
  return path.join(app.getPath("userData"), SENTINEL_FILENAME);
}

function getDismissedPath() {
  return path.join(app.getPath("userData"), DISMISSED_FILENAME);
}

function isReturningFromOldBundle() {
  return false;
}

function markBundleMigrated() {
  try {
    fs.writeFileSync(getSentinelPath(), new Date().toISOString());
  } catch {
    // Best-effort: if userData isn't writable, modal re-shows next launch.
  }
}

function markBundleMigrationDismissed() {
  try {
    fs.writeFileSync(getDismissedPath(), new Date().toISOString());
  } catch {
    // Best-effort: if userData isn't writable, modal re-shows next launch.
  }
}

module.exports = {
  isReturningFromOldBundle,
  markBundleMigrated,
  markBundleMigrationDismissed,
};
