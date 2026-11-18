import { backoffDelayMs } from "./backoff";

/**
 * The upload loop of the court (ADR 0067, D3), one for the app: at most one request in flight, for
 * every session with pending events. Why a session stopped (halt, taken over) is in the SQLite file,
 * not here: this state is only what is transient and dies with the app.
 */
export type CourtSyncState =
  | { readonly status: "idle" }
  /** `again`: something new came while the request was out, so another pass runs right after it. */
  | { readonly status: "sending"; readonly again: boolean; readonly attempt: number }
  | {
      readonly status: "waiting";
      readonly untilMs: number;
      readonly attempt: number;
      /** `retry-after` is the server's own wait (429, 503): nothing leaves before it ends. */
      readonly reason: "backoff" | "retry-after";
    }
  | { readonly status: "stopped" };

export type CourtSyncAction =
  /** A point was written, the network or the app came back, the account changed, the loop started. */
  | { readonly type: "poked" }
  /** A pass ended well; `more`: it moved something and the next one may have work. */
  | { readonly type: "pass-done"; readonly more: boolean }
  /** A pass failed; `jitter` is a sample in [0, 1) for the backoff, `retryAfterMs` the server's wait. */
  | {
      readonly type: "pass-failed";
      readonly nowMs: number;
      readonly jitter: number;
      readonly retryAfterMs: number | null;
    }
  | { readonly type: "wait-elapsed" }
  | { readonly type: "stopped" };

export const INITIAL_COURT_SYNC_STATE: CourtSyncState = { status: "idle" };

const sending = (attempt: number): CourtSyncState => ({ status: "sending", again: false, attempt });

function poked(state: CourtSyncState): CourtSyncState {
  switch (state.status) {
    case "idle":
      return sending(0);
    case "sending":
      return { ...state, again: true };
    case "waiting":
      // A backoff only guesses when the network is back; the server's own wait is kept.
      return state.reason === "backoff" ? sending(state.attempt) : state;
    case "stopped":
      return state;
  }
}

function failed(
  state: CourtSyncState,
  { nowMs, jitter, retryAfterMs }: Extract<CourtSyncAction, { type: "pass-failed" }>,
): CourtSyncState {
  if (state.status !== "sending") return state;
  const attempt = state.attempt + 1;
  return retryAfterMs === null
    ? {
        status: "waiting",
        untilMs: nowMs + backoffDelayMs(attempt, jitter),
        attempt,
        reason: "backoff",
      }
    : { status: "waiting", untilMs: nowMs + retryAfterMs, attempt, reason: "retry-after" };
}

export function courtSyncReducer(state: CourtSyncState, action: CourtSyncAction): CourtSyncState {
  switch (action.type) {
    case "poked":
      return poked(state);
    case "pass-done":
      if (state.status !== "sending") return state;
      return action.more || state.again ? sending(0) : INITIAL_COURT_SYNC_STATE;
    case "pass-failed":
      return failed(state, action);
    case "wait-elapsed":
      return state.status === "waiting" ? sending(state.attempt) : state;
    case "stopped":
      return { status: "stopped" };
  }
}
