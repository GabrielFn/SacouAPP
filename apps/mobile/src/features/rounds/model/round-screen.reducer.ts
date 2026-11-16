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

export interface RoundScreenState {
  readonly sheet: RoundSheet;
  /** "Lista copiada." after the tap on "Copiar lista". */
  readonly copied: boolean;
}

export type RoundScreenAction =
  | { readonly type: "confirmed-opened" }
  | { readonly type: "remove-asked"; readonly memberId: string }
  | { readonly type: "leave-asked" }
  | { readonly type: "sheet-closed" }
  | { readonly type: "list-copied" };

export const initialRoundScreenState: RoundScreenState = {
  sheet: { kind: "none" },
  copied: false,
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
      return { ...state, copied: true };
  }
}
