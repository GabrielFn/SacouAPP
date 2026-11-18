import type { MatchStartedPayload } from "@sacou/match-engine";
import { describe, expect, test } from "vitest";

import { courtSidesInverted, sidesOf } from "./court-sides";
import { stateOfTimeline } from "./court-screen.selectors";
import {
  confirmSet,
  score,
  startScenario,
  withScoring,
  type Scenario,
} from "./screen-scenarios.test.fixture";

describe("sidesOf", () => {
  test("A at the left and B at the right by default", () => {
    expect(sidesOf(false)).toEqual({ left: "a", right: "b" });
  });

  test("inverted swaps the sides and inverting twice is the start again", () => {
    expect(sidesOf(true)).toEqual({ left: "b", right: "a" });
    expect(sidesOf(!true)).toEqual(sidesOf(false));
  });
});

const BEST_OF_THREE_15 = withScoring({
  bestOf: 3,
  pointsPerSet: 25,
  tieBreakPoints: 15,
  winMargin: 2,
});

function inverted(scenario: Scenario, manual: boolean): boolean {
  return courtSidesInverted(stateOfTimeline(scenario.timeline()), manual);
}

/** Sets 1 and 2 split, so the third is the tie-break. */
async function tieBreak(input: MatchStartedPayload = BEST_OF_THREE_15): Promise<Scenario> {
  const scenario = await startScenario(input);
  await score(scenario, "a".repeat(25));
  await confirmSet(scenario);
  await score(scenario, "b".repeat(25));
  await confirmSet(scenario, "a");
  return scenario;
}

describe("the sides follow the sets and the middle of the tie-break (D5)", () => {
  test("set 1 has A at the left, set 2 has B at the left; the manual flip inverts each", async () => {
    const scenario = await startScenario(BEST_OF_THREE_15);
    expect([inverted(scenario, false), inverted(scenario, true)]).toEqual([false, true]);
    await score(scenario, "a".repeat(25));
    await confirmSet(scenario);
    expect([inverted(scenario, false), inverted(scenario, true)]).toEqual([true, false]);
  });

  test("the tie-break of 15 swaps at 8, and undoing the 8th point swaps back", async () => {
    const scenario = await tieBreak();
    await score(scenario, "aaaaabbbbbbb");
    expect([inverted(scenario, false), inverted(scenario, true)]).toEqual([false, true]);
    await score(scenario, "b");
    expect([inverted(scenario, false), inverted(scenario, true)]).toEqual([true, false]);
    await scenario.controller.dispatch({ type: "undo" });
    expect(inverted(scenario, false)).toBe(false);
  });

  test("the tie-break of 11 swaps at 6", async () => {
    const scenario = await tieBreak(
      withScoring({ bestOf: 3, pointsPerSet: 25, tieBreakPoints: 11, winMargin: 2 }),
    );
    await score(scenario, "aaaaa");
    expect(inverted(scenario, false)).toBe(false);
    await score(scenario, "a");
    expect(inverted(scenario, false)).toBe(true);
  });

  test("with the tie-break off, the deciding set follows only the rule of the set", async () => {
    const scenario = await tieBreak(
      withScoring({ bestOf: 3, pointsPerSet: 25, tieBreakPoints: null, winMargin: 2 }),
    );
    await score(scenario, "a".repeat(20));
    expect([inverted(scenario, false), inverted(scenario, true)]).toEqual([false, true]);
  });

  test("a single set never swaps in the middle", async () => {
    const scenario = await startScenario(
      withScoring({ bestOf: 1, pointsPerSet: 25, tieBreakPoints: 15, winMargin: 2 }),
    );
    await score(scenario, "a".repeat(20));
    expect(inverted(scenario, false)).toBe(false);
  });
});
