import type { CourtSessionOrigin } from "./court-event-log";

/**
 * What the device knows of the end of the round of a court session (R97, ADR 0074), read from the
 * persisted list of rounds of its group. Only instants and the local date: nothing personal.
 */
export type RoundEnd =
  /** The round is in the list: its real end (`endsAt`, an early close included) and its date. */
  | {
      readonly kind: "listed";
      readonly endsAt: number;
      readonly localDate: string;
      readonly canceled: boolean;
    }
  /** A list read in the last 24 h does not hold it: it ended more than 24 h ago (`GET /rounds`). */
  | { readonly kind: "gone" }
  /** No list, or one too old to trust its silence: the device does not know (offline, first use). */
  | { readonly kind: "unknown" };

/** The end of the round of a session, from the cache; injected so the decisions stay pure. */
export interface RoundEndLookup {
  endOf(origin: CourtSessionOrigin, now: number): RoundEnd;
}
