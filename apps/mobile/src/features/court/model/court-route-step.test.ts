import { describe, expect, test } from "vitest";

import { SAMPLE_MATCH_ONE_SET } from "../dev/sample-match.data";
import { nextCourtRoute } from "./court-route-step";
import { selectCourtPhase, stateOfTimeline } from "./court-screen.selectors";
import { confirmSet, score, startScenario } from "./screen-scenarios.test.fixture";

describe("where each route of the court goes", () => {
  test.each([
    ["set-end", "match-ended", true, "open-match-end"],
    ["set-end", "match-ended", false, "open-match-end"],
    ["set-end", "playing", true, "go-back"],
    ["set-end", "set-decided", true, "none"],
    ["set-end", "match-pending", true, "none"],
    ["court", "match-pending", true, "open-set-end"],
    ["court", "match-pending", false, "open-set-end"],
    ["set-end", null, true, "none"],
    ["court", "match-ended", true, "open-match-end"],
    ["court", "match-ended", false, "none"],
    ["court", "set-decided", true, "open-set-end"],
    ["court", "set-decided", false, "open-set-end"],
    ["court", "playing", true, "none"],
    ["court", "no-match", true, "none"],
    ["court", null, true, "none"],
  ] as const)("%s in phase %s (focused %s) -> %s", (route, phase, focused, expected) => {
    expect(nextCourtRoute(route, phase, focused)).toBe(expected);
  });
});

describe("a whole one-set match through the routes", () => {
  test("the confirmation at the end of the set ends the match and the set-end hands over", async () => {
    const scenario = await startScenario(SAMPLE_MATCH_ONE_SET);
    const phase = () => selectCourtPhase(stateOfTimeline(scenario.timeline()));
    await score(scenario, "a".repeat(25));
    expect(nextCourtRoute("court", phase(), true)).toBe("open-set-end");
    await confirmSet(scenario);
    expect(phase()).toBe("match-ended");
    expect(nextCourtRoute("set-end", phase(), true)).toBe("open-match-end");
    expect(nextCourtRoute("court", phase(), false)).toBe("none");
  });

  test("a set that is not the last one goes back to the court", async () => {
    const scenario = await startScenario();
    await score(scenario, "a".repeat(25));
    await confirmSet(scenario);
    const phase = selectCourtPhase(stateOfTimeline(scenario.timeline()));
    expect(nextCourtRoute("set-end", phase, true)).toBe("go-back");
  });
});
