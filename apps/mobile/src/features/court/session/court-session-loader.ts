import type { EventEnvelope } from "@sacou/match-engine";
import { err, ok, type Result } from "@sacou/volley-rules";

import type { CourtEventLog, SyncHaltCode } from "../ports/court-event-log";
import type { SessionOwner } from "../sync/session-ownership";
import type { LoadFailureCode } from "./court-errors";
import type { CourtReplayer } from "./court-replay";

/** What a device needs to write: constants of the session, not state. */
export interface WriteContext {
  readonly deviceId: string;
  readonly batch: number;
}

/** How the upload of the session stands, as the file says (ADR 0067, D1). */
export interface SessionSyncState {
  /** Another phone took the court over: this one writes nothing more (09b). */
  readonly takenOver: boolean;
  readonly syncHalt: SyncHaltCode | null;
}

export interface LoadedSession {
  readonly context: WriteContext;
  readonly events: readonly EventEnvelope[];
  readonly sync: SessionSyncState;
  readonly owner: SessionOwner;
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
  const { batch, events, takenOverBatch, syncHalt, fromRound, ownerKey } = stored.value;
  if (!replayer.replay(courtSessionId, events).ok) {
    return err("replay-failed");
  }
  return ok({
    context: { deviceId: device.value, batch },
    events,
    sync: { takenOver: takenOverBatch !== null, syncHalt },
    owner: { fromRound, ownerKey },
  });
}
