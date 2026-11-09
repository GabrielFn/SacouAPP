import type { CourtSessionState } from "@sacou/match-engine";
import { describe, expect, test } from "vitest";

import { SAMPLE_MATCH_ONE_SET } from "../dev/sample-match.data";
import { stateOfTimeline } from "./court-screen.selectors";
import { deriveFeedback, strongestFeedback } from "./feedback";
import { confirmSet, score, startScenario, type Scenario } from "./screen-scenarios.test.fixture";

function stateOf(scenario: Scenario): CourtSessionState {
  return stateOfTimeline(scenario.timeline());
}

/** The state before and after `play`, on a one-set match that already has the `before` points. */
async function around(
  before: string,
  play: (scenario: Scenario) => Promise<void>,
): Promise<readonly [CourtSessionState, CourtSessionState]> {
  const scenario = await startScenario(SAMPLE_MATCH_ONE_SET);
  await score(scenario, before);
  const first = stateOf(scenario);
  await play(scenario);
  return [first, stateOf(scenario)];
}

describe("what the phone does between two states", () => {
  test("a point for the team that was already serving is only a point", async () => {
    // Laranja serves first: its own point is no side-out.
    const [before, after] = await around("", (scenario) => score(scenario, "a"));
    expect(deriveFeedback(before, after)).toEqual(["point"]);
  });

  test("a point that takes the serve is a point and a side-out", async () => {
    const [before, after] = await around("", (scenario) => score(scenario, "b"));
    expect(deriveFeedback(before, after)).toEqual(["point", "side-out"]);
  });

  test("reaching the set point buzzes once: a later point at set point does not repeat it", async () => {
    const [before, reached] = await around("a".repeat(23), (scenario) => score(scenario, "a"));
    expect(deriveFeedback(before, reached)).toEqual(["point", "set-point"]);
    // 24-1 -> 24-2: the same team is still at set point.
    const scenario = await startScenario(SAMPLE_MATCH_ONE_SET);
    await score(scenario, `${"a".repeat(24)}b`);
    const atSetPoint = stateOf(scenario);
    await score(scenario, "b");
    expect(deriveFeedback(atSetPoint, stateOf(scenario))).toEqual(["point"]);
  });

  test("the point that decides the set is only a point", async () => {
    const [before, after] = await around("a".repeat(24), (scenario) => score(scenario, "a"));
    expect(deriveFeedback(before, after)).toEqual(["point"]);
  });

  test("confirming the end of a set of a series is set-ended", async () => {
    const scenario = await startScenario();
    await score(scenario, "a".repeat(25));
    const before = stateOf(scenario);
    await confirmSet(scenario);
    expect(deriveFeedback(before, stateOf(scenario))).toEqual(["set-ended"]);
  });

  test("confirming the end of the deciding set is match-ended", async () => {
    const [before, after] = await around("a".repeat(25), (scenario) => confirmSet(scenario));
    expect(deriveFeedback(before, after)).toEqual(["match-ended"]);
  });

  test("an undo does not buzz like a point", async () => {
    const [before, after] = await around("ab", async (scenario) => {
      const result = await scenario.controller.dispatch({ type: "undo" });
      expect(result.ok).toBe(true);
    });
    expect(deriveFeedback(before, after)).toEqual([]);
  });

  test("the same state buzzes nothing", async () => {
    const [before] = await around("", () => Promise.resolve());
    expect(deriveFeedback(before, before)).toEqual([]);
  });

  test("the phone plays the strongest of the list", () => {
    expect(strongestFeedback(["point", "side-out", "set-point"])).toBe("set-point");
    expect(strongestFeedback(["point"])).toBe("point");
    expect(strongestFeedback([])).toBeNull();
  });
});
