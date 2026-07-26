# Non-Negotiable Product Premises

These 7 constraints are **foundational** — `spec-planner` must address compliance; `pr-reviewer` treats violations as hard `FAIL`.

---

## 1. Privacy — No Data Leaves PC by Default
- No telemetry, analytics, crash reporting without explicit opt-in (none exists today)
- No silent background update checks — version checks must be user-visible + controlled
- Cloud AI (OpenAI, Anthropic, Gemini, Groq, Bedrock/Azure/Vertex) = BYOK opt-in exception
- **No new TCP listener except loopback (127.0.0.1)** — existing: `cliBridge.js` ports 8200-8219, ONNX worker. Any new port must justify + confirm loopback-only in spec.

## 2. Performance — Minimal Idle Footprint
- **Idle budget**: ≤300 MB RAM, <2% avg CPU (measured over minutes, not instantaneous)
- Prefer event-driven OS APIs over polling
- New background work → lazy-spawn (like `QdrantManager`, ONNX worker) — never at launch
- Any new timer/polling/background service must justify interval + cost in spec

## 3. Speed — Sub-500ms Raw Transcription
- Hotkey release → raw transcript text ≤500ms for fast engines (Whisper tiny/base, Parakeet, GPU)
- Medium/large Whisper = explicit documented exception (trade quality for speed)
- Optional AI cleanup/agent pass = separate latency budget (opt-in, network round-trip)
- Any audio pipeline / IPC / whisper.js change must state impact on this budget

## 4. Single Instance — App Never Runs Twice
- Enforced: `app.requestSingleInstanceLock()` in `main.js` → second launch exits (`app.exit(0)`)
- `second-instance` handler focuses/restores control panel
- Rationale: global hotkey, SQLite connection, sidecar ports (Qdrant, ONNX) — all collide
- Any spec touching startup/window creation/relaunch must confirm lock + handler intact

## 5. Graceful Degradation — Optional Components Never Crash App
- Every optional native binary, sidecar, platform integration must have defined fallback
- Failure/absence must never crash app or block core: record → transcribe → paste
- Generalizes: search (Qdrant → FTS5), hotkeys (PTT → tap mode)
- Spec introducing new optional dependency must state fallback; `pr-reviewer` fails if missing

## 6. Migration Safety — Upgrades Never Lose User Data
- Any settings key, localStorage schema, DB schema/column, file format change → migration in same spec
- Existing data (history, settings, dictionary, API keys, notes, hotkeys) survives untouched or transformed forward — never silently reset/dropped
- `postMigrationDetector.js` (bundle-ID migration) = precedent, not exception
- Validation Plan must include test: old format/value through upgrade → data survives
- `pr-reviewer` FAILs schema/key rename/restructure without migration

## 7. Data Retention — Operational Data Persists; Only Collected/Ephemeral Data Auto-Purges

| Category | Examples | Auto-Expiry | Deletion |
|----------|----------|-------------|----------|
| **Operational** (never auto-purge) | Personal Notes, Meeting transcripts/summaries/**raw meeting audio**, Custom Dictionary | **Never** | User-initiated only |
| **Collected/Ephemeral** (user-controlled auto-purge) | Dictation audio recordings (`audioRetentionDays`), SQLite transcription text (gap: no age-based purge yet), Debug logs (gap: no rotation yet), Screen-context screenshots (`persistActiveWindowScreenshots` + `screenContextRetentionDays`) | **Yes** — each has setting + background purge | User setting + auto-purge |

**Known bug**: `ipcHandlers.js:_setupAudioCleanup()` hardcodes `DEFAULT_RETENTION_DAYS=30` for **both** dictation and meeting audio, ignoring user's `audioRetentionDays`. Fix must also remove meeting audio from that cleanup path entirely (per premise).

**Screen context screenshots** (opt-in, off by default): own `screenContextRetentionDays` + `_setupScreenContextCleanup()` mirroring audio cleanup + manual "Clear All" button.

**Rule**: Every item in "Collected/Ephemeral" must have (a) user-facing retention setting + (b) automatic background purge honoring it. "Clear All" button alone ≠ compliance.

**Spec requirement**: Any new stored data must explicitly declare category (operational vs collected) and never introduce auto-expiry for operational data.