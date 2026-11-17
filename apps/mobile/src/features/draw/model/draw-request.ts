import type { MemberId } from "@sacou/match-engine";
import { err, ok, type Result } from "@sacou/volley-rules";

import type { DrawTeamsBody, Round } from "../../../services/api/sacou-api";
import { membersOf, placeOf, type DrawArrangement } from "./draw-arrangement";
import type { DrawFlowState } from "./draw-flow.reducer";
import { MAX_DRAW_LOCKS } from "./draw-limits";

/** Who left the list after the draw, and how many confirmed after it (D4). */
export interface StaleDraw {
  readonly left: readonly MemberId[];
  readonly arrived: number;
}

export function confirmedOf(round: Pick<Round, "going">): readonly MemberId[] {
  return round.going.map((entry) => entry.memberId);
}

/** Compares the draw with the round as the cache has it now; the refetch of the round brings the change. */
export function staleDraw(arrangement: DrawArrangement, round: Pick<Round, "going">): StaleDraw {
  const confirmed = new Set(confirmedOf(round));
  const drawn = new Set(membersOf(arrangement));
  return {
    left: membersOf(arrangement).filter((memberId) => !confirmed.has(memberId)),
    arrived: [...confirmed].filter((memberId) => !drawn.has(memberId)).length,
  };
}

export function isStale(stale: StaleDraw): boolean {
  return stale.left.length > 0 || stale.arrived > 0;
}

export type DrawRequestError = "too-many-locks" | "lock-on-reserve";

/**
 * The body of "Sortear de novo": every lock (`together`) and the reserves as they are after the swaps
 * (`sorteio.md`). When the list changed since, the queue no longer matches it: the reserves are left to the
 * server and the locks of who left are dropped. The server checks it all again.
 */
export function drawRequest(
  state: DrawFlowState,
  round: Pick<Round, "going">,
): Result<DrawTeamsBody, DrawRequestError> {
  const { arrangement } = state;
  if (state.locks.length > MAX_DRAW_LOCKS) return err("too-many-locks");
  if (arrangement === null) return ok({});
  const confirmed = new Set(confirmedOf(round));
  const locks = state.locks.filter(
    (lock) => confirmed.has(lock.first) && confirmed.has(lock.second),
  );
  const onReserve = locks.some(
    (lock) =>
      placeOf(arrangement, lock.first)?.kind === "reserve" ||
      placeOf(arrangement, lock.second)?.kind === "reserve",
  );
  if (onReserve) return err("lock-on-reserve");
  const body = { locks: locks.map((lock) => ({ ...lock, kind: "together" as const })) };
  return ok(
    isStale(staleDraw(arrangement, round))
      ? body
      : { ...body, reserves: [...arrangement.reserves] },
  );
}
