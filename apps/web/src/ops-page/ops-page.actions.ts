import type { SignInSheetAction } from "../round-page/sign-in-flow";

import type { OpsFailure, OpsMetrics } from "./ops-page.types";

/** Firebase's first answer and the end of the session. */
export type OpsSessionAction =
  { readonly type: "sessionChecked"; readonly signedIn: boolean } | { readonly type: "signedOut" };

/** The sheet of screen 02, and the button that opens it again once closed. */
export type OpsSheetAction = { readonly type: "signInTapped" } | SignInSheetAction;

/** The request for the counts and its answers. */
export type OpsLoadAction =
  | { readonly type: "loaded"; readonly metrics: OpsMetrics }
  | { readonly type: "denied" }
  | { readonly type: "unauthorized" }
  | { readonly type: "loadFailed"; readonly failure: OpsFailure }
  /** "Atualizar" on the numbers, or "Tentar de novo" after a failure. */
  | { readonly type: "reloadTapped" };

export type OpsPageAction = OpsSessionAction | OpsSheetAction | OpsLoadAction;

const SESSION_TYPES: ReadonlySet<string> = new Set<OpsSessionAction["type"]>([
  "sessionChecked",
  "signedOut",
]);

const LOAD_TYPES: ReadonlySet<string> = new Set<OpsLoadAction["type"]>([
  "loaded",
  "denied",
  "unauthorized",
  "loadFailed",
  "reloadTapped",
]);

export function isOpsSessionAction(action: OpsPageAction): action is OpsSessionAction {
  return SESSION_TYPES.has(action.type);
}

export function isOpsLoadAction(action: OpsPageAction): action is OpsLoadAction {
  return LOAD_TYPES.has(action.type);
}
