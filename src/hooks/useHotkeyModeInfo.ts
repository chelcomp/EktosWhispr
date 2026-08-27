import { useEffect, useState } from "react";
import logger from "../utils/logger";

export interface HyprlandConfigStatus {
  canWrite: boolean;
  path: string;
}

export interface HotkeyModeInfo {
  isUsingNativeShortcut: boolean;
  isUsingHyprland: boolean;
  supportsPushToTalk: boolean;
  hyprlandConfigStatus: HyprlandConfigStatus | null;
}

const DEFAULT_INFO: HotkeyModeInfo = {
  isUsingNativeShortcut: false,
  isUsingHyprland: false,
  supportsPushToTalk: true,
  hyprlandConfigStatus: null,
};

/**
 * Resolves how the dictation hotkey is registered for the current session.
 * Windows uses native shortcuts (RegisterHotKey) — Hyprland / GNOME are gone.
 */
export function useHotkeyModeInfo(scope: string): HotkeyModeInfo {
  const [modeInfo, setModeInfo] = useState<HotkeyModeInfo>(DEFAULT_INFO);

  useEffect(() => {
    let cancelled = false;
    const checkHotkeyMode = async () => {
      try {
        const info = await window.electronAPI?.getHotkeyModeInfo?.();
        if (!info || cancelled) return;
        setModeInfo({
          isUsingNativeShortcut: info.isUsingNativeShortcut,
          isUsingHyprland: false,
          supportsPushToTalk: info.supportsPushToTalk,
          hyprlandConfigStatus: null,
        });
      } catch (error) {
        logger.error("Failed to check hotkey mode", { error }, scope);
      }
    };
    checkHotkeyMode();
    return () => {
      cancelled = true;
    };
  }, [scope]);

  return modeInfo;
}
