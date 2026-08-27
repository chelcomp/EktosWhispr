import { useState, useCallback, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { signOut } from "../lib/auth";
import { ConfirmDialog, AlertDialog } from "./ui/dialog";
import { useSettings } from "../hooks/useSettings";
import { useDialogs } from "../hooks/useDialogs";
import { useWhisper } from "../hooks/useWhisper";
import { usePermissions } from "../hooks/usePermissions";
import { useSystemAudioPermission } from "../hooks/useSystemAudioPermission";
import { useClipboard } from "../hooks/useClipboard";
import { useHotkeyRegistration } from "../hooks/useHotkeyRegistration";
import { useHotkeyModeInfo } from "../hooks/useHotkeyModeInfo";
import { validateHotkeyForSlot } from "../utils/hotkeyValidation";
import { getCachedPlatform } from "../utils/platform";
import { useToast } from "./ui/useToast";
import { useTheme } from "../hooks/useTheme";
import logger from "../utils/logger";
import { useSettingsLayout } from "./ui/useSettingsLayout";
import { formatBytes } from "../utils/formatBytes";
import { useSettingsStore } from "../stores/settingsStore";
import InputSection from "./settings/sections/InputSection";
import TranscriptionSectionContainer from "./settings/sections/TranscriptionSection";
import AIProcessingSection from "./settings/sections/AIProcessingSection";
import StorageSection from "./settings/sections/StorageSection";
import ModelsSection from "./settings/sections/ModelsSection";
import SystemSection from "./settings/sections/SystemSection";

export type SettingsSectionType =
  "input" | "transcription" | "aiProcessing" | "storage" | "models" | "system";

interface SettingsPageProps {
  activeSection?: SettingsSectionType;
  onNavigateToSection?: (section: SettingsSectionType) => void;
  /** When a legacy section ID was used (e.g. `meetings`), land on the matching sub-tab. */
  initialSubTab?: string;
}

const UI_LANGUAGE_OPTIONS: import("./ui/LanguageSelector").LanguageOption[] = [
  { value: "en", label: "English", flag: "🇺🇸" },
  { value: "pt", label: "Português", flag: "🇵🇹" },
];

export default function SettingsPage({
  activeSection = "input",
  onNavigateToSection,
  initialSubTab,
}: SettingsPageProps) {
  useSettingsLayout();
  const {
    confirmDialog,
    alertDialog,
    showConfirmDialog,
    showAlertDialog,
    hideConfirmDialog,
    hideAlertDialog,
  } = useDialogs();

  const {
    useLocalWhisper,
    whisperModel,
    localTranscriptionProvider,
    parakeetModel,
    uiLanguage,
    preferredLanguage,
    cloudTranscriptionProvider,
    cloudTranscriptionModel,
    cloudTranscriptionBaseUrl,
    useCleanupModel,
    dictationKey,
    activationMode,
    setActivationMode,
    preferBuiltInMic,
    selectedMicDeviceId,
    micNoiseSuppression,
    micGain,
    autoUnmuteMicEnabled,
    setPreferBuiltInMic,
    setSelectedMicDeviceId,
    setMicNoiseSuppression,
    setMicGain,
    setAutoUnmuteMicEnabled,
    setUseLocalWhisper,
    setUiLanguage,
    setWhisperModel,
    setLocalTranscriptionProvider,
    setParakeetModel,
    setCloudTranscriptionProvider,
    setCloudTranscriptionModel,
    setCloudTranscriptionBaseUrl,
    setUseCleanupModel,
    setDictationKey,
    meetingKey,
    setMeetingKey,
    meetingHotkeyLayoutMode,
    setMeetingHotkeyLayoutMode,
    autoLearnCorrections,
    setAutoLearnCorrections,
    updateTranscriptionSettings,
    updateCleanupSettings,
    cloudTranscriptionMode,
    setCloudTranscriptionMode,
    transcriptionMode,
    setTranscriptionMode,
    remoteTranscriptionUrl,
    setRemoteTranscriptionUrl,
    remoteTranscriptionModel,
    setRemoteTranscriptionModel,
    notificationsEnabled,
    setNotificationsEnabled,
    audioCuesEnabled,
    setAudioCuesEnabled,
    pauseMediaOnDictation,
    setPauseMediaOnDictation,
    showTranscriptionPreview,
    setShowTranscriptionPreview,
    autoPasteEnabled,
    setAutoPasteEnabled,
    keepTranscriptionInClipboard,
    setKeepTranscriptionInClipboard,
    floatingIconAutoHide,
    setFloatingIconAutoHide,
    startMinimized,
    setStartMinimized,
    panelStartPosition,
    setPanelStartPosition,
    audioRetentionDays,
    setAudioRetentionDays,
    includeActiveWindowContext,
    setIncludeActiveWindowContext,
    screenContextOcrEngine,
    setScreenContextOcrEngine,
    persistActiveWindowScreenshots,
    setPersistActiveWindowScreenshots,
    screenContextRetentionDays,
    setScreenContextRetentionDays,
    dynamicPromptVocabularyEnabled,
    setDynamicPromptVocabularyEnabled,
    dynamicPromptVocabularyIncludeScreenContext,
    setDynamicPromptVocabularyIncludeScreenContext,
    transcriptionIdleTimeoutMs,
    setTranscriptionIdleTimeoutMs,
    llmIdleTimeoutMs,
    setLlmIdleTimeoutMs,
    dataRetentionEnabled,
    setDataRetentionEnabled,
    saveDiscardedTranscriptions,
    setSaveDiscardedTranscriptions,
    noteFilesEnabled,
    setNoteFilesEnabled,
    noteFilesPath,
    setNoteFilesPath,
    dictationSileroEnabled,
    setDictationSileroEnabled,
    noteRecordingSileroEnabled,
    setNoteRecordingSileroEnabled,
    meetingSileroEnabled,
    setMeetingSileroEnabled,
    meetingAecEnabled,
    setMeetingAecEnabled,
    whisperVadThreshold,
    setWhisperVadThreshold,
    whisperVadMinSpeechDurationMs,
    setWhisperVadMinSpeechDurationMs,
    whisperVadMinSilenceDurationMs,
    setWhisperVadMinSilenceDurationMs,
    whisperVadMaxSpeechDurationS,
    setWhisperVadMaxSpeechDurationS,
    whisperVadSpeechPadMs,
    setWhisperVadSpeechPadMs,
    whisperVadSamplesOverlap,
    setWhisperVadSamplesOverlap,
    previewVadMinSpeechDurationMs,
    setPreviewVadMinSpeechDurationMs,
    previewVadMinSilenceDurationMs,
    setPreviewVadMinSilenceDurationMs,
    previewVadSpeechPadMs,
    setPreviewVadSpeechPadMs,
    previewVadMaxSpeechDurationS,
    setPreviewVadMaxSpeechDurationS,
    previewVadSamplesOverlap,
    setPreviewVadSamplesOverlap,
    previewVadEnergyThreshold,
    setPreviewVadEnergyThreshold,
    previewVadMinSegmentRms,
    setPreviewVadMinSegmentRms,
    previewVadNoiseFloorFactor,
    setPreviewVadNoiseFloorFactor,
    previewVadNoiseFloorAlpha,
    setPreviewVadNoiseFloorAlpha,
    previewVadMaxMerges,
    setPreviewVadMaxMerges,
    previewVadMaxMergedMs,
    setPreviewVadMaxMergedMs,
  } = useSettings();

  const voiceAgentKey = useSettingsStore((s) => s.voiceAgentKey);
  const setVoiceAgentKey = useSettingsStore((s) => s.setVoiceAgentKey);
  const resetWhisperVad = useSettingsStore((s) => s.resetWhisperVad);
  const resetPreviewVadDefaults = useSettingsStore((s) => s.resetPreviewVadDefaults);

  const { t } = useTranslation();
  const { toast } = useToast();

  const [isRemovingModels, setIsRemovingModels] = useState(false);
  const cachePathHint =
    typeof navigator !== "undefined" && /Windows/i.test(navigator.userAgent)
      ? "%USERPROFILE%\\.cache\\ektoswhispr"
      : "~/.cache/ektoswhispr";

  const { checkWhisperInstallation } = useWhisper();
  const permissionsHook = usePermissions(showAlertDialog);
  const systemAudio = useSystemAudioPermission();
  useClipboard(showAlertDialog);
  const [audioStorageUsage, setAudioStorageUsage] = useState<{
    fileCount: number;
    totalBytes: number;
  }>({ fileCount: 0, totalBytes: 0 });

  useEffect(() => {
    if (activeSection !== "storage") return;
    const refreshAudioStorageUsage = () => {
      window.electronAPI
        ?.getAudioStorageUsage?.()
        .then((usage: { fileCount: number; totalBytes: number }) => {
          if (usage) setAudioStorageUsage(usage);
        })
        .catch(() => {});
    };
    refreshAudioStorageUsage();
    // Re-fetch whenever a recording finishes saving its audio, so the count
    // doesn't stay stale if this section is already open while dictating.
    const dispose = window.electronAPI?.onTranscriptionUpdated?.(refreshAudioStorageUsage);
    return () => dispose?.();
  }, [activeSection]);

  const [meetingAudioStorageUsage, setMeetingAudioStorageUsage] = useState<{
    fileCount: number;
    totalBytes: number;
  }>({ fileCount: 0, totalBytes: 0 });

  useEffect(() => {
    if (activeSection !== "storage") return;
    const refreshMeetingAudioStorageUsage = () => {
      window.electronAPI
        ?.getMeetingAudioStorageUsage?.()
        .then((usage: { fileCount: number; totalBytes: number }) => {
          if (usage) setMeetingAudioStorageUsage(usage);
        })
        .catch(() => {});
    };
    refreshMeetingAudioStorageUsage();
    // Re-fetch whenever a note is updated (this fires when a meeting note's
    // audio finishes saving, among other note changes), so the count doesn't
    // stay stale if this section is already open while a meeting is recording.
    const dispose = window.electronAPI?.onNoteUpdated?.(refreshMeetingAudioStorageUsage);
    return () => dispose?.();
  }, [activeSection]);

  // Lazy keep-alive: mount sections only after the user has visited them once,
  // then keep them mounted so model-download progress and IPC listeners survive
  // section switches.
  const [mountedSections, setMountedSections] = useState<Set<string>>(
    new Set([activeSection].filter(Boolean) as string[])
  );
  if (activeSection && !mountedSections.has(activeSection)) {
    setMountedSections((prev) => new Set([...prev, activeSection]));
  }

  const [screenContextStorageUsage, setScreenContextStorageUsage] = useState<{
    fileCount: number;
    totalBytes: number;
  }>({ fileCount: 0, totalBytes: 0 });

  useEffect(() => {
    if (activeSection !== "storage") return;
    const refreshScreenContextStorageUsage = () => {
      window.electronAPI
        ?.getScreenContextStorageUsage?.()
        .then((usage: { fileCount: number; totalBytes: number }) => {
          if (usage) setScreenContextStorageUsage(usage);
        })
        .catch(() => {});
    };
    refreshScreenContextStorageUsage();
  }, [activeSection]);

  const handleClearAllScreenContextScreenshots = async () => {
    if (!window.electronAPI?.deleteAllScreenContextScreenshots) return;
    try {
      await window.electronAPI.deleteAllScreenContextScreenshots();
      setScreenContextStorageUsage({ fileCount: 0, totalBytes: 0 });
      toast({ title: t("settingsPage.privacy.clearAllScreenContext"), variant: "default" });
    } catch {
      // silent fail
    }
  };

  const handleClearAllAudio = async () => {
    if (!window.electronAPI?.deleteAllAudio) return;
    try {
      await window.electronAPI.deleteAllAudio();
      setAudioStorageUsage({ fileCount: 0, totalBytes: 0 });
      toast({ title: t("settingsPage.privacy.clearAllAudio"), variant: "default" });
    } catch {
      // silent fail
    }
  };

  const handleClearAllMeetingAudio = async () => {
    if (!window.electronAPI?.deleteAllMeetingAudio) return;
    try {
      await window.electronAPI.deleteAllMeetingAudio();
      setMeetingAudioStorageUsage({ fileCount: 0, totalBytes: 0 });
      toast({ title: t("settingsPage.privacy.clearAllMeetingAudio"), variant: "default" });
    } catch {
      // silent fail
    }
  };

  // ydotool status for Wayland paste diagnostics
  const [ydotoolStatus, setYdotoolStatus] = useState<{
    isLinux: boolean;
    isWayland: boolean;
    hasYdotool: boolean;
    hasYdotoold: boolean;
    daemonRunning: boolean;
    hasService: boolean;
    hasUinput: boolean;
    hasUdevRule: boolean;
    hasGroup: boolean;
    allGood: boolean;
    isKde?: boolean;
    hasXclip?: boolean;
    hasXsel?: boolean;
    isNixOS?: boolean;
  } | null>(null);
  const [ydotoolGuideKey, setYdotoolGuideKey] = useState<string | null>(null);

  const refreshYdotoolStatus = useCallback(async () => {
    // getYdotoolStatus removed (Windows-only build); status no longer fetched
  }, []);

  useEffect(() => {
    refreshYdotoolStatus();
  }, [refreshYdotoolStatus]);

  const { theme, setTheme } = useTheme();

  const { registerHotkey, isRegistering: isHotkeyRegistering } = useHotkeyRegistration({
    onSuccess: (registeredHotkey) => {
      setDictationKey(registeredHotkey);
    },
    showSuccessToast: false,
    showErrorToast: true,
    showAlert: showAlertDialog,
  });

  const meetingRegisterFn = useCallback(async (hotkey: string) => {
    const result = await window.electronAPI?.registerMeetingHotkey?.(hotkey);
    return result ?? { success: false, message: "Electron API unavailable" };
  }, []);

  const { registerHotkey: registerMeetingHotkey, isRegistering: isMeetingHotkeyRegistering } =
    useHotkeyRegistration({
      onSuccess: (registeredHotkey) => {
        setMeetingKey(registeredHotkey);
      },
      showSuccessToast: false,
      showErrorToast: true,
      showAlert: showAlertDialog,
      registerFn: meetingRegisterFn,
    });

  // Agent hotkey setters resolve to false when main-process registration fails;
  // surface it and return the result so HotkeyListInput rolls the row back.
  const [isAgentHotkeyCommitting, setIsAgentHotkeyCommitting] = useState(false);
  const commitAgentHotkey = useCallback(
    async (setter: (key: string) => Promise<boolean>, key: string) => {
      setIsAgentHotkeyCommitting(true);
      try {
        const ok = await setter(key);
        if (!ok) {
          showAlertDialog({
            title: t("hooks.hotkeyRegistration.titles.notRegistered"),
            description: t("hooks.hotkeyRegistration.errors.failedToRegister"),
          });
        }
        return ok;
      } finally {
        setIsAgentHotkeyCommitting(false);
      }
    },
    [showAlertDialog, t]
  );

  const validateDictationHotkey = useCallback(
    (hotkey: string) =>
      validateHotkeyForSlot(
        hotkey,
        {
          "settingsPage.general.meetingHotkey.title": meetingKey,
          "settingsPage.general.voiceAgentHotkey.title": voiceAgentKey,
        },
        t
      ),
    [meetingKey, voiceAgentKey, t]
  );

  const validateMeetingHotkey = useCallback(
    (hotkey: string) =>
      validateHotkeyForSlot(
        hotkey,
        {
          "settingsPage.general.hotkey.title": dictationKey,
          "settingsPage.general.voiceAgentHotkey.title": voiceAgentKey,
        },
        t
      ),
    [dictationKey, voiceAgentKey, t]
  );

  const validateVoiceAgentHotkey = useCallback(
    (hotkey: string) =>
      validateHotkeyForSlot(
        hotkey,
        {
          "settingsPage.general.hotkey.title": dictationKey,
          "settingsPage.general.meetingHotkey.title": meetingKey,
        },
        t
      ),
    [dictationKey, meetingKey, t]
  );

  const { isUsingNativeShortcut, isUsingHyprland, hyprlandConfigStatus, supportsPushToTalk } =
    useHotkeyModeInfo("settings");
  const [effectiveDefaultHotkey, setEffectiveDefaultHotkey] = useState<string | null>(null);


  const platform = getCachedPlatform();

  const [autoStartEnabled, setAutoStartEnabled] = useState(false);
  const [autoStartLoading, setAutoStartLoading] = useState(true);

  useEffect(() => {
    const loadAutoStart = async () => {
      if (window.electronAPI?.getAutoStartEnabled) {
        try {
          const enabled = await window.electronAPI.getAutoStartEnabled();
          setAutoStartEnabled(enabled);
        } catch (error) {
          logger.error("Failed to get auto-start status", error, "settings");
        }
      }
      setAutoStartLoading(false);
    };
    loadAutoStart();
  }, [platform]);

  useEffect(() => {
    window.electronAPI?.syncNotificationPreferences?.({
      notificationsEnabled,
    });
  }, [notificationsEnabled]);

  const handleAutoStartChange = async (enabled: boolean) => {
    if (window.electronAPI?.setAutoStartEnabled) {
      try {
        setAutoStartLoading(true);
        const result = await window.electronAPI.setAutoStartEnabled(enabled);
        if (result.success) {
          setAutoStartEnabled(enabled);
        }
      } catch (error) {
        logger.error("Failed to set auto-start", error, "settings");
      } finally {
        setAutoStartLoading(false);
      }
    }
  };

  const [noteFilesDefaultPath, setNoteFilesDefaultPath] = useState("");
  const [noteFilesRebuilding, setNoteFilesRebuilding] = useState(false);

  useEffect(() => {
    if (!noteFilesEnabled) return;
    window.electronAPI?.noteFilesGetDefaultPath?.().then((p) => {
      if (p) setNoteFilesDefaultPath(p);
    });
  }, [noteFilesEnabled]);

  const handleNoteFilesToggle = useCallback(
    async (enabled: boolean) => {
      setNoteFilesEnabled(enabled);
      await window.electronAPI?.noteFilesSetEnabled?.(enabled, noteFilesPath || undefined);
    },
    [setNoteFilesEnabled, noteFilesPath]
  );

  const handleNoteFilesChangePath = useCallback(async () => {
    const result = await window.electronAPI?.noteFilesPickFolder?.();
    if (result?.canceled || !result?.path) return;
    setNoteFilesPath(result.path);
    await window.electronAPI?.noteFilesSetPath?.(result.path);
  }, [setNoteFilesPath]);

  const handleNoteFilesRebuild = useCallback(async () => {
    setNoteFilesRebuilding(true);
    try {
      const result = await window.electronAPI?.noteFilesRebuild?.();
      if (result && !result.success) {
        toast({
          title: t("settings.noteFiles.rebuildError.title"),
          description: result.error || t("settings.noteFiles.rebuildError.description"),
          variant: "destructive",
        });
      }
    } finally {
      setNoteFilesRebuilding(false);
    }
  }, [toast, t]);

  useEffect(() => {
    let mounted = true;

    const timer = setTimeout(() => {
      if (mounted) checkWhisperInstallation();
    }, 100);

    return () => {
      mounted = false;
      clearTimeout(timer);
    };
  }, [checkWhisperInstallation]);

  useEffect(() => {
    if (isUsingNativeShortcut && !supportsPushToTalk) {
      setActivationMode("tap");
    }
  }, [isUsingNativeShortcut, supportsPushToTalk, setActivationMode]);

  useEffect(() => {
    const loadEffectiveDefaultHotkey = async () => {
      try {
        const key = await window.electronAPI?.getEffectiveDefaultHotkey?.();
        if (key) setEffectiveDefaultHotkey(key);
      } catch (error) {
        logger.error("Failed to get effective default hotkey", error, "settings");
      }
    };
    loadEffectiveDefaultHotkey();
  }, []);


  const resetAccessibilityPermissions = () => {
    const message = t("settingsPage.permissions.resetAccessibility.description");

    showConfirmDialog({
      title: t("settingsPage.permissions.resetAccessibility.title"),
      description: message,
      onConfirm: () => {
        permissionsHook.requestAccessibilityPermission();
      },
    });
  };

  const handleRemoveModels = useCallback(() => {
    if (isRemovingModels) return;

    showConfirmDialog({
      title: t("settingsPage.developer.removeModels.title"),
      description: t("settingsPage.developer.removeModels.description", { path: cachePathHint }),
      confirmText: t("settingsPage.developer.removeModels.confirmText"),
      variant: "destructive",
      onConfirm: async () => {
        setIsRemovingModels(true);
        try {
          const results = await Promise.allSettled([
            window.electronAPI?.deleteAllWhisperModels?.(),
            window.electronAPI?.deleteAllParakeetModels?.(),
            window.electronAPI?.modelDeleteAll?.(),
          ]);

          const anyFailed = results.some(
            (r) =>
              r.status === "rejected" || (r.status === "fulfilled" && r.value && !r.value.success)
          );

          if (anyFailed) {
            showAlertDialog({
              title: t("settingsPage.developer.removeModels.failedTitle"),
              description: t("settingsPage.developer.removeModels.failedDescription"),
            });
          } else {
            window.dispatchEvent(new Event("ektoswhispr-models-cleared"));
            showAlertDialog({
              title: t("settingsPage.developer.removeModels.successTitle"),
              description: t("settingsPage.developer.removeModels.successDescription"),
            });
          }
        } catch {
          showAlertDialog({
            title: t("settingsPage.developer.removeModels.failedTitle"),
            description: t("settingsPage.developer.removeModels.failedDescriptionShort"),
          });
        } finally {
          setIsRemovingModels(false);
        }
      },
    });
  }, [isRemovingModels, cachePathHint, showConfirmDialog, showAlertDialog, t]);

  const [isBackingUp, setIsBackingUp] = useState(false);
  const [isRestoringBackup, setIsRestoringBackup] = useState(false);

  const handleFullBackup = useCallback(async () => {
    if (isBackingUp) return;
    setIsBackingUp(true);
    try {
      const snapshot: Record<string, string> = {};
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key) snapshot[key] = localStorage.getItem(key) ?? "";
      }
      const result = await window.electronAPI?.fullBackup?.(snapshot);
      if (!result || result.canceled) return;
      if (!result.success) {
        showAlertDialog({
          title: t("settingsPage.developer.fullBackup.failedTitle"),
          description: result.error || t("settingsPage.developer.fullBackup.failedDescription"),
        });
        return;
      }
      showAlertDialog({
        title: t("settingsPage.developer.fullBackup.successTitle"),
        description: t("settingsPage.developer.fullBackup.successDescription"),
      });
    } catch {
      showAlertDialog({
        title: t("settingsPage.developer.fullBackup.failedTitle"),
        description: t("settingsPage.developer.fullBackup.failedDescription"),
      });
    } finally {
      setIsBackingUp(false);
    }
  }, [isBackingUp, showAlertDialog, t]);

  const handleFullRestore = useCallback(() => {
    if (isRestoringBackup) return;

    showConfirmDialog({
      title: t("settingsPage.developer.fullRestore.title"),
      description: t("settingsPage.developer.fullRestore.description"),
      confirmText: t("settingsPage.developer.fullRestore.confirmText"),
      variant: "destructive",
      onConfirm: async () => {
        setIsRestoringBackup(true);
        try {
          const result = await window.electronAPI?.fullRestore?.();
          if (!result || result.canceled) return;
          if (!result.success) {
            showAlertDialog({
              title: t("settingsPage.developer.fullRestore.failedTitle"),
              description:
                result.error || t("settingsPage.developer.fullRestore.failedDescription"),
            });
            return;
          }
          showAlertDialog({
            title: t("settingsPage.developer.fullRestore.successTitle"),
            description: t("settingsPage.developer.fullRestore.successDescription"),
          });
        } catch {
          showAlertDialog({
            title: t("settingsPage.developer.fullRestore.failedTitle"),
            description: t("settingsPage.developer.fullRestore.failedDescription"),
          });
        } finally {
          setIsRestoringBackup(false);
        }
      },
    });
  }, [isRestoringBackup, showConfirmDialog, showAlertDialog, t]);

  const renderSectionContent = () => {
    switch (activeSection) {
      case "input":
        return (
          <InputSection
            t={t}
            theme={theme}
            setTheme={setTheme}
            audioCuesEnabled={audioCuesEnabled}
            setAudioCuesEnabled={setAudioCuesEnabled}
            pauseMediaOnDictation={pauseMediaOnDictation}
            setPauseMediaOnDictation={setPauseMediaOnDictation}
            notificationsEnabled={notificationsEnabled}
            setNotificationsEnabled={setNotificationsEnabled}
            autoPasteEnabled={autoPasteEnabled}
            setAutoPasteEnabled={setAutoPasteEnabled}
            keepTranscriptionInClipboard={keepTranscriptionInClipboard}
            setKeepTranscriptionInClipboard={setKeepTranscriptionInClipboard}
            noteFilesEnabled={noteFilesEnabled}
            handleNoteFilesToggle={handleNoteFilesToggle}
            noteFilesPath={noteFilesPath}
            noteFilesDefaultPath={noteFilesDefaultPath}
            handleNoteFilesChangePath={handleNoteFilesChangePath}
            noteFilesRebuilding={noteFilesRebuilding}
            handleNoteFilesRebuild={handleNoteFilesRebuild}
            floatingIconAutoHide={floatingIconAutoHide}
            setFloatingIconAutoHide={setFloatingIconAutoHide}
            panelStartPosition={panelStartPosition}
            setPanelStartPosition={setPanelStartPosition}
            uiLanguage={uiLanguage}
            setUiLanguage={setUiLanguage}
            preferredLanguage={preferredLanguage}
            updateTranscriptionSettings={updateTranscriptionSettings}
            platform={platform}
            autoStartEnabled={autoStartEnabled}
            autoStartLoading={autoStartLoading}
            handleAutoStartChange={handleAutoStartChange}
            startMinimized={startMinimized}
            setStartMinimized={setStartMinimized}
            preferBuiltInMic={preferBuiltInMic}
            selectedMicDeviceId={selectedMicDeviceId}
            micNoiseSuppression={micNoiseSuppression}
            micGain={micGain}
            setPreferBuiltInMic={setPreferBuiltInMic}
            setSelectedMicDeviceId={setSelectedMicDeviceId}
            setMicNoiseSuppression={setMicNoiseSuppression}
            setMicGain={setMicGain}
            autoUnmuteMicEnabled={autoUnmuteMicEnabled}
            setAutoUnmuteMicEnabled={setAutoUnmuteMicEnabled}
            autoLearnCorrections={autoLearnCorrections}
            setAutoLearnCorrections={setAutoLearnCorrections}
            ydotoolStatus={ydotoolStatus}
            refreshYdotoolStatus={refreshYdotoolStatus}
            ydotoolGuideKey={ydotoolGuideKey}
            setYdotoolGuideKey={setYdotoolGuideKey}
            isUsingHyprland={isUsingHyprland}
            hyprlandConfigStatus={hyprlandConfigStatus}
            dictationKey={dictationKey}
            registerHotkey={registerHotkey}
            validateDictationHotkey={validateDictationHotkey}
            isHotkeyRegistering={isHotkeyRegistering}
            isUsingNativeShortcut={isUsingNativeShortcut}
            effectiveDefaultHotkey={effectiveDefaultHotkey}
            activationMode={activationMode}
            setActivationMode={setActivationMode}

            voiceAgentKey={voiceAgentKey}
            commitAgentHotkey={commitAgentHotkey}
            setVoiceAgentKey={setVoiceAgentKey}
            validateVoiceAgentHotkey={validateVoiceAgentHotkey}
            isAgentHotkeyCommitting={isAgentHotkeyCommitting}
            meetingKey={meetingKey}
            registerMeetingHotkey={registerMeetingHotkey}
            validateMeetingHotkey={validateMeetingHotkey}
            isMeetingHotkeyRegistering={isMeetingHotkeyRegistering}
            setMeetingKey={setMeetingKey}
            meetingHotkeyLayoutMode={meetingHotkeyLayoutMode}
            setMeetingHotkeyLayoutMode={setMeetingHotkeyLayoutMode}
            initialSubTab={activeSection === "input" ? initialSubTab : undefined}
          />
        );

      case "storage":
        return (
          <StorageSection
            t={t}
            audioRetentionDays={audioRetentionDays}
            setAudioRetentionDays={setAudioRetentionDays}
            audioStorageUsage={audioStorageUsage}
            formatBytes={formatBytes}
            handleClearAllAudio={handleClearAllAudio}
            persistActiveWindowScreenshots={persistActiveWindowScreenshots}
            screenContextRetentionDays={screenContextRetentionDays}
            setScreenContextRetentionDays={setScreenContextRetentionDays}
            screenContextStorageUsage={screenContextStorageUsage}
            handleClearAllScreenContextScreenshots={handleClearAllScreenContextScreenshots}
            meetingAudioStorageUsage={meetingAudioStorageUsage}
            handleClearAllMeetingAudio={handleClearAllMeetingAudio}
            transcriptionIdleTimeoutMs={transcriptionIdleTimeoutMs}
            setTranscriptionIdleTimeoutMs={setTranscriptionIdleTimeoutMs}
            llmIdleTimeoutMs={llmIdleTimeoutMs}
            setLlmIdleTimeoutMs={setLlmIdleTimeoutMs}
            dataRetentionEnabled={dataRetentionEnabled}
            setDataRetentionEnabled={setDataRetentionEnabled}
            saveDiscardedTranscriptions={saveDiscardedTranscriptions}
            setSaveDiscardedTranscriptions={setSaveDiscardedTranscriptions}
            platform={platform}
            systemAudio={systemAudio}
            permissionsHook={permissionsHook}
            resetAccessibilityPermissions={resetAccessibilityPermissions}
          />
        );

      case "system":
        return (
          <SystemSection
            t={t}
            cachePathHint={cachePathHint}
            handleRemoveModels={handleRemoveModels}
            isRemovingModels={isRemovingModels}
            handleFullRestore={handleFullRestore}
            handleFullBackup={handleFullBackup}
            isRestoringBackup={isRestoringBackup}
            isBackingUp={isBackingUp}
            showConfirmDialog={showConfirmDialog}
            showAlertDialog={showAlertDialog}
            signOut={signOut}
          />
        );

      // transcription / aiProcessing / models render via lazy keep-alive panels below.
      case "transcription":
      case "aiProcessing":
      case "models":
        return null;

      default:
        return null;
    }
  };

  return (
    <>
      <ConfirmDialog
        open={confirmDialog.open}
        onOpenChange={(open) => !open && hideConfirmDialog()}
        title={confirmDialog.title}
        description={confirmDialog.description}
        onConfirm={confirmDialog.onConfirm}
        variant={confirmDialog.variant}
        confirmText={confirmDialog.confirmText}
        cancelText={confirmDialog.cancelText}
      />

      <AlertDialog
        open={alertDialog.open}
        onOpenChange={(open) => !open && hideAlertDialog()}
        title={alertDialog.title}
        description={alertDialog.description}
        onOk={() => {}}
      />

      {/* Mounted on first visit and kept alive so model-download progress and IPC listeners survive section switches. */}
      {mountedSections.has("transcription") && (
        <div className={activeSection === "transcription" ? undefined : "hidden"}>
          <TranscriptionSectionContainer
            initialTab={activeSection === "transcription" ? initialSubTab : undefined}
            cloudTranscriptionMode={cloudTranscriptionMode}
            setCloudTranscriptionMode={setCloudTranscriptionMode}
            useLocalWhisper={useLocalWhisper}
            setUseLocalWhisper={setUseLocalWhisper}
            updateTranscriptionSettings={updateTranscriptionSettings}
            cloudTranscriptionProvider={cloudTranscriptionProvider}
            setCloudTranscriptionProvider={setCloudTranscriptionProvider}
            cloudTranscriptionModel={cloudTranscriptionModel}
            setCloudTranscriptionModel={setCloudTranscriptionModel}
            localTranscriptionProvider={localTranscriptionProvider}
            setLocalTranscriptionProvider={setLocalTranscriptionProvider}
            whisperModel={whisperModel}
            setWhisperModel={setWhisperModel}
            parakeetModel={parakeetModel}
            setParakeetModel={setParakeetModel}
            cloudTranscriptionBaseUrl={cloudTranscriptionBaseUrl}
            setCloudTranscriptionBaseUrl={setCloudTranscriptionBaseUrl}
            transcriptionMode={transcriptionMode}
            setTranscriptionMode={setTranscriptionMode}
            remoteTranscriptionUrl={remoteTranscriptionUrl}
            setRemoteTranscriptionUrl={setRemoteTranscriptionUrl}
            remoteTranscriptionModel={remoteTranscriptionModel}
            setRemoteTranscriptionModel={setRemoteTranscriptionModel}
            showTranscriptionPreview={showTranscriptionPreview}
            setShowTranscriptionPreview={setShowTranscriptionPreview}
            toast={toast}
            includeActiveWindowContext={includeActiveWindowContext}
            setIncludeActiveWindowContext={setIncludeActiveWindowContext}
            screenContextOcrEngine={screenContextOcrEngine}
            setScreenContextOcrEngine={setScreenContextOcrEngine}
            persistActiveWindowScreenshots={persistActiveWindowScreenshots}
            setPersistActiveWindowScreenshots={setPersistActiveWindowScreenshots}
            dynamicPromptVocabularyEnabled={dynamicPromptVocabularyEnabled}
            setDynamicPromptVocabularyEnabled={setDynamicPromptVocabularyEnabled}
            dynamicPromptVocabularyIncludeScreenContext={dynamicPromptVocabularyIncludeScreenContext}
            setDynamicPromptVocabularyIncludeScreenContext={setDynamicPromptVocabularyIncludeScreenContext}
            dictationSileroEnabled={dictationSileroEnabled}
            setDictationSileroEnabled={setDictationSileroEnabled}
            noteRecordingSileroEnabled={noteRecordingSileroEnabled}
            setNoteRecordingSileroEnabled={setNoteRecordingSileroEnabled}
            meetingSileroEnabled={meetingSileroEnabled}
            setMeetingSileroEnabled={setMeetingSileroEnabled}
            meetingAecEnabled={meetingAecEnabled}
            setMeetingAecEnabled={setMeetingAecEnabled}
            whisperVadThreshold={whisperVadThreshold}
            setWhisperVadThreshold={setWhisperVadThreshold}
            whisperVadMinSpeechDurationMs={whisperVadMinSpeechDurationMs}
            setWhisperVadMinSpeechDurationMs={setWhisperVadMinSpeechDurationMs}
            whisperVadMinSilenceDurationMs={whisperVadMinSilenceDurationMs}
            setWhisperVadMinSilenceDurationMs={setWhisperVadMinSilenceDurationMs}
            whisperVadMaxSpeechDurationS={whisperVadMaxSpeechDurationS}
            setWhisperVadMaxSpeechDurationS={setWhisperVadMaxSpeechDurationS}
            whisperVadSpeechPadMs={whisperVadSpeechPadMs}
            setWhisperVadSpeechPadMs={setWhisperVadSpeechPadMs}
            whisperVadSamplesOverlap={whisperVadSamplesOverlap}
            setWhisperVadSamplesOverlap={setWhisperVadSamplesOverlap}
            resetWhisperVad={resetWhisperVad}
            previewVadMinSpeechDurationMs={previewVadMinSpeechDurationMs}
            setPreviewVadMinSpeechDurationMs={setPreviewVadMinSpeechDurationMs}
            previewVadMinSilenceDurationMs={previewVadMinSilenceDurationMs}
            setPreviewVadMinSilenceDurationMs={setPreviewVadMinSilenceDurationMs}
            previewVadSpeechPadMs={previewVadSpeechPadMs}
            setPreviewVadSpeechPadMs={setPreviewVadSpeechPadMs}
            previewVadMaxSpeechDurationS={previewVadMaxSpeechDurationS}
            setPreviewVadMaxSpeechDurationS={setPreviewVadMaxSpeechDurationS}
            previewVadSamplesOverlap={previewVadSamplesOverlap}
            setPreviewVadSamplesOverlap={setPreviewVadSamplesOverlap}
            previewVadEnergyThreshold={previewVadEnergyThreshold}
            setPreviewVadEnergyThreshold={setPreviewVadEnergyThreshold}
            previewVadMinSegmentRms={previewVadMinSegmentRms}
            setPreviewVadMinSegmentRms={setPreviewVadMinSegmentRms}
            previewVadNoiseFloorFactor={previewVadNoiseFloorFactor}
            setPreviewVadNoiseFloorFactor={setPreviewVadNoiseFloorFactor}
            previewVadNoiseFloorAlpha={previewVadNoiseFloorAlpha}
            setPreviewVadNoiseFloorAlpha={setPreviewVadNoiseFloorAlpha}
            previewVadMaxMerges={previewVadMaxMerges}
            setPreviewVadMaxMerges={setPreviewVadMaxMerges}
            previewVadMaxMergedMs={previewVadMaxMergedMs}
            setPreviewVadMaxMergedMs={setPreviewVadMaxMergedMs}
            resetPreviewVadDefaults={resetPreviewVadDefaults}
          />
        </div>
      )}
      {mountedSections.has("models") && (
        <div className={activeSection === "models" ? undefined : "hidden"}>
          <ModelsSection />
        </div>
      )}
      {mountedSections.has("aiProcessing") && (
        <div className={activeSection === "aiProcessing" ? undefined : "hidden"}>
          <AIProcessingSection
            initialTab={activeSection === "aiProcessing" ? initialSubTab : undefined}
            useCleanupModel={useCleanupModel}
            updateCleanupSettings={updateCleanupSettings}
            toast={toast}
          />
        </div>
      )}
      {renderSectionContent()}
    </>
  );
}
