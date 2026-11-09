import type { CourtSessionTimeline, MatchStartedPayload, TeamSide } from "@sacou/match-engine";

import { createSampleRoster } from "../dev/sample-roster";
import { SAMPLE_MATCH_BEST_OF_THREE, SAMPLE_MATCH_ONE_SET } from "../dev/sample-match.data";
import {
  COURT_SESSION_ID,
  createHarness,
  rallies,
  type CourtHarness,
} from "../session/court-harness.test.fixture";
import type { CourtSessionController } from "../session/court-session-controller";
import {
  AZUL_ZONE_ON_SCREEN_10,
  SCREEN_09_SET_TWO_RALLIES,
  SCREEN_10_ROUNDS,
  SET_ONE_RALLIES,
} from "./screen-scenarios.data";

export const ROSTER = createSampleRoster();

export interface Scenario {
  readonly harness: CourtHarness;
  readonly controller: CourtSessionController;
  timeline(): CourtSessionTimeline;
}

/** A sample match in memory, started and ready for `rallies`; the timeline is the replay of its log. */
export async function startScenario(
  input: MatchStartedPayload = SAMPLE_MATCH_BEST_OF_THREE,
): Promise<Scenario> {
  const harness = await createHarness("memory");
  await harness.start(input);
  const controller = await harness.restart();
  return {
    harness,
    controller,
    timeline() {
      const snapshot = controller.getSnapshot();
      if (snapshot.status !== "ready") throw new Error(`controller is ${snapshot.status}`);
      const replayed = harness.replayer.replay(COURT_SESSION_ID, snapshot.events);
      if (!replayed.ok) throw new Error("the log does not replay");
      return replayed.value;
    },
  };
}

export async function score(scenario: Scenario, teams: string): Promise<void> {
  await rallies(scenario.controller, teams);
}

export async function confirmSet(scenario: Scenario, firstServer?: TeamSide): Promise<void> {
  const result = await scenario.controller.dispatch(
    firstServer === undefined
      ? { type: "confirm-set-end" }
      : { type: "confirm-set-end", firstServer },
  );
  if (!result.ok) throw new Error(`confirm refused: ${result.error.code}`);
}

/** Screen 09: set 1 ends 25-22 for Laranja and set 2 reaches 18-15 (corrections.test.ts). */
export async function screen09(): Promise<Scenario> {
  const scenario = await startScenario();
  await score(scenario, SET_ONE_RALLIES);
  await confirmSet(scenario);
  await score(scenario, SCREEN_09_SET_TWO_RALLIES);
  return scenario;
}

/** The sample match with another scoring, for the tests of the end of a set. */
export function withScoring(scoring: MatchStartedPayload["scoring"]): MatchStartedPayload {
  return { ...SAMPLE_MATCH_BEST_OF_THREE, scoring };
}

/** Screen 10: Laranja in zone 1 and Azul in zone 6, 24-21 after six side-outs each. */
export async function screen10(): Promise<Scenario> {
  const { rotations } = SAMPLE_MATCH_BEST_OF_THREE;
  const scenario = await startScenario({
    ...SAMPLE_MATCH_ONE_SET,
    rotations: {
      a: rotations.a,
      b: rotations.b && { ...rotations.b, setterZone: AZUL_ZONE_ON_SCREEN_10 },
    },
  });
  const rounds = SCREEN_10_ROUNDS.map(
    ({ azul, laranja }) => `b${"b".repeat(azul)}a${"a".repeat(laranja)}`,
  );
  await score(scenario, rounds.join(""));
  return scenario;
}
