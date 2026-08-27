import { useState, useCallback, useEffect } from "react";
import type { SystemAudioAccessResult } from "../types/electron";

const WINDOWS_ACCESS: SystemAudioAccessResult = {
  granted: true,
  status: "granted",
  mode: "loopback",
  strategy: "loopback",
  supportsOnboardingGrant: false,
  supportsNativeCapture: false,
  supportsPersistentGrant: false,
  supportsPersistentPortalGrant: false,
  requiresRuntimeSharePrompt: false,
  restoreTokenAvailable: false,
  portalVersion: null,
};

export function useSystemAudioPermission() {
  const [access, setAccess] = useState<SystemAudioAccessResult | null>(WINDOWS_ACCESS);
  const [isChecking, setIsChecking] = useState(false);

  // No-op probe: Windows always reports loopback-granted. Kept for the same
  // shape used by the macOS/Linux implementation so callers can stay agnostic.
  const check = useCallback(async () => {
    setAccess(WINDOWS_ACCESS);
  }, []);

  useEffect(() => {
    check();
  }, [check]);

  const openSettings = useCallback(async () => {
    await window.electronAPI?.openSystemAudioSettings?.();
  }, []);

  const request = useCallback(async (): Promise<boolean> => {
    setAccess(WINDOWS_ACCESS);
    return WINDOWS_ACCESS.granted;
  }, []);

  const granted = access?.granted ?? WINDOWS_ACCESS.granted;
  const status = access?.status ?? WINDOWS_ACCESS.status;
  const mode = access?.mode ?? WINDOWS_ACCESS.mode;
  const supportsPersistentGrant =
    access?.supportsPersistentGrant ?? WINDOWS_ACCESS.supportsPersistentGrant ?? false;
  const supportsPersistentPortalGrant =
    access?.supportsPersistentPortalGrant ??
    WINDOWS_ACCESS.supportsPersistentPortalGrant ??
    false;
  const supportsNativeCapture =
    access?.supportsNativeCapture ?? WINDOWS_ACCESS.supportsNativeCapture ?? false;
  const supportsOnboardingGrant =
    access?.supportsOnboardingGrant ?? WINDOWS_ACCESS.supportsOnboardingGrant ?? false;
  const requiresRuntimeSharePrompt =
    access?.requiresRuntimeSharePrompt ??
    WINDOWS_ACCESS.requiresRuntimeSharePrompt ??
    false;
  const strategy = access?.strategy ?? WINDOWS_ACCESS.strategy;
  const restoreTokenAvailable =
    access?.restoreTokenAvailable ?? WINDOWS_ACCESS.restoreTokenAvailable ?? false;
  const portalVersion = access?.portalVersion ?? WINDOWS_ACCESS.portalVersion ?? null;

  return {
    access,
    isChecking,
    granted,
    status,
    mode,
    supportsPersistentGrant,
    supportsPersistentPortalGrant,
    supportsNativeCapture,
    supportsOnboardingGrant,
    requiresRuntimeSharePrompt,
    strategy,
    restoreTokenAvailable,
    portalVersion,
    check,
    request,
    openSettings,
  };
}
