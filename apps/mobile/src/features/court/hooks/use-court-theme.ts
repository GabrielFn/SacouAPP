import { useCallback, useSyncExternalStore } from "react";

import { useServices } from "../../../services/services-context";
import type { CourtThemeChoice } from "../ports/court-theme-preference";

export interface CourtThemeControl {
  readonly choice: CourtThemeChoice;
  readonly choose: (choice: CourtThemeChoice) => void;
}

/** The theme of the court, read from the preference and nowhere else (E4.10, D9). */
export function useCourtTheme(): CourtThemeControl {
  const { courtThemePreference } = useServices();
  const choice = useSyncExternalStore(
    courtThemePreference.subscribe,
    courtThemePreference.snapshot,
  );
  const choose = useCallback(
    (next: CourtThemeChoice) => {
      void courtThemePreference.set(next).catch(() => undefined);
    },
    [courtThemePreference],
  );
  return { choice, choose };
}
