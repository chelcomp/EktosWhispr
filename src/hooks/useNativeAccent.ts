import { useEffect } from "react";

// Applies the Windows accent color (via IPC from systemPreferences.getAccentColor())
// to the --color-accent CSS custom property. No-op fallback when the API is absent.
export function useNativeAccent() {
  useEffect(() => {
    const apply = (accent?: string) => {
      if (!accent) return;
      document.documentElement.style.setProperty("--color-accent", accent);
    };
    void window.electronAPI?.getAccentColor?.().then(apply);
    const unsubscribe = window.electronAPI?.onThemeUpdated?.(({ accent }) => apply(accent));
    return () => unsubscribe?.();
  }, []);
}
