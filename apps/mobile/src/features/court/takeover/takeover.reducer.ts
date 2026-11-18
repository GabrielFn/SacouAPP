/**
 * Why taking the court over did not end (screen 09a). Only codes: the texts are in `strings`, and
 * nothing the server wrote is shown.
 */
export type TakeoverFailure =
  /** The stream read from the server did not parse, replay or fit the ceilings: nothing was kept. */
  | "import-invalid"
  /** The stream reached its ceiling of take-overs (422 `limit-reached`, `writers-per-stream`). */
  | "writers-limit"
  | "no-account"
  | "no-permission"
  | "not-found"
  | "offline"
  | "failed";

/**
 * The flow of screen 09a (E4.11, D5). The summary is not here: it stays in the query cache
 * (frontend.md, rule 1), and "confirming" shows whatever it holds now.
 */
export type TakeoverState =
  | {
      readonly status: "confirming";
      /** The stream moved between the summary and the tap: the screen says so over the new one. */
      readonly streamChanged: boolean;
    }
  | { readonly status: "taking-over" }
  | { readonly status: "importing"; readonly imported: number; readonly total: number }
  | { readonly status: "done"; readonly courtSessionId: string }
  | { readonly status: "failed"; readonly reason: TakeoverFailure };

export type TakeoverAction =
  | { readonly type: "confirmed" }
  | { readonly type: "stream-changed" }
  | { readonly type: "taken-over"; readonly eventsBefore: number }
  | { readonly type: "page-imported"; readonly imported: number }
  | { readonly type: "imported"; readonly courtSessionId: string }
  | { readonly type: "failed"; readonly reason: TakeoverFailure }
  | { readonly type: "retried" };

export const INITIAL_TAKEOVER_STATE: TakeoverState = { status: "confirming", streamChanged: false };

/** Pure and exhaustive: the calls, the writes and the navigation are in the hook. */
export function takeoverReducer(state: TakeoverState, action: TakeoverAction): TakeoverState {
  switch (action.type) {
    case "confirmed":
      return state.status === "confirming" ? { status: "taking-over" } : state;
    case "stream-changed":
      return state.status === "taking-over" ? { status: "confirming", streamChanged: true } : state;
    case "taken-over":
      return state.status === "taking-over"
        ? { status: "importing", imported: 0, total: action.eventsBefore }
        : state;
    case "page-imported":
      return state.status === "importing"
        ? { ...state, imported: Math.min(action.imported, state.total) }
        : state;
    case "imported":
      return state.status === "importing"
        ? { status: "done", courtSessionId: action.courtSessionId }
        : state;
    case "failed":
      return state.status === "taking-over" || state.status === "importing"
        ? { status: "failed", reason: action.reason }
        : state;
    case "retried":
      return state.status === "failed" ? INITIAL_TAKEOVER_STATE : state;
  }
}

/** The court is never opened between the tap and the end of the import (D5, item 5). */
export function isBusy(state: TakeoverState): boolean {
  return state.status === "taking-over" || state.status === "importing";
}
