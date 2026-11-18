import { describe, expect, test, vi } from "vitest";

import { createMemoryKeyValueStore } from "./memory-key-value-store";
import {
  COURT_THEME_KEY,
  createStoredCourtThemePreference,
} from "./stored-court-theme-preference";

async function settle(): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, 0));
}

describe("the court theme preference", () => {
  test("is sun until the person chooses", () => {
    expect(createStoredCourtThemePreference(createMemoryKeyValueStore()).snapshot()).toBe("sun");
  });

  test("choosing night tells the listeners and is stored", async () => {
    const store = createMemoryKeyValueStore();
    const preference = createStoredCourtThemePreference(store);
    const listener = vi.fn();
    preference.subscribe(listener);
    await preference.set("night");
    expect(preference.snapshot()).toBe("night");
    expect(listener).toHaveBeenCalledTimes(1);
    expect(store.entries().get(COURT_THEME_KEY)).toBe("night");
  });

  test("survives a new start: the stored night is read back", async () => {
    const store = createMemoryKeyValueStore();
    await createStoredCourtThemePreference(store).set("night");
    const again = createStoredCourtThemePreference(store);
    await settle();
    expect(again.snapshot()).toBe("night");
  });

  test("a store that fails reads as sun and a choice still works", async () => {
    const store = createMemoryKeyValueStore();
    const broken = { ...store, getItem: () => Promise.reject(new Error("disk")) };
    const preference = createStoredCourtThemePreference(broken);
    await settle();
    expect(preference.snapshot()).toBe("sun");
    await preference.set("night");
    expect(preference.snapshot()).toBe("night");
  });

  test("going back to sun is stored too", async () => {
    const store = createMemoryKeyValueStore();
    const preference = createStoredCourtThemePreference(store);
    await preference.set("night");
    await preference.set("sun");
    expect(store.entries().get(COURT_THEME_KEY)).toBe("sun");
    expect(preference.snapshot()).toBe("sun");
  });
});
