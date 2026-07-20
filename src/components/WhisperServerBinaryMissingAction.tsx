import { useCallback, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

interface WhisperServerBinaryMissingActionProps {
  /** Fires a new toast (matches ToastContext's `toast`). */
  toast: (props: {
    title?: string;
    description?: string;
    variant?: "default" | "destructive" | "success";
    duration?: number;
  }) => string;
  /** Dismisses a toast by id (matches ToastContext's `dismiss`). */
  dismiss?: (id?: string) => void;
  /**
   * Returns the id of the destructive toast this action button is rendered
   * inside. A getter, not a plain value, because `toast()` hasn't returned
   * the id yet at the moment this component element is constructed.
   */
  getToastId?: () => string | undefined;
}

/**
 * "Download" action rendered inside the WHISPER_SERVER_BINARY_MISSING
 * destructive toast (see useAudioRecording.js's onError handler). Triggers a
 * runtime download+install of the missing whisper-server binary, only on
 * explicit click — never automatic — with live progress, and no internal
 * retry loop on failure (the user can click again to retry manually).
 */
export default function WhisperServerBinaryMissingAction({
  toast,
  dismiss,
  getToastId,
}: WhisperServerBinaryMissingActionProps) {
  const { t } = useTranslation();
  const [state, setState] = useState<"idle" | "downloading" | "error">("idle");
  const [percent, setPercent] = useState(0);
  const disposeRef = useRef<(() => void) | undefined>(undefined);

  const handleClick = useCallback(async () => {
    if (state === "downloading") return;

    setState("downloading");
    setPercent(0);

    disposeRef.current?.();
    disposeRef.current = window.electronAPI?.onWhisperServerDownloadProgress?.((_event, data) => {
      if (data.type === "progress") {
        setPercent(data.percent || 0);
      }
    });

    try {
      const result = await window.electronAPI?.downloadWhisperServerBinary?.();
      disposeRef.current?.();
      disposeRef.current = undefined;

      if (result?.success) {
        const toastId = getToastId?.();
        if (toastId) dismiss?.(toastId);
        toast({
          title: t("hooks.audioRecording.whisperServerDownload.successTitle"),
          description: t("hooks.audioRecording.whisperServerDownload.successDescription"),
          variant: "success",
          duration: 6000,
        });
      } else {
        setState("error");
      }
    } catch {
      disposeRef.current?.();
      disposeRef.current = undefined;
      setState("error");
    }
  }, [state, toast, dismiss, getToastId, t]);

  const label =
    state === "downloading"
      ? t("hooks.audioRecording.whisperServerDownload.inProgress", { percent })
      : state === "error"
        ? t("hooks.audioRecording.whisperServerDownload.retry")
        : t("hooks.audioRecording.whisperServerDownload.download");

  return (
    <button
      onClick={handleClick}
      disabled={state === "downloading"}
      className="text-[10px] font-medium px-2.5 py-1 rounded-sm whitespace-nowrap
        text-red-100/90 hover:text-white
        bg-red-500/15 hover:bg-red-500/25
        border border-red-400/20 hover:border-red-400/35
        transition-all duration-150
        disabled:opacity-70 disabled:cursor-default"
    >
      {label}
    </button>
  );
}
