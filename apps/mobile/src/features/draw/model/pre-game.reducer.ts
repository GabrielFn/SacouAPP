import type { BestOf, TeamSide } from "@sacou/match-engine";
import type { FormationSystem } from "@sacou/volley-rules";

import { overrideOf, steppedPoints, type PreGameChoices, type SavedLineups } from "./pre-game";

/**
 * Sheet 08 lies over screen 07, in the same flow, so the draw never leaves the screen (D1); screen 22
 * opens from it in the same flow too, because the draw lives only here (E4.8, D1).
 */
export type DrawSheet = "none" | "pre-game" | "lineup" | "close-other";

/** The actions of sheet 08 (D3). Each `base` is the resolved setting of the round, never stored. */
export type PreGameAction =
  | { readonly type: "pre-game-opened" }
  | { readonly type: "pre-game-closed" }
  /** "−" or "+" of "Pontos por set". */
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
    }
  /** "Escalação" of the 08, and back from screen 22 without saving. */
  | { readonly type: "lineup-opened" }
  | { readonly type: "lineup-closed" }
  /** "Salvar escalação": the teams the admin changed, back to the 08. */
  | { readonly type: "lineup-saved"; readonly lineups: SavedLineups }
  /** "Começar partida" with a forgotten match of a round that ended (R97, D5): the sheet asks first. */
  | { readonly type: "close-other-asked" }
  /** "Cancelar" of that sheet, or its confirmation: back to the 08. */
  | { readonly type: "close-other-dismissed" };

/** The part of the flow of screen 07 that the sheet reads and writes. */
export interface PreGameSlice {
  readonly arrangement: object | null;
  readonly selection: string | null;
  readonly notice: object | null;
  readonly sheet: DrawSheet;
  readonly preGame: PreGameChoices;
}

/** Every action type of the sheet, checked complete by the compiler. */
const PRE_GAME_ACTION_TYPES: Readonly<Record<PreGameAction["type"], true>> = {
  "pre-game-opened": true,
  "pre-game-closed": true,
  "points-stepped": true,
  "best-of-chosen": true,
  "first-server-chosen": true,
  "rotation-tab-chosen": true,
  "system-chosen": true,
  "lineup-opened": true,
  "lineup-closed": true,
  "lineup-saved": true,
  "close-other-asked": true,
  "close-other-dismissed": true,
};

export function isPreGameAction<A extends { readonly type: string }>(
  action: A,
): action is Extract<A, PreGameAction> {
  return Object.hasOwn(PRE_GAME_ACTION_TYPES, action.type);
}

function withChoices<S extends PreGameSlice>(state: S, patch: Partial<PreGameChoices>): S {
  return { ...state, preGame: { ...state.preGame, ...patch } };
}

function pointsStepped<S extends PreGameSlice>(state: S, delta: number, base: number): S {
  const shown = state.preGame.pointsPerSet ?? base;
  return withChoices(state, { pointsPerSet: overrideOf(steppedPoints(shown, delta), base) });
}

function systemChosen<S extends PreGameSlice>(
  state: S,
  side: TeamSide,
  system: FormationSystem,
  base: FormationSystem,
): S {
  return withChoices(state, {
    systems: { ...state.preGame.systems, [side]: overrideOf(system, base) },
  });
}

/** The sheet opens only over a draw: without teams there is no match to start. */
function opened<S extends PreGameSlice>(state: S): S {
  return state.arrangement === null
    ? state
    : { ...state, sheet: "pre-game", selection: null, notice: null };
}

/** Screen 22 opens only over the 08. */
function lineupOpened<S extends PreGameSlice>(state: S): S {
  return state.sheet === "pre-game" ? { ...state, sheet: "lineup" } : state;
}

function lineupSaved<S extends PreGameSlice>(state: S, lineups: SavedLineups): S {
  const saved = withChoices(state, { lineups: { ...state.preGame.lineups, ...lineups } });
  return { ...saved, sheet: "pre-game" };
}

type LineupSheetAction = Extract<
  PreGameAction,
  { type: "lineup-opened" | "lineup-closed" | "lineup-saved" }
>;

const LINEUP_SHEET_ACTION_TYPES: readonly PreGameAction["type"][] = [
  "lineup-opened",
  "lineup-closed",
  "lineup-saved",
];

function isLineupSheetAction(action: PreGameAction): action is LineupSheetAction {
  return LINEUP_SHEET_ACTION_TYPES.includes(action.type);
}

/** Screen 22 over the 08 (E4.8, D1). */
function lineupSheetReducer<S extends PreGameSlice>(state: S, action: LineupSheetAction): S {
  switch (action.type) {
    case "lineup-opened":
      return lineupOpened(state);
    case "lineup-closed":
      return state.sheet === "lineup" ? { ...state, sheet: "pre-game" } : state;
    case "lineup-saved":
      return lineupSaved(state, action.lineups);
  }
}

type CloseOtherAction = Extract<
  PreGameAction,
  { type: "close-other-asked" | "close-other-dismissed" }
>;

function isCloseOtherAction(action: PreGameAction): action is CloseOtherAction {
  return action.type === "close-other-asked" || action.type === "close-other-dismissed";
}

/** The sheet "Encerrar a partida antiga?" over the 08 (R97, D5). */
function closeOtherReducer<S extends PreGameSlice>(state: S, action: CloseOtherAction): S {
  switch (action.type) {
    case "close-other-asked":
      return state.sheet === "pre-game" ? { ...state, sheet: "close-other" } : state;
    case "close-other-dismissed":
      return state.sheet === "close-other" ? { ...state, sheet: "pre-game" } : state;
  }
}

/** The sheet keeps only what differs from the round: back to the base, the choice goes (D3, D6). */
export function preGameReducer<S extends PreGameSlice>(state: S, action: PreGameAction): S {
  if (isLineupSheetAction(action)) return lineupSheetReducer(state, action);
  if (isCloseOtherAction(action)) return closeOtherReducer(state, action);
  switch (action.type) {
    case "pre-game-opened":
      return opened(state);
    case "pre-game-closed":
      return { ...state, sheet: "none" };
    case "points-stepped":
      return pointsStepped(state, action.delta, action.base);
    case "best-of-chosen":
      return withChoices(state, { bestOf: overrideOf(action.bestOf, action.base) });
    case "first-server-chosen":
      return withChoices(state, { firstServer: action.side });
    case "rotation-tab-chosen":
      return withChoices(state, { rotationTab: action.side });
    case "system-chosen":
      return systemChosen(state, action.side, action.system, action.base);
  }
}
