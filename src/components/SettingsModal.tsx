import React, { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Mic,
  AudioWaveform,
  Sparkles,
  FolderOpen,
  Cpu,
  Settings2,
} from "lucide-react";
import SidebarModal, { type SidebarItem } from "./ui/SidebarModal";
import SettingsPage, { SettingsSectionType } from "./SettingsPage";

export type { SettingsSectionType };

// The old AI Models sidebar had four items (transcription, meetings,
// intelligence, agentMode) — they now collapse into two: speechToText + llms.
// Legacy deep-links land on the matching sub-tab via LEGACY_SUB_TAB.
const SECTION_ALIASES: Record<string, SettingsSectionType> = {
  // Map old 7 sections to new 6 sections
  general: "input",
  hotkeys: "input",
  speechToText: "transcription",
  llms: "aiProcessing",
  localModel: "models",
  privacyData: "storage",
  // Legacy deep-links
  aiModels: "aiProcessing",
  agentConfig: "aiProcessing",
  agentMode: "aiProcessing",
  intelligence: "aiProcessing",
  meetings: "transcription",
  prompts: "aiProcessing",
  transcription: "transcription",
  uploadTranscription: "transcription",
  softwareUpdates: "system",
  privacy: "storage",
  permissions: "storage",
  developer: "system",
};

const LEGACY_SUB_TAB: Record<string, string> = {
  // New 6-section sub-tabs
  input: "microphone",
  transcription: "dictation",
  uploadTranscription: "upload",
  aiProcessing: "dictationCleanup",
  agentMode: "dictationAgent",
  agentConfig: "dictationAgent",
  intelligence: "dictationCleanup",
  prompts: "dictationCleanup",
};

interface SettingsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialSection?: string;
}

export default function SettingsModal({ open, onOpenChange, initialSection }: SettingsModalProps) {
  const { t } = useTranslation();
  const sidebarItems: SidebarItem<SettingsSectionType>[] = useMemo(
    () => [
      {
        id: "input",
        label: t("settingsModal.sections.input.label"),
        icon: Mic,
        description: t("settingsModal.sections.input.description"),
        group: t("settingsModal.groups.input"),
      },
      {
        id: "transcription",
        label: t("settingsModal.sections.transcription.label"),
        icon: AudioWaveform,
        description: t("settingsModal.sections.transcription.description"),
        group: t("settingsModal.groups.transcription"),
      },
      {
        id: "aiProcessing",
        label: t("settingsModal.sections.aiProcessing.label"),
        icon: Sparkles,
        description: t("settingsModal.sections.aiProcessing.description"),
        group: t("settingsModal.groups.aiProcessing"),
      },
      {
        id: "storage",
        label: t("settingsModal.sections.storage.label"),
        icon: FolderOpen,
        description: t("settingsModal.sections.storage.description"),
        group: t("settingsModal.groups.storage"),
      },
      {
        id: "models",
        label: t("settingsModal.sections.models.label"),
        icon: Cpu,
        description: t("settingsModal.sections.models.description"),
        group: t("settingsModal.groups.models"),
      },
      {
        id: "system",
        label: t("settingsModal.sections.system.label"),
        icon: Settings2,
        description: t("settingsModal.sections.system.description"),
        group: t("settingsModal.groups.system"),
      },
    ],
    [t]
  );

  const resolveSection = (section: string | undefined): SettingsSectionType => {
    if (!section) return "input";
    const resolved = (SECTION_ALIASES[section] ?? section) as SettingsSectionType;
    if (!["input", "transcription", "aiProcessing", "storage", "models", "system"].includes(resolved)) return "input";
    return resolved;
  };

  const [activeSection, setActiveSection] = React.useState<SettingsSectionType>(() =>
    resolveSection(initialSection)
  );
  const [initialSubTab, setInitialSubTab] = useState<string | undefined>(() =>
    initialSection ? LEGACY_SUB_TAB[initialSection] : undefined
  );
  const [prevOpen, setPrevOpen] = useState(open);

  if (open && !prevOpen && initialSection) {
    setPrevOpen(open);
    setActiveSection(resolveSection(initialSection));
    setInitialSubTab(LEGACY_SUB_TAB[initialSection]);
  } else if (open !== prevOpen) {
    setPrevOpen(open);
    if (!open) setInitialSubTab(undefined);
  }

  const handleSectionChange = (section: SettingsSectionType) => {
    setActiveSection(section);
    setInitialSubTab(undefined);
  };

  return (
    <SidebarModal<SettingsSectionType>
      open={open}
      onOpenChange={onOpenChange}
      title={t("settingsModal.title")}
      sidebarItems={sidebarItems}
      activeSection={activeSection}
      onSectionChange={handleSectionChange}
    >
      <SettingsPage
        activeSection={activeSection}
        onNavigateToSection={handleSectionChange}
        initialSubTab={initialSubTab}
      />
    </SidebarModal>
  );
}
