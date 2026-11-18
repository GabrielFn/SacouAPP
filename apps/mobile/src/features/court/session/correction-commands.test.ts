import { getRecentPoints, planNextMatch, type CourtSessionState } from "@sacou/match-engine";
import { describe, expect, test, vi } from "vitest";

import { createFakeCourtFeedback } from "../../../adapters/fake-court-feedback";

import { SAMPLE_MATCH_BEST_OF_THREE, SAMPLE_MATCH_ONE_SET } from "../dev/sample-match.data";
import { stateOfTimeline } from "../model/court-screen.selectors";
import { feedbackOnChange } from "../model/feedback";
import {
  confirmSet,
  score,
  screen09,
  startScenario,
  type Scenario,
} from "../model/screen-scenarios.test.fixture";
import { playChangeFeedback } from "./play-change-feedback";
import { undoCourtAction } from "./undo-court-action";

function stateOf(scenario: Scenario): CourtSessionState {
  return stateOfTimeline(scenario.timeline());
}

function servingTeam(scenario: Scenario) {
  return stateOf(scenario).currentMatch?.currentSet?.servingTeam;
}

function eventTypes(scenario: Scenario): readonly string[] {
  const snapshot = scenario.controller.getSnapshot();
  return snapshot.status === "ready" ? snapshot.events.map(({ type }) => type) : [];
}

describe("switch-serving-team", () => {
  test("two in a row give the serve back, one event each", async () => {
    const scenario = await screen09();
    const before = servingTeam(scenario);
    const events = eventTypes(scenario).length;
    expect((await scenario.controller.dispatch({ type: "switch-serving-team" })).ok).toBe(true);
    expect(servingTeam(scenario)).not.toBe(before);
    expect((await scenario.controller.dispatch({ type: "switch-serving-team" })).ok).toBe(true);
    expect(servingTeam(scenario)).toBe(before);
    expect(eventTypes(scenario)).toHaveLength(events + 2);
  });

  test("with the set decided it is refused with its code", async () => {
    const scenario = await startScenario();
    await score(scenario, "a".repeat(25));
    expect(await scenario.controller.dispatch({ type: "switch-serving-team" })).toEqual({
      ok: false,
      error: { code: "refused", reason: "set-decided" },
    });
  });
});

describe("shift-rotation", () => {
  test("forward and backward undo each other and the zone moves", async () => {
    const scenario = await screen09();
    const zone = () => stateOf(scenario).currentMatch?.rotations.a?.setterZone;
    const start = zone();
    await scenario.controller.dispatch({ type: "shift-rotation", team: "a", direction: "forward" });
    expect(zone()).not.toBe(start);
    await scenario.controller.dispatch({
      type: "shift-rotation",
      team: "a",
      direction: "backward",
    });
    expect(zone()).toBe(start);
  });

  test("a team without rotation is refused", async () => {
    const scenario = await startScenario({
      ...SAMPLE_MATCH_ONE_SET,
      rotations: { a: null, b: null },
    });
    expect(
      await scenario.controller.dispatch({
        type: "shift-rotation",
        team: "a",
        direction: "forward",
      }),
    ).toEqual({ ok: false, error: { code: "refused", reason: "rotation-off" } });
  });
});

describe("revert-to", () => {
  test("goes back to the state right after the point, like the replay of the prefix", async () => {
    const scenario = await screen09();
    const target = getRecentPoints(scenario.timeline())[3];
    if (target === undefined) throw new Error("no point");
    const { entries } = scenario.timeline();
    const expected = entries.find(({ event }) => event.eventId === target.eventId)?.state;
    const result = await scenario.controller.dispatch({
      type: "revert-to",
      eventId: target.eventId,
    });
    expect(result.ok).toBe(true);
    expect(stateOf(scenario)).toEqual(expected);
  });

  test("an event that is not on the timeline is refused", async () => {
    const scenario = await screen09();
    expect(await scenario.controller.dispatch({ type: "revert-to", eventId: "nope" })).toEqual({
      ok: false,
      error: { code: "refused", reason: "invalid-revert-target" },
    });
  });
});

describe("end-match-manually", () => {
  test("writes MatchEnded with the leader in sets and the reason manual", async () => {
    const scenario = await screen09();
    expect((await scenario.controller.dispatch({ type: "end-match-manually" })).ok).toBe(true);
    const finished = stateOf(scenario).finishedMatches.at(-1);
    expect(finished?.winner).toBe("a");
    expect(finished?.endReason).toBe("manual");
  });

  test("level in sets and in points ends without a winner", async () => {
    const scenario = await startScenario();
    await score(scenario, "ab");
    await scenario.controller.dispatch({ type: "end-match-manually" });
    expect(stateOf(scenario).finishedMatches.at(-1)?.winner).toBeNull();
  });

  test("the set in play decides when the sets are level", async () => {
    const scenario = await startScenario();
    await score(scenario, "a".repeat(25));
    await confirmSet(scenario);
    await score(scenario, "b".repeat(25));
    await confirmSet(scenario, "a");
    await score(scenario, "bbba");
    await scenario.controller.dispatch({ type: "end-match-manually" });
    expect(stateOf(scenario).finishedMatches.at(-1)?.winner).toBe("b");
  });
});

describe("DESFAZER never buzzes", () => {
  test("the feedback between the state before and after an undo is nothing", async () => {
    const scenario = await screen09();
    const before = stateOf(scenario);
    await scenario.controller.dispatch({ type: "undo" });
    expect(feedbackOnChange(before, stateOf(scenario))).toBeNull();
  });
});

describe("end-match-manually without a winner", () => {
  test("the plan of the next match takes nobody out", async () => {
    const scenario = await startScenario();
    await score(scenario, "ab");
    await scenario.controller.dispatch({ type: "end-match-manually" });
    const plan = planNextMatch(stateOf(scenario), {
      exitMode: { kind: "automatic" },
      playersPerTeam: SAMPLE_MATCH_BEST_OF_THREE.teams.a.memberIds.length,
      winnerExit: null,
      criterion: "arrival-order",
      criterionInput: { arrivalOrder: [] },
      winnerCriterionInput: null,
    });
    expect(plan.ok).toBe(true);
    expect(plan.ok && plan.value.exits).toEqual([]);
    expect(plan.ok && plan.value.winnerLeaving).toBeNull();
  });
});

describe("switch-serving-team at 0-0", () => {
  test("changes who serves first", async () => {
    const scenario = await startScenario();
    const first = () => stateOf(scenario).currentMatch?.currentSet?.firstServer;
    const before = first();
    expect((await scenario.controller.dispatch({ type: "switch-serving-team" })).ok).toBe(true);
    expect(first()).toBeDefined();
    expect(first()).not.toBe(before);
  });
});

describe("DESFAZER through the route", () => {
  async function undoThroughRoute(scenario: Scenario) {
    const feedback = createFakeCourtFeedback();
    const before = stateOf(scenario);
    await undoCourtAction(scenario.timeline(), {
      dispatch: scenario.controller.dispatch,
      teamLabel: () => "Laranja",
      onUndone: () => undefined,
    });
    playChangeFeedback(feedback, before, stateOf(scenario));
    return feedback;
  }

  test("an accepted undo buzzes nothing", async () => {
    const scenario = await screen09();
    expect((await undoThroughRoute(scenario)).played()).toEqual([]);
  });

  test("a refused undo buzzes nothing and says nothing", async () => {
    const scenario = await startScenario();
    const onUndone = vi.fn();
    const feedback = createFakeCourtFeedback();
    const before = stateOf(scenario);
    await undoCourtAction(scenario.timeline(), {
      dispatch: scenario.controller.dispatch,
      teamLabel: () => "Laranja",
      onUndone,
    });
    playChangeFeedback(feedback, before, stateOf(scenario));
    expect(onUndone).not.toHaveBeenCalled();
    expect(feedback.played()).toEqual([]);
  });
});
