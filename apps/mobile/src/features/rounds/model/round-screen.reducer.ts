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
export type CopyNote = "none" | "copied" | "copied-with-link" | "failed";

/** The note when the share sheet could not open (R101 item 1): "Use Copiar lista". */
export type ShareNote = "none" | "failed";

export interface RoundScreenState {
  readonly sheet: RoundSheet;
  readonly copyNote: CopyNote;
  readonly shareNote: ShareNote;
}

export type RoundScreenAction =
  | { readonly type: "confirmed-opened" }
  | { readonly type: "remove-asked"; readonly memberId: string }
  | { readonly type: "leave-asked" }
  | { readonly type: "sheet-closed" }
  | { readonly type: "list-copied" }
  | { readonly type: "list-and-link-copied" }
  | { readonly type: "share-failed" }
  | { readonly type: "copy-failed" }
  /** The note goes away a moment after it shows (the hook keeps the timer, not the reducer). */
  | { readonly type: "copy-note-cleared" }
  | { readonly type: "share-note-cleared" };

export const initialRoundScreenState: RoundScreenState = {
  sheet: { kind: "none" },
  copyNote: "none",
  shareNote: "none",
};

type SheetAction = Extract<
  RoundScreenAction,
  { type: "confirmed-opened" | "remove-asked" | "leave-asked" | "sheet-closed" }
>;

function sheetOf(action: SheetAction): RoundSheet {
  switch (action.type) {
    case "confirmed-opened":
      return { kind: "confirmed" };
    case "remove-asked":
      return { kind: "remove", memberId: action.memberId };
    case "leave-asked":
      return { kind: "leave" };
    case "sheet-closed":
      return { kind: "none" };
  }
}

function notesReducer(
  state: RoundScreenState,
  action: Exclude<RoundScreenAction, SheetAction>,
): RoundScreenState {
  switch (action.type) {
    case "list-copied":
      return { ...state, copyNote: "copied" };
    case "list-and-link-copied":
      return { ...state, copyNote: "copied-with-link" };
    case "copy-failed":
      return { ...state, copyNote: "failed" };
    case "copy-note-cleared":
      return { ...state, copyNote: "none" };
    case "share-failed":
      return { ...state, shareNote: "failed" };
    case "share-note-cleared":
      return { ...state, shareNote: "none" };
  }
}

const SHEET_ACTIONS: ReadonlySet<RoundScreenAction["type"]> = new Set([
  "confirmed-opened",
  "remove-asked",
  "leave-asked",
  "sheet-closed",
]);

function isSheetAction(action: RoundScreenAction): action is SheetAction {
  return SHEET_ACTIONS.has(action.type);
}

export function roundScreenReducer(
  state: RoundScreenState,
  action: RoundScreenAction,
): RoundScreenState {
  return isSheetAction(action) ? { ...state, sheet: sheetOf(action) } : notesReducer(state, action);
}
