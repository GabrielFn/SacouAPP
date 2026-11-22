import type { RoundSummary } from "../../../services/api/sacou-api";
import type { RoundEnd } from "../ports/round-end-lookup";

const HOUR_MS = 3_600_000;
const LIST_TRUST_HOURS = 24;
/**
 * How long the silence of a list of rounds is trusted (R97, risk of D4): `GET /rounds` lists the future
 * rounds and the ones of the last 24 h, so a round missing from a list read in that time has ended.
 */
export const ROUND_LIST_TRUST_MS = LIST_TRUST_HOURS * HOUR_MS;

const RESUME_GRACE_MINUTES = 30;
const MINUTE_MS = 60_000;
/**
 * After the end of the round the court still opens on its own for this long (R97, D4, ADR 0074): an
 * app that died in the last rally of a match that ran over the scheduled end comes back to it.
 */
export const RESUME_GRACE_MS = RESUME_GRACE_MINUTES * MINUTE_MS;

/** The cached list of rounds of a group and when it was read, or `undefined` when there is none. */
export interface CachedRoundList {
  readonly rounds: readonly RoundSummary[];
  readonly updatedAt: number;
}

/**
 * Whether the silence of the list says the round has ended: the list is recent, and it was read after
 * the session opened. A list read before may predate the round (created on another phone, opened from
 * the push), so it says nothing of it; nor does it when the opening is not known.
 */
function trustsAbsence(list: CachedRoundList, openedAt: number | null, now: number): boolean {
  return (
    openedAt !== null && list.updatedAt > openedAt && now - list.updatedAt < ROUND_LIST_TRUST_MS
  );
}

/** What the cached list says of the end of the round of a session opened at `openedAt` (R97, D4, D5). */
export function roundEndOf(
  list: CachedRoundList | undefined,
  roundId: string,
  openedAt: number | null,
  now: number,
): RoundEnd {
  if (list === undefined) return { kind: "unknown" };
  const round = list.rounds.find((candidate) => candidate.roundId === roundId);
  if (round !== undefined) {
    return {
      kind: "listed",
      endsAt: Date.parse(round.endsAt),
      localDate: round.localDate,
      canceled: round.status === "canceled",
    };
  }
  return trustsAbsence(list, openedAt, now) ? { kind: "gone" } : { kind: "unknown" };
}

/**
 * Whether the round has ended `grace` milliseconds ago or more: `true`, `false`, or `null` when the
 * device does not know. A canceled round has ended; an `endsAt` that does not parse is not known.
 */
export function hasRoundEnded(end: RoundEnd, now: number, grace = 0): boolean | null {
  switch (end.kind) {
    case "unknown":
      return null;
    case "gone":
      return true;
    case "listed":
      if (end.canceled) return true;
      return Number.isNaN(end.endsAt) ? null : now >= end.endsAt + grace;
  }
}
