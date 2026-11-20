import type { CourtAccount } from "../ports/court-account";
import type { CourtEventLog } from "../ports/court-event-log";
import type { UnsentSummary } from "../ports/court-sync";
import { countPoints, pendingEvents } from "./pending-events";

const NONE: UnsentSummary = { events: 0, points: 0 };

/**
 * What the account signed in still has to send, over every session it owns (question 84), or only the ones of one round (the warning of screen 12). A file that
 * cannot be read counts as nothing: the warning is a courtesy, the events stay in the log anyway.
 */
export async function countUnsent(
  {
    log,
    account,
  }: {
    readonly log: CourtEventLog;
    readonly account: CourtAccount;
  },
  roundId: string | null = null,
): Promise<UnsentSummary> {
  const current = await account.current();
  const device = await log.getDeviceId();
  if (current === null || !device.ok) return NONE;
  const sessions = await log.findSessionsToSync(device.value);
  if (!sessions.ok) return NONE;
  const owned = sessions.value.filter(
    (session) =>
      session.ownerKey === current.key && (roundId === null || session.roundId === roundId),
  );
  const loads = await Promise.all(owned.map((session) => log.load(session.courtSessionId)));
  return loads.reduce<UnsentSummary>((total, loaded) => {
    if (!loaded.ok) return total;
    const { events, batch, ackedSequence } = loaded.value;
    const pending = pendingEvents(events, { deviceId: device.value, batch, ackedSequence });
    return { events: total.events + pending.length, points: total.points + countPoints(pending) };
  }, NONE);
}
