import type { MemberId } from "@sacou/match-engine";

import {
  isLocked,
  placeOf,
  sameLock,
  touches,
  type DrawArrangement,
  type DrawLock,
} from "./draw-arrangement";
import { MAX_DRAW_LOCKS } from "./draw-limits";
import { swapPlayers } from "./swap-players";

/** The local notice of the last tap: a lock that went away, or a lock the app refused. */
export type DrawNotice =
  | { readonly kind: "lock-broken"; readonly lock: DrawLock }
  | { readonly kind: "reserve-cannot-lock" }
  | { readonly kind: "too-many-locks" };

/** What a second name changes: the arrangement, the locks and the notice. The selection always clears. */
export interface TapOutcome {
  readonly arrangement: DrawArrangement;
  readonly locks: readonly DrawLock[];
  readonly notice: DrawNotice | null;
}

/**
 * "Trocar" with a second name. A swap that moves a locked member takes its locks away: the swap by hand
 * wins over the lock (D3), and the notice names the first lock that went.
 */
export function swapOutcome(
  arrangement: DrawArrangement,
  locks: readonly DrawLock[],
  pair: DrawLock,
): TapOutcome {
  const next = swapPlayers(arrangement, pair.first, pair.second);
  if (next === arrangement) return { arrangement, locks, notice: null };
  const broken = locks.filter((lock) => touches(lock, pair.first) || touches(lock, pair.second));
  const [firstBroken] = broken;
  return {
    arrangement: next,
    locks: locks.filter((lock) => !broken.includes(lock)),
    notice: firstBroken === undefined ? null : { kind: "lock-broken", lock: firstBroken },
  };
}

/** "Travar dupla" with a second name: a reserve never locks, a pair is kept once, 24 at most. */
export function lockOutcome(
  arrangement: DrawArrangement,
  locks: readonly DrawLock[],
  pair: DrawLock,
): TapOutcome {
  const reserve = [pair.first, pair.second].some(
    (memberId) => placeOf(arrangement, memberId)?.kind !== "team",
  );
  if (reserve) return { arrangement, locks, notice: { kind: "reserve-cannot-lock" } };
  if (locks.some((lock) => sameLock(lock, pair))) return { arrangement, locks, notice: null };
  if (locks.length >= MAX_DRAW_LOCKS) {
    return { arrangement, locks, notice: { kind: "too-many-locks" } };
  }
  return { arrangement, locks: [...locks, pair], notice: null };
}

/** Takes away every lock of the member ("Destravar"). */
export function unlockMember(locks: readonly DrawLock[], memberId: MemberId): readonly DrawLock[] {
  return isLocked(locks, memberId) ? locks.filter((lock) => !touches(lock, memberId)) : locks;
}
