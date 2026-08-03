const test = require("node:test");
const assert = require("node:assert/strict");
const { render, screen, cleanup, waitFor } = require("@testing-library/react");
const React = require("react");
const DictationBar = require("../../src/components/DictationBar.jsx").default;

test.afterEach(cleanup);

test("capturing renders 30 bars and an M:SS timer", () => {
  render(React.createElement(DictationBar, { state: "capturing" }));
  assert.equal(document.querySelectorAll(".dictation-bar__eq .bar").length, 30);
  assert.ok(screen.getByText(/^\d{2}:\d{2}$/), "M:SS timer present");
});

test("transcribing renders 5 bars, the sliding caption and the timer", () => {
  render(React.createElement(DictationBar, {
    state: "transcribing",
    transcript: "hello world",
    partialTranscript: " hoje",
  }));
  assert.equal(document.querySelectorAll(".dictation-bar__eq .bar").length, 5);
  assert.ok(screen.getByText(/hello world/), "caption shows the final text");
  assert.ok(screen.getByText(/hoje/), "caption shows the live partial tail");
  assert.ok(screen.getByText(/^\d{2}:\d{2}$/));
});

test("processing renders 35 bars and no caption or timer", () => {
  render(React.createElement(DictationBar, { state: "processing", transcript: "ignored" }));
  assert.equal(document.querySelectorAll(".dictation-bar__eq .bar").length, 35);
  assert.equal(screen.queryByText(/^\d{2}:\d{2}$/), null);
  assert.equal(screen.queryByText(/ignored/), null);
});

test("error renders the ! icon and calls onAutoHide after autoHideMs", async () => {
  let autoHidden = false;
  render(React.createElement(DictationBar, {
    state: "error",
    autoHideMs: 10,
    onAutoHide: () => { autoHidden = true; },
  }));
  assert.ok(screen.getByText("!"), "error icon present");
  await waitFor(() => assert.equal(autoHidden, true), { timeout: 500 });
});
