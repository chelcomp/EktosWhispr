import React from "react";
import type { TFunction } from "i18next";
import { Download, FolderOpen, Upload } from "lucide-react";
import DeveloperSection from "../../DeveloperSection";
import { Button } from "../../ui/button";
import {
  SectionHeader,
  SettingsPanel,
  SettingsPanelRow,
  SettingsRow,
} from "../../ui/SettingsSection";
import type { ConfirmDialogState, AlertDialogState } from "../../../hooks/useDialogs";

interface SystemSectionProps {
  t: TFunction;
  cachePathHint: string;
  handleRemoveModels: () => void;
  isRemovingModels: boolean;
  handleFullRestore: () => void;
  handleFullBackup: () => void;
  isRestoringBackup: boolean;
  isBackingUp: boolean;
  showConfirmDialog: (options: Omit<ConfirmDialogState, "open">) => void;
  showAlertDialog: (options: Omit<AlertDialogState, "open">) => void;
  signOut: () => Promise<void>;
}

export default function SystemSection({
  t,
  cachePathHint,
  handleRemoveModels,
  isRemovingModels,
  handleFullRestore,
  handleFullBackup,
  isRestoringBackup,
  isBackingUp,
  showConfirmDialog,
  showAlertDialog,
  signOut,
}: SystemSectionProps) {
  return (
    <div className="space-y-6">
      {/* Developer Tools */}
      <div>
        <DeveloperSection />
      </div>

      {/* Data Management */}
      <div className="border-t border-border/40 pt-6">
        <SectionHeader
          title={t("settingsPage.developer.dataManagementTitle")}
          description={t("settingsPage.developer.dataManagementDescription")}
        />

        <div className="space-y-4">
          <SettingsPanel>
            <SettingsPanelRow>
              <SettingsRow
                label={t("settingsPage.developer.modelCache")}
                description={cachePathHint}
              >
                <div className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => window.electronAPI?.openWhisperModelsFolder?.()}
                  >
                    <FolderOpen className="mr-1.5 h-3.5 w-3.5" />
                    {t("settingsPage.developer.open")}
                  </Button>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={handleRemoveModels}
                    disabled={isRemovingModels}
                  >
                    {isRemovingModels
                      ? t("settingsPage.developer.removing")
                      : t("settingsPage.developer.clearCache")}
                  </Button>
                </div>
              </SettingsRow>
            </SettingsPanelRow>
          </SettingsPanel>

          <SettingsPanel>
            <SettingsPanelRow>
              <SettingsRow
                label={t("settingsPage.developer.fullBackup.label")}
                description={t("settingsPage.developer.fullBackup.description")}
              >
                <div className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleFullRestore}
                    disabled={isRestoringBackup || isBackingUp}
                  >
                    <Upload className="mr-1.5 h-3.5 w-3.5" />
                    {isRestoringBackup
                      ? t("settingsPage.developer.fullRestore.restoring")
                      : t("settingsPage.developer.fullRestore.action")}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleFullBackup}
                    disabled={isBackingUp || isRestoringBackup}
                  >
                    <Download className="mr-1.5 h-3.5 w-3.5" />
                    {isBackingUp
                      ? t("settingsPage.developer.fullBackup.backingUp")
                      : t("settingsPage.developer.fullBackup.action")}
                  </Button>
                </div>
              </SettingsRow>
            </SettingsPanelRow>
          </SettingsPanel>

          <SettingsPanel>
            <SettingsPanelRow>
              <SettingsRow
                label={t("settingsPage.developer.resetAppData")}
                description={t("settingsPage.developer.resetAppDataDescription")}
              >
                <Button
                  onClick={() => {
                    showConfirmDialog({
                      title: t("settingsPage.developer.resetAll.title"),
                      description: t("settingsPage.developer.resetAll.description"),
                      onConfirm: async () => {
                        try {
                          try {
                            await signOut();
                          } catch {}
                          await window.electronAPI?.cleanupApp();
                          showAlertDialog({
                            title: t("settingsPage.developer.resetAll.successTitle"),
                            description: t(
                              "settingsPage.developer.resetAll.successDescription"
                            ),
                          });
                          setTimeout(() => {
                            window.location.reload();
                          }, 1000);
                        } catch {
                          showAlertDialog({
                            title: t("settingsPage.developer.resetAll.failedTitle"),
                            description: t(
                              "settingsPage.developer.resetAll.failedDescription"
                            ),
                          });
                        }
                      },
                      variant: "destructive",
                      confirmText: t("settingsPage.developer.resetAll.confirmText"),
                    });
                  }}
                  variant="outline"
                  size="sm"
                  className="text-destructive border-destructive/30 hover:bg-destructive/10 hover:border-destructive"
                >
                  {t("common.reset")}
                </Button>
              </SettingsRow>
            </SettingsPanelRow>
          </SettingsPanel>
        </div>
      </div>
    </div>
  );
}
