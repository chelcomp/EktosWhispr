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
import LinuxPttSetupInfo from "../../ui/LinuxPttSetupInfo";
import NixOsPasteInfo from "../../ui/NixOsPasteInfo";
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
  linuxPttAvailable: boolean;
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
              {platform !== "linux" && (
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

          {/* Wayland Paste Diagnostics — only on Linux + Wayland */}
          {ydotoolStatus?.isLinux && ydotoolStatus?.isWayland && (
            <div>
              <SectionHeader
                title={t("settingsPage.general.waylandPaste.title", {
                  defaultValue: "Wayland Paste Setup",
                })}
                description={t("settingsPage.general.waylandPaste.description", {
                  defaultValue:
                    "Auto-paste on Wayland requires ydotool. Check the status of each component below.",
                })}
              />
              {(() => {
                if (ydotoolStatus.isNixOS) {
                  return (
                    <NixOsPasteInfo status={ydotoolStatus} onRecheck={refreshYdotoolStatus} />
                  );
                }
                const checks = [
                  {
                    key: "hasYdotool",
                    label: "ydotool",
                    ok: ydotoolStatus.hasYdotool,
                    desc: t("settingsPage.general.waylandPaste.ydotoolDesc", {
                      defaultValue: "Input automation tool for Wayland",
                    }),
                    steps: [
                      {
                        title: t("settingsPage.general.waylandPaste.guide.ydotool.step1Title", {
                          defaultValue: "Install ydotool",
                        }),
                        desc: t("settingsPage.general.waylandPaste.guide.ydotool.step1Desc", {
                          defaultValue:
                            "Use your distribution's package manager to install ydotool.",
                        }),
                        cmds: [
                          { label: "Ubuntu / Pop!_OS / Debian", cmd: "sudo apt install ydotool" },
                          { label: "Fedora", cmd: "sudo dnf install ydotool" },
                          { label: "Arch Linux", cmd: "sudo pacman -S ydotool" },
                          { label: "openSUSE", cmd: "sudo zypper install ydotool" },
                        ],
                      },
                      {
                        title: t("settingsPage.general.waylandPaste.guide.ydotool.step2Title", {
                          defaultValue: "Verify installation",
                        }),
                        desc: t("settingsPage.general.waylandPaste.guide.ydotool.step2Desc", {
                          defaultValue: "Check that ydotool is available in your PATH.",
                        }),
                        cmds: [{ cmd: "which ydotool" }],
                      },
                    ],
                  },
                  {
                    key: "hasYdotoold",
                    label: "ydotoold",
                    ok: ydotoolStatus.hasYdotoold,
                    desc: t("settingsPage.general.waylandPaste.ydotooldDesc", {
                      defaultValue: "Daemon for ydotool (separate package on Ubuntu/Pop!_OS)",
                    }),
                    steps: [
                      {
                        title: t("settingsPage.general.waylandPaste.guide.ydotoold.step1Title", {
                          defaultValue: "Install ydotoold",
                        }),
                        desc: t("settingsPage.general.waylandPaste.guide.ydotoold.step1Desc", {
                          defaultValue:
                            "On Ubuntu and Pop!_OS, ydotoold is a separate package. On Fedora, it's included with ydotool.",
                        }),
                        cmds: [
                          {
                            label: "Ubuntu / Pop!_OS / Debian",
                            cmd: "sudo apt install ydotoold",
                          },
                          { label: "Fedora", cmd: "# Already included in the ydotool package" },
                          { label: "Arch Linux", cmd: "# Included in the ydotool package" },
                        ],
                      },
                    ],
                  },
                  {
                    key: "hasUinput",
                    label: "/dev/uinput",
                    ok: ydotoolStatus.hasUinput,
                    desc: t("settingsPage.general.waylandPaste.uinputDesc", {
                      defaultValue: "Kernel input device access",
                    }),
                    note: !ydotoolStatus.hasUinput
                      ? ydotoolStatus.hasUdevRule
                        ? t("settingsPage.general.waylandPaste.uinputRuleFound", {
                            defaultValue: "Rule present but not active. A reboot should fix it.",
                          })
                        : t("settingsPage.general.waylandPaste.uinputRuleMissing", {
                            defaultValue: "no udev rule found",
                          })
                      : undefined,
                    steps:
                      ydotoolStatus.hasUdevRule && !ydotoolStatus.hasUinput
                        ? [
                            {
                              title: t(
                                "settingsPage.general.waylandPaste.guide.uinput.ruleFoundTitle",
                                {
                                  defaultValue: "udev rule already configured",
                                }
                              ),
                              desc: t(
                                "settingsPage.general.waylandPaste.guide.uinput.ruleFoundDesc",
                                {
                                  defaultValue:
                                    "The udev rule for /dev/uinput is already on your system but hasn't taken effect. Try reloading:",
                                }
                              ),
                              cmds: [
                                {
                                  cmd: "sudo udevadm control --reload-rules && sudo udevadm trigger /dev/uinput",
                                },
                              ],
                            },
                            {
                              title: t(
                                "settingsPage.general.waylandPaste.guide.uinput.rebootTitle",
                                {
                                  defaultValue: "If reloading didn't help, reboot",
                                }
                              ),
                              desc: t(
                                "settingsPage.general.waylandPaste.guide.uinput.rebootDesc",
                                {
                                  defaultValue:
                                    "On some distros, udev changes only apply after a full reboot. Restart your computer and come back to re-check.",
                                }
                              ),
                            },
                          ]
                        : [
                            {
                              title: t(
                                "settingsPage.general.waylandPaste.guide.uinput.step1Title",
                                {
                                  defaultValue: "Create a udev rule",
                                }
                              ),
                              desc: t(
                                "settingsPage.general.waylandPaste.guide.uinput.step1Desc",
                                {
                                  defaultValue:
                                    "This rule grants access to /dev/uinput for users in the input group.",
                                }
                              ),
                              cmds: [
                                {
                                  cmd: 'echo \'KERNEL=="uinput", GROUP="input", MODE="0660", TAG+="uaccess"\' | sudo tee /etc/udev/rules.d/70-uinput.rules',
                                },
                              ],
                            },
                            {
                              title: t(
                                "settingsPage.general.waylandPaste.guide.uinput.step2Title",
                                {
                                  defaultValue: "Reload udev rules",
                                }
                              ),
                              desc: t(
                                "settingsPage.general.waylandPaste.guide.uinput.step2Desc",
                                {
                                  defaultValue: "Apply the new rule without rebooting.",
                                }
                              ),
                              cmds: [
                                {
                                  cmd: "sudo udevadm control --reload-rules && sudo udevadm trigger /dev/uinput",
                                },
                              ],
                            },
                          ],
                  },
                  {
                    key: "hasGroup",
                    label: t("settingsPage.general.waylandPaste.inputGroup", {
                      defaultValue: "input group",
                    }),
                    ok: ydotoolStatus.hasGroup,
                    desc: t("settingsPage.general.waylandPaste.inputGroupDesc", {
                      defaultValue: "User must be in the input group (requires re-login)",
                    }),
                    steps: [
                      {
                        title: t("settingsPage.general.waylandPaste.guide.group.step1Title", {
                          defaultValue: "Add your user to the input group",
                        }),
                        cmds: [{ cmd: "sudo usermod -aG input $USER" }],
                      },
                      {
                        title: t("settingsPage.general.waylandPaste.guide.group.step2Title", {
                          defaultValue: "Log out and back in",
                        }),
                        desc: t("settingsPage.general.waylandPaste.guide.group.step2Desc", {
                          defaultValue:
                            "Group changes only take effect after a new login session. Log out of your desktop and log back in, then reopen EktosWhispr.",
                        }),
                      },
                    ],
                  },
                  {
                    key: "hasService",
                    label: t("settingsPage.general.waylandPaste.service", {
                      defaultValue: "systemd service",
                    }),
                    ok: ydotoolStatus.hasService,
                    desc: t("settingsPage.general.waylandPaste.serviceDesc", {
                      defaultValue: "User service file for auto-starting ydotoold",
                    }),
                    steps: [
                      {
                        title: t("settingsPage.general.waylandPaste.guide.service.step1Title", {
                          defaultValue: "Create the service directory",
                        }),
                        cmds: [{ cmd: "mkdir -p ~/.config/systemd/user" }],
                      },
                      {
                        title: t("settingsPage.general.waylandPaste.guide.service.step2Title", {
                          defaultValue: "Create the service file",
                        }),
                        desc: t("settingsPage.general.waylandPaste.guide.service.step2Desc", {
                          defaultValue:
                            "This creates a user-level systemd service that starts ydotoold automatically when you log in.",
                        }),
                        cmds: [
                          {
                            cmd: `cat > ~/.config/systemd/user/ydotoold.service << 'EOF'
[Unit]
Description=ydotoold - ydotool daemon
After=graphical-session.target
PartOf=graphical-session.target

[Service]
ExecStart=/usr/bin/ydotoold
Restart=on-failure
RestartSec=1s

[Install]
WantedBy=graphical-session.target
EOF`,
                          },
                        ],
                      },
                      {
                        title: t("settingsPage.general.waylandPaste.guide.service.step3Title", {
                          defaultValue: "Reload and enable",
                        }),
                        cmds: [
                          {
                            cmd: "systemctl --user daemon-reload && systemctl --user enable ydotoold",
                          },
                        ],
                      },
                    ],
                  },
                  {
                    key: "daemonRunning",
                    label: t("settingsPage.general.waylandPaste.daemon", {
                      defaultValue: "ydotoold daemon",
                    }),
                    ok: ydotoolStatus.daemonRunning,
                    desc: t("settingsPage.general.waylandPaste.daemonDesc", {
                      defaultValue: "Background service must be running",
                    }),
                    steps: [
                      {
                        title: t("settingsPage.general.waylandPaste.guide.daemon.step1Title", {
                          defaultValue: "Start the daemon",
                        }),
                        desc: t("settingsPage.general.waylandPaste.guide.daemon.step1Desc", {
                          defaultValue: "Start ydotoold and enable it so it runs on every login.",
                        }),
                        cmds: [
                          {
                            cmd: "systemctl --user enable ydotoold && systemctl --user start ydotoold",
                          },
                          {
                            label: "Arch Linux (service is named ydotool.service)",
                            cmd: "systemctl --user enable --now ydotool.service",
                          },
                        ],
                      },
                      {
                        title: t("settingsPage.general.waylandPaste.guide.daemon.step2Title", {
                          defaultValue: "Verify it's running",
                        }),
                        cmds: [
                          { cmd: "systemctl --user status ydotoold" },
                          {
                            label: "Arch Linux",
                            cmd: "systemctl --user status ydotool.service",
                          },
                        ],
                      },
                    ],
                  },
                ];

                if (ydotoolStatus.isKde) {
                  checks.push({
                    key: "hasXclip",
                    label: "xclip",
                    ok: ydotoolStatus.hasXclip || ydotoolStatus.hasXsel || false,
                    desc: t("settingsPage.general.waylandPaste.xclipDesc", {
                      defaultValue: "Clipboard tool for KDE Wayland paste (xclip or xsel)",
                    }),
                    steps: [
                      {
                        title: t("settingsPage.general.waylandPaste.guide.xclip.step1Title", {
                          defaultValue: "Install xclip",
                        }),
                        cmds: [
                          { cmd: "sudo dnf install xclip  # Fedora" },
                          { cmd: "sudo apt install xclip  # Debian/Ubuntu" },
                        ],
                      },
                    ],
                  });
                }

                const allOk = checks.every((c) => c.ok);
                const activeGuide = checks.find((c) => c.key === ydotoolGuideKey);

                return (
                  <>
                    {allOk ? (
                      <SettingsPanel>
                        <SettingsPanelRow>
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <CircleCheck className="h-4 w-4 text-emerald-500" />
                              <span className="text-sm">
                                {t("settingsPage.general.waylandPaste.allGoodDesc", {
                                  defaultValue: "Auto-paste is ready to go.",
                                })}
                              </span>
                            </div>
                            <button
                              onClick={refreshYdotoolStatus}
                              className="shrink-0 text-muted-foreground hover:text-foreground transition-colors"
                            >
                              <RotateCw className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </SettingsPanelRow>
                      </SettingsPanel>
                    ) : (
                      <>
                        <SettingsPanel>
                          {checks.map((item) => (
                            <SettingsPanelRow key={item.key}>
                              <div className="flex items-center gap-2.5">
                                {item.ok ? (
                                  <CircleCheck className="h-4 w-4 shrink-0 text-emerald-500" />
                                ) : (
                                  <CircleX className="h-4 w-4 shrink-0 text-red-500" />
                                )}
                                <div className="flex-1 min-w-0">
                                  <span className="text-sm font-medium">{item.label}</span>
                                  <span className="text-xs text-muted-foreground ml-2">
                                    {item.desc}
                                  </span>
                                  {item.note && (
                                    <p className="text-[11px] text-amber-600 dark:text-amber-400 mt-0.5">
                                      {item.note}
                                    </p>
                                  )}
                                </div>
                                {!item.ok && (
                                  <button
                                    onClick={() => setYdotoolGuideKey(item.key)}
                                    className="shrink-0 flex items-center gap-1 text-xs px-2.5 py-1 rounded-md border border-border hover:bg-muted transition-colors text-foreground"
                                  >
                                    <BookOpen className="w-3 h-3" />
                                    {t("settingsPage.general.waylandPaste.guide.open", {
                                      defaultValue: "Guide",
                                    })}
                                  </button>
                                )}
                              </div>
                            </SettingsPanelRow>
                          ))}
                        </SettingsPanel>
                        <button
                          onClick={refreshYdotoolStatus}
                          className="flex items-center gap-1.5 mt-3 text-xs text-muted-foreground hover:text-foreground transition-colors"
                        >
                          <RotateCw className="w-3 h-3" />
                          {t("settingsPage.general.waylandPaste.recheck", {
                            defaultValue: "Re-check",
                          })}
                        </button>
                      </>
                    )}

                    {/* Step-by-step guide dialog */}
                    <Dialog
                      open={!!activeGuide}
                      onOpenChange={(open) => !open && setYdotoolGuideKey(null)}
                    >
                      <DialogContent className="sm:max-w-lg max-h-[80vh] overflow-y-auto">
                        {activeGuide && (
                          <>
                            <DialogHeader>
                              <DialogTitle className="flex items-center gap-2">
                                <BookOpen className="w-4 h-4" />
                                {activeGuide.label}
                              </DialogTitle>
                              <DialogDescription>{activeGuide.desc}</DialogDescription>
                            </DialogHeader>
                            <div className="space-y-5 mt-2">
                              {activeGuide.steps.map((step, i) => (
                                <div key={i}>
                                  <div className="flex items-start gap-3">
                                    <span className="shrink-0 w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-semibold">
                                      {i + 1}
                                    </span>
                                    <div className="flex-1 min-w-0">
                                      <p className="text-sm font-medium">{step.title}</p>
                                      {step.desc && (
                                        <p className="text-xs text-muted-foreground mt-0.5">
                                          {step.desc}
                                        </p>
                                      )}
                                      {step.cmds && step.cmds.length > 0 && (
                                        <div className="mt-2 space-y-2">
                                          {step.cmds.map((c, j) => (
                                            <div key={j}>
                                              {c.label && (
                                                <p className="text-[11px] text-muted-foreground mb-1">
                                                  {c.label}
                                                </p>
                                              )}
                                              <div className="flex items-start gap-1.5">
                                                <pre className="flex-1 text-[11px] bg-muted/60 rounded-md px-3 py-2 font-mono whitespace-pre-wrap break-all select-all overflow-x-auto">
                                                  {c.cmd}
                                                </pre>
                                                <button
                                                  onClick={() =>
                                                    navigator.clipboard.writeText(c.cmd)
                                                  }
                                                  className="shrink-0 p-1.5 rounded-md hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
                                                  title={t(
                                                    "settingsPage.general.waylandPaste.copy",
                                                    { defaultValue: "Copy" }
                                                  )}
                                                >
                                                  <Copy className="w-3.5 h-3.5" />
                                                </button>
                                              </div>
                                            </div>
                                          ))}
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </>
                        )}
                      </DialogContent>
                    </Dialog>
                  </>
                );
              })()}
            </div>
          )}
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

              {(!isUsingNativeShortcut || getCachedPlatform() === "linux") && (
                <SettingsPanelRow>
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-xs text-muted-foreground/80">
                      {t("settingsPage.general.hotkey.activationMode")}
                    </span>
                    <ActivationModeSelector value={activationMode} onChange={setActivationMode} />
                  </div>
                  {getCachedPlatform() === "linux" && activationMode === "push" && (
                    <LinuxPttSetupInfo isAvailable={linuxPttAvailable} />
                  )}
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
