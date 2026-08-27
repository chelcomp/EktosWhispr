export type Platform = "win32";

/**
 * Detects the current platform using Electron when available.
 */
export function getPlatform(): Platform {
  // Try Electron API first
  if (typeof window !== "undefined" && window.electronAPI?.getPlatform) {
    const platform = window.electronAPI.getPlatform();
    if (platform === "win32") {
      return "win32";
    }
  }

  // Default to win32
  return "win32";
}

/**
 * Cached platform value for performance
 */
let cachedPlatform: Platform | null = null;

export function getCachedPlatform(): Platform {
  if (cachedPlatform === null) {
    cachedPlatform = getPlatform();
  }
  return cachedPlatform;
}
