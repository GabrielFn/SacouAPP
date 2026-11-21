import type { CourtRuntime } from "../ports/court-runtime";
import { readOtherRoundCourt, type OtherRoundCourt } from "../session/other-round-court";
import { useFocusedLogRead } from "./use-focused-log-read";

/** What the device knows of a match open in another round: still reading the log, or what it found. */
export type OtherRoundCourtRead =
  | { readonly status: "reading" }
  | { readonly status: "read"; readonly court: OtherRoundCourt | null };

/**
 * A log that does not load counts as none here; the start then fails closed
 * (`ensureRoundCourtSession` keeps an unreadable session open).
 */
async function readOrNone(runtime: CourtRuntime, roundId: string): Promise<OtherRoundCourt | null> {
  const result = await readOtherRoundCourt(runtime, roundId);
  return result.ok ? result.value : null;
}

/** The match open in another round on this device (R97, D2), read on each focus of the 08. */
export function useOtherRoundCourt(roundId: string): OtherRoundCourtRead {
  const read = useFocusedLogRead(roundId, readOrNone);
  return read.status === "reading" ? read : { status: "read", court: read.value };
}
