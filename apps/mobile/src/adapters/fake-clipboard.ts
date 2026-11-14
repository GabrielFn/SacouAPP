import type { Clipboard } from "../services/clipboard/clipboard";

export interface FakeClipboard extends Clipboard {
  /** The last text copied, or `null` before any copy. */
  readonly text: () => string | null;
}

export function createFakeClipboard(): FakeClipboard {
  const state = { value: null as string | null };
  return {
    setText: (text) => {
      state.value = text;
      return Promise.resolve();
    },
    text: () => state.value,
  };
}
