import type {
  CourtThemeChoice,
  CourtThemePreference,
} from "../features/court/ports/court-theme-preference";
import type { KeyValueStore } from "../services/query/key-value-store";
import { createListeners } from "./listeners";

/** Its own row, beside the persisted cache and apart from it. */
export const COURT_THEME_KEY = "court:theme";
const NIGHT = "night";
const SUN = "sun";

/**
 * The court theme over a `KeyValueStore`: the real one is a row of `sacou-cache.db`, the one of the
 * tests a map in memory. It is read once when created; a store that fails reads as sun.
 */
export function createStoredCourtThemePreference(store: KeyValueStore): CourtThemePreference {
  const listeners = createListeners();
  const state: { value: { readonly choice: CourtThemeChoice; readonly chosen: boolean } } = {
    value: { choice: SUN, chosen: false },
  };

  function change(next: CourtThemeChoice, chosen: boolean): void {
    const changed = state.value.choice !== next;
    state.value = { choice: next, chosen: state.value.chosen || chosen };
    if (changed) listeners.notify();
  }

  void store
    .getItem(COURT_THEME_KEY)
    .then((stored) => {
      // A choice made before the first read wins over it.
      if (!state.value.chosen && stored === NIGHT) change(NIGHT, false);
    })
    .catch(() => undefined);

  return {
    subscribe: (listener) => listeners.add(listener),
    snapshot: () => state.value.choice,
    async set(choice) {
      change(choice, true);
      await store.setItem(COURT_THEME_KEY, choice);
    },
  };
}
