import {
  getLineupBySlot,
  MIDDLE_BLOCKER_LINEUP_INDEXES,
  type MemberId,
  type TeamState,
} from "@sacou/match-engine";
import { ROTATION_SLOTS, type SetterZone } from "@sacou/volley-rules";

/** The allocation screen 22 edits: the whole state of one team, whose `system` never changes here. */
export type LineupDraft = TeamState;

/** Where the libero who leaves goes: back to the queue (pre-game) or to the end of the bench (match). */
export type LiberoExit = "out" | "bench";

/** The slot a member of `lineup` stands in now, or `null` when the member is not in it. */
export function slotOf(draft: Pick<TeamState, "lineup" | "setterZone">, memberId: MemberId) {
  const index = getLineupBySlot(draft.lineup, draft.setterZone).indexOf(memberId);
  return index < 0 ? null : (ROTATION_SLOTS[index] ?? null);
}

/**
 * A tap on two members on the court: each takes the index of the other, and so its place and its
 * role; the zone stays (D3). Anyone outside `lineup` leaves the draft as it is.
 */
export function swapInLineup(draft: LineupDraft, first: MemberId, second: MemberId): LineupDraft {
  const { lineup } = draft;
  if (first === second || !lineup.includes(first) || !lineup.includes(second)) return draft;
  const swapped = lineup.map((memberId) => {
    if (memberId === first) return second;
    return memberId === second ? first : memberId;
  });
  return { ...draft, lineup: swapped };
}

/** The rotation selector: everyone turns together, so only the zone of the setter changes (D4). */
export function withSetterZone(draft: LineupDraft, setterZone: SetterZone): LineupDraft {
  return draft.setterZone === setterZone ? draft : { ...draft, setterZone };
}

/**
 * "Tornar levantador" (D4): `lineup` turns so the chosen member is `lineup[0]`, and the zone becomes
 * the one the member stands in, so nobody moves on the court; only who sets, and so the roles, change.
 */
export function reanchor(draft: LineupDraft, memberId: MemberId): LineupDraft {
  const at = draft.lineup.indexOf(memberId);
  const zone = slotOf(draft, memberId);
  if (at <= 0 || zone === null) return draft;
  return {
    ...draft,
    lineup: [...draft.lineup.slice(at), ...draft.lineup.slice(0, at)],
    setterZone: zone,
  };
}

/** The libero covers the two middle blockers, always (ADR 0028, D5). */
function liberoOf(memberId: MemberId) {
  return { memberId, replacedIndexes: MIDDLE_BLOCKER_LINEUP_INDEXES };
}

/**
 * Another libero, or none (D5). The new one leaves the bench, if it was there; the one who leaves goes
 * back to the queue in the pre-game, or to the end of the bench in a match. Never out of `lineup`.
 */
export function withLibero(
  draft: LineupDraft,
  memberId: MemberId | null,
  exit: LiberoExit,
): LineupDraft {
  const current = draft.libero?.memberId ?? null;
  if (current === memberId || (memberId !== null && draft.lineup.includes(memberId))) return draft;
  const bench = draft.bench.filter((id) => id !== memberId);
  return {
    ...draft,
    bench: exit === "bench" && current !== null ? [...bench, current] : bench,
    libero: memberId === null ? null : liberoOf(memberId),
  };
}

/**
 * A reserve of the queue goes to the bench, or comes back (R96). The bench is always `pool` filtered,
 * so it keeps the order of the queue and undoing puts each one back where it was. Never the libero,
 * nor anyone of `lineup`, nor anyone outside `pool`.
 */
export function toggleBench(
  draft: LineupDraft,
  memberId: MemberId,
  pool: readonly MemberId[],
): LineupDraft {
  if (
    !pool.includes(memberId) ||
    draft.lineup.includes(memberId) ||
    draft.libero?.memberId === memberId
  )
    return draft;
  const inBench = draft.bench.includes(memberId);
  const next = inBench
    ? draft.bench.filter((id) => id !== memberId)
    : [...draft.bench, memberId];
  return { ...draft, bench: pool.filter((id) => next.includes(id)) };
}
