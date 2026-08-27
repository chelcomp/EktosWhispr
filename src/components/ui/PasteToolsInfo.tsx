import { useTranslation } from "react-i18next";
import { Check, Terminal } from "lucide-react";
import { InfoBox } from "./InfoBox";
import type { PasteToolsResult } from "../../types/electron";

interface PasteToolsInfoProps {
  pasteToolsInfo: PasteToolsResult | null;
  isChecking: boolean;
}

export default function PasteToolsInfo({
  pasteToolsInfo,
  isChecking,
}: PasteToolsInfoProps) {
  const { t } = useTranslation();

  if (!pasteToolsInfo) {
    return (
      <div className="border border-border rounded-lg p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Terminal className="w-6 h-6 text-primary" />
            <p className="text-sm text-muted-foreground">{t("pasteToolsInfo.checking")}</p>
          </div>
          {isChecking && (
            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-primary"></div>
          )}
        </div>
      </div>
    );
  }

  if (pasteToolsInfo.platform !== "win32") {
    return null;
  }

  return (
    <InfoBox variant="success">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Terminal className="w-6 h-6 text-success dark:text-success" />
          <div>
            <h3 className="font-semibold text-success dark:text-success">
              {t("pasteToolsInfo.readyTitle")}
            </h3>
            <p className="text-sm text-success dark:text-success">
              {t("pasteToolsInfo.windowsReady")}
            </p>
          </div>
        </div>
        <div className="text-success dark:text-success">
          <Check className="w-5 h-5" />
        </div>
      </div>
    </InfoBox>
  );
}
