# Fix: llama-server never receives a `--ctx-size` flag, so it falls back to a model's native GGUF context

## Status
Implemented

## TL;DR
- `src/helpers/llamaServer.js`'s `_doStart()` builds the local-LLM launch args (`baseArgs`) without a `--ctx-size`/`-c` flag. Callers (`modelManagerBridge.js`) already compute the right value (`options.contextSize`, sourced from the model registry's `contextLength`) and pass it in `start(modelPath, options)` — but `_doStart` silently ignores `options.contextSize` entirely. llama-server then defaults to the GGUF's own trained max context.
- This is a general bug affecting every local model, not specific to Nemotron 3 Nano — it just happens to expose the bug badly because that model's native context (~1,048,576 tokens) is far larger than its registry `contextLength` (262144), causing a huge KV-cache allocation that OOMs the Vulkan/GPU backend before falling back to a slow CPU boot (~10s) with an oversized `n_ctx`.
- Fix: add `--ctx-size <value>` to `baseArgs` in `_doStart`, sourced from `options.contextSize`, with a safe fallback (4096, matching the fallback already used by both call sites in `modelManagerBridge.js`) if the caller omits it.
- Also fix the one caller that restarts the server with no `options` at all on a GPU-device change (`ipcHandlers.js` intelligence-GPU-change handler, `~line 2414`) — it must preserve the model's context size across that restart, not silently drop back to a 4096/native default.
- No blocking open question — this is a narrow, low-risk bug fix confined to argument construction; no design decision needs the project owner's judgment call.
- Practical impact: local LLM cleanup/dictation-agent/note-formatting/chat-intelligence passes for large-native-context models (Nemotron 3 Nano now, any future model with `contextLength` << native GGUF max) will start reliably on GPU without OOM-crashing, and boot in the time appropriate for their registry-declared context rather than an unbounded native one.

## Problem / Goal

`LlamaServerManager._doStart(modelPath, options)` in `src/helpers/llamaServer.js` builds `baseArgs` for the `llama-server` binary without ever reading `options.contextSize`:

```
const baseArgs = [
  "--model", modelPath,
  "--host", "127.0.0.1",
  "--port", String(this.port),
  "--threads", String(options.threads || 4),
  "--jinja",
];
```

Meanwhile every caller in `src/helpers/modelManagerBridge.js` (`runInference()` and `prewarmServer()`) already resolves and passes a `contextSize` value derived from the model registry (`src/models/modelRegistryData.json`'s `contextLength` field, via `findModelById()`/`modelInfo.model.contextLength`):

```
await this.serverManager.start(modelPath, {
  contextSize: options.contextSize || modelInfo.model.contextLength || 4096,
  threads: options.threads || 4,
  gpuLayers: 99,
});
```

Because `_doStart` never reads it, llama-server falls back to whatever context length is baked into the GGUF file's own metadata — which can be dramatically larger than the registry's declared `contextLength`. For the newly-added `nemotron-3-nano-4b-q4_k_m` model (registry `contextLength: 262144`), the GGUF's native/trained max appears to be ~1,048,576 tokens. Observed consequence from a live debug-log run on an NVIDIA RTX PRO 1000 Blackwell laptop GPU (7822 MiB total, ~7054 MiB free):

1. llama-server tries the Vulkan GPU backend first.
2. It attempts to allocate a 2,147,483,648-byte (2 GB) KV-cache buffer sized for the full native context, which exceeds free VRAM: `ggml_vulkan: Device memory allocation of size 2147483648 failed ... ErrorOutOfDeviceMemory`.
3. llama-server crashes on startup (exit code `3221225477` / `0xC0000005`).
4. The existing backend fallback chain (`getBackendChain`/`llamaBackends.js`) correctly retries CPU, which succeeds but takes ~10.3s to boot (`startupTimeMs: 10272`) with `n_ctx = 1048576` per slot — a huge, unneeded context that also slows prompt processing (~48 tok/s measured).
5. The eventual cleanup output on that run was low quality/garbled — plausibly related (weaker, secondary observation, not asserted as a hard causal claim in this spec).

The user experienced this as "the LLM isn't loading" — in reality it eventually loads via the slow CPU fallback, but the GPU path crashes first and the whole round-trip is unacceptably slow for what CLAUDE.md documents as a distinct, bounded latency budget for the optional cleanup/agent pass.

This is a **general** bug in `llamaServer.js`'s argument construction — it happens to be masked for most already-registered models (Qwen, Llama, Mistral, GPT-OSS, other Nemotron variants) because those GGUFs' own native context ceilings are close to or smaller than their registry `contextLength` values, so the missing clamp rarely bites. It is not something to special-case for Nemotron.

## Requirements

- `LlamaServerManager._doStart()` must always launch `llama-server` with an explicit `--ctx-size` argument, so llama-server never falls back to a GGUF's own (potentially far larger) native context default.
- The value passed must be `options.contextSize` when provided by the caller (already the case for both `modelManagerBridge.js` call sites), with a fallback constant of `4096` when `options.contextSize` is missing/falsy — matching the fallback value already used by both `modelManagerBridge.js` call sites, so behavior stays consistent whether the clamp happens at the caller or here.
- The GPU-change restart path in `ipcHandlers.js` (the `purpose === "intelligence"` branch, `~line 2404-2416`) must not silently drop context size to the fallback on restart — it must reuse the context size the server was actually running with before the restart, so a GPU-device switch (e.g. user changes which physical GPU handles "Intelligence" workloads) doesn't unintentionally reset a previously-correct large-context model back to 4096, nor keep it stuck reading the removed default.
- No functional change to `--n-gpu-layers`, `--jinja`, `--threads`, `--host`, `--port`, or the backend-selection/fallback chain in `llamaBackends.js`.
- Must not alter the per-scope (`dictationCleanup`/`dictationAgent`/`noteFormatting`/`chatIntelligence`) prompt-building or truncation logic — this fix only changes the llama-server process's `--ctx-size` launch argument, not application-level prompt construction.

## Non-goals

- Not attempting to reduce the registry's declared `contextLength` for any model (Nemotron or otherwise) — that value is correct/intended; the bug is that it was never actually passed to the server process.
- Not adding a UI/settings control for context size — it remains fully derived from the model registry, as today.
- Not addressing the "garbled output" secondary observation directly; if it recurs after this fix ships (with a sane, registry-matched context size), it would be a separate bug/spec, since the causal link to oversized context is only a weak hypothesis here, not confirmed.
- Not changing `llamaBackends.js`'s Vulkan/CUDA device-picking, GPU-layer offload count, or backend fallback ordering.
- Not touching whisper.cpp/Parakeet transcription paths — this is scoped entirely to the local-LLM (llama-server) reasoning/cleanup pipeline.

## Design

### `src/helpers/llamaServer.js`

In `_doStart(modelPath, options = {})`, add a `--ctx-size` flag to `baseArgs`, positioned alongside the other flags (order among flags doesn't matter to llama-server, but keep it near `--threads` for readability). The value: `options.contextSize` if it is a truthy, positive number; otherwise a new local constant `DEFAULT_CONTEXT_SIZE = 4096` (matching the existing inline fallback literal already used in `modelManagerBridge.js`, so the same number appears in exactly one more place, not a new arbitrary value). Coerce with `String(...)` the same way `--threads` and `--port` already are.

No other line in `_doStart`, `_startBackend`, or `_startWithBinary` needs to change — `baseArgs` already flows unmodified through `backend.buildArgs(baseArgs, gpuMode)` for every backend (`CpuBackend`, `VulkanBackend`, `CudaBackend`, `MetalBackend` in `llamaBackends.js`), so adding one flag here is sufficient for all four backends without touching `llamaBackends.js` at all.

### `src/helpers/ipcHandlers.js` — GPU-change restart path

The `purpose === "intelligence"` branch (around line 2403-2417) currently does:

```
const modelPath = modelManager.serverManager.modelPath;
await modelManager.serverManager.stop();
if (modelPath) {
  await modelManager.serverManager.start(modelPath);
}
```

`stop()` resets `this.port`/`this.modelPath`/`this.activeBackend`, but the manager has no persisted "last contextSize used" field today. Two options were considered:

1. Add a `this.lastOptions` (or specifically `this.contextSize`) field to `LlamaServerManager`, set at the top of `_doStart()` before `stop()` could ever clear it, and read it back when restarting with no explicit options.
2. Have the `ipcHandlers.js` restart call resolve the context size the same way `modelManagerBridge.js` already does — via `modelManager.currentServerModelId` (already tracked) → `modelManager.findModelById(currentServerModelId)` → `modelInfo.model.contextLength` — and pass it explicitly in the `start()` call, mirroring exactly the pattern `runInference()`/`prewarmServer()` already use.

Choose **option 2**: it reuses the existing, already-correct resolution path (registry lookup) instead of introducing new state on `LlamaServerManager` that would need its own invalidation/lifecycle reasoning (e.g. what happens to a stale `lastOptions.contextSize` if the model changes without going through `modelManagerBridge.js`). Concretely: before calling `stop()`, capture `modelManager.currentServerModelId`; after `stop()`, if both `modelPath` and that captured model ID are present, look up the model via `modelManager.findModelById(capturedModelId)` and pass `{ contextSize: modelInfo.model.contextLength || 4096, threads: 4, gpuLayers: 99 }` to `start()`, mirroring `prewarmServer()`'s existing call shape exactly. If the model can no longer be found (edge case — model deleted between calls), fall back to today's no-options `start(modelPath)` call (which now still gets a sane `--ctx-size` default of 4096 thanks to the `llamaServer.js` fix above, rather than an unbounded native default).

### Compliance with Non-Negotiable Product Premises

- **Performance (§2/§3)**: this change only affects the optional, opt-in local-LLM cleanup/agent pass, which per CLAUDE.md §3 has its own latency budget separate from the 500ms raw-transcription figure — no regression to the raw whisper/Parakeet transcription path. The fix is a net *improvement* to that separate budget: it prevents a GPU OOM crash + ~10s CPU-fallback boot, replacing it with a GPU boot sized to the intended context.
- **Idle budget (§2)**: no change — llama-server is already lazy-spawned only on first inference/prewarm use, matching the existing pattern; this fix doesn't add any new always-on timer or polling loop.
- **Privacy (§1)**: no new network calls, no new listener/port — `--ctx-size` is a local process argument only.
- **Migration safety (§6)**: no settings/schema/storage format changes — `contextLength` already exists in the registry and is already being read by both callers; this only fixes the argument that was silently dropped downstream.
- **Graceful degradation (§5)**: unaffected — the existing CUDA → Vulkan → CPU fallback chain in `llamaBackends.js` is untouched; this fix reduces how often that fallback needs to trigger at all for large-context models, and the same chain remains the safety net if it does.

## Validation Plan

### Automated

- `test/helpers/llamaServer.test.js` (existing file, follow its established mocking conventions — `loadLlamaServerManager()`, `makeBackend()`, `createFakeSpawn()`):
  - New test: `"start() passes --ctx-size derived from options.contextSize to the spawned backend"` — call `manager.start(FAKE_MODEL_PATH, { contextSize: 262144 })` with a single successful fake backend, then assert the recorded `calls[0].args` array contains `"--ctx-size"` immediately followed by `"262144"`.
  - New test: `"start() falls back to the default --ctx-size when contextSize is not provided"` — call `manager.start(FAKE_MODEL_PATH)` with no options, assert `calls[0].args` contains `"--ctx-size"` followed by the fallback constant's string value (assert against the exported/imported constant, not a hardcoded literal, so the test doesn't silently drift from the implementation).
  - These two tests exercise `_doStart`'s arg construction across all backend types implicitly (since `baseArgs` is shared), so no per-backend duplication is needed — consistent with how the existing suite already tests shared `baseArgs` behavior (e.g. the `--threads`/`--jinja` flags aren't re-tested per backend either).
- `test/helpers/ipcHandlers*.test.js` (or wherever the GPU-change/intelligence-purpose IPC handler already has coverage — check for an existing test file covering `set-gpu-device`/`gpu-uuid`-style handlers before creating a new one; if none exists, add a new `test/helpers/llamaServerGpuRestart.test.js` that mocks `modelManagerBridge` and asserts the restart call includes the previously-active model's `contextLength`, not a bare `start(modelPath)` call with no options).
  - Test: given `currentServerModelId` set to a model whose registry `contextLength` is `262144`, trigger the intelligence-GPU-change restart path, and assert the `start()` call captured by the mock includes `contextSize: 262144`.

### Manual

1. Ensure the `nemotron-3-nano-4b-q4_k_m` model is downloaded (Settings → AI Models → Local).
2. Select it for any of the four LLM scopes (e.g. `dictationCleanup`) on a machine with an NVIDIA GPU with limited free VRAM (reproducing the original bug's conditions is easiest on the reported RTX PRO 1000 Blackwell class of device, or any GPU where a 2GB KV-cache buffer would exceed free VRAM at native context).
3. Trigger a dictation with cleanup enabled (or the agent/note-formatting/chat-intelligence path using this model).
4. With debug logging enabled (`EKTOSWHISPR_LOG_LEVEL=debug`), confirm in the logs: (a) the `"llama-server launch parameters"` debug entry now includes `--ctx-size 262144` (or whatever the model's registry value is) in `args`; (b) the GPU backend (Vulkan or CUDA) boots successfully rather than OOM-crashing; (c) startup time is meaningfully faster than the ~10.3s CPU-fallback figure from the original bug report.
5. Switch the "Intelligence" GPU device in Settings while this model's server is running (if a multi-GPU setup is available) and confirm, via the same debug log line, that the restarted server still launches with `--ctx-size 262144` rather than reverting to the 4096 default.

### Docs

- No `CLAUDE.md` or `docs/RECREATION_SPEC.md` sections describe today's (buggy) `_doStart()` behavior in enough detail to need correction — `CLAUDE.md`'s Model Registry Architecture section (§8) already documents `contextLength` as registry metadata without asserting it's currently wired through to the server process, so no existing claim needs retracting. No doc update is required as part of this fix; if a future doc pass adds a "Local LLM server (llama-server) launch arguments" subsection to CLAUDE.md, it should describe `--ctx-size` as sourced from the resolved model's `contextLength`.

## Open Questions

None — this is a scoped, low-risk bug fix; no decision here requires the project owner's judgment call.
