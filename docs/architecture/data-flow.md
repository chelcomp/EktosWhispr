# Data Flow Documentation Index

| File | Description |
|------|-------------|
| `dictation.md` | Hotkey → MediaRecorder → IPC → Whisper/Parakeet → VAD batching → transcript → (cleanup/agent) → paste |
| `meeting-recording.md` | Meeting hotkey → manualMeetingLauncher → note creation → meeting-transcription-* IPC → diarization + system audio |
| `note-recording.md` | Personal Notes UI → same meeting-transcription-* IPC backend |
| `screen-context.md` | Hotkey-down → shouldCaptureScreenContext → activeWindowCapture → OCR → warmupScreenContext → prompt placeholder |
| `auto-learn.md` | Paste → TextEditMonitor (500ms) → text-edited (1.5s debounce) → extractCorrections → anti-oscillation → dictionary |
| `dynamic-vocab.md` | Transcription saved → recordVocabularyOccurrences → extractVocabularyTokens → score → buildDynamicVocabularyPrompt → prepend to prompt |
| `ipc-channels.md` | Complete IPC channel registry with handler locations |

See individual files for detailed flow diagrams and code references.