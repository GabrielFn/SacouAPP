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
  const state: { value: CourtThemeChoice; chosen: boolean } = { value: SUN, chosen: false };

  function change(next: CourtThemeChoice): void {
    if (state.value === next) return;
    state.value = next;
    listeners.notify();
  }

  void store
    .getItem(COURT_THEME_KEY)
    .then((stored) => {
      // A choice made before the first read wins over it.
      if (!state.chosen && stored === NIGHT) change(NIGHT);
    })
    .catch(() => undefined);

  return {
    subscribe: (listener) => listeners.add(listener),
    snapshot: () => state.value,
    async set(choice) {
      state.chosen = true;
      change(choice);
      await store.setItem(COURT_THEME_KEY, choice);
    },
  };
}
