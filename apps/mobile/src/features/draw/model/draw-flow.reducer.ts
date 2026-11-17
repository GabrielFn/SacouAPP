import type { MemberId } from "@sacou/match-engine";

import type { DrawTeamsAnswer } from "../../../services/api/sacou-api";
import {
  arrangementOf,
  placeOf,
  sameLock,
  sameTeam,
  type DrawArrangement,
  type DrawLock,
} from "./draw-arrangement";
import { lockOutcome, swapOutcome, unlockMember, type DrawNotice } from "./player-tap";

/** What a second name does: swap the two (the default) or lock them together. */
export type DrawMode = "swap" | "lock";

/**
 * The flow of screen 07 (frontend.md, rule 4; ADR 0060). The draw is the one answer of a command that stores
 * nothing on the server and is edited by the swaps, so it lives only here: never in the query cache. The
 * request status stays in the TanStack mutation; titles, the meter and the hints are derived.
 */
export interface DrawFlowState {
  /** `null` until the first draw arrives. */
  readonly arrangement: DrawArrangement | null;
  readonly locks: readonly DrawLock[];
  readonly selection: MemberId | null;
  readonly mode: DrawMode;
  readonly notice: DrawNotice | null;
}

export type DrawFlowAction =
  | { readonly type: "drawn"; readonly answer: DrawTeamsAnswer }
  | { readonly type: "player-tapped"; readonly memberId: MemberId }
  | { readonly type: "swap-mode-chosen" }
  | { readonly type: "lock-mode-chosen" }
  /** "Destravar" of the selected member: every lock of it goes. */
  | { readonly type: "unlock-chosen" }
  | { readonly type: "selection-cleared" }
  /** A lock across teams asked for a new draw that the server refused: the lock goes back out. */
  | { readonly type: "lock-undone"; readonly lock: DrawLock };

export const initialDrawFlowState: DrawFlowState = {
  arrangement: null,
  locks: [],
  selection: null,
  mode: "swap",
  notice: null,
};

/** The server honours the `together` locks: any that came apart (someone left) is dropped. */
function drawn(state: DrawFlowState, answer: DrawTeamsAnswer): DrawFlowState {
  const arrangement = arrangementOf(answer);
  return {
    ...state,
    arrangement,
    locks: state.locks.filter((lock) => sameTeam(arrangement, lock)),
    selection: null,
    notice: null,
  };
}

function secondTap(
  state: DrawFlowState,
  arrangement: DrawArrangement,
  pair: DrawLock,
): DrawFlowState {
  const outcome =
    state.mode === "swap"
      ? swapOutcome(arrangement, state.locks, pair)
      : lockOutcome(arrangement, state.locks, pair);
  // One "Travar dupla" locks one pair: the next names swap again.
  return { ...state, ...outcome, selection: null, mode: "swap" };
}

function playerTapped(state: DrawFlowState, memberId: MemberId): DrawFlowState {
  const { arrangement, selection } = state;
  if (arrangement === null || placeOf(arrangement, memberId) === null) return state;
  if (selection === null) return { ...state, selection: memberId, notice: null };
  if (selection === memberId) return { ...state, selection: null, notice: null };
  return secondTap(state, arrangement, { first: selection, second: memberId });
}

function unlockChosen(state: DrawFlowState): DrawFlowState {
  if (state.selection === null) return state;
  return {
    ...state,
    locks: unlockMember(state.locks, state.selection),
    selection: null,
    mode: "swap",
    notice: null,
  };
}

export function drawFlowReducer(state: DrawFlowState, action: DrawFlowAction): DrawFlowState {
  switch (action.type) {
    case "drawn":
      return drawn(state, action.answer);
    case "player-tapped":
      return playerTapped(state, action.memberId);
    case "swap-mode-chosen":
      return { ...state, mode: "swap", notice: null };
    case "lock-mode-chosen":
      return { ...state, mode: "lock", notice: null };
    case "unlock-chosen":
      return unlockChosen(state);
    case "selection-cleared":
      return { ...state, selection: null, notice: null };
    case "lock-undone":
      return { ...state, locks: state.locks.filter((lock) => !sameLock(lock, action.lock)) };
  }
}

/** The lock the last tap added across two teams: it needs a new draw with the locks (D3, D5). */
export function lockAcrossTeams(before: DrawFlowState, after: DrawFlowState): DrawLock | null {
  if (after.arrangement === null || after.locks.length <= before.locks.length) return null;
  const added = after.locks.find((lock) => !before.locks.includes(lock));
  return added === undefined || sameTeam(after.arrangement, added) ? null : added;
}
