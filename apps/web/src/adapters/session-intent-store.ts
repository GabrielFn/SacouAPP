import type { PendingIntentStore } from "../round-page/ports";
import type { Intent } from "../round-page/round-page.types";

/** The parts of `sessionStorage` the store uses. */
export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

const KEY = "sacou.round-page.intent";
const INTENTS: readonly Intent[] = ["going", "notGoing"];

/**
 * The intent across the Google redirect only: the tab's session storage, read once and removed. Never the URL, so it
 * is in no history, log or referrer (ADR 0070, D4). A storage that refuses (private mode) loses the intent, nothing else.
 */
export function createSessionIntentStore(storage: StorageLike): PendingIntentStore {
  return {
    keep: (intent) => {
      try {
        storage.setItem(KEY, intent);
      } catch {
        // No storage: after the redirect the person taps VOU again.
      }
    },
    take: () => {
      try {
        const kept = storage.getItem(KEY);
        storage.removeItem(KEY);
        return INTENTS.find((intent) => intent === kept) ?? null;
      } catch {
        return null;
      }
    },
  };
}
