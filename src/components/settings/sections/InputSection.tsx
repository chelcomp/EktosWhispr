import React, { useEffect } from "react";
import type { TFunction } from "i18next";
import {
  BookOpen,
  CircleCheck,
  CircleX,
  Copy,
  Info,
  Keyboard,
  Loader2,
  Mic,
  Monitor,
  Moon,
  RotateCw,
  Sun,
} from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "../../ui/alert";
import { Button } from "../../ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "../../ui/dialog";
import { ActivationModeSelector } from "../../ui/ActivationModeSelector";
import LanguageSelector from "../../ui/LanguageSelector";
import type { LanguageOption } from "../../ui/LanguageSelector";
import { HotkeyListInput } from "../../ui/HotkeyListInput";
import MicrophoneSettings from "../../ui/MicrophoneSettings";

import { ProviderTabs } from "../../ui/ProviderTabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../ui/select";
import {
  SectionHeader,
  SettingsPanel,
  SettingsPanelRow,
  SettingsRow,
} from "../../ui/SettingsSection";
import { Toggle } from "../../ui/toggle";
import { useLocalStorage } from "../../../hooks/useLocalStorage";
import type { HyprlandConfigStatus } from "../../../hooks/useHotkeyModeInfo";
import type { TranscriptionSettings } from "../../../hooks/useSettings";
import { getCachedPlatform, type Platform } from "../../../utils/platform";
import { formatHotkeyLabel } from "../../../utils/hotkeys";

type InputSubTab = "microphone" | "hotkeys";

const INPUT_TABS: readonly InputSubTab[] = ["microphone", "hotkeys"];

const UI_LANGUAGE_OPTIONS: LanguageOption[] = [
  { value: "en", label: "English", flag: "🇺🇸" },
  { value: "pt", label: "Português", flag: "🇵🇹" },
];

function useSubTab<T extends string>(storageKey: string, options: readonly T[], initial?: T) {
  const [tab, setTab] = useLocalStorage<T>(storageKey, initial ?? options[0]);
  useEffect(() => {
    if (initial && initial !== tab) setTab(initial);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initial]);
  const safeTab = options.includes(tab) ? tab : options[0];
  return [safeTab, setTab] as const;
}

function TabPanel({ active, children }: { active: boolean; children: React.ReactNode }) {
  return <div className={active ? undefined : "hidden"}>{children}</div>;
}

interface InputSectionProps {
  t: TFunction;
  /* Appearance & general behavior (former `general` arm) */
  theme: "light" | "dark" | "auto";
  setTheme: (theme: "light" | "dark" | "auto") => void;
  audioCuesEnabled: boolean;
  setAudioCuesEnabled: (v: boolean) => void;
  pauseMediaOnDictation: boolean;
  setPauseMediaOnDictation: (v: boolean) => void;
  notificationsEnabled: boolean;
  setNotificationsEnabled: (v: boolean) => void;
  autoPasteEnabled: boolean;
  setAutoPasteEnabled: (v: boolean) => void;
  keepTranscriptionInClipboard: boolean;
  setKeepTranscriptionInClipboard: (v: boolean) => void;
  noteFilesEnabled: boolean;
  handleNoteFilesToggle: (enabled: boolean) => void;
  noteFilesPath: string;
  noteFilesDefaultPath: string;
  handleNoteFilesChangePath: () => void;
  noteFilesRebuilding: boolean;
  handleNoteFilesRebuild: () => void;
  floatingIconAutoHide: boolean;
  setFloatingIconAutoHide: (v: boolean) => void;
  panelStartPosition: "bottom-right" | "center" | "bottom-left";
  setPanelStartPosition: (position: "bottom-right" | "center" | "bottom-left") => void;
  uiLanguage: string;
  setUiLanguage: (language: string) => void;
  preferredLanguage: string;
  updateTranscriptionSettings: (settings: Partial<TranscriptionSettings>) => void;
  platform: Platform;
  autoStartEnabled: boolean;
  autoStartLoading: boolean;
  handleAutoStartChange: (enabled: boolean) => void;
  startMinimized: boolean;
  setStartMinimized: (v: boolean) => void;
  preferBuiltInMic: boolean;
  selectedMicDeviceId: string;
  micNoiseSuppression: boolean;
  micGain: number;
  setPreferBuiltInMic: (v: boolean) => void;
  setSelectedMicDeviceId: (deviceId: string) => void;
  setMicNoiseSuppression: (v: boolean) => void;
  setMicGain: (gain: number) => void;
  autoUnmuteMicEnabled: boolean;
  setAutoUnmuteMicEnabled: (v: boolean) => void;
  autoLearnCorrections: boolean;
  setAutoLearnCorrections: (v: boolean) => void;
  ydotoolStatus: {
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
  } | null;
  refreshYdotoolStatus: () => void;
  ydotoolGuideKey: string | null;
  setYdotoolGuideKey: (key: string | null) => void;
  /* Hotkeys (former `hotkeys` arm) */
  isUsingHyprland: boolean;
  hyprlandConfigStatus: HyprlandConfigStatus | null;
  dictationKey: string;
  registerHotkey: (hotkey: string) => Promise<boolean>;
  validateDictationHotkey: (hotkey: string) => string | null;
  isHotkeyRegistering: boolean;
  isUsingNativeShortcut: boolean;
  effectiveDefaultHotkey: string | null;
  activationMode: "tap" | "push";
  setActivationMode: (mode: "tap" | "push") => void;
  linuxPttAvailable?: boolean;
  voiceAgentKey: string;
  commitAgentHotkey: (
    setter: (key: string) => Promise<boolean>,
    key: string
  ) => Promise<boolean>;
  setVoiceAgentKey: (key: string) => Promise<boolean>;
  validateVoiceAgentHotkey: (hotkey: string) => string | null;
  isAgentHotkeyCommitting: boolean;
  meetingKey: string;
  registerMeetingHotkey: (hotkey: string) => Promise<boolean>;
  validateMeetingHotkey: (hotkey: string) => string | null;
  isMeetingHotkeyRegistering: boolean;
  setMeetingKey: (key: string) => void;
  meetingHotkeyLayoutMode: "side-panel" | "full-width";
  setMeetingHotkeyLayoutMode: (mode: "side-panel" | "full-width") => void;
  /** Legacy deep-link landing tab; invalid values fall back to the first tab. */
  initialSubTab?: string;
}

export default function InputSection({
  t,
  theme,
  setTheme,
  audioCuesEnabled,
  setAudioCuesEnabled,
  pauseMediaOnDictation,
  setPauseMediaOnDictation,
  notificationsEnabled,
  setNotificationsEnabled,
  autoPasteEnabled,
  setAutoPasteEnabled,
  keepTranscriptionInClipboard,
  setKeepTranscriptionInClipboard,
  noteFilesEnabled,
  handleNoteFilesToggle,
  noteFilesPath,
  noteFilesDefaultPath,
  handleNoteFilesChangePath,
  noteFilesRebuilding,
  handleNoteFilesRebuild,
  floatingIconAutoHide,
  setFloatingIconAutoHide,
  panelStartPosition,
  setPanelStartPosition,
  uiLanguage,
  setUiLanguage,
  preferredLanguage,
  updateTranscriptionSettings,
  platform,
  autoStartEnabled,
  autoStartLoading,
  handleAutoStartChange,
  startMinimized,
  setStartMinimized,
  preferBuiltInMic,
  selectedMicDeviceId,
  micNoiseSuppression,
  micGain,
  setPreferBuiltInMic,
  setSelectedMicDeviceId,
  setMicNoiseSuppression,
  setMicGain,
  autoUnmuteMicEnabled,
  setAutoUnmuteMicEnabled,
  autoLearnCorrections,
  setAutoLearnCorrections,
  ydotoolStatus,
  refreshYdotoolStatus,
  ydotoolGuideKey,
  setYdotoolGuideKey,
  isUsingHyprland,
  hyprlandConfigStatus,
  dictationKey,
  registerHotkey,
  validateDictationHotkey,
  isHotkeyRegistering,
  isUsingNativeShortcut,
  effectiveDefaultHotkey,
  activationMode,
  setActivationMode,
  linuxPttAvailable,
  voiceAgentKey,
  commitAgentHotkey,
  setVoiceAgentKey,
  validateVoiceAgentHotkey,
  isAgentHotkeyCommitting,
  meetingKey,
  registerMeetingHotkey,
  validateMeetingHotkey,
  isMeetingHotkeyRegistering,
  setMeetingKey,
  meetingHotkeyLayoutMode,
  setMeetingHotkeyLayoutMode,
  initialSubTab,
}: InputSectionProps) {
  const [tab, setTab] = useSubTab<InputSubTab>(
    "settings.inputTab",
    INPUT_TABS,
    initialSubTab === "hotkeys" || initialSubTab === "microphone" ? initialSubTab : undefined
  );

  const subTabs = [
    { id: "microphone", name: t("settingsPage.input.microphone.title") },
    { id: "hotkeys", name: t("settingsPage.input.hotkeys.title") },
  ];

  return (
    <div className="space-y-6">
      <SectionHeader
        title={t("settingsPage.input.title")}
        description={t("settingsPage.input.description")}
      />
      <ProviderTabs
        providers={subTabs}
        selectedId={tab}
        onSelect={(id) => setTab(id as InputSubTab)}
        renderIcon={(id) =>
          id === "hotkeys" ? (
            <Keyboard className="w-3.5 h-3.5" />
          ) : (
            <Mic className="w-3.5 h-3.5" />
          )
        }
      />
      <TabPanel active={tab === "microphone"}>
        <div className="space-y-6">
          {/* Appearance */}
          <div id="general-appearance">
            <SectionHeader
              title={t("settingsPage.general.appearance.title")}
              description={t("settingsPage.general.appearance.description")}
            />
            <SettingsPanel>
              <SettingsPanelRow>
                <SettingsRow
                  label={t("settingsPage.general.appearance.theme")}
                  description={t("settingsPage.general.appearance.themeDescription")}
                >
                  <div className="inline-flex items-center gap-px p-0.5 bg-muted/60 dark:bg-surface-2 rounded-md">
                    {(
                      [
                        {
                          value: "light",
                          icon: Sun,
                          label: t("settingsPage.general.appearance.light"),
                        },
                        {
                          value: "dark",
                          icon: Moon,
                          label: t("settingsPage.general.appearance.dark"),
                        },
                        {
                          value: "auto",
                          icon: Monitor,
                          label: t("settingsPage.general.appearance.auto"),
                        },
                      ] as const
                    ).map((option) => {
                      const Icon = option.icon;
                      const isSelected = theme === option.value;
                      return (
                        <button
                          key={option.value}
                          onClick={() => setTheme(option.value)}
                          className={`
                              flex items-center gap-1 px-2.5 py-1 rounded-[5px] text-xs font-medium
                              transition-colors duration-100
                              ${
                                isSelected
                                  ? "bg-background dark:bg-surface-raised text-foreground shadow-sm"
                                  : "text-muted-foreground hover:text-foreground"
                              }
                            `}
                        >
                          <Icon className={`w-3 h-3 ${isSelected ? "text-primary" : ""}`} />
                          {option.label}
                        </button>
                      );
                    })}
                  </div>
                </SettingsRow>
              </SettingsPanelRow>
            </SettingsPanel>
          </div>

          {/* Sound Effects */}
          <div id="general-sound-effects">
            <SectionHeader title={t("settingsPage.general.soundEffects.title")} />
            <SettingsPanel>
              <SettingsPanelRow>
                <SettingsRow
                  label={t("settingsPage.general.soundEffects.dictationSounds")}
                  description={t("settingsPage.general.soundEffects.dictationSoundsDescription")}
                >
                  <Toggle checked={audioCuesEnabled} onChange={setAudioCuesEnabled} />
                </SettingsRow>
              </SettingsPanelRow>
              <SettingsPanelRow>
                <SettingsRow
                  label={t("settingsPage.general.soundEffects.pauseMedia")}
                  description={t("settingsPage.general.soundEffects.pauseMediaDescription")}
                >
                  <Toggle checked={pauseMediaOnDictation} onChange={setPauseMediaOnDictation} />
                </SettingsRow>
              </SettingsPanelRow>
            </SettingsPanel>
          </div>

          {/* Notifications */}
          <div id="general-notifications">
            <SectionHeader
              title={t("settingsPage.general.notifications.title")}
              description={t("settingsPage.general.notifications.description")}
            />
            <SettingsPanel>
              <SettingsPanelRow>
                <SettingsRow
                  label={t("settingsPage.general.notifications.disableAll")}
                  description={t("settingsPage.general.notifications.disableAllDescription")}
                >
                  <Toggle
                    checked={!notificationsEnabled}
                    onChange={(v) => setNotificationsEnabled(!v)}
                  />
                </SettingsRow>
              </SettingsPanelRow>
            </SettingsPanel>
          </div>

          {/* Clipboard */}
          <div id="general-clipboard">
            <SectionHeader title={t("settingsPage.general.clipboard.title")} />
            <SettingsPanel>
              <SettingsPanelRow>
                <SettingsRow
                  label={t("settingsPage.general.clipboard.autoPaste")}
                  description={t("settingsPage.general.clipboard.autoPasteDescription")}
                >
                  <Toggle checked={autoPasteEnabled} onChange={setAutoPasteEnabled} />
                </SettingsRow>
              </SettingsPanelRow>
              <SettingsPanelRow>
                <SettingsRow
                  label={t("settingsPage.general.clipboard.keepInClipboard")}
                  description={t("settingsPage.general.clipboard.keepInClipboardDescription")}
                >
                  <Toggle
                    checked={keepTranscriptionInClipboard}
                    onChange={setKeepTranscriptionInClipboard}
                  />
                </SettingsRow>
              </SettingsPanelRow>
            </SettingsPanel>
          </div>

          {/* Save Notes as Files */}
          <div id="general-save-files">
            <SectionHeader title={t("settings.noteFiles.title")} />
            <SettingsPanel>
              <SettingsPanelRow>
                <SettingsRow
                  label={t("settings.noteFiles.title")}
                  description={t("settings.noteFiles.description")}
                >
                  <Toggle checked={noteFilesEnabled} onChange={handleNoteFilesToggle} />
                </SettingsRow>
              </SettingsPanelRow>
              {noteFilesEnabled && (
                <>
                  <SettingsPanelRow>
                    <SettingsRow
                      label={t("settings.noteFiles.path")}
                      description={noteFilesPath || noteFilesDefaultPath || "..."}
                    >
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-7 text-xs"
                        onClick={handleNoteFilesChangePath}
                      >
                        {t("settings.noteFiles.changePath")}
                      </Button>
                    </SettingsRow>
                  </SettingsPanelRow>
                  <SettingsPanelRow>
                    <SettingsRow
                      label={t("settings.noteFiles.rebuild")}
                      description={t("settings.noteFiles.rebuildDescription")}
                    >
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-7 text-xs"
                        disabled={noteFilesRebuilding}
                        onClick={handleNoteFilesRebuild}
                      >
                        {noteFilesRebuilding ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : (
                          t("settings.noteFiles.rebuild")
                        )}
                      </Button>
                    </SettingsRow>
                  </SettingsPanelRow>
                </>
              )}
            </SettingsPanel>
          </div>

          {/* Floating Icon */}
          <div id="general-floating-icon">
            <SectionHeader
              title={t("settingsPage.general.floatingIcon.title")}
              description={t("settingsPage.general.floatingIcon.description")}
            />
            <SettingsPanel>
              <SettingsPanelRow>
                <SettingsRow
                  label={t("settingsPage.general.floatingIcon.autoHide")}
                  description={t("settingsPage.general.floatingIcon.autoHideDescription")}
                >
                  <Toggle checked={floatingIconAutoHide} onChange={setFloatingIconAutoHide} />
                </SettingsRow>
              </SettingsPanelRow>
              <SettingsPanelRow>
                <SettingsRow
                  label={t("settingsPage.general.floatingIcon.startPosition")}
                  description={t("settingsPage.general.floatingIcon.startPositionDescription")}
                >
                  <select
                    value={panelStartPosition}
                    onChange={(e) =>
                      setPanelStartPosition(
                        e.target.value as "bottom-right" | "center" | "bottom-left"
                      )
                    }
                    className="h-7 rounded border border-border/70 bg-surface-1/80 px-2.5 text-xs font-medium text-foreground shadow-sm backdrop-blur-sm hover:border-border-hover hover:bg-surface-2/70 focus:outline-none focus:ring-2 focus:ring-ring/30 focus:ring-offset-1 transition-colors duration-200"
                  >
                    <option value="bottom-right">
                      {t("settingsPage.general.floatingIcon.bottomRight")}
                    </option>
                    <option value="center">
                      {t("settingsPage.general.floatingIcon.center")}
                    </option>
                    <option value="bottom-left">
                      {t("settingsPage.general.floatingIcon.bottomLeft")}
                    </option>
                  </select>
                </SettingsRow>
              </SettingsPanelRow>
            </SettingsPanel>
          </div>

          {/* Language */}
          <div id="general-language">
            <SectionHeader
              title={t("settings.language.sectionTitle")}
              description={t("settings.language.sectionDescription")}
            />
            <SettingsPanel>
              <SettingsPanelRow>
                <SettingsRow
                  label={t("settings.language.uiLabel")}
                  description={t("settings.language.uiDescription")}
                >
                  <LanguageSelector
                    value={uiLanguage}
                    onChange={setUiLanguage}
                    options={UI_LANGUAGE_OPTIONS}
                    className="min-w-32"
                  />
                </SettingsRow>
              </SettingsPanelRow>
              <SettingsPanelRow>
                <SettingsRow
                  label={t("settings.language.transcriptionLabel")}
                  description={t("settings.language.transcriptionDescription")}
                >
                  <LanguageSelector
                    value={preferredLanguage}
                    onChange={(value) =>
                      updateTranscriptionSettings({ preferredLanguage: value })
                    }
                    multiSelect
                  />
                </SettingsRow>
              </SettingsPanelRow>
            </SettingsPanel>
          </div>

          {/* Startup */}
          <div id="general-startup">
            <SectionHeader
              title={t("settingsPage.general.startup.title")}
              description={t("settingsPage.general.startup.description")}
            />
            <SettingsPanel>
              {true && (
                <SettingsPanelRow>
                  <SettingsRow
                    label={t("settingsPage.general.startup.launchAtLogin")}
                    description={t("settingsPage.general.startup.launchAtLoginDescription")}
                  >
                    <Toggle
                      checked={autoStartEnabled}
                      onChange={(checked: boolean) => handleAutoStartChange(checked)}
                      disabled={autoStartLoading}
                    />
                  </SettingsRow>
                </SettingsPanelRow>
              )}
              <SettingsPanelRow>
                <SettingsRow
                  label={t("settingsPage.general.startup.startMinimized")}
                  description={t("settingsPage.general.startup.startMinimizedDescription")}
                >
                  <Toggle checked={startMinimized} onChange={setStartMinimized} />
                </SettingsRow>
              </SettingsPanelRow>
            </SettingsPanel>
          </div>

          {/* Microphone */}
          <div id="general-microphone">
            <SectionHeader
              title={t("settingsPage.general.microphone.title")}
              description={t("settingsPage.general.microphone.description")}
            />
            <SettingsPanel>
              <SettingsPanelRow>
                <MicrophoneSettings
                  preferBuiltInMic={preferBuiltInMic}
                  selectedMicDeviceId={selectedMicDeviceId}
                  micNoiseSuppression={micNoiseSuppression}
                  micGain={micGain}
                  onPreferBuiltInChange={setPreferBuiltInMic}
                  onDeviceSelect={setSelectedMicDeviceId}
                  onMicNoiseSuppressionChange={setMicNoiseSuppression}
                  onMicGainChange={setMicGain}
                  autoUnmuteMic={autoUnmuteMicEnabled}
                  onAutoUnmuteMicChange={setAutoUnmuteMicEnabled}
                />
              </SettingsPanelRow>
            </SettingsPanel>
          </div>

          {/* Dictionary */}
          <div id="general-auto-learn">
            <SectionHeader
              title={t("settingsPage.dictionary.autoLearnTitle", {
                defaultValue: "Auto-learn from corrections",
              })}
            />
            <SettingsPanel>
              <SettingsPanelRow>
                <SettingsRow
                  label={t("settingsPage.dictionary.autoLearnTitle", {
                    defaultValue: "Auto-learn from corrections",
                  })}
                  description={t("settingsPage.dictionary.autoLearnDescription", {
                    defaultValue:
                      "When you correct a transcription in the target app, the corrected word is automatically added to your dictionary.",
                  })}
                >
                  <Toggle checked={autoLearnCorrections} onChange={setAutoLearnCorrections} />
                </SettingsRow>
              </SettingsPanelRow>
            </SettingsPanel>
          </div>


        </div>
      </TabPanel>
      <TabPanel active={tab === "hotkeys"}>
        <div className="space-y-6">
          {isUsingHyprland && hyprlandConfigStatus && !hyprlandConfigStatus.canWrite && (
            <Alert>
              <Info className="h-4 w-4" />
              <AlertTitle>
                {t("settingsPage.general.hotkey.hyprlandConfigWriteWarningTitle")}
              </AlertTitle>
              <AlertDescription>
                {t("settingsPage.general.hotkey.hyprlandConfigWriteWarningDescription", {
                  path: hyprlandConfigStatus.path,
                })}
              </AlertDescription>
            </Alert>
          )}
          {/* Dictation Hotkey */}
          <div>
            <SectionHeader
              title={t("settingsPage.general.hotkey.title")}
              description={t("settingsPage.general.hotkey.description")}
              note={isUsingHyprland && t("settingsPage.general.hotkey.hyprlandUnbindDescription")}
            />
            <SettingsPanel>
              <SettingsPanelRow>
                <HotkeyListInput
                  value={dictationKey}
                  onChange={(list) => registerHotkey(list)}
                  validate={validateDictationHotkey}
                  disabled={isHotkeyRegistering}
                  maxHotkeys={isUsingNativeShortcut ? 1 : undefined}
                  required
                  footerEnd={
                    effectiveDefaultHotkey &&
                    dictationKey &&
                    dictationKey !== effectiveDefaultHotkey ? (
                      <button
                        onClick={() => registerHotkey(effectiveDefaultHotkey)}
                        disabled={isHotkeyRegistering}
                        className="text-xs text-muted-foreground/70 hover:text-foreground transition-colors disabled:opacity-50"
                      >
                        {t("settingsPage.general.hotkey.resetToDefault", {
                          hotkey: formatHotkeyLabel(effectiveDefaultHotkey),
                        })}
                      </button>
                    ) : null
                  }
                />
              </SettingsPanelRow>

              {(!isUsingNativeShortcut) && (
                <SettingsPanelRow>
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-xs text-muted-foreground/80">
                      {t("settingsPage.general.hotkey.activationMode")}
                    </span>
                    <ActivationModeSelector value={activationMode} onChange={setActivationMode} />
                  </div>

                </SettingsPanelRow>
              )}
            </SettingsPanel>
          </div>

          {/* Voice Agent Hotkey */}
          <div>
            <SectionHeader
              title={t("settingsPage.general.voiceAgentHotkey.title")}
              description={t("settingsPage.general.voiceAgentHotkey.description")}
            />
            <SettingsPanel>
              <SettingsPanelRow>
                <HotkeyListInput
                  value={voiceAgentKey}
                  onChange={(list) => commitAgentHotkey(setVoiceAgentKey, list)}
                  onClear={() => commitAgentHotkey(setVoiceAgentKey, "")}
                  validate={validateVoiceAgentHotkey}
                  disabled={isAgentHotkeyCommitting}
                  maxHotkeys={isUsingNativeShortcut ? 1 : undefined}
                />
              </SettingsPanelRow>
            </SettingsPanel>
          </div>

          {/* Meeting Mode Hotkey */}
          <div>
            <SectionHeader
              title={t("settingsPage.general.meetingHotkey.title")}
              description={t("settingsPage.general.meetingHotkey.description")}
            />
            <SettingsPanel>
              <SettingsPanelRow>
                <HotkeyListInput
                  value={meetingKey}
                  onChange={(list) => registerMeetingHotkey(list)}
                  onClear={async () => {
                    await window.electronAPI?.registerMeetingHotkey?.("");
                    setMeetingKey("");
                  }}
                  validate={validateMeetingHotkey}
                  disabled={isMeetingHotkeyRegistering}
                  maxHotkeys={isUsingNativeShortcut ? 1 : undefined}
                />
              </SettingsPanelRow>
              <SettingsPanelRow className="flex items-center justify-between gap-3 border-t border-border/40 dark:border-white/5">
                <span className="text-xs text-muted-foreground/80">
                  {t("settingsPage.general.meetingHotkey.layoutLabel")}
                </span>
                <Select
                  value={meetingHotkeyLayoutMode}
                  onValueChange={(value) =>
                    setMeetingHotkeyLayoutMode(value as "side-panel" | "full-width")
                  }
                >
                  <SelectTrigger className="h-7 w-36 text-xs px-2.5 [&>svg]:h-3 [&>svg]:w-3">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem
                      value="full-width"
                      className="text-xs py-1.5 pl-2.5 pr-7 rounded-md"
                    >
                      {t("settingsPage.general.meetingHotkey.layoutFullWidth")}
                    </SelectItem>
                    <SelectItem
                      value="side-panel"
                      className="text-xs py-1.5 pl-2.5 pr-7 rounded-md"
                    >
                      {t("settingsPage.general.meetingHotkey.layoutSidePanel")}
                    </SelectItem>
                  </SelectContent>
                </Select>
              </SettingsPanelRow>
            </SettingsPanel>
          </div>
        </div>
      </TabPanel>
    </div>
  );
}
