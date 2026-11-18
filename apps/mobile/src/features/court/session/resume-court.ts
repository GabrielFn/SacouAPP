import { selectCourtPhase, stateOfTimeline } from "../model/court-screen.selectors";
import type { CourtRuntime } from "../ports/court-runtime";
import { loadCourtSession } from "./court-session-loader";

/**
 * The open session of this device with a match being played, or `null`. A log that does not load is
 * not a reason to open the court: the user reaches it from the home, and the court shows the error.
 */
export async function findResumableCourtSession({
  log,
  replayer,
}: Pick<CourtRuntime, "log" | "replayer">): Promise<string | null> {
  const active = await log.findActiveSession();
  if (!active.ok || active.value === null) {
    return null;
  }
  const loaded = await loadCourtSession(log, replayer, active.value);
  if (!loaded.ok) {
    return null;
  }
  const replayed = replayer.replay(active.value, loaded.value.events);
  if (!replayed.ok) {
    return null;
  }
  const phase = selectCourtPhase(stateOfTimeline(replayed.value));
  return phase === "playing" || phase === "set-decided" || phase === "match-pending"
    ? active.value
    : null;
}
