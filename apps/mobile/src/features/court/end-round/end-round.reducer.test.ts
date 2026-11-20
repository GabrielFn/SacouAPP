import { describe, expect, test } from "vitest";

import {
  endRoundReducer,
  INITIAL_END_ROUND,
  type EndRoundAction,
  type EndRoundState,
} from "./end-round.reducer";

function run(actions: readonly EndRoundAction[], from: EndRoundState = INITIAL_END_ROUND) {
  return actions.reduce(endRoundReducer, from);
}

describe("endRoundReducer (E4.12, questions 150 and 151)", () => {
  test("without a match in play, goes straight to closing", () => {
    expect(run([{ type: "requested", openMatchScore: null }])).toEqual({ phase: "closing" });
  });

  test("with a match in play, asks first and keeps its score", () => {
    expect(run([{ type: "requested", openMatchScore: "12 × 10" }])).toEqual({
      phase: "confirming",
      openMatchScore: "12 × 10",
    });
  });

  test("confirming goes to closing, cancelling goes back to idle", () => {
    const asking = run([{ type: "requested", openMatchScore: "1 × 0" }]);
    expect(run([{ type: "confirmed" }], asking)).toEqual({ phase: "closing" });
    expect(run([{ type: "cancelled" }], asking)).toEqual(INITIAL_END_ROUND);
  });

  test("closing ends in closed (idle) or failed, and failed can be asked again", () => {
    const closing = run([{ type: "requested", openMatchScore: null }]);
    expect(run([{ type: "closed" }], closing)).toEqual(INITIAL_END_ROUND);
    const failed = run([{ type: "failed", failure: "round-not-started" }], closing);
    expect(failed).toEqual({ phase: "failed", failure: "round-not-started" });
    expect(run([{ type: "requested", openMatchScore: null }], failed)).toEqual({
      phase: "closing",
    });
    expect(run([{ type: "cancelled" }], failed)).toEqual(INITIAL_END_ROUND);
  });

  test("a second request while closing or asking changes nothing", () => {
    const closing: EndRoundState = { phase: "closing" };
    expect(run([{ type: "requested", openMatchScore: null }], closing)).toBe(closing);
    const asking: EndRoundState = { phase: "confirming", openMatchScore: "1 × 0" };
    expect(run([{ type: "requested", openMatchScore: "2 × 0" }], asking)).toBe(asking);
  });

  test("answers out of phase are ignored", () => {
    expect(run([{ type: "confirmed" }])).toEqual(INITIAL_END_ROUND);
    expect(run([{ type: "closed" }])).toEqual(INITIAL_END_ROUND);
    expect(run([{ type: "failed", failure: "storage" }])).toEqual(INITIAL_END_ROUND);
  });
});
