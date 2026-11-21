import {
  LIBERO_SYSTEMS,
  MIDDLE_BLOCKER_LINEUP_INDEXES,
  type MemberId,
  type TeamState,
} from "@sacou/match-engine";

import type { SavedLineup } from "./pre-game";

function sameMembers(left: readonly MemberId[], right: readonly MemberId[]): boolean {
  return left.length === right.length && left.every((memberId) => right.includes(memberId));
}

/** The libero holds only in the 5x1 and the 6x2, and only while still a free reserve (D5). */
function liberoOf(base: TeamState, saved: SavedLineup, pool: readonly MemberId[]) {
  const { libero } = saved;
  if (libero === null || !LIBERO_SYSTEMS.includes(base.system) || !pool.includes(libero))
    return null;
  return { memberId: libero, replacedIndexes: MIDDLE_BLOCKER_LINEUP_INDEXES };
}

/** The bench holds for who is still a free reserve, in the order of the queue, never the libero (R96). */
function benchOf(
  saved: SavedLineup,
  pool: readonly MemberId[],
  libero: TeamState["libero"],
): readonly MemberId[] {
  return pool.filter((memberId) => saved.bench.includes(memberId) && memberId !== libero?.memberId);
}

/**
 * The lineup a team starts with (E4.8, D3): the one saved on screen 22 while it is still a lineup of
 * this team with this system, else the default. Derived on each read, with no effect that syncs it:
 * a swap on the 07 or another system on the 08 brings the default back by itself. `pool` is who can
 * be the libero or on the bench: the free reserves of the queue, in order (R96).
 */
export function savedRotation(
  base: TeamState,
  saved: SavedLineup | undefined,
  pool: readonly MemberId[],
): TeamState {
  if (saved?.system !== base.system || !sameMembers(saved.lineup, base.lineup)) return base;
  const libero = liberoOf(base, saved, pool);
  return {
    ...base,
    lineup: saved.lineup,
    setterZone: saved.setterZone,
    bench: benchOf(saved, pool, libero),
    libero,
  };
}

/** What screen 22 saves for a team: the allocation and the system it holds for. */
export function toSavedLineup(state: TeamState): SavedLineup {
  return {
    system: state.system,
    lineup: state.lineup,
    setterZone: state.setterZone,
    libero: state.libero?.memberId ?? null,
    bench: state.bench,
  };
}

/** The liberos of the two teams: they leave the queue and join their team (D5). */
export function liberosOf(rotations: readonly (TeamState | null)[]): readonly MemberId[] {
  return rotations.flatMap((rotation) => {
    const libero = rotation?.libero ?? null;
    return libero === null ? [] : [libero.memberId];
  });
}

/** The reserves who wait on the bench of their team: they leave the queue and join it (R96). */
export function benchesOf(rotations: readonly (TeamState | null)[]): readonly MemberId[] {
  return rotations.flatMap((rotation) => rotation?.bench ?? []);
}
