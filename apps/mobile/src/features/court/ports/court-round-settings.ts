import type { CourtSessionOrigin } from "./court-event-log";

/**
 * The options of the round a court session came from, as the court needs them. They are server data,
 * so they are read from where it lives (the TanStack cache), never copied into the court log.
 */
export interface CourtRoundSettings {
  /**
   * "Ponto individual" of the resolved settings of the round (E4.10, D10). `false` when the round is
   * not known on the phone or its settings do not parse: screen 31 never opens on a guess.
   */
  individualPoints(origin: CourtSessionOrigin): boolean;
}
