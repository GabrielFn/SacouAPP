import type { KeyValueStore } from "../services/query/key-value-store";

export interface MemoryKeyValueStore extends KeyValueStore {
  /** What is stored now, for assertions. */
  entries(): ReadonlyMap<string, string>;
}

/** The `KeyValueStore` of the tests: a map in memory. */
export function createMemoryKeyValueStore(): MemoryKeyValueStore {
  const map = { value: new Map<string, string>() as ReadonlyMap<string, string> };
  return {
    getItem: (key) => Promise.resolve(map.value.get(key) ?? null),
    setItem(key, value) {
      map.value = new Map([...map.value, [key, value]]);
      return Promise.resolve();
    },
    removeItem(key) {
      map.value = new Map([...map.value].filter(([stored]) => stored !== key));
      return Promise.resolve();
    },
    entries: () => map.value,
  };
}
