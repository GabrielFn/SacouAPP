/** What screen 22 keeps as the host of a match, around the editor (frontend.md, rule 4). */
export interface MatchLineupState {
  /** "Descartar as mudanças?" is open (D7). */
  readonly confirmingDiscard: boolean;
  /** Commands on their way: "Salvar" waits for them. */
  readonly saving: boolean;
  /** Why the last save did nothing, in words. */
  readonly refusal: string | null;
}

export type MatchLineupAction =
  | { readonly type: "discard-asked" }
  | { readonly type: "discard-cancelled" }
  | { readonly type: "save-started" }
  | { readonly type: "save-refused"; readonly text: string };

export const INITIAL_MATCH_LINEUP: MatchLineupState = {
  confirmingDiscard: false,
  saving: false,
  refusal: null,
};

export function matchLineupReducer(
  state: MatchLineupState,
  action: MatchLineupAction,
): MatchLineupState {
  switch (action.type) {
    case "discard-asked":
      return { ...state, confirmingDiscard: true };
    case "discard-cancelled":
      return { ...state, confirmingDiscard: false };
    case "save-started":
      return { ...state, saving: true, refusal: null };
    case "save-refused":
      return { ...state, saving: false, refusal: action.text };
  }
}
