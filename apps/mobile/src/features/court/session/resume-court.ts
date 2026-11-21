import { selectCourtPhase, stateOfTimeline } from "../model/court-screen.selectors";
import type { CourtPhase } from "../model/court-screen.types";
import type { CourtRuntime } from "../ports/court-runtime";
import type { RoundEndLookup } from "../ports/round-end-lookup";
import { loadCourtSession } from "./court-session-loader";
import { hasRoundEnded, RESUME_GRACE_MS } from "./round-end";

/** A match is on: being played, a set waiting for its confirmation, or a match with no set yet. */
export function isMatchInPlay(phase: CourtPhase): boolean {
  return phase === "playing" || phase === "set-decided" || phase === "match-pending";
}

export interface ResumeDeps extends Pick<CourtRuntime, "log" | "replayer"> {
  /** The end of the round of the session, from the cache (R97, D4). */
  readonly rounds: RoundEndLookup;
  /** The wall-clock time, in milliseconds. */
  readonly now: number;
}

/**
 * The open session of this device with a match being played, or `null`. A log that does not load is
 * not a reason to open the court: the user reaches it from the home, and the court shows the error.
 * Once its round has ended (plus a grace, ADR 0074) it no longer opens on its own: the bar "EM QUADRA"
 * of the home still leads to it. A round the device knows nothing of (offline on the first use)
 * resumes as before; a sample session has no round and always resumes.
 */
export async function findResumableCourtSession({
  log,
  replayer,
  rounds,
  now,
}: ResumeDeps): Promise<string | null> {
  const active = await log.findActiveSession();
  if (!active.ok || active.value === null) {
    return null;
  }
  const loaded = await loadCourtSession(log, replayer, active.value);
  if (!loaded.ok) {
    return null;
  }
  const replayed = replayer.replay(active.value, loaded.value.events);
  if (!replayed.ok || !isMatchInPlay(selectCourtPhase(stateOfTimeline(replayed.value)))) {
    return null;
  }
  const origin = await log.findOrigin(active.value);
  if (!origin.ok) return null;
  if (origin.value === null) return active.value;
  const openedAt = await log.findOpenedAt(active.value);
  if (!openedAt.ok) return null;
  const end = rounds.endOf(origin.value, openedAt.value, now);
  const ended = hasRoundEnded(end, now, RESUME_GRACE_MS);
  return ended === true ? null : active.value;
}
