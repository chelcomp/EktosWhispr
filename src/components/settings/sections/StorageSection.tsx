import React from "react";
import type { TFunction } from "i18next";
import { Mic, Monitor, Shield } from "lucide-react";
import { Button } from "../../ui/button";
import MicPermissionWarning from "../../ui/MicPermissionWarning";
import PermissionCard from "../../ui/PermissionCard";
import PasteToolsInfo from "../../ui/PasteToolsInfo";
import {
  SectionHeader,
  SettingsPanel,
  SettingsPanelRow,
  SettingsRow,
} from "../../ui/SettingsSection";
import { Toggle } from "../../ui/toggle";
import type { UsePermissionsReturn } from "../../../hooks/usePermissions";
import { useSystemAudioPermission } from "../../../hooks/useSystemAudioPermission";
import type { Platform } from "../../../utils/platform";
import { canManageSystemAudioInApp } from "../../../utils/systemAudioAccess";

type StorageUsage = { fileCount: number; totalBytes: number };

interface StorageSectionProps {
  t: TFunction;
  audioRetentionDays: number;
  setAudioRetentionDays: (days: number) => void;
  audioStorageUsage: StorageUsage;
  formatBytes: (bytes: number) => string;
  handleClearAllAudio: () => void;
  persistActiveWindowScreenshots: boolean;
  screenContextRetentionDays: number;
  setScreenContextRetentionDays: (days: number) => void;
  screenContextStorageUsage: StorageUsage;
  handleClearAllScreenContextScreenshots: () => void;
  meetingAudioStorageUsage: StorageUsage;
  handleClearAllMeetingAudio: () => void;
  transcriptionIdleTimeoutMs: number;
  setTranscriptionIdleTimeoutMs: (ms: number) => void;
  llmIdleTimeoutMs: number;
  setLlmIdleTimeoutMs: (ms: number) => void;
  dataRetentionEnabled: boolean;
  setDataRetentionEnabled: (v: boolean) => void;
  saveDiscardedTranscriptions: boolean;
  setSaveDiscardedTranscriptions: (v: boolean) => void;
  platform: Platform;
  systemAudio: ReturnType<typeof useSystemAudioPermission>;
  permissionsHook: UsePermissionsReturn;
  resetAccessibilityPermissions: () => void;
}

export default function StorageSection({
  t,
  audioRetentionDays,
  setAudioRetentionDays,
  audioStorageUsage,
  formatBytes,
  handleClearAllAudio,
  persistActiveWindowScreenshots,
  screenContextRetentionDays,
  setScreenContextRetentionDays,
  screenContextStorageUsage,
  handleClearAllScreenContextScreenshots,
  meetingAudioStorageUsage,
  handleClearAllMeetingAudio,
  transcriptionIdleTimeoutMs,
  setTranscriptionIdleTimeoutMs,
  llmIdleTimeoutMs,
  setLlmIdleTimeoutMs,
  dataRetentionEnabled,
  setDataRetentionEnabled,
  saveDiscardedTranscriptions,
  setSaveDiscardedTranscriptions,
  platform,
  systemAudio,
  permissionsHook,
  resetAccessibilityPermissions,
}: StorageSectionProps) {
  return (
    <div className="space-y-6">
      {/* Audio Retention */}
      <div>
        <SectionHeader
          title={t("settingsPage.privacy.audioRetention")}
          description={t("settingsPage.privacy.audioRetentionDescription")}
        />

        <SettingsPanel>
          <SettingsPanelRow>
            <SettingsRow
              label={t("settingsPage.privacy.audioRetention")}
              description={t("settingsPage.privacy.audioRetentionDescription")}
            >
              <select
                value={audioRetentionDays}
                onChange={(e) => setAudioRetentionDays(parseInt(e.target.value, 10))}
                className="h-7 rounded border border-border/70 bg-surface-1/80 px-2.5 text-xs font-medium text-foreground shadow-sm backdrop-blur-sm hover:border-border-hover hover:bg-surface-2/70 focus:outline-none focus:ring-2 focus:ring-ring/30 focus:ring-offset-1 transition-colors duration-200"
              >
                <option value={0}>{t("settingsPage.privacy.audioRetentionDisabled")}</option>
                <option value={1}>
                  {t("settingsPage.privacy.audioRetentionDays", { count: 1 })}
                </option>
                <option value={7}>
                  {t("settingsPage.privacy.audioRetentionDays", { count: 7 })}
                </option>
                <option value={14}>
                  {t("settingsPage.privacy.audioRetentionDays", { count: 14 })}
                </option>
                <option value={30}>
                  {t("settingsPage.privacy.audioRetentionDays", { count: 30 })}
                </option>
                <option value={60}>
                  {t("settingsPage.privacy.audioRetentionDays", { count: 60 })}
                </option>
                <option value={90}>
                  {t("settingsPage.privacy.audioRetentionDays", { count: 90 })}
                </option>
              </select>
            </SettingsRow>
          </SettingsPanelRow>
          <SettingsPanelRow>
            <SettingsRow
              label={t("settingsPage.privacy.audioStorageUsage")}
              description={
                audioStorageUsage.fileCount > 0
                  ? t("settingsPage.privacy.audioStorageFiles", {
                      count: audioStorageUsage.fileCount,
                      size: formatBytes(audioStorageUsage.totalBytes),
                    })
                  : t("settingsPage.privacy.audioStorageEmpty")
              }
            >
              <Button
                variant="outline"
                size="sm"
                className="h-7 text-xs"
                disabled={audioStorageUsage.fileCount === 0}
                onClick={handleClearAllAudio}
              >
                {t("settingsPage.privacy.clearAllAudio")}
              </Button>
            </SettingsRow>
          </SettingsPanelRow>
        </SettingsPanel>
      </div>

      {/* Active-window screen context screenshots — collected/ephemeral data
          per CLAUDE.md §7, own independent retention setting (see
          docs/specs/active-window-screen-context.md). Only shown once
          persistActiveWindowScreenshots has ever been (or is) enabled,
          since leftover files need a manual escape hatch even after the
          toggle is turned back off. */}
      {(persistActiveWindowScreenshots || screenContextStorageUsage.fileCount > 0) && (
        <div>
          <SectionHeader
            title={t("settingsPage.privacy.screenContextStorageUsage")}
            description={t("settingsPage.privacy.screenContextStorageUsageDescription")}
          />
          <SettingsPanel>
            {persistActiveWindowScreenshots && (
              <SettingsPanelRow>
                <SettingsRow
                  label={t("settingsPage.privacy.screenContextRetention")}
                  description={t("settingsPage.privacy.screenContextRetentionDescription")}
                >
                  <select
                    value={screenContextRetentionDays}
                    onChange={(e) =>
                      setScreenContextRetentionDays(parseInt(e.target.value, 10))
                    }
                    className="h-7 rounded border border-border/70 bg-surface-1/80 px-2.5 text-xs font-medium text-foreground shadow-sm backdrop-blur-sm hover:border-border-hover hover:bg-surface-2/70 focus:outline-none focus:ring-2 focus:ring-ring/30 focus:ring-offset-1 transition-colors duration-200"
                  >
                    <option value={0}>
                      {t("settingsPage.privacy.audioRetentionDisabled")}
                    </option>
                    <option value={1}>
                      {t("settingsPage.privacy.audioRetentionDays", { count: 1 })}
                    </option>
                    <option value={7}>
                      {t("settingsPage.privacy.audioRetentionDays", { count: 7 })}
                    </option>
                    <option value={14}>
                      {t("settingsPage.privacy.audioRetentionDays", { count: 14 })}
                    </option>
                    <option value={30}>
                      {t("settingsPage.privacy.audioRetentionDays", { count: 30 })}
                    </option>
                    <option value={60}>
                      {t("settingsPage.privacy.audioRetentionDays", { count: 60 })}
                    </option>
                    <option value={90}>
                      {t("settingsPage.privacy.audioRetentionDays", { count: 90 })}
                    </option>
                  </select>
                </SettingsRow>
              </SettingsPanelRow>
            )}
            <SettingsPanelRow>
              <SettingsRow
                label={t("settingsPage.privacy.screenContextStorageUsage")}
                description={
                  screenContextStorageUsage.fileCount > 0
                    ? t("settingsPage.privacy.audioStorageFiles", {
                        count: screenContextStorageUsage.fileCount,
                        size: formatBytes(screenContextStorageUsage.totalBytes),
                      })
                    : t("settingsPage.privacy.screenContextStorageEmpty")
                }
              >
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 text-xs"
                  disabled={screenContextStorageUsage.fileCount === 0}
                  onClick={handleClearAllScreenContextScreenshots}
                >
                  {t("settingsPage.privacy.clearAllScreenContext")}
                </Button>
              </SettingsRow>
            </SettingsPanelRow>
          </SettingsPanel>
        </div>
      )}

      {/* Meeting Audio — never auto-purged (CLAUDE.md §7); manual controls only */}
      <div>
        <SectionHeader
          title={t("settingsPage.privacy.meetingAudioStorageUsage")}
          description={t("settingsPage.privacy.meetingAudioStorageUsageDescription")}
        />

        <SettingsPanel>
          <SettingsPanelRow>
            <SettingsRow
              label={t("settingsPage.privacy.meetingAudioStorageUsage")}
              description={
                meetingAudioStorageUsage.fileCount > 0
                  ? t("settingsPage.privacy.audioStorageFiles", {
                      count: meetingAudioStorageUsage.fileCount,
                      size: formatBytes(meetingAudioStorageUsage.totalBytes),
                    })
                  : t("settingsPage.privacy.meetingAudioStorageEmpty")
              }
            >
              <Button
                variant="outline"
                size="sm"
                className="h-7 text-xs"
                disabled={meetingAudioStorageUsage.fileCount === 0}
                onClick={handleClearAllMeetingAudio}
              >
                {t("settingsPage.privacy.clearAllMeetingAudio")}
              </Button>
            </SettingsRow>
          </SettingsPanelRow>
        </SettingsPanel>
      </div>

      {/* Local Model Performance — on-demand load/idle-timeout (see
          docs/specs/on-demand-model-lifecycle.md). Two independent
          settings: transcription (Whisper/Parakeet) and the local LLM
          (llama-server) each auto-unload after their own idle timeout. */}
      <div>
        <SectionHeader
          title={t("settingsPage.privacy.localModelPerformance")}
          description={t("settingsPage.privacy.localModelPerformanceDescription")}
        />

        <SettingsPanel>
          <SettingsPanelRow>
            <SettingsRow
              label={t("settingsPage.privacy.transcriptionIdleTimeout")}
              description={t("settingsPage.privacy.transcriptionIdleTimeoutDescription")}
            >
              <select
                value={transcriptionIdleTimeoutMs}
                onChange={(e) => setTranscriptionIdleTimeoutMs(parseInt(e.target.value, 10))}
                className="h-7 rounded border border-border/70 bg-surface-1/80 px-2.5 text-xs font-medium text-foreground shadow-sm backdrop-blur-sm hover:border-border-hover hover:bg-surface-2/70 focus:outline-none focus:ring-2 focus:ring-ring/30 focus:ring-offset-1 transition-colors duration-200"
              >
                <option value={30000}>
                  {t("settingsPage.privacy.idleTimeoutSeconds", { count: 30 })}
                </option>
                <option value={60000}>
                  {t("settingsPage.privacy.idleTimeoutMinutes", { count: 1 })}
                </option>
                <option value={120000}>
                  {t("settingsPage.privacy.idleTimeoutMinutes", { count: 2 })}
                </option>
                <option value={300000}>
                  {t("settingsPage.privacy.idleTimeoutMinutes", { count: 5 })}
                </option>
                <option value={600000}>
                  {t("settingsPage.privacy.idleTimeoutMinutes", { count: 10 })}
                </option>
                <option value={900000}>
                  {t("settingsPage.privacy.idleTimeoutMinutes", { count: 15 })}
                </option>
                <option value={1800000}>
                  {t("settingsPage.privacy.idleTimeoutMinutes", { count: 30 })}
                </option>
                <option value={3600000}>
                  {t("settingsPage.privacy.idleTimeoutMinutes", { count: 60 })}
                </option>
              </select>
            </SettingsRow>
          </SettingsPanelRow>
          <SettingsPanelRow>
            <SettingsRow
              label={t("settingsPage.privacy.llmIdleTimeout")}
              description={t("settingsPage.privacy.llmIdleTimeoutDescription")}
            >
              <select
                value={llmIdleTimeoutMs}
                onChange={(e) => setLlmIdleTimeoutMs(parseInt(e.target.value, 10))}
                className="h-7 rounded border border-border/70 bg-surface-1/80 px-2.5 text-xs font-medium text-foreground shadow-sm backdrop-blur-sm hover:border-border-hover hover:bg-surface-2/70 focus:outline-none focus:ring-2 focus:ring-ring/30 focus:ring-offset-1 transition-colors duration-200"
              >
                <option value={30000}>
                  {t("settingsPage.privacy.idleTimeoutSeconds", { count: 30 })}
                </option>
                <option value={60000}>
                  {t("settingsPage.privacy.idleTimeoutMinutes", { count: 1 })}
                </option>
                <option value={120000}>
                  {t("settingsPage.privacy.idleTimeoutMinutes", { count: 2 })}
                </option>
                <option value={300000}>
                  {t("settingsPage.privacy.idleTimeoutMinutes", { count: 5 })}
                </option>
                <option value={600000}>
                  {t("settingsPage.privacy.idleTimeoutMinutes", { count: 10 })}
                </option>
                <option value={900000}>
                  {t("settingsPage.privacy.idleTimeoutMinutes", { count: 15 })}
                </option>
                <option value={1800000}>
                  {t("settingsPage.privacy.idleTimeoutMinutes", { count: 30 })}
                </option>
                <option value={3600000}>
                  {t("settingsPage.privacy.idleTimeoutMinutes", { count: 60 })}
                </option>
              </select>
            </SettingsRow>
          </SettingsPanelRow>
        </SettingsPanel>
      </div>

      {/* Data Retention */}
      <div className="border-t border-border/40 pt-6">
        <SettingsPanel>
          <SettingsPanelRow>
            <SettingsRow
              label={t("settingsPage.privacy.dataRetention")}
              description={t("settingsPage.privacy.dataRetentionDescription")}
            >
              <Toggle checked={dataRetentionEnabled} onChange={setDataRetentionEnabled} />
            </SettingsRow>
          </SettingsPanelRow>
          <SettingsPanelRow>
            <SettingsRow
              label={t("settingsPage.privacy.saveDiscarded")}
              description={t("settingsPage.privacy.saveDiscardedDescription")}
            >
              <Toggle
                checked={saveDiscardedTranscriptions}
                disabled={!dataRetentionEnabled || audioRetentionDays === 0}
                onChange={setSaveDiscardedTranscriptions}
              />
            </SettingsRow>
          </SettingsPanelRow>
        </SettingsPanel>
      </div>

      {/* Permissions */}
      <div className="border-t border-border/40 pt-6">
        <SectionHeader
          title={t("settingsPage.permissions.title")}
          description={t("settingsPage.permissions.description")}
        />

        <div className="space-y-3">
          <PermissionCard
            icon={Mic}
            title={t("settingsPage.permissions.microphoneTitle")}
            description={t("settingsPage.permissions.microphoneDescription")}
            granted={permissionsHook.micPermissionGranted}
            onRequest={permissionsHook.requestMicPermission}
            buttonText={t("settingsPage.permissions.grantAccess")}
          />

          {(platform === "darwin" || canManageSystemAudioInApp(systemAudio)) && (
            <>
              {platform === "darwin" && (
                <PermissionCard
                  icon={Shield}
                  title={t("settingsPage.permissions.accessibilityTitle")}
                  description={t("settingsPage.permissions.accessibilityDescription")}
                  granted={permissionsHook.accessibilityPermissionGranted}
                  onRequest={permissionsHook.requestAccessibilityPermission}
                  buttonText={t("settingsPage.permissions.grantAccess")}
                />
              )}
              {canManageSystemAudioInApp(systemAudio) && (
                <PermissionCard
                  icon={Monitor}
                  title={t("settingsPage.permissions.systemAudioTitle")}
                  description={t("settingsPage.permissions.systemAudioDescription")}
                  granted={systemAudio.granted}
                  onRequest={systemAudio.request}
                  buttonText={t("settingsPage.permissions.grantAccess")}
                  badge={t("settingsPage.permissions.optional")}
                />
              )}
            </>
          )}
        </div>

        {!permissionsHook.micPermissionGranted && permissionsHook.micPermissionError && (
          <MicPermissionWarning
            error={permissionsHook.micPermissionError}
            onOpenSoundSettings={permissionsHook.openSoundInputSettings}
            onOpenPrivacySettings={permissionsHook.openMicPrivacySettings}
          />
        )}

        {platform === "linux" &&
          permissionsHook.pasteToolsInfo &&
          !permissionsHook.pasteToolsInfo.available && (
            <PasteToolsInfo
              pasteToolsInfo={permissionsHook.pasteToolsInfo}
              isChecking={permissionsHook.isCheckingPasteTools}
              onCheck={permissionsHook.checkPasteToolsAvailability}
            />
          )}

        {platform === "darwin" && (
          <div className="mt-5">
            <p className="text-xs font-medium text-foreground mb-3">
              {t("settingsPage.permissions.troubleshootingTitle")}
            </p>
            <SettingsPanel>
              <SettingsPanelRow>
                <SettingsRow
                  label={t("settingsPage.permissions.resetAccessibility.label")}
                  description={t(
                    "settingsPage.permissions.resetAccessibility.rowDescription"
                  )}
                >
                  <Button
                    onClick={resetAccessibilityPermissions}
                    variant="ghost"
                    size="sm"
                    className="text-foreground/70 hover:text-foreground"
                  >
                    {t("settingsPage.permissions.troubleshoot")}
                  </Button>
                </SettingsRow>
              </SettingsPanelRow>
            </SettingsPanel>
          </div>
        )}
      </div>
    </div>
  );
}
