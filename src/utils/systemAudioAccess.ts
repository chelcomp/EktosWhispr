import type { SystemAudioAccessResult, SystemAudioStrategy } from "../types/electron";
import { getCachedPlatform } from "./platform";

type Platform = "win32";
type RendererSystemAudioStrategy = Extract<SystemAudioStrategy, "loopback">;
export const DEFAULT_SYSTEM_AUDIO_ACCESS: SystemAudioAccessResult = {
  granted: false,
  status: "unsupported",
  mode: "unsupported",
  supportsPersistentGrant: false,
  supportsPersistentPortalGrant: false,
  supportsNativeCapture: false,
  supportsOnboardingGrant: false,
  requiresRuntimeSharePrompt: false,
  strategy: "unsupported",
  restoreTokenAvailable: false,
  portalVersion: null,
};

export const getFallbackSystemAudioAccess = (
  _platform: Platform = getCachedPlatform()
): SystemAudioAccessResult => ({
  ...DEFAULT_SYSTEM_AUDIO_ACCESS,
  granted: true,
  status: "granted",
  mode: "loopback",
  strategy: "loopback",
});

export const canManageSystemAudioInApp = ({ mode }: Pick<SystemAudioAccessResult, "mode">) =>
  mode === "native";

export const isRendererSystemAudioStrategy = (
  strategy: SystemAudioStrategy | undefined | null
): strategy is RendererSystemAudioStrategy => strategy === "loopback";

export const getDisplayCaptureModeForStrategy = (
  _strategy: RendererSystemAudioStrategy
): "loopback" | "portal" => "loopback";
