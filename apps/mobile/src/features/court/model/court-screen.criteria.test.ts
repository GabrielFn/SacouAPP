import { describe, expect, test } from "vitest";

import { SAMPLE_MATCH_BEST_OF_THREE } from "../dev/sample-match.data";
import { selectCourtScreen } from "./court-screen.selectors";
import { selectQueue } from "./queue-model";
import { setsLabel } from "./screen-texts";
import {
  ROSTER,
  confirmSet,
  score,
  startScenario,
  withScoring,
  type Scenario,
} from "./screen-scenarios.test.fixture";

function screenOf(scenario: Scenario) {
  const model = selectCourtScreen(scenario.timeline(), ROSTER);
  if (model === null) throw new Error("no court to show");
  return model;
}

const TWO_POINT_MARGIN = {
  bestOf: 1,
  pointsPerSet: 25,
  tieBreakPoints: null,
  winMargin: 2,
} as const;

describe("set point follows the win margin of the match", () => {
  test("24-23 with a margin of 2: only the team ahead has set point and the strip names it", async () => {
    const scenario = await startScenario(withScoring(TWO_POINT_MARGIN));
    await score(scenario, `${"ab".repeat(23)}a`);
    const model = screenOf(scenario);
    expect([model.teams.a.hasSetPoint, model.teams.b.hasSetPoint]).toEqual([true, false]);
    expect(model.hint).toEqual({ kind: "closes-set", side: "a" });
  });

  test("24-24 with a margin of 2: nobody has set point, the next point does not close the set", async () => {
    const scenario = await startScenario(withScoring(TWO_POINT_MARGIN));
    await score(scenario, "ab".repeat(24));
    const model = screenOf(scenario);
    expect([model.teams.a.hasSetPoint, model.teams.b.hasSetPoint]).toEqual([false, false]);
    expect(model.hint).toEqual({ kind: "positions" });
  });

  test("25-24 with a margin of 2 is not decided and gives set point to the team ahead", async () => {
    const scenario = await startScenario(withScoring(TWO_POINT_MARGIN));
    await score(scenario, `${"ab".repeat(24)}a`);
    const model = screenOf(scenario);
    expect(model.phase).toBe("playing");
    expect([model.teams.a.hasSetPoint, model.teams.b.hasSetPoint]).toEqual([true, false]);
  });
});

describe("the dots count the sets played, never the set in play", () => {
  test("a set that just got decided but is not confirmed is still the open dot", async () => {
    const scenario = await startScenario(SAMPLE_MATCH_BEST_OF_THREE);
    await score(scenario, "a".repeat(25));
    const model = screenOf(scenario);
    expect(model.phase).toBe("set-decided");
    expect(model.dots).toEqual([{ winner: null }]);
    expect(setsLabel(model)).toBe(setsLabel({ ...model, dots: [] }));
  });

  test("after the confirmation the won set is a dot of its winner and the new set is open", async () => {
    const scenario = await startScenario(SAMPLE_MATCH_BEST_OF_THREE);
    await score(scenario, "a".repeat(25));
    await confirmSet(scenario);
    const model = screenOf(scenario);
    expect(model.setNumber).toBe(2);
    expect(model.dots).toEqual([{ winner: "a" }, { winner: null }]);
  });
});

function member(n: number): string {
  return `c0000000-0000-4000-8000-0000000000${String(n).padStart(2, "0")}`;
}

describe("the queue shows exactly who waits", () => {
  test("nobody waiting: no queue at all", () => {
    expect(selectQueue({ teams: [], players: [] }, ROSTER)).toBeNull();
  });

  test("whole teams wait in order, are a full exit, and the key is the first member", () => {
    const queue = selectQueue(
      {
        teams: [{ memberIds: [member(1), member(2)] }, { memberIds: [member(3)] }],
        players: [member(4)],
      },
      ROSTER,
    );
    expect(queue?.exit).toBe("full");
    expect(queue?.teams.map(({ players }) => players.map(({ memberId }) => memberId))).toEqual([
      [member(1), member(2)],
      [member(3)],
    ]);
    expect(queue?.players.map(({ memberId }) => memberId)).toEqual([member(4)]);
  });

  test("an unknown member still has a non-empty name", () => {
    const queue = selectQueue({ teams: [], players: [member(99)] }, ROSTER);
    expect(queue?.players[0]?.name).not.toBe("");
  });
});
