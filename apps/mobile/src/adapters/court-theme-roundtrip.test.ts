import { describe, expect, test } from "vitest";

import { createMemoryKeyValueStore } from "./memory-key-value-store";
import { COURT_THEME_KEY, createStoredCourtThemePreference } from "./stored-court-theme-preference";

describe("court theme roundtrip", () => {
  test("an unknown stored value reads as sun", async () => {
    const store = createMemoryKeyValueStore();
    await store.setItem(COURT_THEME_KEY, "purple");
    const preference = createStoredCourtThemePreference(store);
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(preference.snapshot()).toBe("sun");
  });
});
