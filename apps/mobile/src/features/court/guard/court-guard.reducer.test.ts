import { describe, expect, test } from "vitest";

import {
  canScore,
  courtGuardReducer,
  INITIAL_COURT_GUARD,
  isBackBlocked,
  isToastVisible,
  nextDeadline,
  type CourtGuardAction,
  type CourtGuardState,
} from "./court-guard.reducer";

function run(actions: readonly CourtGuardAction[], from = INITIAL_COURT_GUARD): CourtGuardState {
  return actions.reduce(courtGuardReducer, from);
}

describe("the lock", () => {
  test("the court opens locked", () => {
    expect(INITIAL_COURT_GUARD).toEqual({ locked: true, cooldownUntil: null, toastUntil: null });
  });

  test("unlock opens it and lock closes it again", () => {
    const unlocked = run([{ type: "unlock" }]);
    expect(unlocked.locked).toBe(false);
    expect(run([{ type: "lock" }], unlocked).locked).toBe(true);
  });

  test("the back button is blocked only while locked and on the court", () => {
    expect(isBackBlocked(INITIAL_COURT_GUARD, true)).toBe(true);
    expect(isBackBlocked(INITIAL_COURT_GUARD, false)).toBe(false);
    expect(isBackBlocked(run([{ type: "unlock" }]), true)).toBe(false);
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

describe("the toast (1500 ms)", () => {
  const recorded = run([
    { type: "point-accepted", at: 1000 },
    { type: "point-recorded", at: 1010 },
  ]);

  test("it shows from the moment the point is stored for 1500 ms", () => {
    expect(isToastVisible(recorded, 1010)).toBe(true);
    expect(isToastVisible(recorded, 2509)).toBe(true);
    expect(isToastVisible(recorded, 2510)).toBe(false);
  });

  test("it is not shown before the point is stored", () => {
    expect(isToastVisible(run([{ type: "point-accepted", at: 1000 }]), 1005)).toBe(false);
  });

  test("an undo takes it away", () => {
    expect(isToastVisible(courtGuardReducer(recorded, { type: "undo-accepted" }), 1100)).toBe(
      false,
    );
  });

  test("a new point takes the old toast away until it is stored", () => {
    const next = courtGuardReducer(recorded, { type: "point-accepted", at: 1800 });
    expect(isToastVisible(next, 1810)).toBe(false);
  });
});

describe("time passing", () => {
  test("tick clears what has expired and nothing else", () => {
    const state = run([
      { type: "point-accepted", at: 0 },
      { type: "point-recorded", at: 0 },
    ]);
    const afterWait = courtGuardReducer(state, { type: "tick", at: 700 });
    expect(afterWait).toEqual({ locked: true, cooldownUntil: null, toastUntil: 1500 });
    expect(courtGuardReducer(afterWait, { type: "tick", at: 1500 })).toEqual(INITIAL_COURT_GUARD);
  });

  test("a tick that finds nothing expired returns the very same state", () => {
    const state = run([{ type: "point-accepted", at: 0 }]);
    expect(courtGuardReducer(state, { type: "tick", at: 10 })).toBe(state);
  });

  test("the next deadline is the nearest one, or none", () => {
    expect(nextDeadline(INITIAL_COURT_GUARD)).toBeNull();
    const state = run([
      { type: "point-accepted", at: 0 },
      { type: "point-recorded", at: 0 },
    ]);
    expect(nextDeadline(state)).toBe(700);
  });
});
