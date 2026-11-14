import { POINT_COOLDOWN_MS } from "../court.data";

/**
 * The protections of the court against an accidental touch (produto.md:136). It keeps only what
 * cannot be derived: until when the zones wait.
 */
export interface CourtGuardState {
  /** Taps on the zones are ignored until this time (the clock of the app), or `null`. */
  readonly cooldownUntil: number | null;
}

export type CourtGuardAction =
  /** A tap on a zone went through: the zones wait. */
  | { readonly type: "point-accepted"; readonly at: number }
  | { readonly type: "undo-accepted" }
  /** The time moved on: what has expired is cleared. */
  | { readonly type: "tick"; readonly at: number };

export const INITIAL_COURT_GUARD: CourtGuardState = {
  cooldownUntil: null,
};

function isPending(deadline: number | null, now: number): boolean {
  return deadline !== null && now < deadline;
}

export function canScore(state: CourtGuardState, now: number): boolean {
  return !isPending(state.cooldownUntil, now);
}

/** The back button stays put while the court is in front of the person. */
export function isBackBlocked(state: CourtGuardState, focused: boolean): boolean {
  return focused;
}

/** The next time something expires, or `null` when nothing is running. */
export function nextDeadline(state: CourtGuardState): number | null {
  return state.cooldownUntil;
}

function expire(state: CourtGuardState, now: number): CourtGuardState {
  return state.cooldownUntil === null || isPending(state.cooldownUntil, now)
    ? state
    : { ...state, cooldownUntil: null };
}

export function courtGuardReducer(
  state: CourtGuardState,
  action: CourtGuardAction,
): CourtGuardState {
  switch (action.type) {
    case "point-accepted":
      return { ...state, cooldownUntil: action.at + POINT_COOLDOWN_MS };
    case "undo-accepted":
      return state;
    case "tick":
      return expire(state, action.at);
  }
}
