import { readRoundCourt, type RoundCourt } from "../session/round-court";
import type { CourtRuntime } from "../ports/court-runtime";
import { useFocusedLogRead } from "./use-focused-log-read";

/** What the device knows of the court of a round: still reading the log, or what it found there. */
export type RoundCourtRead =
  { readonly status: "reading" } | { readonly status: "read"; readonly court: RoundCourt | null };

/** A log that does not load counts as no session here; the court itself shows the error. */
async function readOrNone(runtime: CourtRuntime, roundId: string): Promise<RoundCourt | null> {
  const result = await readRoundCourt(runtime, roundId);
  return result.ok ? result.value : null;
}

/**
 * The court session of a round on this device (screens 06 and 08). The log is the one source: this is
 * a read of it, done again each time the screen comes back to the front (after the court), never a
 * second copy that the screen edits.
 */
export function useRoundCourt(roundId: string): RoundCourtRead {
  const read = useFocusedLogRead(roundId, readOrNone);
  return read.status === "reading" ? read : { status: "read", court: read.value };
}
