import type { SetScore } from "@sacou/match-engine";

import { selectCourtPhase, stateOfTimeline } from "../model/court-screen.selectors";
import type { CourtRuntime } from "../ports/court-runtime";
import type { CourtSessionOrigin } from "../ports/court-event-log";
import { loadCourtSession } from "./court-session-loader";
import { isMatchInPlay } from "./resume-court";

const LEVEL_SCORE: SetScore = { a: 0, b: 0 };

/** The match open on this device, as the bar "EM QUADRA" of the home shows it (R97, D1). */
export interface ActiveCourt {
  readonly courtSessionId: string;
  /** The round and the group, only IDs; `null` for a sample session of the development screen. */
  readonly origin: CourtSessionOrigin | null;
  /** The set in play, or 0 x 0 before its first rally. */
  readonly score: SetScore;
}

export interface ActiveCourtOptions {
  /** Whether a sample session (no round) counts: only with the development tools on. */
  readonly includeSamples: boolean;
}

/** The score of the set of a match on in the session, or `null` with none or a log that does not load. */
async function scoreInPlay(
  { log, replayer }: Pick<CourtRuntime, "log" | "replayer">,
  courtSessionId: string,
): Promise<SetScore | null> {
  const loaded = await loadCourtSession(log, replayer, courtSessionId);
  if (!loaded.ok) return null;
  const replayed = replayer.replay(courtSessionId, loaded.value.events);
  if (!replayed.ok) return null;
  const state = stateOfTimeline(replayed.value);
  if (!isMatchInPlay(selectCourtPhase(state))) return null;
  return state.currentMatch?.currentSet?.score ?? LEVEL_SCORE;
}

/**
 * The open session of this device with a match on, read from the log (the one source): `null` with
 * none, with the match ended, or with a log that does not load (the home never breaks on it).
 */
export async function readActiveCourt(
  runtime: Pick<CourtRuntime, "log" | "replayer">,
  { includeSamples }: ActiveCourtOptions,
): Promise<ActiveCourt | null> {
  const active = await runtime.log.findActiveSession();
  if (!active.ok || active.value === null) return null;
  const courtSessionId = active.value;
  const origin = await runtime.log.findOrigin(courtSessionId);
  if (!origin.ok || (origin.value === null && !includeSamples)) return null;
  const score = await scoreInPlay(runtime, courtSessionId);
  return score === null ? null : { courtSessionId, origin: origin.value, score };
}
