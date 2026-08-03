// Pure mapping from overlay micState to the dictation bar view.
// Extracted so the App.jsx glue stays thin and the state machine is testable.
function deriveBarView(micState, { hasLiveText = false, micError = null } = {}) {
  if (micError) return "error";
  if (micState === "recording") return hasLiveText ? "transcribing" : "capturing";
  if (micState === "processing" || micState === "transforming") return "processing";
  return null;
}

module.exports = { deriveBarView };
