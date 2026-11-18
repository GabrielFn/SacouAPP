import { getRecentPoints } from "@sacou/match-engine";
import { describe, expect, test } from "vitest";

import { stateOfTimeline } from "../model/court-screen.selectors";
import { score, screen09, startScenario } from "../model/screen-scenarios.test.fixture";

describe("revert-to at the limits", () => {
  test("to the first point of the match keeps only that point", async () => {
    const scenario = await screen09();
    const points = getRecentPoints(scenario.timeline());
    const first = points.at(-1);
    if (first === undefined) throw new Error("no point");
    expect(
      (await scenario.controller.dispatch({ type: "revert-to", eventId: first.eventId })).ok,
    ).toBe(true);
    const entries = scenario.timeline().entries;
    expect(entries.at(-1)?.event.eventId).toBe(first.eventId);
  });

  test("to the current point is refused as nothing to undo and changes nothing", async () => {
    const scenario = await screen09();
    const before = stateOfTimeline(scenario.timeline());
    const current = getRecentPoints(scenario.timeline())[0];
    if (current === undefined) throw new Error("no point");
    const result = await scenario.controller.dispatch({
      type: "revert-to",
      eventId: current.eventId,
    });
    expect(result).toEqual({ ok: false, error: { code: "refused", reason: "nothing-to-undo" } });
    expect(stateOfTimeline(scenario.timeline())).toEqual(before);
  });

  test("twice to the same point is idempotent", async () => {
    const scenario = await screen09();
    const target = getRecentPoints(scenario.timeline())[2];
    if (target === undefined) throw new Error("no point");
    await scenario.controller.dispatch({ type: "revert-to", eventId: target.eventId });
    const after = stateOfTimeline(scenario.timeline());
    await scenario.controller.dispatch({ type: "revert-to", eventId: target.eventId });
    expect(stateOfTimeline(scenario.timeline())).toEqual(after);
  });
});

describe("end-match-manually refusals", () => {
  test("a second end, once the match is over, is refused and writes nothing", async () => {
    const scenario = await startScenario();
    await score(scenario, "ab");
    expect((await scenario.controller.dispatch({ type: "end-match-manually" })).ok).toBe(true);
    const count = scenario.timeline().entries.length;
    const second = await scenario.controller.dispatch({ type: "end-match-manually" });
    expect(second.ok).toBe(false);
    expect(scenario.timeline().entries).toHaveLength(count);
  });

  test("the four correction commands are refused once the match is over", async () => {
    const scenario = await startScenario();
    await score(scenario, "ab");
    await scenario.controller.dispatch({ type: "end-match-manually" });
    const count = scenario.timeline().entries.length;
    const results = await Promise.all([
      scenario.controller.dispatch({ type: "switch-serving-team" }),
      scenario.controller.dispatch({ type: "shift-rotation", team: "a", direction: "forward" }),
      scenario.controller.dispatch({ type: "end-match-manually" }),
    ]);
    for (const result of results) {
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error.code).toBe("refused");
    }
    expect(scenario.timeline().entries).toHaveLength(count);
  });
});
