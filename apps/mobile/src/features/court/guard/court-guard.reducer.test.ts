import { describe, expect, test } from "vitest";

import {
  canScore,
  courtGuardReducer,
  INITIAL_COURT_GUARD,
  isBackBlocked,
  nextDeadline,
  type CourtGuardAction,
  type CourtGuardState,
} from "./court-guard.reducer";

function run(actions: readonly CourtGuardAction[], from = INITIAL_COURT_GUARD): CourtGuardState {
  return actions.reduce(courtGuardReducer, from);
}

describe("the back button", () => {
  test("the court starts with no wait", () => {
    expect(INITIAL_COURT_GUARD).toEqual({ cooldownUntil: null });
  });

  test("is blocked while the court is in front, free when it is not", () => {
    expect(isBackBlocked(INITIAL_COURT_GUARD, true)).toBe(true);
    expect(isBackBlocked(INITIAL_COURT_GUARD, false)).toBe(false);
  });
});

describe("the wait after a point (700 ms)", () => {
  const accepted = run([{ type: "point-accepted", at: 1000 }]);

  test("the zones wait until 700 ms later: 1699 is still blocked and 1700 is free", () => {
    expect(canScore(accepted, 1000)).toBe(false);
    expect(canScore(accepted, 1699)).toBe(false);
    expect(canScore(accepted, 1700)).toBe(true);
  });

  test("before any point the zones are free", () => {
    expect(canScore(INITIAL_COURT_GUARD, 0)).toBe(true);
  });

  test("an undo does not start the wait", () => {
    expect(canScore(run([{ type: "undo-accepted" }]), 0)).toBe(true);
  });

  test("an undo inside the wait does not end it", () => {
    expect(canScore(courtGuardReducer(accepted, { type: "undo-accepted" }), 1200)).toBe(false);
  });
});

describe("time passing", () => {
  test("tick clears the wait once it has expired", () => {
    const state = run([{ type: "point-accepted", at: 0 }]);
    expect(courtGuardReducer(state, { type: "tick", at: 700 })).toEqual(INITIAL_COURT_GUARD);
  });

  test("a tick that finds nothing expired returns the very same state", () => {
    const state = run([{ type: "point-accepted", at: 0 }]);
    expect(courtGuardReducer(state, { type: "tick", at: 10 })).toBe(state);
    expect(courtGuardReducer(INITIAL_COURT_GUARD, { type: "tick", at: 10 })).toBe(
      INITIAL_COURT_GUARD,
    );
  });

  test("the next deadline is the wait, or none", () => {
    expect(nextDeadline(INITIAL_COURT_GUARD)).toBeNull();
    expect(nextDeadline(run([{ type: "point-accepted", at: 0 }]))).toBe(700);
  });
});
