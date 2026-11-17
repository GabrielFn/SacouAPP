import type { CourtSessionState } from "@sacou/match-engine";
import { err, ok, type Result } from "@sacou/volley-rules";

import { stateOfTimeline } from "../model/court-screen.selectors";
import type { CourtRuntime } from "../ports/court-runtime";
import type { LoadFailureCode } from "./court-errors";
import { loadCourtSession } from "./court-session-loader";

/** The court session of a round on this device, as screens 06 and 08 need it (D1, D6). */
export interface RoundCourt {
  readonly courtSessionId: string;
  /** Matches already begun in the session, finished or not: "Partida N" is this plus one. */
  readonly startedMatches: number;
  /** A match not ended yet: a new one waits for it ("Termine a partida aberta antes."). */
  readonly openMatch: boolean;
}

export function summaryOf(courtSessionId: string, state: CourtSessionState): RoundCourt {
  const openMatch = state.currentMatch !== null;
  return {
    courtSessionId,
    startedMatches: state.finishedMatches.length + (openMatch ? 1 : 0),
    openMatch,
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
  const state = await sessionState(runtime, found.value);
  return state.ok ? ok(summaryOf(found.value, state.value)) : state;
}
