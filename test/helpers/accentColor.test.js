const test = require("node:test");
const assert = require("node:assert/strict");
const { formatAccentColor, FALLBACK_ACCENT } = require("../../src/helpers/accentColor.js");

test("formatAccentColor strips the alpha channel from AARRGGBB", () => {
  assert.equal(formatAccentColor("0067C0FF"), "#67c0ff");
  assert.equal(formatAccentColor("ff0067c0"), "#0067c0");
});

test("formatAccentColor accepts and normalizes #RRGGBB", () => {
  assert.equal(formatAccentColor("#0067c0"), "#0067c0");
  assert.equal(formatAccentColor("#ABC123"), "#abc123");
});

test("formatAccentColor returns null for anything else", () => {
  assert.equal(formatAccentColor(null), null);
  assert.equal(formatAccentColor(undefined), null);
  assert.equal(formatAccentColor(""), null);
  assert.equal(formatAccentColor("67c0ff"), null);
  assert.equal(formatAccentColor("#gggggg"), null);
  assert.equal(formatAccentColor("0067c0ff00"), null);
});

test("FALLBACK_ACCENT is the Win11 default blue", () => {
  assert.equal(FALLBACK_ACCENT, "#0067c0");
});
