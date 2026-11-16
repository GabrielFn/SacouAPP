import type { LevelTenths } from "../../../ui/skill-level";

/** What waits for a "yes" on screen 19: leaving, removing someone, or revoking one invite. */
export type MembersConfirm =
  | { readonly kind: "leave" }
  | { readonly kind: "remove"; readonly memberId: string }
  | { readonly kind: "revoke-invite"; readonly inviteId: string };

/**
 * The sheet 19a of one member. `draft` is only what the admin typed and the server does not have yet:
 * `null` shows the level of the server (frontend.md, rule 1). Never persisted, never logged (ADR 0047).
 */
export interface LevelSheetState {
  readonly memberId: string;
  readonly draft: LevelTenths | null;
}

/**
 * The local state of screen 19 (frontend.md, rule 4): which row has the sheet 19c or 19a open and what
 * waits for a confirmation. The members, levels and invites stay in the query cache; the tab is a
 * `useState`. One modal at a time: opening one closes the others.
 */
export interface MembersScreenState {
  readonly sheetMemberId: string | null;
  readonly level: LevelSheetState | null;
  readonly confirm: MembersConfirm | null;
}

export type MembersScreenAction =
  | { readonly type: "sheet-opened"; readonly memberId: string }
  | { readonly type: "sheet-closed" }
  | { readonly type: "level-opened"; readonly memberId: string }
  | { readonly type: "level-drafted"; readonly tenths: LevelTenths }
  | { readonly type: "level-closed" }
  | { readonly type: "leave-asked" }
  | { readonly type: "remove-asked"; readonly memberId: string }
  | { readonly type: "revoke-asked"; readonly inviteId: string }
  | { readonly type: "confirm-closed" };

export const initialMembersScreenState: MembersScreenState = {
  sheetMemberId: null,
  level: null,
  confirm: null,
};

const onlyConfirm = (confirm: MembersConfirm): MembersScreenState => ({
  sheetMemberId: null,
  level: null,
  confirm,
});

/** A draft without an open sheet is dropped: nobody is being rated. */
function withDraft(state: MembersScreenState, tenths: LevelTenths): MembersScreenState {
  return state.level === null ? state : { ...state, level: { ...state.level, draft: tenths } };
}

export function membersScreenReducer(
  state: MembersScreenState,
  action: MembersScreenAction,
): MembersScreenState {
  switch (action.type) {
    case "sheet-opened":
      return { sheetMemberId: action.memberId, level: null, confirm: null };
    case "sheet-closed":
      return { ...state, sheetMemberId: null };
    case "level-opened":
      return {
        sheetMemberId: null,
        level: { memberId: action.memberId, draft: null },
        confirm: null,
      };
    case "level-drafted":
      return withDraft(state, action.tenths);
    case "level-closed":
      return { ...state, level: null };
    case "leave-asked":
      return onlyConfirm({ kind: "leave" });
    case "remove-asked":
      return onlyConfirm({ kind: "remove", memberId: action.memberId });
    case "revoke-asked":
      return onlyConfirm({ kind: "revoke-invite", inviteId: action.inviteId });
    case "confirm-closed":
      return { ...state, confirm: null };
  }
}
