const test = require("node:test");
const assert = require("node:assert/strict");

const { classifyLocalWhisperError } = require("../../src/helpers/whisperErrorClassifier");

test("regression: whisper-server binary missing message with .code recognized (fails before fix, passes after)", () => {
  const err = new Error(
    "whisper-server binary not found. Please ensure the app is installed correctly."
  );
  err.code = "WHISPER_SERVER_BINARY_MISSING";

  const result = classifyLocalWhisperError(err);

  assert.deepEqual(result, {
    success: false,
    error: "whisper_server_binary_missing",
    code: "WHISPER_SERVER_BINARY_MISSING",
    message: err.message,
  });
});

test("FFmpeg not found classifies as ffmpeg_not_found", () => {
  const result = classifyLocalWhisperError(new Error("FFmpeg not found on this system"));
  assert.equal(result.success, false);
  assert.equal(result.error, "ffmpeg_not_found");
});

test("FFmpeg conversion failure classifies as ffmpeg_error", () => {
  const result = classifyLocalWhisperError(new Error("FFmpeg conversion failed: bad input"));
  assert.equal(result.error, "ffmpeg_error");
});

test("legacy whisper.cpp/whisper-cpp missing message classifies as whisper_not_found", () => {
  const result = classifyLocalWhisperError(new Error("whisper-cpp binary missing"));
  assert.equal(result.error, "whisper_not_found");
});

test("empty/too-small audio buffer classifies as no_audio_data", () => {
  const result = classifyLocalWhisperError(new Error("Audio buffer is empty"));
  assert.equal(result.error, "no_audio_data");
});

test("model not downloaded classifies as model_not_found and preserves message", () => {
  const message = 'Whisper model "base" not downloaded. Please download it from Settings.';
  const result = classifyLocalWhisperError(new Error(message));
  assert.equal(result.error, "model_not_found");
  assert.equal(result.message, message);
});

test("unrecognized error returns null (handler still rethrows raw)", () => {
  const result = classifyLocalWhisperError(new Error("Something completely unexpected happened"));
  assert.equal(result, null);
});
