import type { CourtSessionState } from "@sacou/match-engine";
import { err, ok, type Result } from "@sacou/volley-rules";

import { stateOfTimeline } from "../model/court-screen.selectors";
import type { CourtRuntime } from "../ports/court-runtime";
import type { LoadFailureCode } from "./court-errors";
import { loadCourtSession, type LoadedSession } from "./court-session-loader";

/** The court session of a round on this device, as screens 06 and 08 need it (D1, D6). */
export interface RoundCourt {
  readonly courtSessionId: string;
  /** Matches already begun in the session, finished or not: "Partida N" is this plus one. */
  readonly startedMatches: number;
  /** A match not ended yet: a new one waits for it ("Termine a partida aberta antes."). */
  readonly openMatch: boolean;
  /** The batch this device writes: the server's `currentBatch` says whether it still does (D5). */
  readonly batch: number;
  /** Another phone took the court over (09b). */
  readonly takenOver: boolean;
  /** Screen 09c still has points to show (D6). */
  readonly refusedUnseen: boolean;
}

export function summaryOf(
  courtSessionId: string,
  state: CourtSessionState,
  loaded: Pick<LoadedSession, "context" | "sync">,
): RoundCourt {
  const openMatch = state.currentMatch !== null;
  const { takenOver, refused, refusedUnseen } = loaded.sync;
  return {
    courtSessionId,
    startedMatches: state.finishedMatches.length + (openMatch ? 1 : 0),
    openMatch,
    batch: loaded.context.batch,
    takenOver,
    refusedUnseen: refusedUnseen && refused.length > 0,
  };
}

/** The state of a session from its replayed log: the log is the one source (frontend.md, rule 1). */
export async function sessionState(
  { log, replayer }: Pick<CourtRuntime, "log" | "replayer">,
  courtSessionId: string,
): Promise<Result<CourtSessionState, LoadFailureCode>> {
  const loaded = await loadCourtSession(log, replayer, courtSessionId);
  if (!loaded.ok) return loaded;
  const replayed = replayer.replay(courtSessionId, loaded.value.events);
  return replayed.ok ? ok(stateOfTimeline(replayed.value)) : err("replay-failed");
}

/** The open court session of this round, read from the log, or `null` when the device has none. */
export async function readRoundCourt(
  runtime: Pick<CourtRuntime, "log" | "replayer">,
  roundId: string,
): Promise<Result<RoundCourt | null, LoadFailureCode>> {
  const found = await runtime.log.findOpenSessionOfRound(roundId);
  if (!found.ok) return err(found.error.code);
  if (found.value === null) return ok(null);
  const loaded = await loadCourtSession(runtime.log, runtime.replayer, found.value);
  if (!loaded.ok) return loaded;
  const replayed = runtime.replayer.replay(found.value, loaded.value.events);
  if (!replayed.ok) return err("replay-failed");
  return ok(summaryOf(found.value, stateOfTimeline(replayed.value), loaded.value));
}
