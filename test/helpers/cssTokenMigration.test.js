const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const cssPath = path.join(__dirname, "..", "..", "src", "index.css");
const css = fs.readFileSync(cssPath, "utf8");

test("Parchment brand tokens are gone", () => {
  assert.ok(!css.includes("parchment"), "no --color-parchment-* tokens");
  assert.ok(!css.includes("--color-brand-"), "no --color-brand-* tokens");
  assert.ok(!css.includes("--color-pattern"), "no --color-pattern token");
});

test("neutral Win11 surface tokens are present (light + dark)", () => {
  assert.ok(css.includes("#f3f3f3"), "light background #f3f3f3");
  assert.ok(css.includes("#202020"), "dark background #202020");
  assert.ok(css.includes("#2b2b2b"), "dark surface #2b2b2b");
});

test("font stack starts with Segoe UI on Windows", () => {
  assert.ok(css.includes('"Segoe UI Variable Text"'), "Segoe UI Variable Text in font stack");
  assert.ok(css.includes("--font-family-sans:"));
});

test("accent token exists with the Win11 fallback", () => {
  assert.ok(css.includes("--color-accent: #0067c0"), "accent fallback declared");
});

test("primary follows the dynamic accent", () => {
  assert.ok(css.includes("--color-primary: var(--color-accent)"), "primary maps to accent");
});
