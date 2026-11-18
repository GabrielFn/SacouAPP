import type { CourtSessionOrigin } from "../features/court/ports/court-event-log";
import type { CourtRoundSettings } from "../features/court/ports/court-round-settings";

/** The settings of the rounds a test turns "Ponto individual" on for, by round ID. */
export function createFakeCourtRoundSettings(
  roundsWithIndividualPoints: readonly string[] = [],
): CourtRoundSettings {
  return {
    individualPoints: ({ roundId }: CourtSessionOrigin) =>
      roundsWithIndividualPoints.includes(roundId),
  };
}
