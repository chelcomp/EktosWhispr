import React, { useState, useEffect, useLayoutEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import "./index.css";
import { X } from "lucide-react";
import { useToast } from "./components/ui/useToast";
import { LoadingDots } from "./components/ui/LoadingDots";
import { useHotkey } from "./hooks/useHotkey";
import { formatHotkeyListLabel } from "./utils/hotkeys";
import { useWindowDrag } from "./hooks/useWindowDrag";
import { useAudioRecording } from "./hooks/useAudioRecording";
import { useSettingsStore, selectResolvedLLMConfig } from "./stores/settingsStore";
import { playTransformStartCue, playTransformDoneCue } from "./utils/dictationCues";
import VersionBadge from "./components/VersionBadge";
import DictationBar from "./components/DictationBar";
import { deriveBarView } from "./utils/dictationBar";

// Sound Wave Icon Component (for idle/hover states)
const SoundWaveIcon = ({ size = 16 }) => {
  return (
    <div className="flex items-center justify-center gap-1">
      <div
        className={`bg-white rounded-full`}
        style={{ width: size * 0.25, height: size * 0.6 }}
      ></div>
      <div className={`bg-white rounded-full`} style={{ width: size * 0.25, height: size }}></div>
      <div
        className={`bg-white rounded-full`}
        style={{ width: size * 0.25, height: size * 0.6 }}
      ></div>
    </div>
  );
};

// Voice Wave Animation Component (for processing state)
const VoiceWaveIndicator = ({ isListening }) => {
  return (
    <div className="flex items-center justify-center gap-0.5">
      {[...Array(4)].map((_, i) => (
        <div
          key={i}
          className={`w-0.5 bg-white rounded-full transition-[height] duration-150 ${
            isListening ? "animate-pulse h-4" : "h-2"
          }`}
          style={{
            animationDelay: isListening ? `${i * 0.1}s` : "0s",
            animationDuration: isListening ? `${0.6 + i * 0.1}s` : "0s",
          }}
        />
      ))}
    </div>
  );
};

// Transform Icon — two interleaved arrows suggesting text rewrite
const TransformIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M5 12h14" />
    <path d="M15 6l6 6-6 6" />
  </svg>
);

// Tooltip Component
const Tooltip = ({ children, content, emoji, align = "center" }) => {
  const [isVisible, setIsVisible] = useState(false);

  const alignClass =
    align === "right" ? "right-0" : align === "left" ? "left-0" : "left-1/2 -translate-x-1/2";

  const arrowClass =
    align === "right" ? "right-3" : align === "left" ? "left-3" : "left-1/2 -translate-x-1/2";

  return (
    <div className="relative inline-block">
      <div onMouseEnter={() => setIsVisible(true)} onMouseLeave={() => setIsVisible(false)}>
        {children}
      </div>
      {isVisible && (
        <div
          className={`absolute bottom-full ${alignClass} mb-2 px-1.5 py-1 text-[10px] text-popover-foreground bg-popover border border-border rounded-md z-10 shadow-lg transition-opacity duration-150 whitespace-nowrap`}
        >
          {emoji && <span className="mr-1">{emoji}</span>}
          {content}
          <div
            className={`absolute top-full ${arrowClass} w-0 h-0 border-l-2 border-r-2 border-t-2 border-transparent border-t-popover`}
          ></div>
        </div>
      )}
    </div>
  );
};

// Update overlay component (rendered inside dictation bar window)
function UpdateOverlay({ data, onRespond, t }) {
  const [isVisible, setIsVisible] = useState(false);
  const [isHovered, setIsHovered] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setIsVisible(true), 50);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div className="w-full h-full flex items-end justify-center p-3 pointer-events-none">
      <div
        className={[
          "relative w-[392px]",
          "bg-card/95 dark:bg-surface-2/95 backdrop-blur-xl",
          "border border-border/40 dark:border-border-subtle/40",
          "rounded-xl shadow-lg p-2.5",
          "transition-all duration-300 ease-out",
          isVisible
            ? "translate-y-0 opacity-100 scale-100"
            : "translate-y-8 opacity-0 scale-95",
        ].join(" ")}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        style={{ pointerEvents: "auto" }}
      >
        <button
          onClick={() => onRespond("dismiss")}
          className={[
            "absolute -left-2.5 -top-2.5 z-10 size-6 rounded-full",
            "flex items-center justify-center",
            "bg-card dark:bg-surface-2 border border-border/40 dark:border-border-subtle/40 shadow-sm",
            "text-muted-foreground/70 hover:text-foreground hover:bg-muted",
            "transition-all duration-150",
            isHovered ? "opacity-100 scale-100" : "opacity-0 scale-75 pointer-events-none",
          ].join(" ")}
          aria-label={t("common.dismiss")}
        >
          <X className="size-3" />
        </button>

        <div className="flex items-center gap-2.5">
          <div className="shrink-0 bg-primary/10 rounded-md p-1">
            <svg viewBox="0 0 1024 1024" className="w-4.5 h-4.5">
              <rect width="1024" height="1024" rx="241" fill="#2056DF" />
              <circle cx="512" cy="512" r="314" fill="#2056DF" stroke="white" strokeWidth="74" />
              <path d="M512 383V641" stroke="white" strokeWidth="74" strokeLinecap="round" />
              <path d="M627 457V568" stroke="white" strokeWidth="74" strokeLinecap="round" />
              <path d="M397 457V568" stroke="white" strokeWidth="74" strokeLinecap="round" />
            </svg>
          </div>

          <div className="flex-1 min-w-0">
            <p className="text-[12px] font-semibold text-foreground leading-tight truncate">
              {t("updateNotification.title")}
            </p>
            <p className="text-[11px] text-muted-foreground leading-tight mt-0.5">
              {t("updateNotification.body", { version: data?.version ?? "" })}
            </p>
          </div>

          <button
            onClick={() => onRespond("update")}
            className="shrink-0 bg-primary text-primary-foreground hover:bg-primary/90 active:bg-primary/80 text-[11px] font-medium px-2.5 py-1 rounded-md transition-colors"
          >
            {t("updateNotification.cta")}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function App() {
  const [isHovered, setIsHovered] = useState(false);
  const [isTransforming, setIsTransforming] = useState(false);
  const [isCommandMenuOpen, setIsCommandMenuOpen] = useState(false);
  const commandMenuRef = useRef(null);
  const buttonRef = useRef(null);
  const { toast, dismiss, toastCount } = useToast();
  const { t } = useTranslation();
  const { hotkey } = useHotkey();
  const { isDragging, handleMouseDown, handleMouseUp } = useWindowDrag();

  const [dragStartPos, setDragStartPos] = useState(null);
  const [hasDragged, setHasDragged] = useState(false);

  // Floating icon auto-hide setting (read from store, synced via IPC)
  const floatingIconAutoHide = useSettingsStore((s) => s.floatingIconAutoHide);
  const panelStartPosition = useSettingsStore((s) => s.panelStartPosition);
  const dictationBarPosition = useSettingsStore((s) => s.dictationBarPosition);

  const setWindowInteractivity = React.useCallback((shouldCapture) => {
    window.electronAPI?.setMainWindowInteractivity?.(shouldCapture);
  }, []);

  useEffect(() => {
    setWindowInteractivity(false);
    return () => setWindowInteractivity(false);
  }, [setWindowInteractivity]);

  useEffect(() => {
    const unsubscribeFallback = window.electronAPI?.onHotkeyFallbackUsed?.((data) => {
      toast({
        title: t("app.toasts.hotkeyChanged.title"),
        description: t("app.toasts.hotkeyChanged.description", {
          original: data.original,
          fallback: data.fallback,
        }),
        duration: 8000,
      });
    });

    const unsubscribeFailed = window.electronAPI?.onHotkeyRegistrationFailed?.((_data) => {
      toast({
        title: t("app.toasts.hotkeyUnavailable.title"),
        description: t("app.toasts.hotkeyUnavailable.description"),
        duration: 10000,
      });
    });

    const unsubscribeCorrections = window.electronAPI?.onCorrectionsLearned?.((words) => {
      if (words && words.length > 0) {
        const wordList = words.map((w) => `“${w}”`).join(", ");
        let toastId;
        toastId = toast({
          title: t("app.toasts.addedToDict", { words: wordList }),
          variant: "success",
          duration: 6000,
          action: (
            <button
              onClick={async () => {
                try {
                  const result = await window.electronAPI?.undoLearnedCorrections?.(words);
                  if (result?.success) {
                    dismiss(toastId);
                  }
                } catch {
                  // silently fail — word stays in dictionary
                }
              }}
              className="text-[10px] font-medium px-2.5 py-1 rounded-sm whitespace-nowrap
                text-emerald-100/90 hover:text-white
                bg-emerald-500/15 hover:bg-emerald-500/25
                border border-emerald-400/20 hover:border-emerald-400/35
                transition-all duration-150"
            >
              {t("app.toasts.undo")}
            </button>
          ),
        });
      }
    });

    return () => {
      unsubscribeFallback?.();
      unsubscribeFailed?.();
      unsubscribeCorrections?.();
    };
  }, [toast, dismiss, t]);

  useEffect(() => {
    if (isCommandMenuOpen || toastCount > 0) {
      setWindowInteractivity(true);
    } else if (!isHovered) {
      setWindowInteractivity(false);
    }
  }, [isCommandMenuOpen, isHovered, toastCount, setWindowInteractivity]);

  const handleDictationToggle = React.useCallback(() => {
    setIsCommandMenuOpen(false);
    setWindowInteractivity(false);
  }, [setWindowInteractivity]);

  const {
    isRecording,
    isProcessing,
    transcript,
    partialTranscript,
    micError,
    clearMicError,
    toggleListening,
    cancelRecording,
    cancelProcessing,
  } = useAudioRecording(toast, {
    onToggle: handleDictationToggle,
    dismissToast: dismiss,
  });

  // Sync auto-hide from main process — setState directly to avoid IPC echo
  useEffect(() => {
    const unsubscribe = window.electronAPI?.onFloatingIconAutoHideChanged?.((enabled) => {
      localStorage.setItem("floatingIconAutoHide", String(enabled));
      useSettingsStore.setState({ floatingIconAutoHide: enabled });
    });
    return () => unsubscribe?.();
  }, []);

  // Overlay notification state (update, preview, agent)
  const [overlayNotification, setOverlayNotification] = useState(null);

  // Listen for overlay notifications from main process
  useEffect(() => {
    const unsubscribe = window.electronAPI?.onMainWindowOverlayNotification?.((payload) => {
      if (payload?.type === "clear") {
        setOverlayNotification(null);
      } else {
        setOverlayNotification({ type: payload.type, data: payload.data });
      }
    });
    return () => unsubscribe?.();
  }, []);

  // Respond to overlay notification (dismiss or update)
  const handleOverlayNotificationRespond = React.useCallback((action) => {
    window.electronAPI?.mainOverlayNotificationRespond?.(action);
    setOverlayNotification(null);
  }, []);
  // Play the activation cue the instant the hotkey fires — before the
  // copy/clipboard-poll pipeline in transformManager.js runs (which can take ~1s)
  useEffect(() => {
    const unsubscribe = window.electronAPI?.onTransformActivated?.(() => {
      setIsTransforming(true);
      playTransformStartCue();
    });
    return () => unsubscribe?.();
  }, []);

  // Handle transform execution requests from main process
  useEffect(() => {
    const unsubscribe = window.electronAPI?.onRunTransform?.(async ({ id, text, systemPrompt, activeApp, richText }) => {
      console.log(`[Transform] Received run-transform id=${id} textLength=${text?.length} activeApp=${activeApp ?? "none"}`);
      setIsTransforming(true);
      let succeeded = false;
      let cfg = null;
      let effectivePrompt = "";
      try {
        const ReasoningService = (await import("./services/ReasoningService")).default;
        const state = useSettingsStore.getState();
        cfg = selectResolvedLLMConfig(state, "chatIntelligence");
        const globalPrompt = state.customPrompts?.chatAgent || "";
        const appContext = activeApp ? `Active application: ${activeApp}` : "";
        effectivePrompt = [globalPrompt, appContext, systemPrompt].filter(Boolean).join("\n\n");
        const result = await ReasoningService.processText(text, cfg.model, null, {
          systemPrompt: effectivePrompt,
          provider: cfg.provider || undefined,
        });
        succeeded = !!result;
        await window.electronAPI?.sendTransformResult?.(
          id,
          result || "",
          result ? null : `LLM returned empty (provider=${cfg.provider} model=${cfg.model})`,
          { provider: cfg.provider, model: cfg.model, systemPrompt: effectivePrompt, inputText: text, richText }
        );
      } catch (err) {
        if (!cfg) cfg = selectResolvedLLMConfig(useSettingsStore.getState(), "chatIntelligence");
        await window.electronAPI?.sendTransformResult?.(
          id,
          "",
          `${err.message} (provider=${cfg.provider} model=${cfg.model})`,
          { provider: cfg.provider, model: cfg.model, systemPrompt: effectivePrompt, inputText: text, richText }
        );
      } finally {
        setIsTransforming(false);
        if (succeeded) playTransformDoneCue();
      }
    });
    return () => unsubscribe?.();
  }, []);

  const isRecordingRef = useRef(isRecording);

  useLayoutEffect(() => {
    isRecordingRef.current = isRecording;
  }, [isRecording]);

  useEffect(() => {
    const unsubscribe = window.electronAPI?.onCancelHotkeyPressed?.(() => {
      if (isRecordingRef.current) cancelRecording();
    });
    return () => unsubscribe?.();
  }, [cancelRecording]);

  const handleClose = () => {
    window.electronAPI.hideWindow();
  };

  useEffect(() => {
    if (!isCommandMenuOpen) {
      return;
    }

    const handleClickOutside = (event) => {
      if (
        commandMenuRef.current &&
        !commandMenuRef.current.contains(event.target) &&
        buttonRef.current &&
        !buttonRef.current.contains(event.target)
      ) {
        setIsCommandMenuOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isCommandMenuOpen]);

  useEffect(() => {
    const handleKeyPress = (e) => {
      if (e.key === "Escape") {
        if (isCommandMenuOpen) {
          setIsCommandMenuOpen(false);
        } else {
          handleClose();
        }
      }
    };

    document.addEventListener("keydown", handleKeyPress);
    return () => document.removeEventListener("keydown", handleKeyPress);
  }, [isCommandMenuOpen]);

  // Determine current mic state
  const getMicState = () => {
    if (isRecording) return "recording";
    if (isProcessing) return "processing";
    if (isTransforming) return "transforming";
    if (isHovered) return "hover";
    return "idle";
  };

  const micState = getMicState();
  const hasLiveText = Boolean((transcript || partialTranscript).trim());
  const barView = deriveBarView(micState, { hasLiveText, micError });
  const barErrorText =
    typeof micError === "string" && micError.trim()
      ? micError
      : micError?.title && micError.title !== "Paste Error"
        ? micError.title
        : t("app.dictationBar.error");
  const barActive = barView !== null;
  const prevBarActiveRef = useRef(false);
  // Bar active wins the resize — hide the window when nothing to show.
  // When the bar transitions from active to inactive, add a brief delay so
  // the user sees the final state (e.g. error icon) before hiding.
  useLayoutEffect(() => {
    if (barActive) {
      window.electronAPI?.resizeDictationBar?.(dictationBarPosition);
      prevBarActiveRef.current = true;
      return;
    }
    // Bar just became inactive — hide immediately so there's no empty
    // frame visible. The Delay was meant for error states, but errors
    // are shown by DictationBar while barActive is still true.
    if (prevBarActiveRef.current) {
      prevBarActiveRef.current = false;
      window.electronAPI?.hideWindow?.();
      return;
    }
    // Already idle: hide if no menu or toast
    if (!isCommandMenuOpen && toastCount === 0) {
      window.electronAPI?.hideWindow?.();
    }
  }, [barActive, dictationBarPosition, isCommandMenuOpen, toastCount]);

  // Force EVERY background to transparent on the dictation window
  // so only the dictation-bar pill (with its own background) is visible.
  // :has() CSS selectors can flash the solid body background before they match.
  useEffect(() => {
    const html = document.documentElement;
    const body = document.body;
    const root = document.getElementById("root");
    html.style.setProperty("background", "transparent", "important");
    html.style.setProperty("min-height", "0", "important");
    html.style.setProperty("border", "none", "important");
    html.style.setProperty("outline", "none", "important");
    body.style.setProperty("background", "transparent", "important");
    body.style.setProperty("min-height", "0", "important");
    body.style.setProperty("overflow", "hidden", "important");
    body.style.setProperty("border", "none", "important");
    body.style.setProperty("outline", "none", "important");
    if (root) {
      root.style.setProperty("background", "transparent", "important");
      root.style.setProperty("min-height", "0", "important");
    }
    return () => {
      html.style.removeProperty("background");
      html.style.removeProperty("min-height");
      html.style.removeProperty("border");
      html.style.removeProperty("outline");
      body.style.removeProperty("background");
      body.style.removeProperty("min-height");
      body.style.removeProperty("overflow");
      body.style.removeProperty("border");
      body.style.removeProperty("outline");
      if (root) {
        root.style.removeProperty("background");
        root.style.removeProperty("min-height");
      }
    };
  }, []);

  const getMicButtonProps = () => {
    const baseClasses =
      "rounded-full w-10 h-10 flex items-center justify-center relative overflow-hidden border-2 border-white/70 cursor-pointer";

    switch (micState) {
      case "idle":
      case "hover":
        return {
          className: `${baseClasses} bg-black/50 cursor-pointer`,
          tooltip: formatHotkeyListLabel(hotkey),
        };
      case "recording":
        return {
          className: `${baseClasses} bg-primary cursor-pointer`,
          tooltip: t("app.mic.recording"),
        };
      case "processing":
        return {
          className: `${baseClasses} bg-accent cursor-not-allowed`,
          tooltip: t("app.mic.processing"),
        };
      case "transforming":
        return {
          className: `${baseClasses} bg-violet-600 cursor-not-allowed`,
          tooltip: t("app.mic.transforming"),
        };
      default:
        return {
          className: `${baseClasses} bg-black/50 cursor-pointer`,
          style: { transform: "scale(0.8)" },
          tooltip: t("app.mic.clickToSpeak"),
        };
    }
  };

  const micProps = getMicButtonProps();

  return (
    <div className="dictation-window">
      <VersionBadge variant="overlay" visible={isCommandMenuOpen || toastCount > 0} />
      {barActive && (
        <DictationBar
          state={barView}
          transcript={transcript}
          partialTranscript={partialTranscript}
          error={barErrorText}
          onAutoHide={clearMicError}
        />
      )}
      {overlayNotification?.type === "update" && (
        <UpdateOverlay
          data={overlayNotification.data}
          onRespond={handleOverlayNotificationRespond}
          t={t}
        />
      )}
    </div>
  );
}
