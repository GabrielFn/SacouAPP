import type { Failure } from "../round-page/round-page.types";
import type { SignInSheetAction } from "../round-page/sign-in-flow";

import type { InvitePreview } from "./invite-page.types";

/** The token and Firebase: whether the link can lead anywhere, and who is signed in. */
export type InviteSessionAction =
  /** No token after the `#`, or one out of its format: nothing to ask the API. */
  | { readonly type: "tokenRejected" }
  | { readonly type: "sessionChecked"; readonly signedIn: boolean }
  | { readonly type: "signedOut" };

/** The sheet of screen 02, the same ways in as the round page. */
export type InviteSheetAction =
  /** The main button: the sheet when signed out, the preview again when signed in. */
  { readonly type: "signInTapped" } | SignInSheetAction;

/** The preview and the join. */
export type InviteJoinAction =
  | { readonly type: "previewLoaded"; readonly preview: InvitePreview }
  | { readonly type: "previewFailed"; readonly failure: Failure }
  | { readonly type: "joinTapped" }
  | { readonly type: "joined" }
  | { readonly type: "joinFailed"; readonly failure: Failure };

export type InvitePageAction = InviteSessionAction | InviteSheetAction | InviteJoinAction;

const SESSION_TYPES: ReadonlySet<string> = new Set<InviteSessionAction["type"]>([
  "tokenRejected",
  "sessionChecked",
  "signedOut",
]);

const JOIN_TYPES: ReadonlySet<string> = new Set<InviteJoinAction["type"]>([
  "previewLoaded",
  "previewFailed",
  "joinTapped",
  "joined",
  "joinFailed",
]);

export function isInviteSessionAction(action: InvitePageAction): action is InviteSessionAction {
  return SESSION_TYPES.has(action.type);
}

export function isInviteJoinAction(action: InvitePageAction): action is InviteJoinAction {
  return JOIN_TYPES.has(action.type);
}
