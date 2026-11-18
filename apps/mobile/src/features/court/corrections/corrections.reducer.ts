import type { TeamSide } from "@sacou/match-engine";

/**
 * What screen 24 keeps: the point picked and the little sheet of "Girar". Everything else comes from
 * the log. `selected` is validated on every read, since the event may have left the timeline.
 */
export interface CorrectionsState {
  readonly selected: string | null;
  readonly sheet: "none" | "shift";
  readonly shiftTeam: TeamSide;
  /** Why the last command did nothing; any new pick or sheet clears it. */
  readonly refusal: string | null;
}

export type CorrectionsAction =
  | { readonly type: "point-tapped"; readonly eventId: string }
  | { readonly type: "selection-cleared" }
  | { readonly type: "shift-opened" }
  | { readonly type: "shift-team-chosen"; readonly team: TeamSide }
  | { readonly type: "shift-closed" }
  | { readonly type: "command-refused"; readonly text: string }
  | { readonly type: "command-accepted" };

export const INITIAL_CORRECTIONS: CorrectionsState = {
  selected: null,
  sheet: "none",
  shiftTeam: "a",
  refusal: null,
};

export function correctionsReducer(
  state: CorrectionsState,
  action: CorrectionsAction,
): CorrectionsState {
  switch (action.type) {
    case "point-tapped":
      // Tapping the picked point again picks nothing; a pick closes the sheet of "Girar".
      return {
        ...state,
        selected: state.selected === action.eventId ? null : action.eventId,
        sheet: "none",
        refusal: null,
      };
    case "selection-cleared":
      return { ...state, selected: null };
    case "shift-opened":
      return { ...state, selected: null, sheet: "shift", refusal: null };
    case "shift-team-chosen":
      return { ...state, shiftTeam: action.team };
    case "shift-closed":
      return { ...state, sheet: "none" };
    case "command-refused":
      return { ...state, refusal: action.text };
    case "command-accepted":
      return { ...state, refusal: null };
  }
}
