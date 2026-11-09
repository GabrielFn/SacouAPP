import { POINT_COOLDOWN_MS, POINT_TOAST_MS } from "../court.data";

/**
 * The protections of the court against an accidental touch (produto.md:136). It keeps only what
 * cannot be derived: whether the screen is locked and until when the zones wait and the toast stays.
 */
export interface CourtGuardState {
  readonly locked: boolean;
  /** Taps on the zones are ignored until this time (the clock of the app), or `null`. */
  readonly cooldownUntil: number | null;
  readonly toastUntil: number | null;
}

export type CourtGuardAction =
  | { readonly type: "lock" }
  | { readonly type: "unlock" }
  /** A tap on a zone went through: the zones wait. */
  | { readonly type: "point-accepted"; readonly at: number }
  /** The point is stored: the toast shows. */
  | { readonly type: "point-recorded"; readonly at: number }
  | { readonly type: "undo-accepted" }
  /** The time moved on: what has expired is cleared. */
  | { readonly type: "tick"; readonly at: number };

/** The court opens locked, and so does it after the app is reopened. */
export const INITIAL_COURT_GUARD: CourtGuardState = {
  locked: true,
  cooldownUntil: null,
  toastUntil: null,
};

function isPending(deadline: number | null, now: number): boolean {
  return deadline !== null && now < deadline;
}

export function canScore(state: CourtGuardState, now: number): boolean {
  return !isPending(state.cooldownUntil, now);
}

export function isToastVisible(state: CourtGuardState, now: number): boolean {
  return isPending(state.toastUntil, now);
}

/** The back button stays put while the court is locked and in front of the person. */
export function isBackBlocked(state: CourtGuardState, focused: boolean): boolean {
  return state.locked && focused;
}

/** The next time something expires, or `null` when nothing is running. */
export function nextDeadline(state: CourtGuardState): number | null {
  const deadlines = [state.cooldownUntil, state.toastUntil].filter(
    (deadline): deadline is number => deadline !== null,
  );
  return deadlines.length === 0 ? null : Math.min(...deadlines);
}

function expire(state: CourtGuardState, now: number): CourtGuardState {
  const cooldownUntil = isPending(state.cooldownUntil, now) ? state.cooldownUntil : null;
  const toastUntil = isPending(state.toastUntil, now) ? state.toastUntil : null;
  return cooldownUntil === state.cooldownUntil && toastUntil === state.toastUntil
    ? state
    : { ...state, cooldownUntil, toastUntil };
}

export function courtGuardReducer(
  state: CourtGuardState,
  action: CourtGuardAction,
): CourtGuardState {
  switch (action.type) {
    case "lock":
      return { ...state, locked: true };
    case "unlock":
      return { ...state, locked: false };
    case "point-accepted":
      return { ...state, cooldownUntil: action.at + POINT_COOLDOWN_MS, toastUntil: null };
    case "point-recorded":
      return { ...state, toastUntil: action.at + POINT_TOAST_MS };
    case "undo-accepted":
      return { ...state, toastUntil: null };
    case "tick":
      return expire(state, action.at);
  }
}
