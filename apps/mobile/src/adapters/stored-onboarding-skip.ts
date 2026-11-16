import type {
  OnboardingSkip,
  OnboardingSkipState,
} from "../features/profile/ports/onboarding-skip";
import type { KeyValueStore } from "../services/query/key-value-store";
import { createListeners } from "./listeners";

/** Its own row, beside the persisted cache and apart from it: the profile itself is never stored. */
export const ONBOARDING_SKIP_KEY = "onboarding-skipped";
const SKIPPED = "1";

/**
 * The flag of "Pular" over a `KeyValueStore`: the real one is the row in `sacou-cache.db`, the one of the
 * tests a map in memory. It is read once when created; a store that fails reads as not skipped.
 */
export function createStoredOnboardingSkip(store: KeyValueStore): OnboardingSkip {
  const listeners = createListeners();
  const state: { value: OnboardingSkipState } = { value: "unknown" };

  function set(next: OnboardingSkipState): void {
    if (state.value === next) return;
    state.value = next;
    listeners.notify();
  }

  void store
    .getItem(ONBOARDING_SKIP_KEY)
    .then((value) => {
      // A write that came first wins over the first read.
      if (state.value === "unknown") set(value === SKIPPED ? "skipped" : "notSkipped");
    })
    .catch(() => {
      if (state.value === "unknown") set("notSkipped");
    });

  return {
    subscribe: (listener) => listeners.add(listener),
    snapshot: () => state.value,
    async markSkipped() {
      set("skipped");
      await store.setItem(ONBOARDING_SKIP_KEY, SKIPPED);
    },
    async clear() {
      set("notSkipped");
      await store.removeItem(ONBOARDING_SKIP_KEY);
    },
  };
}
