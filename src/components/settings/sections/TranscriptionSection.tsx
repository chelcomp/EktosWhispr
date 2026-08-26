/**
 * Transcription section container (new L1 sidebar id: "transcription").
 *
 * Layout-only extraction from SettingsPage.tsx (Wave 2): every child, handler
 * expression and tab wrapper below was copied VERBATIM from the Speech-to-Text
 * keep-alive TabPanel and its module-local helpers. No new logic, state or IPC.
 * Shared hooks/values arrive as props; the sub-tab hook (`useSubTab`) is
 * exclusive to this block and lives here. Mount gating (`mountedSections`
 * keep-alive) stays the caller's responsibility.
 */
import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  AudioWaveform,
  Cpu,
  FileAudio,
  Info,
  Key,
  Mic,
  Network,
  Radio,
  RotateCw,
  Upload,
} from "lucide-react";
import { GpuDeviceSelector } from "./ModelsSection";
import TranscriptionModelPicker from "../../TranscriptionModelPicker";
import SelfHostedPanel from "../../SelfHostedPanel";
import { WHISPER_MODEL_INFO, PARAKEET_MODEL_INFO } from "../../../models/ModelRegistry";
import { ProviderTabs } from "../../ui/ProviderTabs";
import { MeetingTranscriptionPanel } from "../MeetingSettings";
import { UploadTranscriptionPanel } from "../UploadSettings";
import { useLocalStorage } from "../../../hooks/useLocalStorage";
import type { InferenceMode, LocalTranscriptionProvider } from "../../../types/electron";
import {
  InferenceModeSelector,
  SectionHeader,
  SettingsPanel,
  SettingsPanelRow,
  SettingsRow,
} from "../../ui/SettingsSection";
import type { InferenceModeOption } from "../../ui/SettingsSection";
import { Toggle } from "../../ui/toggle";
import { Input } from "../../ui/input";
import { Button } from "../../ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "../../ui/popover";

type SettingsToastFn = (opts: {
  title: string;
  description: string;
  variant?: "default" | "destructive" | "success";
  duration?: number;
}) => void;

const noop = () => {};

// --- Moved verbatim from SettingsPage.tsx -----------------------------------

interface TranscriptionSectionProps {
  cloudTranscriptionMode: string;
  setCloudTranscriptionMode: (mode: string) => void;
  useLocalWhisper: boolean;
  setUseLocalWhisper: (value: boolean) => void;
  updateTranscriptionSettings: (settings: { useLocalWhisper: boolean }) => void;
  cloudTranscriptionProvider: string;
  setCloudTranscriptionProvider: (provider: string) => void;
  cloudTranscriptionModel: string;
  setCloudTranscriptionModel: (model: string) => void;
  localTranscriptionProvider: string;
  setLocalTranscriptionProvider: (provider: LocalTranscriptionProvider) => void;
  whisperModel: string;
  setWhisperModel: (model: string) => void;
  parakeetModel: string;
  setParakeetModel: (model: string) => void;
  cloudTranscriptionBaseUrl?: string;
  setCloudTranscriptionBaseUrl: (url: string) => void;
  transcriptionMode: InferenceMode;
  setTranscriptionMode: (mode: InferenceMode) => void;
  remoteTranscriptionUrl: string;
  setRemoteTranscriptionUrl: (url: string) => void;
  remoteTranscriptionModel: string;
  setRemoteTranscriptionModel: (model: string) => void;
  showTranscriptionPreview: boolean;
  setShowTranscriptionPreview: (value: boolean) => void;
  toast: SettingsToastFn;
}

function TranscriptionSection({
  cloudTranscriptionMode,
  setCloudTranscriptionMode,
  useLocalWhisper,
  setUseLocalWhisper,
  updateTranscriptionSettings,
  cloudTranscriptionProvider,
  setCloudTranscriptionProvider,
  cloudTranscriptionModel,
  setCloudTranscriptionModel,
  localTranscriptionProvider,
  setLocalTranscriptionProvider,
  whisperModel,
  setWhisperModel,
  parakeetModel,
  setParakeetModel,
  cloudTranscriptionBaseUrl,
  setCloudTranscriptionBaseUrl,
  transcriptionMode,
  setTranscriptionMode,
  remoteTranscriptionUrl,
  setRemoteTranscriptionUrl,
  remoteTranscriptionModel,
  setRemoteTranscriptionModel,
  showTranscriptionPreview,
  setShowTranscriptionPreview,
  toast,
}: TranscriptionSectionProps) {
  const { t } = useTranslation();

  const selectedLocalTranscriptionModelId =
    localTranscriptionProvider === "nvidia" ? parakeetModel : whisperModel;
  const activeLocalTranscriptionModelName = selectedLocalTranscriptionModelId
    ? ((localTranscriptionProvider === "nvidia"
        ? PARAKEET_MODEL_INFO[selectedLocalTranscriptionModelId]?.name
        : WHISPER_MODEL_INFO[selectedLocalTranscriptionModelId]?.name) ??
      selectedLocalTranscriptionModelId)
    : undefined;

  const transcriptionModes: InferenceModeOption[] = [
    {
      id: "providers",
      label: t("settingsPage.transcription.modes.providers"),
      description: t("settingsPage.transcription.modes.providersDesc"),
      icon: <Key className="w-4 h-4" />,
    },
    {
      id: "local",
      label: t("settingsPage.transcription.modes.local"),
      description: t("settingsPage.transcription.modes.localDesc"),
      icon: <Cpu className="w-4 h-4" />,
      activeLabel: activeLocalTranscriptionModelName,
    },
    {
      id: "self-hosted",
      label: t("settingsPage.transcription.modes.selfHosted"),
      description: t("settingsPage.transcription.modes.selfHostedDesc"),
      icon: <Network className="w-4 h-4" />,
    },
  ];

  const handleTranscriptionModeSelect = (mode: InferenceMode) => {
    if (mode === transcriptionMode) return;
    setTranscriptionMode(mode);
    setUseLocalWhisper(mode === "local");
    updateTranscriptionSettings({ useLocalWhisper: mode === "local" });
    setCloudTranscriptionMode("byok");

    const toastKey =
      {
        providers: "switchedProviders",
        local: "switchedLocal",
        "self-hosted": "switchedSelfHosted",
      }[mode as "providers" | "local" | "self-hosted"] ?? "switchedProviders";
    toast({
      title: t(`settingsPage.transcription.toasts.${toastKey}.title`),
      description: t(`settingsPage.transcription.toasts.${toastKey}.description`),
      variant: "success",
      duration: 3000,
    });
  };

  const handleLocalModelSelect = useCallback(
    (modelId: string) => {
      if (localTranscriptionProvider === "nvidia") {
        setParakeetModel(modelId);
      } else {
        setWhisperModel(modelId);
      }
    },
    [localTranscriptionProvider, setParakeetModel, setWhisperModel]
  );

  const renderPreviewToggle = () => (
    <SettingsPanel>
      <SettingsPanelRow>
        <SettingsRow
          label={t("settingsPage.transcription.transcriptionPreview")}
          description={t("settingsPage.transcription.transcriptionPreviewDescription")}
        >
          <Toggle checked={showTranscriptionPreview} onChange={setShowTranscriptionPreview} />
        </SettingsRow>
      </SettingsPanelRow>
    </SettingsPanel>
  );

  const renderTranscriptionPicker = (mode?: "cloud" | "local") => (
    <TranscriptionModelPicker
      selectedCloudProvider={cloudTranscriptionProvider}
      onCloudProviderSelect={setCloudTranscriptionProvider}
      selectedCloudModel={cloudTranscriptionModel}
      onCloudModelSelect={setCloudTranscriptionModel}
      selectedLocalModel={localTranscriptionProvider === "nvidia" ? parakeetModel : whisperModel}
      onLocalModelSelect={handleLocalModelSelect}
      selectedLocalProvider={localTranscriptionProvider}
      onLocalProviderSelect={setLocalTranscriptionProvider}
      useLocalWhisper={mode === "local" || (!mode && useLocalWhisper)}
      onModeChange={
        mode
          ? noop
          : (isLocal) => {
              setUseLocalWhisper(isLocal);
              updateTranscriptionSettings({ useLocalWhisper: isLocal });
              if (isLocal) setCloudTranscriptionMode("byok");
            }
      }
      mode={mode}
      cloudTranscriptionBaseUrl={cloudTranscriptionBaseUrl}
      setCloudTranscriptionBaseUrl={setCloudTranscriptionBaseUrl}
      variant="settings"
    />
  );

  return (
    <div className="space-y-4">
      <InferenceModeSelector
        modes={transcriptionModes}
        activeMode={transcriptionMode}
        onSelect={handleTranscriptionModeSelect}
      />

      {transcriptionMode === "providers" && renderTranscriptionPicker("cloud")}
      {transcriptionMode === "local" && (
        <>
          {renderTranscriptionPicker("local")}
          {renderPreviewToggle()}
        </>
      )}

      {transcriptionMode === "self-hosted" && (
        <SelfHostedPanel
          service="transcription"
          url={remoteTranscriptionUrl}
          onUrlChange={setRemoteTranscriptionUrl}
          model={remoteTranscriptionModel}
          onModelChange={setRemoteTranscriptionModel}
        />
      )}

      <GpuDeviceSelector purpose="transcription" />
    </div>
  );
}

// Settings → Speech-to-Text → Dictation's screen-context controls (see
// docs/specs/active-window-screen-context.md's "Settings & IPC" Design
// section). Hidden entirely on non-Windows platforms (feature absent, not
// erroring) — matches the toggle's own no-op behavior on macOS/Linux.
export function ScreenContextSettingsSection({
  includeActiveWindowContext,
  setIncludeActiveWindowContext,
  screenContextOcrEngine,
  setScreenContextOcrEngine,
  persistActiveWindowScreenshots,
  setPersistActiveWindowScreenshots,
}: {
  includeActiveWindowContext: boolean;
  setIncludeActiveWindowContext: (v: boolean) => void;
  screenContextOcrEngine: "auto" | "native" | "tesseract";
  setScreenContextOcrEngine: (v: "auto" | "native" | "tesseract") => void;
  persistActiveWindowScreenshots: boolean;
  setPersistActiveWindowScreenshots: (v: boolean) => void;
}) {
  const { t } = useTranslation();
  const [platformSupported, setPlatformSupported] = useState(true);
  const [tesseractStatus, setTesseractStatus] = useState<{
    supported: boolean;
    downloaded: boolean;
    downloading: boolean;
  }>({ supported: true, downloaded: false, downloading: false });
  const [downloadProgress, setDownloadProgress] = useState(0);

  useEffect(() => {
    window.electronAPI
      ?.getActiveWindowContextPlatformSupport?.()
      .then((result: { supported: boolean }) => setPlatformSupported(!!result?.supported))
      .catch(() => setPlatformSupported(false));
  }, []);

  const refreshTesseractStatus = () => {
    window.electronAPI
      ?.getTesseractOcrStatus?.()
      .then((status: { supported: boolean; downloaded: boolean; downloading: boolean }) => {
        if (status) setTesseractStatus(status);
      })
      .catch(() => {});
  };

  useEffect(() => {
    refreshTesseractStatus();
    const dispose = window.electronAPI?.onTesseractOcrDownloadProgress?.(
      (data: { progress: number }) => setDownloadProgress(Math.round((data?.progress || 0) * 100))
    );
    return () => dispose?.();
  }, []);

  if (!platformSupported) return null;

  const needsTesseractDownload =
    (screenContextOcrEngine === "tesseract" || screenContextOcrEngine === "auto") &&
    !tesseractStatus.downloaded &&
    !tesseractStatus.downloading;

  const handleDownloadTesseract = async () => {
    setDownloadProgress(0);
    await window.electronAPI?.downloadTesseractOcrAssets?.();
    refreshTesseractStatus();
  };

  return (
    <div>
      <SectionHeader
        title={t("settingsPage.screenContext.title")}
        description={t("settingsPage.screenContext.description")}
      />
      <SettingsPanel>
        <SettingsPanelRow>
          <SettingsRow
            label={t("settingsPage.screenContext.toggleLabel")}
            description={t("settingsPage.screenContext.toggleDescription")}
          >
            <Toggle checked={includeActiveWindowContext} onChange={setIncludeActiveWindowContext} />
          </SettingsRow>
        </SettingsPanelRow>
        {includeActiveWindowContext && (
          <>
            <SettingsPanelRow>
              <SettingsRow
                label={t("settingsPage.screenContext.engineLabel")}
                description={t("settingsPage.screenContext.engineDescription")}
              >
                <select
                  value={screenContextOcrEngine}
                  onChange={(e) =>
                    setScreenContextOcrEngine(e.target.value as "auto" | "native" | "tesseract")
                  }
                  className="h-7 rounded border border-border/70 bg-surface-1/80 px-2.5 text-xs font-medium text-foreground shadow-sm backdrop-blur-sm hover:border-border-hover hover:bg-surface-2/70 focus:outline-none focus:ring-2 focus:ring-ring/30 focus:ring-offset-1 transition-colors duration-200"
                >
                  <option value="auto">{t("settingsPage.screenContext.engineAuto")}</option>
                  <option value="native">{t("settingsPage.screenContext.engineNative")}</option>
                  <option value="tesseract">
                    {t("settingsPage.screenContext.engineTesseract")}
                  </option>
                </select>
              </SettingsRow>
            </SettingsPanelRow>
            {needsTesseractDownload && (
              <SettingsPanelRow>
                <div className="flex items-center justify-between gap-3 px-3 py-2 rounded-md border border-border/60">
                  <span className="text-xs text-muted-foreground">
                    {t("settingsPage.screenContext.tesseractDownloadRequired")}
                  </span>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 text-xs"
                    onClick={handleDownloadTesseract}
                  >
                    {t("settingsPage.screenContext.downloadButton")}
                  </Button>
                </div>
              </SettingsPanelRow>
            )}
            {tesseractStatus.downloading && (
              <SettingsPanelRow>
                <div className="w-full h-1.5 rounded bg-surface-2/70 overflow-hidden">
                  <div
                    className="h-full bg-primary transition-all"
                    style={{ width: `${downloadProgress}%` }}
                  />
                </div>
              </SettingsPanelRow>
            )}
            <SettingsPanelRow>
              <SettingsRow
                label={t("settingsPage.screenContext.persistLabel")}
                description={t("settingsPage.screenContext.persistDescription")}
              >
                <Toggle
                  checked={persistActiveWindowScreenshots}
                  onChange={setPersistActiveWindowScreenshots}
                />
              </SettingsRow>
            </SettingsPanelRow>
          </>
        )}
      </SettingsPanel>
    </div>
  );
}

// Settings → Speech-to-Text → Dictation's dynamic-vocabulary controls (see
// docs/specs/dynamic-prompt-vocabulary.md). The master toggle defaults ON;
// the OCR-derived-vocabulary toggle defaults OFF and only has any effect
// while the master toggle is on.
export function DynamicVocabularySettingsSection({
  dynamicPromptVocabularyEnabled,
  setDynamicPromptVocabularyEnabled,
  dynamicPromptVocabularyIncludeScreenContext,
  setDynamicPromptVocabularyIncludeScreenContext,
}: {
  dynamicPromptVocabularyEnabled: boolean;
  setDynamicPromptVocabularyEnabled: (v: boolean) => void;
  dynamicPromptVocabularyIncludeScreenContext: boolean;
  setDynamicPromptVocabularyIncludeScreenContext: (v: boolean) => void;
}) {
  const { t } = useTranslation();
  return (
    <div>
      <SectionHeader
        title={t("settingsPage.dynamicVocabulary.title")}
        description={t("settingsPage.dynamicVocabulary.description")}
      />
      <SettingsPanel>
        <SettingsPanelRow>
          <SettingsRow
            label={t("settingsPage.dynamicVocabulary.toggleLabel")}
            description={t("settingsPage.dynamicVocabulary.toggleDescription")}
          >
            <Toggle
              checked={dynamicPromptVocabularyEnabled}
              onChange={setDynamicPromptVocabularyEnabled}
            />
          </SettingsRow>
        </SettingsPanelRow>
        {dynamicPromptVocabularyEnabled && (
          <SettingsPanelRow>
            <SettingsRow
              label={t("settingsPage.dynamicVocabulary.includeScreenContextLabel")}
              description={t("settingsPage.dynamicVocabulary.includeScreenContextDescription")}
            >
              <Toggle
                checked={dynamicPromptVocabularyIncludeScreenContext}
                onChange={setDynamicPromptVocabularyIncludeScreenContext}
              />
            </SettingsRow>
          </SettingsPanelRow>
        )}
      </SettingsPanel>
    </div>
  );
}

export function DictationVadTabs({
  initialTab,
  renderPreviewVadSettings,
  renderWhisperVadSettings,
}: {
  initialTab?: "live" | "silero";
  renderPreviewVadSettings: () => React.ReactNode;
  renderWhisperVadSettings?: () => React.ReactNode;
}) {
  const { t } = useTranslation();
  const VAD_TABS = ["live", "silero"] as const;
  const [tab, setTab] = useSubTab<"live" | "silero">(
    "settings.dictationVadTab",
    VAD_TABS,
    initialTab
  );

  if (!renderWhisperVadSettings) {
    return <div className="space-y-4">{renderPreviewVadSettings()}</div>;
  }

  const subTabs = [
    { id: "live", name: t("settingsPage.speechToText.vadTabs.live") },
    { id: "silero", name: t("settingsPage.speechToText.vadTabs.silero") },
  ];

  return (
    <div className="space-y-4">
      <ProviderTabs
        providers={subTabs}
        selectedId={tab}
        onSelect={(id) => setTab(id as "live" | "silero")}
        renderIcon={(id) =>
          id === "live" ? (
            <Radio className="w-3.5 h-3.5" />
          ) : (
            <AudioWaveform className="w-3.5 h-3.5" />
          )
        }
      />
      <TabPanel active={tab === "live"}>{renderPreviewVadSettings()}</TabPanel>
      <TabPanel active={tab === "silero"}>{renderWhisperVadSettings()}</TabPanel>
    </div>
  );
}

// ----------------------------------------------------------------------------

type SpeechTab = "dictation" | "noteRecording" | "upload";

const SPEECH_TABS: SpeechTab[] = ["dictation", "noteRecording", "upload"];

function useSubTab<T extends string>(storageKey: string, options: readonly T[], initial?: T) {
  const [tab, setTab] = useLocalStorage<T>(storageKey, initial ?? options[0]);
  useEffect(() => {
    if (initial && initial !== tab) setTab(initial);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initial]);
  const safeTab = options.includes(tab) ? tab : options[0];
  return [safeTab, setTab] as const;
}

function VADLabelWithInfo({ label, description }: { label: string; description: string }) {
  return (
    <div className="inline-flex items-center gap-1.5 text-xs font-medium text-foreground">
      <span>{label}</span>
      <Popover>
        <PopoverTrigger asChild>
          <button
            type="button"
            className="inline-flex items-center justify-center rounded-sm text-muted-foreground hover:text-foreground transition-colors"
            aria-label={label}
          >
            <Info className="h-3.5 w-3.5" />
          </button>
        </PopoverTrigger>
        <PopoverContent side="top" align="start" className="max-w-sm p-3">
          <p className="text-xs leading-relaxed text-muted-foreground">{description}</p>
        </PopoverContent>
      </Popover>
    </div>
  );
}

function TabPanel({ active, children }: { active: boolean; children: React.ReactNode }) {
  return <div className={active ? undefined : "hidden"}>{children}</div>;
}

function SpeechToTextTabs({
  initialTab,
  renderDictation,
  renderNoteRecording,
  renderUpload,
}: {
  initialTab?: SpeechTab;
  renderDictation: () => React.ReactNode;
  renderNoteRecording: () => React.ReactNode;
  renderUpload: () => React.ReactNode;
}) {
  const { t } = useTranslation();
  const [tab, setTab] = useSubTab<SpeechTab>("settings.speechToTextTab", SPEECH_TABS, initialTab);

  const subTabs = [
    { id: "dictation", name: t("settingsPage.speechToText.tabs.dictation") },
    { id: "noteRecording", name: t("settingsPage.speechToText.tabs.noteRecording") },
    { id: "upload", name: t("settingsPage.speechToText.tabs.upload") },
  ];

  return (
    <div className="space-y-4">
      <SectionHeader
        title={t("settingsPage.speechToText.title")}
        description={t("settingsPage.speechToText.description")}
      />
      <ProviderTabs
        providers={subTabs}
        selectedId={tab}
        onSelect={(id) => setTab(id as SpeechTab)}
        renderIcon={(id) =>
          id === "dictation" ? (
            <Mic className="w-3.5 h-3.5" />
          ) : id === "upload" ? (
            <Upload className="w-3.5 h-3.5" />
          ) : (
            <FileAudio className="w-3.5 h-3.5" />
          )
        }
      />
      <TabPanel active={tab === "dictation"}>{renderDictation()}</TabPanel>
      <TabPanel active={tab === "noteRecording"}>{renderNoteRecording()}</TabPanel>
      <TabPanel active={tab === "upload"}>{renderUpload()}</TabPanel>
    </div>
  );
}

// ----------------------------------------------------------------------------
// Section container

export interface TranscriptionSectionContainerProps {
  /** Legacy deep-link support: selects the initially shown sub-tab. */
  initialTab?: string;
  // Provider/mode picker (former TranscriptionSection panel)
  cloudTranscriptionMode: string;
  setCloudTranscriptionMode: (mode: string) => void;
  useLocalWhisper: boolean;
  setUseLocalWhisper: (value: boolean) => void;
  updateTranscriptionSettings: (settings: { useLocalWhisper: boolean }) => void;
  cloudTranscriptionProvider: string;
  setCloudTranscriptionProvider: (provider: string) => void;
  cloudTranscriptionModel: string;
  setCloudTranscriptionModel: (model: string) => void;
  localTranscriptionProvider: string;
  setLocalTranscriptionProvider: (provider: LocalTranscriptionProvider) => void;
  whisperModel: string;
  setWhisperModel: (model: string) => void;
  parakeetModel: string;
  setParakeetModel: (model: string) => void;
  cloudTranscriptionBaseUrl?: string;
  setCloudTranscriptionBaseUrl: (url: string) => void;
  transcriptionMode: InferenceMode;
  setTranscriptionMode: (mode: InferenceMode) => void;
  remoteTranscriptionUrl: string;
  setRemoteTranscriptionUrl: (url: string) => void;
  remoteTranscriptionModel: string;
  setRemoteTranscriptionModel: (model: string) => void;
  showTranscriptionPreview: boolean;
  setShowTranscriptionPreview: (value: boolean) => void;
  toast: SettingsToastFn;
  // Screen context
  includeActiveWindowContext: boolean;
  setIncludeActiveWindowContext: (v: boolean) => void;
  screenContextOcrEngine: "auto" | "native" | "tesseract";
  setScreenContextOcrEngine: (v: "auto" | "native" | "tesseract") => void;
  persistActiveWindowScreenshots: boolean;
  setPersistActiveWindowScreenshots: (v: boolean) => void;
  // Dynamic vocabulary
  dynamicPromptVocabularyEnabled: boolean;
  setDynamicPromptVocabularyEnabled: (v: boolean) => void;
  dynamicPromptVocabularyIncludeScreenContext: boolean;
  setDynamicPromptVocabularyIncludeScreenContext: (v: boolean) => void;
  // Silero VAD toggles (whisper renderer)
  dictationSileroEnabled: boolean;
  setDictationSileroEnabled: (value: boolean) => void;
  noteRecordingSileroEnabled: boolean;
  setNoteRecordingSileroEnabled: (value: boolean) => void;
  meetingSileroEnabled: boolean;
  setMeetingSileroEnabled: (value: boolean) => void;
  meetingAecEnabled: boolean;
  setMeetingAecEnabled: (value: boolean) => void;
  // Whisper VAD fields
  whisperVadThreshold: number;
  setWhisperVadThreshold: (value: number) => void;
  whisperVadMinSpeechDurationMs: number;
  setWhisperVadMinSpeechDurationMs: (value: number) => void;
  whisperVadMinSilenceDurationMs: number;
  setWhisperVadMinSilenceDurationMs: (value: number) => void;
  whisperVadMaxSpeechDurationS: number;
  setWhisperVadMaxSpeechDurationS: (value: number) => void;
  whisperVadSpeechPadMs: number;
  setWhisperVadSpeechPadMs: (value: number) => void;
  whisperVadSamplesOverlap: number;
  setWhisperVadSamplesOverlap: (value: number) => void;
  resetWhisperVad: () => void;
  // Preview VAD fields
  previewVadMinSpeechDurationMs: number;
  setPreviewVadMinSpeechDurationMs: (value: number) => void;
  previewVadMinSilenceDurationMs: number;
  setPreviewVadMinSilenceDurationMs: (value: number) => void;
  previewVadSpeechPadMs: number;
  setPreviewVadSpeechPadMs: (value: number) => void;
  previewVadMaxSpeechDurationS: number;
  setPreviewVadMaxSpeechDurationS: (value: number) => void;
  previewVadSamplesOverlap: number;
  setPreviewVadSamplesOverlap: (value: number) => void;
  previewVadEnergyThreshold: number;
  setPreviewVadEnergyThreshold: (value: number) => void;
  previewVadMinSegmentRms: number;
  setPreviewVadMinSegmentRms: (value: number) => void;
  previewVadNoiseFloorFactor: number;
  setPreviewVadNoiseFloorFactor: (value: number) => void;
  previewVadNoiseFloorAlpha: number;
  setPreviewVadNoiseFloorAlpha: (value: number) => void;
  previewVadMaxMerges: number;
  setPreviewVadMaxMerges: (value: number) => void;
  previewVadMaxMergedMs: number;
  setPreviewVadMaxMergedMs: (value: number) => void;
  resetPreviewVadDefaults: () => void;
}

/**
 * New "transcription" section: the former Speech-to-Text keep-alive TabPanel.
 * The VAD renderers moved inside — their ~40 VAD fields and the
 * `resetWhisperVad`/`resetPreviewVadDefaults` selectors arrive as props
 * instead of being read from the settings store here.
 */
function TranscriptionSectionContainer({
  initialTab,
  cloudTranscriptionMode,
  setCloudTranscriptionMode,
  useLocalWhisper,
  setUseLocalWhisper,
  updateTranscriptionSettings,
  cloudTranscriptionProvider,
  setCloudTranscriptionProvider,
  cloudTranscriptionModel,
  setCloudTranscriptionModel,
  localTranscriptionProvider,
  setLocalTranscriptionProvider,
  whisperModel,
  setWhisperModel,
  parakeetModel,
  setParakeetModel,
  cloudTranscriptionBaseUrl,
  setCloudTranscriptionBaseUrl,
  transcriptionMode,
  setTranscriptionMode,
  remoteTranscriptionUrl,
  setRemoteTranscriptionUrl,
  remoteTranscriptionModel,
  setRemoteTranscriptionModel,
  showTranscriptionPreview,
  setShowTranscriptionPreview,
  toast,
  includeActiveWindowContext,
  setIncludeActiveWindowContext,
  screenContextOcrEngine,
  setScreenContextOcrEngine,
  persistActiveWindowScreenshots,
  setPersistActiveWindowScreenshots,
  dynamicPromptVocabularyEnabled,
  setDynamicPromptVocabularyEnabled,
  dynamicPromptVocabularyIncludeScreenContext,
  setDynamicPromptVocabularyIncludeScreenContext,
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
  resetWhisperVad,
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
  resetPreviewVadDefaults,
}: TranscriptionSectionContainerProps) {
  const { t } = useTranslation();

  const renderWhisperVadSettings = () => (
    <div>
      <SectionHeader
        title={t("settingsPage.transcription.vad.title")}
        description={t("settingsPage.transcription.vad.description")}
      />
      <SettingsPanel>
        <SettingsPanelRow>
          <SettingsRow
            label={t("settingsPage.transcription.vad.toggles.dictation.title")}
            description={t("settingsPage.transcription.vad.toggles.dictation.description")}
          >
            <Toggle checked={dictationSileroEnabled} onChange={setDictationSileroEnabled} />
          </SettingsRow>
        </SettingsPanelRow>
        <SettingsPanelRow>
          <SettingsRow
            label={t("settingsPage.transcription.vad.toggles.noteRecording.title")}
            description={t("settingsPage.transcription.vad.toggles.noteRecording.description")}
          >
            <Toggle checked={noteRecordingSileroEnabled} onChange={setNoteRecordingSileroEnabled} />
          </SettingsRow>
        </SettingsPanelRow>
        <SettingsPanelRow>
          <SettingsRow
            label={t("settingsPage.transcription.vad.toggles.meeting.title")}
            description={t("settingsPage.transcription.vad.toggles.meeting.description")}
          >
            <Toggle checked={meetingSileroEnabled} onChange={setMeetingSileroEnabled} />
          </SettingsRow>
        </SettingsPanelRow>
        <SettingsPanelRow>
          <SettingsRow
            label={t("settingsPage.transcription.aec.toggle.title")}
            description={t("settingsPage.transcription.aec.toggle.description")}
          >
            <Toggle checked={meetingAecEnabled} onChange={setMeetingAecEnabled} />
          </SettingsRow>
        </SettingsPanelRow>
        <SettingsPanelRow>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full">
            <div className="space-y-1.5">
              <VADLabelWithInfo
                label={t("settingsPage.transcription.vad.fields.threshold.label")}
                description={t("settingsPage.transcription.vad.fields.threshold.info")}
              />
              <Input
                type="number"
                step="0.01"
                min="0.1"
                max="0.95"
                value={whisperVadThreshold}
                onChange={(e) => setWhisperVadThreshold(Number(e.target.value))}
              />
            </div>
            <div className="space-y-1.5">
              <VADLabelWithInfo
                label={t("settingsPage.transcription.vad.fields.minSpeechDurationMs.label")}
                description={t("settingsPage.transcription.vad.fields.minSpeechDurationMs.info")}
              />
              <Input
                type="number"
                step="10"
                min="50"
                max="2000"
                value={whisperVadMinSpeechDurationMs}
                onChange={(e) => setWhisperVadMinSpeechDurationMs(Number(e.target.value))}
              />
            </div>
            <div className="space-y-1.5">
              <VADLabelWithInfo
                label={t("settingsPage.transcription.vad.fields.minSilenceDurationMs.label")}
                description={t("settingsPage.transcription.vad.fields.minSilenceDurationMs.info")}
              />
              <Input
                type="number"
                step="10"
                min="50"
                max="2000"
                value={whisperVadMinSilenceDurationMs}
                onChange={(e) => setWhisperVadMinSilenceDurationMs(Number(e.target.value))}
              />
            </div>
            <div className="space-y-1.5">
              <VADLabelWithInfo
                label={t("settingsPage.transcription.vad.fields.maxSpeechDurationS.label")}
                description={t("settingsPage.transcription.vad.fields.maxSpeechDurationS.info")}
              />
              <Input
                type="number"
                step="1"
                min="5"
                max="120"
                value={whisperVadMaxSpeechDurationS}
                onChange={(e) => setWhisperVadMaxSpeechDurationS(Number(e.target.value))}
              />
            </div>
            <div className="space-y-1.5">
              <VADLabelWithInfo
                label={t("settingsPage.transcription.vad.fields.speechPadMs.label")}
                description={t("settingsPage.transcription.vad.fields.speechPadMs.info")}
              />
              <Input
                type="number"
                step="10"
                min="0"
                max="1000"
                value={whisperVadSpeechPadMs}
                onChange={(e) => setWhisperVadSpeechPadMs(Number(e.target.value))}
              />
            </div>
            <div className="space-y-1.5">
              <VADLabelWithInfo
                label={t("settingsPage.transcription.vad.fields.samplesOverlap.label")}
                description={t("settingsPage.transcription.vad.fields.samplesOverlap.info")}
              />
              <Input
                type="number"
                step="0.01"
                min="0"
                max="0.95"
                value={whisperVadSamplesOverlap}
                onChange={(e) => setWhisperVadSamplesOverlap(Number(e.target.value))}
              />
            </div>
          </div>
        </SettingsPanelRow>
        <SettingsPanelRow>
          <div className="flex justify-end w-full">
            <Button variant="ghost" size="sm" onClick={resetWhisperVad}>
              <RotateCw className="mr-1.5 h-3.5 w-3.5" />
              {t("settingsPage.transcription.vad.resetDefaults")}
            </Button>
          </div>
        </SettingsPanelRow>
      </SettingsPanel>
    </div>
  );

  const renderPreviewVadSettings = () => (
    <div>
      <SectionHeader
        title={t("settingsPage.transcription.previewVad.title")}
        description={t("settingsPage.transcription.previewVad.description")}
      />
      <SettingsPanel>
        <SettingsPanelRow>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full">
            <div className="space-y-1.5">
              <VADLabelWithInfo
                label={t("settingsPage.transcription.previewVad.fields.minSpeechDurationMs.label")}
                description={t(
                  "settingsPage.transcription.previewVad.fields.minSpeechDurationMs.info"
                )}
              />
              <Input
                type="number"
                step="10"
                min="20"
                max="500"
                value={previewVadMinSpeechDurationMs}
                onChange={(e) => setPreviewVadMinSpeechDurationMs(Number(e.target.value))}
              />
            </div>
            <div className="space-y-1.5">
              <VADLabelWithInfo
                label={t("settingsPage.transcription.previewVad.fields.minSilenceDurationMs.label")}
                description={t(
                  "settingsPage.transcription.previewVad.fields.minSilenceDurationMs.info"
                )}
              />
              <Input
                type="number"
                step="10"
                min="100"
                max="2000"
                value={previewVadMinSilenceDurationMs}
                onChange={(e) => setPreviewVadMinSilenceDurationMs(Number(e.target.value))}
              />
            </div>
            <div className="space-y-1.5">
              <VADLabelWithInfo
                label={t("settingsPage.transcription.previewVad.fields.speechPadMs.label")}
                description={t("settingsPage.transcription.previewVad.fields.speechPadMs.info")}
              />
              <Input
                type="number"
                step="10"
                min="0"
                max="500"
                value={previewVadSpeechPadMs}
                onChange={(e) => setPreviewVadSpeechPadMs(Number(e.target.value))}
              />
            </div>
            <div className="space-y-1.5">
              <VADLabelWithInfo
                label={t("settingsPage.transcription.previewVad.fields.maxSpeechDurationS.label")}
                description={t(
                  "settingsPage.transcription.previewVad.fields.maxSpeechDurationS.info"
                )}
              />
              <Input
                type="number"
                step="1"
                min="5"
                max="60"
                value={previewVadMaxSpeechDurationS}
                onChange={(e) => setPreviewVadMaxSpeechDurationS(Number(e.target.value))}
              />
            </div>
            <div className="space-y-1.5">
              <VADLabelWithInfo
                label={t("settingsPage.transcription.previewVad.fields.samplesOverlap.label")}
                description={t("settingsPage.transcription.previewVad.fields.samplesOverlap.info")}
              />
              <Input
                type="number"
                step="0.05"
                min="0"
                max="0.95"
                value={previewVadSamplesOverlap}
                onChange={(e) => setPreviewVadSamplesOverlap(Number(e.target.value))}
              />
            </div>
            <div className="space-y-1.5">
              <VADLabelWithInfo
                label={t("settingsPage.transcription.previewVad.fields.energyThreshold.label")}
                description={t("settingsPage.transcription.previewVad.fields.energyThreshold.info")}
              />
              <Input
                type="number"
                step="0.001"
                min="0.001"
                max="0.05"
                value={previewVadEnergyThreshold}
                onChange={(e) => setPreviewVadEnergyThreshold(Number(e.target.value))}
              />
            </div>
            <div className="space-y-1.5">
              <VADLabelWithInfo
                label={t("settingsPage.transcription.previewVad.fields.minSegmentRms.label")}
                description={t("settingsPage.transcription.previewVad.fields.minSegmentRms.info")}
              />
              <Input
                type="number"
                step="0.0005"
                min="0.0005"
                max="0.05"
                value={previewVadMinSegmentRms}
                onChange={(e) => setPreviewVadMinSegmentRms(Number(e.target.value))}
              />
            </div>
            <div className="space-y-1.5">
              <VADLabelWithInfo
                label={t("settingsPage.transcription.previewVad.fields.noiseFloorFactor.label")}
                description={t(
                  "settingsPage.transcription.previewVad.fields.noiseFloorFactor.info"
                )}
              />
              <Input
                type="number"
                step="0.5"
                min="1"
                max="10"
                value={previewVadNoiseFloorFactor}
                onChange={(e) => setPreviewVadNoiseFloorFactor(Number(e.target.value))}
              />
            </div>
            <div className="space-y-1.5">
              <VADLabelWithInfo
                label={t("settingsPage.transcription.previewVad.fields.noiseFloorAlpha.label")}
                description={t("settingsPage.transcription.previewVad.fields.noiseFloorAlpha.info")}
              />
              <Input
                type="number"
                step="0.01"
                min="0.01"
                max="0.5"
                value={previewVadNoiseFloorAlpha}
                onChange={(e) => setPreviewVadNoiseFloorAlpha(Number(e.target.value))}
              />
            </div>
            <div className="space-y-1.5">
              <VADLabelWithInfo
                label={t("settingsPage.transcription.previewVad.fields.maxMerges.label")}
                description={t("settingsPage.transcription.previewVad.fields.maxMerges.info")}
              />
              <Input
                type="number"
                step="1"
                min="0"
                max="10"
                value={previewVadMaxMerges}
                onChange={(e) => setPreviewVadMaxMerges(Number(e.target.value))}
              />
            </div>
            <div className="space-y-1.5">
              <VADLabelWithInfo
                label={t("settingsPage.transcription.previewVad.fields.maxMergedMs.label")}
                description={t("settingsPage.transcription.previewVad.fields.maxMergedMs.info")}
              />
              <Input
                type="number"
                step="1000"
                min="5000"
                max="60000"
                value={previewVadMaxMergedMs}
                onChange={(e) => setPreviewVadMaxMergedMs(Number(e.target.value))}
              />
            </div>
          </div>
        </SettingsPanelRow>
        <SettingsPanelRow>
          <div className="flex justify-end w-full">
            <Button variant="ghost" size="sm" onClick={resetPreviewVadDefaults}>
              <RotateCw className="mr-1.5 h-3.5 w-3.5" />
              {t("settingsPage.transcription.previewVad.resetDefaults")}
            </Button>
          </div>
        </SettingsPanelRow>
      </SettingsPanel>
    </div>
  );

  return (
    <SpeechToTextTabs
      initialTab={initialTab as SpeechTab | undefined}
      renderDictation={() => (
          <div className="space-y-6">
            <TranscriptionSection
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
            />
            {transcriptionMode === "local" && (
              <DictationVadTabs
                renderPreviewVadSettings={renderPreviewVadSettings}
                renderWhisperVadSettings={
                  localTranscriptionProvider !== "nvidia" ? renderWhisperVadSettings : undefined
                }
              />
            )}
            <ScreenContextSettingsSection
              includeActiveWindowContext={includeActiveWindowContext}
              setIncludeActiveWindowContext={setIncludeActiveWindowContext}
              screenContextOcrEngine={screenContextOcrEngine}
              setScreenContextOcrEngine={setScreenContextOcrEngine}
              persistActiveWindowScreenshots={persistActiveWindowScreenshots}
              setPersistActiveWindowScreenshots={setPersistActiveWindowScreenshots}
            />
            <DynamicVocabularySettingsSection
              dynamicPromptVocabularyEnabled={dynamicPromptVocabularyEnabled}
              setDynamicPromptVocabularyEnabled={setDynamicPromptVocabularyEnabled}
              dynamicPromptVocabularyIncludeScreenContext={
                dynamicPromptVocabularyIncludeScreenContext
              }
              setDynamicPromptVocabularyIncludeScreenContext={
                setDynamicPromptVocabularyIncludeScreenContext
              }
            />
          </div>
        )}
        renderNoteRecording={() => (
          <div className="space-y-6">
            <MeetingTranscriptionPanel />
            {transcriptionMode === "local" &&
              localTranscriptionProvider !== "nvidia" &&
              renderWhisperVadSettings()}
          </div>
        )}
        renderUpload={() => (
          <div className="space-y-6">
            <UploadTranscriptionPanel />
          </div>
        )}
    />
  );
}

export default TranscriptionSectionContainer;
