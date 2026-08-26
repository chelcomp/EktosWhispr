/**
 * Models section container (new L1 sidebar id: "models").
 *
 * Layout-only extraction from SettingsPage.tsx (Wave 2): the LocalModel
 * keep-alive TabPanel content was copied VERBATIM. No internal sub-tabs; the
 * `GpuDeviceSelector` helper moved here (also consumed by TranscriptionSection)
 * and keeps its own IPC wiring unchanged. Mount gating (`mountedSections`
 * keep-alive) stays the caller's responsibility.
 */
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import LocalModelSection from "../LocalModelSection";
import type { GpuDevice } from "../../../types/electron";
import { SectionHeader, SettingsPanel, SettingsPanelRow } from "../../ui/SettingsSection";

// --- Moved verbatim from SettingsPage.tsx -----------------------------------

export function GpuDeviceSelector({
  purpose,
}: {
  purpose: "transcription" | "intelligence";
}) {
  const { t } = useTranslation();
  const [gpus, setGpus] = useState<GpuDevice[]>([]);
  const [selectedUuid, setSelectedUuid] = useState("");
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    Promise.all([
      window.electronAPI?.listGpus?.() ?? Promise.resolve([]),
      window.electronAPI?.getGpuDeviceIndex?.(purpose) ?? Promise.resolve(""),
    ])
      .then(([gpuList, savedUuid]) => {
        setGpus(gpuList);
        setSelectedUuid(savedUuid || gpuList[0]?.uuid || "");
        setLoaded(true);
      })
      .catch(() => setLoaded(true));
  }, [purpose]);

  if (!loaded || gpus.length < 2) return null;

  return (
    <div className="border-t border-border/40 pt-4 mt-4">
      <SectionHeader
        title={t(`settingsPage.${purpose}.gpuDevice.title`)}
        description={t(`settingsPage.${purpose}.gpuDevice.description`)}
      />
      <SettingsPanel>
        <SettingsPanelRow>
          <div className="relative w-full">
            <select
              value={selectedUuid}
              onChange={async (e) => {
                const uuid = e.target.value;
                setSelectedUuid(uuid);
                await window.electronAPI?.setGpuDeviceIndex?.(purpose, uuid);
              }}
              className="w-full appearance-none rounded-md border border-border bg-background px-3 pr-10 py-2 text-sm"
            >
              {gpus.map((gpu) => (
                <option key={gpu.uuid} value={gpu.uuid}>
                  GPU {gpu.index}: {gpu.name} ({Math.round(gpu.vramMb / 1024)}GB)
                </option>
              ))}
            </select>
            <svg
              className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground"
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="m6 9 6 6 6-6" />
            </svg>
          </div>
        </SettingsPanelRow>
      </SettingsPanel>
    </div>
  );
}

// ----------------------------------------------------------------------------
// Section container

/**
 * New "models" section: the former local-model keep-alive TabPanel. No props —
 * both children are self-contained (store/IPC driven).
 */
export default function ModelsSection() {
  const { t } = useTranslation();

  return (
    <div className="space-y-4">
      <SectionHeader
        title={t("settingsPage.llms.tabs.localModel")}
        description={t("settingsPage.llms.localModel.description")}
      />
      <LocalModelSection />
      <GpuDeviceSelector purpose="intelligence" />
    </div>
  );
}
