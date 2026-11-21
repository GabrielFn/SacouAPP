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

/**
 * The open session of this device with a match on, read from the log (the one source): `null` with
 * none, with the match ended, or with a log that does not load (the home never breaks on it).
 */
export async function readActiveCourt(
  { log, replayer }: Pick<CourtRuntime, "log" | "replayer">,
  { includeSamples }: ActiveCourtOptions,
): Promise<ActiveCourt | null> {
  const active = await log.findActiveSession();
  if (!active.ok || active.value === null) return null;
  const courtSessionId = active.value;
  const origin = await log.findOrigin(courtSessionId);
  if (!origin.ok || (origin.value === null && !includeSamples)) return null;
  const loaded = await loadCourtSession(log, replayer, courtSessionId);
  if (!loaded.ok) return null;
  const replayed = replayer.replay(courtSessionId, loaded.value.events);
  if (!replayed.ok) return null;
  const state = stateOfTimeline(replayed.value);
  if (!isMatchInPlay(selectCourtPhase(state))) return null;
  const score = state.currentMatch?.currentSet?.score ?? LEVEL_SCORE;
  return { courtSessionId, origin: origin.value, score };
}
