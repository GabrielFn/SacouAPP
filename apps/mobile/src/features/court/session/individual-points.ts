import type { CourtEventLog, CourtSessionOrigin } from "../ports/court-event-log";
import type { CourtRoundSettings } from "../ports/court-round-settings";

/** The round a court session came from; `null` for a sample session or a log that cannot say. */
export async function findSessionOrigin(
  log: Pick<CourtEventLog, "findSessionOrigin">,
  courtSessionId: string,
): Promise<CourtSessionOrigin | null> {
  const origin = await log.findSessionOrigin(courtSessionId);
  return origin.ok ? origin.value : null;
}

/**
 * Whether screen 31 asks "De quem foi?": only with "Ponto individual" on in the resolved settings of
 * the round. An unknown origin is off (E4.10, D10). Read on each draw, so no copy of the option exists.
 */
export function isIndividualPoints(
  origin: CourtSessionOrigin | null | undefined,
  settings: CourtRoundSettings,
): boolean {
  return origin !== null && origin !== undefined && settings.individualPoints(origin);
}
