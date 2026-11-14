/** What waits for a "yes" on screen 19: leaving the group, or revoking one invite. */
export type MembersConfirm =
  | { readonly kind: "leave" }
  | { readonly kind: "revoke-invite"; readonly inviteId: string };

/**
 * The local state of screen 19 (frontend.md, rule 4): which row has the sheet 19c open and what waits
 * for a confirmation. The members and invites stay in the query cache; the tab is a `useState`.
 */
export interface MembersScreenState {
  readonly sheetMemberId: string | null;
  readonly confirm: MembersConfirm | null;
}

export type MembersScreenAction =
  | { readonly type: "sheet-opened"; readonly memberId: string }
  | { readonly type: "sheet-closed" }
  | { readonly type: "leave-asked" }
  | { readonly type: "revoke-asked"; readonly inviteId: string }
  | { readonly type: "confirm-closed" };

export const initialMembersScreenState: MembersScreenState = { sheetMemberId: null, confirm: null };

export function membersScreenReducer(
  state: MembersScreenState,
  action: MembersScreenAction,
): MembersScreenState {
  switch (action.type) {
    case "sheet-opened":
      return { sheetMemberId: action.memberId, confirm: null };
    case "sheet-closed":
      return { ...state, sheetMemberId: null };
    case "leave-asked":
      // The confirmation replaces the sheet: two modals never stack.
      return { sheetMemberId: null, confirm: { kind: "leave" } };
    case "revoke-asked":
      return { sheetMemberId: null, confirm: { kind: "revoke-invite", inviteId: action.inviteId } };
    case "confirm-closed":
      return { ...state, confirm: null };
  }
}
