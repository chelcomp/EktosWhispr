/**
 * AI processing section container (new L1 sidebar id: "aiProcessing").
 *
 * Layout-only extraction from SettingsPage.tsx (Wave 2): the LLM keep-alive
 * TabPanel cluster (LlmsTabs + AiModelsSection + NoteFormattingSettings and
 * their children) was copied VERBATIM. No new logic, state or IPC; shared
 * values arrive as props, the sub-tab hook (`useSubTab`) is exclusive to this
 * block and lives here. Mount gating (`mountedSections` keep-alive) stays the
 * caller's responsibility.
 */
import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { BookOpen, Sparkles, Wand2 } from "lucide-react";
import ChatAgentSettings from "../ChatAgentSettings";
import DictationAgentSettings from "../DictationAgentSettings";
import InferenceConfigEditor from "../InferenceConfigEditor";
import PromptStudio from "../../ui/PromptStudio";
import { ProviderTabs } from "../../ui/ProviderTabs";
import { useLocalStorage } from "../../../hooks/useLocalStorage";
import { useSettingsStore } from "../../../stores/settingsStore";
import type { InferenceMode } from "../../../types/electron";
import {
  SectionHeader,
  SettingsPanel,
  SettingsPanelRow,
  SettingsRow,
} from "../../ui/SettingsSection";
import { Toggle } from "../../ui/toggle";

type SettingsToastFn = (opts: {
  title: string;
  description: string;
  variant?: "default" | "destructive" | "success";
  duration?: number;
}) => void;

// --- Moved verbatim from SettingsPage.tsx -----------------------------------

const CLEANUP_MODE_TOAST_KEY: Record<InferenceMode, string> = {
  providers: "switchedProviders",
  local: "switchedLocal",
  "self-hosted": "switchedSelfHosted",
  enterprise: "switchedEnterprise",
};

function NoteFormattingSettings() {
  const { t } = useTranslation();
  const autoGenerateNoteTitle = useSettingsStore((s) => s.autoGenerateNoteTitle);
  const setAutoGenerateNoteTitle = useSettingsStore((s) => s.setAutoGenerateNoteTitle);

  return (
    <div className="space-y-4">
      <SettingsPanel>
        <SettingsPanelRow>
          <SettingsRow
            label={t("settingsPage.noteFormatting.autoGenerateTitle")}
            description={t("settingsPage.noteFormatting.autoGenerateTitleDescription")}
          >
            <Toggle checked={autoGenerateNoteTitle} onChange={setAutoGenerateNoteTitle} />
          </SettingsRow>
        </SettingsPanelRow>
      </SettingsPanel>
      <InferenceConfigEditor scope="noteFormatting" />
    </div>
  );
}

interface AiModelsSectionProps {
  useCleanupModel: boolean;
  setUseCleanupModel: (value: boolean) => void;
  toast: SettingsToastFn;
}

function AiModelsSection({ useCleanupModel, setUseCleanupModel, toast }: AiModelsSectionProps) {
  const { t } = useTranslation();

  const handleCleanupModeChange = (mode: InferenceMode) => {
    const toastKey = CLEANUP_MODE_TOAST_KEY[mode];
    toast({
      title: t(`settingsPage.aiModels.toasts.${toastKey}.title`),
      description: t(`settingsPage.aiModels.toasts.${toastKey}.description`),
      variant: "success",
      duration: 3000,
    });
  };

  return (
    <div className="space-y-4">
      <SettingsPanel>
        <SettingsPanelRow>
          <SettingsRow
            label={t("settingsPage.aiModels.enableTextCleanup")}
            description={t("settingsPage.aiModels.enableTextCleanupDescription")}
          >
            <Toggle checked={useCleanupModel} onChange={setUseCleanupModel} />
          </SettingsRow>
        </SettingsPanelRow>
      </SettingsPanel>

      {useCleanupModel && (
        <InferenceConfigEditor scope="dictationCleanup" onModeChange={handleCleanupModeChange} />
      )}
    </div>
  );
}

type LlmTab = "dictationCleanup" | "dictationAgent" | "noteFormatting" | "chatIntelligence";

const LLM_TABS: LlmTab[] = [
  "dictationCleanup",
  "dictationAgent",
  "noteFormatting",
  "chatIntelligence",
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

function LlmsTabs({
  initialTab,
  renderDictationCleanup,
  renderDictationAgent,
  renderNoteFormatting,
  renderChatIntelligence,
}: {
  initialTab?: LlmTab;
  renderDictationCleanup: () => React.ReactNode;
  renderDictationAgent: () => React.ReactNode;
  renderNoteFormatting: () => React.ReactNode;
  renderChatIntelligence: () => React.ReactNode;
}) {
  const { t } = useTranslation();
  const [tab, setTab] = useSubTab<LlmTab>("settings.llmsTab", LLM_TABS, initialTab);

  const subTabs = [
    { id: "dictationCleanup", name: t("settingsPage.llms.tabs.dictationCleanup") },
    { id: "dictationAgent", name: t("settingsPage.llms.tabs.dictationAgent") },
    { id: "noteFormatting", name: t("settingsPage.llms.tabs.noteFormatting") },
    { id: "chatIntelligence", name: t("settingsPage.llms.tabs.chatIntelligence") },
  ];

  return (
    <div className="space-y-4">
      <SectionHeader
        title={t("settingsPage.llms.title")}
        description={t("settingsPage.llms.description")}
      />
      <ProviderTabs
        providers={subTabs}
        selectedId={tab}
        onSelect={(id) => setTab(id as LlmTab)}
        renderIcon={(id) => {
          if (id === "dictationCleanup") return <Wand2 className="w-3.5 h-3.5" />;
          if (id === "dictationAgent") return <Sparkles className="w-3.5 h-3.5" />;
          if (id === "noteFormatting") return <BookOpen className="w-3.5 h-3.5" />;
          return <Wand2 className="w-3.5 h-3.5" />;
        }}
      />
      <TabPanel active={tab === "dictationCleanup"}>{renderDictationCleanup()}</TabPanel>
      <TabPanel active={tab === "dictationAgent"}>{renderDictationAgent()}</TabPanel>
      <TabPanel active={tab === "noteFormatting"}>{renderNoteFormatting()}</TabPanel>
      <TabPanel active={tab === "chatIntelligence"}>{renderChatIntelligence()}</TabPanel>
    </div>
  );
}

// ----------------------------------------------------------------------------
// Section container

export interface AIProcessingSectionProps {
  /** Legacy deep-link support: selects the initially shown sub-tab. */
  initialTab?: string;
  /** Gates all cleanup model wiring: when off, no cleanup model is pre-warmed. */
  useCleanupModel: boolean;
  updateCleanupSettings: (settings: { useCleanupModel: boolean }) => void;
  toast: SettingsToastFn;
}

/**
 * New "aiProcessing" section: the former LLMS keep-alive TabPanel with its
 * four sub-tabs (dictationCleanup | dictationAgent | noteFormatting |
 * chatIntelligence). Falls back to the first tab when `initialTab` is absent
 * or points at a removed tab (useSubTab default behavior).
 */
export default function AIProcessingSection({
  initialTab,
  useCleanupModel,
  updateCleanupSettings,
  toast,
}: AIProcessingSectionProps) {
  const { t } = useTranslation();

  return (
    <LlmsTabs
      initialTab={initialTab as LlmTab | undefined}
      renderChatIntelligence={() => <ChatAgentSettings />}
      renderDictationCleanup={() => (
        <div className="space-y-6">
          <AiModelsSection
            useCleanupModel={useCleanupModel}
            setUseCleanupModel={(value) => {
              updateCleanupSettings({ useCleanupModel: value });
            }}
            toast={toast}
          />
          <div className="border-t border-border/40 pt-6">
            <SectionHeader
              title={t("settingsPage.prompts.title")}
              description={t("settingsPage.prompts.description")}
            />
            <PromptStudio />
          </div>
        </div>
      )}
      renderDictationAgent={() => <DictationAgentSettings />}
      renderNoteFormatting={() => <NoteFormattingSettings />}
    />
  );
}
