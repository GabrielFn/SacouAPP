/**
 * What the person types on screen 30b. Whether the password is asked for is not kept here: it comes
 * from the last answer of the deletion, in the mutation (frontend.md, rule 1).
 */
export interface DeleteAccountState {
  readonly confirmText: string;
  /** Only while an e-mail account is asked to log in again; never trimmed, gone after each try. */
  readonly password: string;
}

export type DeleteAccountAction =
  | { readonly type: "confirm-changed"; readonly text: string }
  | { readonly type: "password-changed"; readonly text: string }
  /** The password left with the request: the field is emptied at once (ADR 0057, D5). */
  | { readonly type: "password-sent" };

export const initialDeleteAccountState: DeleteAccountState = { confirmText: "", password: "" };

export function deleteAccountReducer(
  state: DeleteAccountState,
  action: DeleteAccountAction,
): DeleteAccountState {
  switch (action.type) {
    case "confirm-changed":
      return { ...state, confirmText: action.text };
    case "password-changed":
      return { ...state, password: action.text };
    case "password-sent":
      return { ...state, password: "" };
  }
}
