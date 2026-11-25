import { describe, expect, test } from "vitest";

import {
  endRoundReducer,
  INITIAL_END_ROUND,
  type EndRoundAction,
  type EndRoundState,
} from "./end-round.reducer";

const ASK = { openMatchScore: null, finishedMatches: 3, votingEnabled: true } as const;
const ASK_PLAYING = {
  openMatchScore: "12 × 10",
  finishedMatches: 0,
  votingEnabled: false,
} as const;

function run(actions: readonly EndRoundAction[], from: EndRoundState = INITIAL_END_ROUND) {
  return actions.reduce(endRoundReducer, from);
}

describe("endRoundReducer (E4.12, questions 150 and 151, R101 3a)", () => {
  test("without a match in play, still asks first (never goes straight to closing)", () => {
    expect(run([{ type: "requested", ...ASK }])).toEqual({ phase: "confirming", ...ASK });
  });

  test("with a match in play, asks first and keeps its score", () => {
    expect(run([{ type: "requested", ...ASK_PLAYING }])).toEqual({
      phase: "confirming",
      ...ASK_PLAYING,
    });
  });

  test("confirming goes to closing, cancelling goes back to idle", () => {
    const asking = run([{ type: "requested", ...ASK }]);
    expect(run([{ type: "confirmed" }], asking)).toEqual({ phase: "closing" });
    expect(run([{ type: "cancelled" }], asking)).toEqual(INITIAL_END_ROUND);
  });

  test("closing ends in closed (idle) or failed, and failed can be asked again", () => {
    const closing = run([{ type: "requested", ...ASK }, { type: "confirmed" }]);
    expect(run([{ type: "closed" }], closing)).toEqual(INITIAL_END_ROUND);
    const failed = run([{ type: "failed", failure: "round-not-started" }], closing);
    expect(failed).toEqual({ phase: "failed", failure: "round-not-started" });
    expect(run([{ type: "requested", ...ASK }], failed)).toEqual({ phase: "confirming", ...ASK });
    expect(run([{ type: "cancelled" }], failed)).toEqual(INITIAL_END_ROUND);
  });

  test("a second request while closing or asking changes nothing", () => {
    const closing: EndRoundState = { phase: "closing" };
    expect(run([{ type: "requested", ...ASK }], closing)).toBe(closing);
    const asking = run([{ type: "requested", ...ASK }]);
    expect(run([{ type: "requested", ...ASK_PLAYING }], asking)).toBe(asking);
  });

  test("answers out of phase are ignored", () => {
    expect(run([{ type: "confirmed" }])).toEqual(INITIAL_END_ROUND);
    expect(run([{ type: "closed" }])).toEqual(INITIAL_END_ROUND);
    expect(run([{ type: "failed", failure: "storage" }])).toEqual(INITIAL_END_ROUND);
  });
});
