/**
 * Whether the round can be closed now. The server refuses before the start time unless a match was
 * already finished (ADR 0076, `sessions.round-not-started`); the sheet says so before asking.
 */
export type EndRoundAvailability = "open" | "not-started";

export interface EndRoundAvailabilityInput {
  /** ISO start of the round from the phone's cache; `null` when it is not there (the server decides). */
  readonly startsAt: string | null;
  /** Wall-clock time in milliseconds. */
  readonly nowMs: number;
  readonly finishedMatches: number;
}

export function endRoundAvailability(input: EndRoundAvailabilityInput): EndRoundAvailability {
  if (input.finishedMatches > 0 || input.startsAt === null) return "open";
  const startsAtMs = Date.parse(input.startsAt);
  if (Number.isNaN(startsAtMs)) return "open";
  return input.nowMs < startsAtMs ? "not-started" : "open";
}
