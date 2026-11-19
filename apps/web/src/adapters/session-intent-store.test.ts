import { describe, expect, it } from "vitest";

import { createSessionIntentStore, type StorageLike } from "./session-intent-store";

function memory(): StorageLike & { readonly items: Map<string, string> } {
  const items = new Map<string, string>();
  return {
    items,
    getItem: (key) => items.get(key) ?? null,
    setItem: (key, value) => items.set(key, value),
    removeItem: (key) => items.delete(key),
  };
}

describe("createSessionIntentStore", () => {
  it("gives the intent back once", () => {
    const storage = memory();
    const store = createSessionIntentStore(storage);
    store.keep("notGoing");
    expect(store.take()).toBe("notGoing");
    expect(store.take()).toBeNull();
    expect(storage.items.size).toBe(0);
  });

  it("ignores a value that is no intent", () => {
    const storage = memory();
    storage.setItem("sacou.round-page.intent", "<script>");
    expect(createSessionIntentStore(storage).take()).toBeNull();
  });

  it("survives a storage that refuses", () => {
    const refusing: StorageLike = {
      getItem: () => {
        throw new Error("denied");
      },
      setItem: () => {
        throw new Error("denied");
      },
      removeItem: () => undefined,
    };
    const store = createSessionIntentStore(refusing);
    expect(() => {
      store.keep("going");
    }).not.toThrow();
    expect(store.take()).toBeNull();
  });
});
