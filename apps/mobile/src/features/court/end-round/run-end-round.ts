import { err, ok, type Result } from "@sacou/volley-rules";

import type { ApiError } from "../../../services/api/api-error";
import type { SacouApi } from "../../../services/api/sacou-api";
import type { CourtEventLog, CourtSessionOrigin } from "../ports/court-event-log";
import type { CourtSyncHooks } from "../ports/court-sync";
import type { EndRoundFailure } from "./end-round.reducer";

const ROUND_NOT_STARTED = "sessions.round-not-started";

export interface EndRoundTarget extends CourtSessionOrigin {
  readonly courtSessionId: string;
}

export interface EndRoundPorts {
  readonly log: Pick<CourtEventLog, "closeSession">;
  readonly sync: Pick<CourtSyncHooks, "notifyAppended">;
  readonly api: Pick<SacouApi, "closeRound">;
}

export interface EndRoundOutcome {
  /** The server marked the end of the round: the cached round (its `endsAt`) is stale. */
  readonly serverClosed: boolean;
}

function isNotStarted(error: ApiError): boolean {
  return error.kind === "problem" && error.status === 409 && error.code === ROUND_NOT_STARTED;
}

/**
 * "Encerrar rodada" (E4.12, question 150). The server goes first and is best effort: offline, a 5xx or a
 * canceled round do not stop the user, since the round ends on its own 6 h after it starts (E3.18, D1),
 * and nothing is queued to try again. The one answer that stops it is "the round has not started", which
 * must reach the user before the court is closed. Then the session closes on the phone (the points keep
 * being sent) and an upload starts at once.
 */
export async function runEndRound(
  { log, sync, api }: EndRoundPorts,
  target: EndRoundTarget,
): Promise<Result<EndRoundOutcome, EndRoundFailure>> {
  const closed = await api.closeRound(target.groupId, target.roundId);
  if (!closed.ok && isNotStarted(closed.error)) return err("round-not-started");
  const session = await log.closeSession(target.courtSessionId);
  if (!session.ok) return err("storage");
  sync.notifyAppended();
  return ok({ serverClosed: closed.ok });
}
