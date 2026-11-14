import type { ShareSheet } from "../services/share/share-sheet";

export interface FakeShareSheet extends ShareSheet {
  /** Every text shared, in order. */
  readonly shared: () => readonly string[];
}

export function createFakeShareSheet(): FakeShareSheet {
  const log = { value: [] as readonly string[] };
  return {
    share: (text) => {
      log.value = [...log.value, text];
      return Promise.resolve();
    },
    shared: () => log.value,
  };
}
