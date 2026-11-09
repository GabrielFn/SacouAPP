import type { EventEnvelope } from "@sacou/match-engine";
import { err, ok, type Result } from "@sacou/volley-rules";

import type { CourtEventLog } from "../ports/court-event-log";
import type { LoadFailureCode } from "./court-errors";
import type { CourtReplayer } from "./court-replay";

/** What a device needs to write: constants of the session, not state. */
export interface WriteContext {
  readonly deviceId: string;
  readonly batch: number;
}

export interface LoadedSession {
  readonly context: WriteContext;
  readonly events: readonly EventEnvelope[];
}

/**
 * Reads the persisted log and proves it replays before anything shows it: a log that does not
 * replay fails closed and is not erased (modelo-de-ameacas.md).
 */
export async function loadCourtSession(
  log: CourtEventLog,
  replayer: CourtReplayer,
  courtSessionId: string,
): Promise<Result<LoadedSession, LoadFailureCode>> {
  const device = await log.getDeviceId();
  if (!device.ok) {
    return err(device.error.code);
  }
  const stored = await log.load(courtSessionId);
  if (!stored.ok) {
    return err(stored.error.code);
  }
  const { batch, events } = stored.value;
  if (!replayer.replay(courtSessionId, events).ok) {
    return err("replay-failed");
  }
  return ok({ context: { deviceId: device.value, batch }, events });
}
