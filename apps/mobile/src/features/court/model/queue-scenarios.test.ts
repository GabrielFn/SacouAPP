import type { MatchStartedPayload } from "@sacou/match-engine";
import { describe, expect, test } from "vitest";

import { SAMPLE_MATCH_ONE_SET } from "../dev/sample-match.data";
import { selectCourtScreen } from "./court-screen.selectors";
import { queuePills } from "./screen-texts";
import { ROSTER, startScenario } from "./screen-scenarios.test.fixture";

const TEAM_SIZE = 6;

function team(prefix: string): readonly string[] {
  return Array.from(
    { length: TEAM_SIZE },
    (_, index) => `${prefix}0000000-0000-4000-8000-00000000000${String(index + 1)}`,
  );
}

/** 24 players: two on the court, two whole teams waiting (and, in one case, two loose reserves). */
function withQueue(players: readonly string[]): MatchStartedPayload {
  return {
    ...SAMPLE_MATCH_ONE_SET,
    queue: { players, teams: [{ memberIds: team("d") }, { memberIds: team("e") }] },
  };
}

describe("a queue with whole teams, from the engine", () => {
  test("the exit is full and the teams keep the order of the queue", async () => {
    const scenario = await startScenario(withQueue([]));
    const queue = selectCourtScreen(scenario.timeline(), ROSTER)?.queue;
    expect(queue?.exit).toBe("full");
    expect(queue?.teams.map(({ key }) => key)).toEqual([team("d").join(), team("e").join()]);
    expect(queue?.players).toEqual([]);
    expect(queue && queuePills(queue).map(({ label }) => label)).toEqual(["Time 1", "Time 2"]);
  });

  test("reserves next to whole teams still make a full exit, and come after the teams", async () => {
    const reserves = SAMPLE_MATCH_ONE_SET.queue.players;
    const scenario = await startScenario(withQueue(reserves));
    const queue = selectCourtScreen(scenario.timeline(), ROSTER)?.queue;
    expect(queue?.exit).toBe("full");
    expect(queue && queuePills(queue).map(({ label }) => label)).toEqual([
      "Time 1",
      "Time 2",
      "Davi",
      "Sofia",
    ]);
  });

  test("only loose reserves make a partial exit", async () => {
    const scenario = await startScenario(SAMPLE_MATCH_ONE_SET);
    expect(selectCourtScreen(scenario.timeline(), ROSTER)?.queue?.exit).toBe("partial");
  });

  test("an empty queue shows nothing", async () => {
    const scenario = await startScenario({
      ...SAMPLE_MATCH_ONE_SET,
      queue: { players: [], teams: [] },
    });
    expect(selectCourtScreen(scenario.timeline(), ROSTER)?.queue).toBeNull();
  });
});
