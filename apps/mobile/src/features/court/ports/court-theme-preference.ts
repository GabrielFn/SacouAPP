/** The two looks of the court: sun (screen 09) and night (screen 10). */
export type CourtThemeChoice = "sun" | "night";

/**
 * The look the person chose for the court, kept on this phone: the one place of the choice (E4.10,
 * D9). It is a preference with nothing personal in it. Until it is read from the phone it is sun.
 */
export interface CourtThemePreference {
  /** For `useSyncExternalStore`: the listener is called whenever `snapshot()` changes. */
  subscribe(listener: () => void): () => void;
  snapshot(): CourtThemeChoice;
  set(choice: CourtThemeChoice): Promise<void>;
}
