import type { CourtEventLog } from "../ports/court-event-log";
import type { CourtRoundSettings } from "../ports/court-round-settings";

/**
 * Whether screen 31 asks "De quem foi?" in this session: only with "Ponto individual" on in the
 * resolved settings of its round. A sample session, or a log that cannot say where the session came
 * from, is off (E4.10, D10).
 */
export async function readIndividualPoints(
  log: Pick<CourtEventLog, "findSessionOrigin">,
  settings: CourtRoundSettings,
  courtSessionId: string,
): Promise<boolean> {
  const origin = await log.findSessionOrigin(courtSessionId);
  return origin.ok && origin.value !== null && settings.individualPoints(origin.value);
}
