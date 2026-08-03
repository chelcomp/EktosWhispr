const test = require("node:test");
const assert = require("node:assert/strict");
const { useSettingsStore } = require("../../src/stores/settingsStore.ts");

test("dictationBarPosition defaults to bottom", () => {
  assert.equal(useSettingsStore.getState().dictationBarPosition, "bottom");
});

test("setDictationBarPosition updates the value", () => {
  const store = useSettingsStore.getState();
  store.setDictationBarPosition("top");
  assert.equal(useSettingsStore.getState().dictationBarPosition, "top");
  store.setDictationBarPosition("bottom");
  assert.equal(useSettingsStore.getState().dictationBarPosition, "bottom");
});

test("setDictationBarPosition ignores invalid values", () => {
  const store = useSettingsStore.getState();
  store.setDictationBarPosition("top");
  store.setDictationBarPosition("sideways"); // not in the union
  assert.equal(useSettingsStore.getState().dictationBarPosition, "top");
  store.setDictationBarPosition("bottom");
});
