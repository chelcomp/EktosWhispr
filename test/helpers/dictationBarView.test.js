const test = require("node:test");
const assert = require("node:assert/strict");
const { deriveBarView } = require("../../src/utils/dictationBar.js");

test("idle/hover produce no bar", () => {
  assert.equal(deriveBarView("idle", {}), null);
  assert.equal(deriveBarView("hover", {}), null);
});

test("recording with no live text yet is capturing", () => {
  assert.equal(deriveBarView("recording", { hasLiveText: false }), "capturing");
});

test("recording with live text is transcribing", () => {
  assert.equal(deriveBarView("recording", { hasLiveText: true }), "transcribing");
});

test("processing and transforming reuse the processing visual", () => {
  assert.equal(deriveBarView("processing", {}), "processing");
  assert.equal(deriveBarView("transforming", {}), "processing");
});

test("mic error overrides everything", () => {
  assert.equal(deriveBarView("recording", { hasLiveText: true, micError: { title: "x" } }), "error");
  assert.equal(deriveBarView("idle", { micError: { title: "x" } }), "error");
});
