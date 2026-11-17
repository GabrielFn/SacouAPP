import type { BestOf, MemberId, TeamSide } from "@sacou/match-engine";
import type { FormationSystem } from "@sacou/volley-rules";

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
import { initialPreGameChoices, overrideOf, steppedPoints, type PreGameChoices } from "./pre-game";

/** What a second name does: swap the two (the default) or lock them together. */
export type DrawMode = "swap" | "lock";

/** Sheet 08 lies over screen 07, in this same flow, so the draw never leaves the screen (D1). */
export type DrawSheet = "none" | "pre-game";

/**
 * The flow of screen 07 (frontend.md, rule 4; ADR 0061). The draw is the one answer of a command that stores
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
  readonly sheet: DrawSheet;
  readonly preGame: PreGameChoices;
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
  | { readonly type: "lock-undone"; readonly lock: DrawLock }
  /** A new draw was asked offline: it is refused here, with a local notice. */
  | { readonly type: "offline-refused" }
  | { readonly type: "pre-game-opened" }
  | { readonly type: "pre-game-closed" }
  /** "−" or "+" of "Pontos por set"; `base` is the resolved setting of the round, never stored. */
  | { readonly type: "points-stepped"; readonly delta: number; readonly base: number }
  | { readonly type: "best-of-chosen"; readonly bestOf: BestOf; readonly base: BestOf }
  /** A tap on "A" or "B", or the side the coin gave for "Sortear" (D10). */
  | { readonly type: "first-server-chosen"; readonly side: TeamSide }
  | { readonly type: "rotation-tab-chosen"; readonly side: TeamSide }
  | {
      readonly type: "system-chosen";
      readonly side: TeamSide;
      readonly system: FormationSystem;
      readonly base: FormationSystem;
    };

export const initialDrawFlowState: DrawFlowState = {
  arrangement: null,
  locks: [],
  selection: null,
  mode: "swap",
  notice: null,
  sheet: "none",
  preGame: initialPreGameChoices,
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

function withPreGame(state: DrawFlowState, patch: Partial<PreGameChoices>): DrawFlowState {
  return { ...state, preGame: { ...state.preGame, ...patch } };
}

function pointsStepped(state: DrawFlowState, delta: number, base: number): DrawFlowState {
  const shown = state.preGame.pointsPerSet ?? base;
  return withPreGame(state, { pointsPerSet: overrideOf(steppedPoints(shown, delta), base) });
}

function systemChosen(
  state: DrawFlowState,
  side: TeamSide,
  system: FormationSystem,
  base: FormationSystem,
): DrawFlowState {
  return withPreGame(state, {
    systems: { ...state.preGame.systems, [side]: overrideOf(system, base) },
  });
}

/** The sheet opens only over a draw: without teams there is no match to start. */
function preGameOpened(state: DrawFlowState): DrawFlowState {
  return state.arrangement === null
    ? state
    : { ...state, sheet: "pre-game", selection: null, notice: null };
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
    case "offline-refused":
      return { ...state, notice: { kind: "offline" } };
    case "lock-undone":
      return { ...state, locks: state.locks.filter((lock) => !sameLock(lock, action.lock)) };
    case "pre-game-opened":
      return preGameOpened(state);
    case "pre-game-closed":
      return { ...state, sheet: "none" };
    case "points-stepped":
      return pointsStepped(state, action.delta, action.base);
    case "best-of-chosen":
      return withPreGame(state, { bestOf: overrideOf(action.bestOf, action.base) });
    case "first-server-chosen":
      return withPreGame(state, { firstServer: action.side });
    case "rotation-tab-chosen":
      return withPreGame(state, { rotationTab: action.side });
    case "system-chosen":
      return systemChosen(state, action.side, action.system, action.base);
  }
}

/** The lock the last tap added across two teams: it needs a new draw with the locks (D3, D5). */
export function lockAcrossTeams(before: DrawFlowState, after: DrawFlowState): DrawLock | null {
  if (after.arrangement === null || after.locks.length <= before.locks.length) return null;
  const added = after.locks.find((lock) => !before.locks.includes(lock));
  return added === undefined || sameTeam(after.arrangement, added) ? null : added;
}
