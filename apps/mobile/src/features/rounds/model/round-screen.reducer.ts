/**
 * The sheets of screens 06 and 26 and the "copied" note (frontend.md, rule 4). Only one sheet at a time:
 * "Tirar" swaps the list for its confirmation, because two `Modal`s do not stack on Android.
 */
export type RoundSheet =
  | { readonly kind: "none" }
  | { readonly kind: "confirmed" }
  /** "Tirar" of the list asks first (question 47). Only the ID: the name comes from the members query. */
  | { readonly kind: "remove"; readonly memberId: string }
  /** "Não vou mais" with the list full asks first (D7). */
  | { readonly kind: "leave" };

/** The note under "Copiar lista": none, "Lista copiada." or the failure, until it is cleared. */
export type CopyNote = "none" | "copied" | "failed";

export interface RoundScreenState {
  readonly sheet: RoundSheet;
  readonly copyNote: CopyNote;
}

export type RoundScreenAction =
  | { readonly type: "confirmed-opened" }
  | { readonly type: "remove-asked"; readonly memberId: string }
  | { readonly type: "leave-asked" }
  | { readonly type: "sheet-closed" }
  | { readonly type: "list-copied" }
  | { readonly type: "copy-failed" }
  /** The note goes away a moment after it shows (the hook keeps the timer, not the reducer). */
  | { readonly type: "copy-note-cleared" };

export const initialRoundScreenState: RoundScreenState = {
  sheet: { kind: "none" },
  copyNote: "none",
};

export function roundScreenReducer(
  state: RoundScreenState,
  action: RoundScreenAction,
): RoundScreenState {
  switch (action.type) {
    case "confirmed-opened":
      return { ...state, sheet: { kind: "confirmed" } };
    case "remove-asked":
      return { ...state, sheet: { kind: "remove", memberId: action.memberId } };
    case "leave-asked":
      return { ...state, sheet: { kind: "leave" } };
    case "sheet-closed":
      return { ...state, sheet: { kind: "none" } };
    case "list-copied":
      return { ...state, copyNote: "copied" };
    case "copy-failed":
      return { ...state, copyNote: "failed" };
    case "copy-note-cleared":
      return { ...state, copyNote: "none" };
  }
}
