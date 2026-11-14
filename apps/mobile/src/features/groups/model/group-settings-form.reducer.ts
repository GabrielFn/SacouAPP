import type { SettingsBlock, SettingsPath, SettingsValue } from "@sacou/match-engine";

import type { ShownPath } from "../../../strings/settings.pt-BR";

/** The sheet that is open over screen 18, with the draft it is editing. */
export type SettingsSheet =
  | { readonly kind: "none" }
  | { readonly kind: "field"; readonly path: ShownPath; readonly text: string }
  | { readonly kind: "schedule"; readonly weekday: number; readonly time: string }
  | { readonly kind: "template-picker" }
  | { readonly kind: "save-template"; readonly name: string };

export type PendingLeaves = Readonly<Partial<Record<SettingsPath, SettingsValue>>>;

/**
 * Only the draft of each leaf: what the person changed and the server has not answered yet. The document
 * itself stays in the query cache (frontend.md, rules 1 and 4).
 */
export interface GroupSettingsFormState {
  readonly pending: PendingLeaves;
  /** The block whose accordion is open, or `null`. */
  readonly expanded: SettingsBlock | null;
  readonly sheet: SettingsSheet;
  /** The text of the last refusal, shown in the error strip until dismissed or the next change. */
  readonly message: string | null;
}

export const initialGroupSettingsFormState: GroupSettingsFormState = {
  pending: {},
  expanded: null,
  sheet: { kind: "none" },
  message: null,
};

export type LeafAction =
  | { readonly type: "block-toggled"; readonly block: SettingsBlock }
  | { readonly type: "leaf-changed"; readonly path: SettingsPath; readonly value: SettingsValue }
  | { readonly type: "leaf-saved"; readonly path: SettingsPath }
  | { readonly type: "leaf-failed"; readonly path: SettingsPath; readonly message: string }
  | { readonly type: "message-shown"; readonly message: string }
  | { readonly type: "message-dismissed" };

export type SheetAction =
  | { readonly type: "sheet-opened"; readonly sheet: SettingsSheet }
  | { readonly type: "sheet-text-changed"; readonly text: string }
  | { readonly type: "sheet-weekday-selected"; readonly weekday: number }
  | { readonly type: "sheet-confirmed" }
  | { readonly type: "sheet-cancelled" };

export type GroupSettingsFormAction = LeafAction | SheetAction;

function withoutLeaf(pending: PendingLeaves, path: SettingsPath): PendingLeaves {
  return Object.fromEntries(Object.entries(pending).filter(([key]) => key !== path));
}

function sheetWithText(sheet: SettingsSheet, text: string): SettingsSheet {
  switch (sheet.kind) {
    case "field":
      return { ...sheet, text };
    case "schedule":
      return { ...sheet, time: text };
    case "save-template":
      return { ...sheet, name: text };
    case "none":
    case "template-picker":
      return sheet;
  }
}

function isSheetAction(action: GroupSettingsFormAction): action is SheetAction {
  return action.type.startsWith("sheet-");
}

function leafReducer(state: GroupSettingsFormState, action: LeafAction): GroupSettingsFormState {
  switch (action.type) {
    case "block-toggled":
      return { ...state, expanded: state.expanded === action.block ? null : action.block };
    case "leaf-changed":
      return {
        ...state,
        pending: { ...state.pending, [action.path]: action.value },
        message: null,
      };
    case "leaf-saved":
      return { ...state, pending: withoutLeaf(state.pending, action.path) };
    case "leaf-failed":
      return {
        ...state,
        pending: withoutLeaf(state.pending, action.path),
        message: action.message,
      };
    case "message-shown":
      return { ...state, message: action.message };
    case "message-dismissed":
      return { ...state, message: null };
  }
}

function sheetReducer(state: GroupSettingsFormState, action: SheetAction): GroupSettingsFormState {
  switch (action.type) {
    case "sheet-opened":
      return { ...state, sheet: action.sheet };
    case "sheet-text-changed":
      return { ...state, sheet: sheetWithText(state.sheet, action.text) };
    case "sheet-weekday-selected":
      return state.sheet.kind === "schedule"
        ? { ...state, sheet: { ...state.sheet, weekday: action.weekday } }
        : state;
    case "sheet-confirmed":
    case "sheet-cancelled":
      return { ...state, sheet: { kind: "none" } };
  }
}

/** Pure: the PATCH, the cache and the navigation are done by the hook (frontend.md, rule 4). */
export function groupSettingsFormReducer(
  state: GroupSettingsFormState,
  action: GroupSettingsFormAction,
): GroupSettingsFormState {
  return isSheetAction(action) ? sheetReducer(state, action) : leafReducer(state, action);
}
