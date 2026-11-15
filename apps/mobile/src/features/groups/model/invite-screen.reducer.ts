/**
 * The local state of screen 19d (frontend.md, rule 4). The token is not here: it lives in the
 * `InviteLinkStore` and in the result of the mutation that read or made it (ADR 0049, D7).
 */
export interface InviteScreenState {
  readonly confirmingRegenerate: boolean;
  readonly copied: boolean;
}

export type InviteScreenAction =
  | { readonly type: "regenerate-asked" }
  | { readonly type: "regenerate-closed" }
  | { readonly type: "copied" }
  | { readonly type: "link-changed" };

export const initialInviteScreenState: InviteScreenState = {
  confirmingRegenerate: false,
  copied: false,
};

export function inviteScreenReducer(
  state: InviteScreenState,
  action: InviteScreenAction,
): InviteScreenState {
  switch (action.type) {
    case "regenerate-asked":
      return { ...state, confirmingRegenerate: true };
    case "regenerate-closed":
      return { ...state, confirmingRegenerate: false };
    case "copied":
      return { ...state, copied: true };
    case "link-changed":
      // "Link copiado" spoke of the old link.
      return { confirmingRegenerate: false, copied: false };
  }
}
