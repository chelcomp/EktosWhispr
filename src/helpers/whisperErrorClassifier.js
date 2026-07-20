/**
 * Pure classification of a local-whisper transcription error into the
 * structured `{success:false, error, code, message}` shape the renderer
 * expects, extracted out of ipcHandlers.js's `transcribe-local-whisper` catch
 * block so it's unit-testable without an ipcHandlers-level test harness.
 *
 * Returns `null` for an unrecognized error — the caller should still rethrow
 * the raw error in that case, matching today's behavior.
 *
 * @param {Error & {code?: string}} error
 * @returns {{success: false, error: string, code?: string, message: string} | null}
 */
function classifyLocalWhisperError(error) {
  const errorMessage = error?.message || "Unknown error";

  // Checked before the message-substring checks below so a properly-coded
  // error is always recognized regardless of its exact wording.
  if (error?.code === "WHISPER_SERVER_BINARY_MISSING") {
    return {
      success: false,
      error: "whisper_server_binary_missing",
      code: "WHISPER_SERVER_BINARY_MISSING",
      message: errorMessage,
    };
  }

  if (errorMessage.includes("FFmpeg not found")) {
    return {
      success: false,
      error: "ffmpeg_not_found",
      message: "FFmpeg is missing. Please reinstall the app or install FFmpeg manually.",
    };
  }

  if (
    errorMessage.includes("FFmpeg conversion failed") ||
    errorMessage.includes("FFmpeg process error")
  ) {
    return {
      success: false,
      error: "ffmpeg_error",
      message: "Audio conversion failed. The recording may be corrupted.",
    };
  }

  if (errorMessage.includes("whisper.cpp not found") || errorMessage.includes("whisper-cpp")) {
    return {
      success: false,
      error: "whisper_not_found",
      message: "Whisper binary is missing. Please reinstall the app.",
    };
  }

  if (
    errorMessage.includes("Audio buffer is empty") ||
    errorMessage.includes("Audio data too small")
  ) {
    return {
      success: false,
      error: "no_audio_data",
      message: "No audio detected",
    };
  }

  if (errorMessage.includes("model") && errorMessage.includes("not downloaded")) {
    return {
      success: false,
      error: "model_not_found",
      message: errorMessage,
    };
  }

  return null;
}

module.exports = { classifyLocalWhisperError };
