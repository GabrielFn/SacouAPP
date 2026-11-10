import {
  getLineupBySlot,
  getLiberoSlot,
  getOnCourtBySlot,
  type MatchScore,
  type MatchStartedPayload,
  type TeamSide,
} from "@sacou/match-engine";
import { ROTATION_SLOTS, type SetterZone } from "@sacou/volley-rules";
import { describe, expect, test } from "vitest";

import {
  SAMPLE_LIBERO_ID,
  SAMPLE_MATCH_WITH_LIBERO,
  SAMPLE_ORANGE_LINEUP,
} from "../dev/sample-match.data";
import { selectCourtScreen, stateOfTimeline } from "./court-screen.selectors";
import { ROSTER, score, startScenario, type Scenario } from "./screen-scenarios.test.fixture";

const LIBERO_NAME = "Tati";
const MIDDLE_BLOCKERS = [SAMPLE_ORANGE_LINEUP[2], SAMPLE_ORANGE_LINEUP[5]];
const FRONT_ZONE_4 = 4;
const SERVING_ZONE = 1;
const SETTER_ZONES: readonly SetterZone[] = ROTATION_SLOTS;

function withSetup(firstServer: TeamSide, setterZone: SetterZone): MatchStartedPayload {
  const { a } = SAMPLE_MATCH_WITH_LIBERO.rotations;
  return {
    ...SAMPLE_MATCH_WITH_LIBERO,
    firstServer,
    rotations: { ...SAMPLE_MATCH_WITH_LIBERO.rotations, a: a && { ...a, setterZone } },
  };
}

function orangeMatch(scenario: Scenario): MatchScore {
  const { currentMatch } = stateOfTimeline(scenario.timeline());
  if (currentMatch === null) throw new Error("no open match");
  return currentMatch;
}

function orangeChips(scenario: Scenario) {
  const model = selectCourtScreen(scenario.timeline(), ROSTER);
  if (model === null) throw new Error("no court to show");
  return model.teams.a.chips;
}

/** What the engine says is on Laranja's court, by zone, and whether Laranja is serving. */
function engineView(scenario: Scenario) {
  const match = orangeMatch(scenario);
  const state = match.rotations.a;
  if (state === null || match.currentSet === null) throw new Error("no rotation");
  const phase = match.currentSet.servingTeam === "a" ? "serving" : "receiving";
  return { state, phase, liberoSlot: getLiberoSlot(state, phase) } as const;
}

describe("the libero on the screen, against the engine", () => {
  test("receiving: the libero is in the back row, in the place of a middle blocker", async () => {
    const scenario = await startScenario(withSetup("b", 1));
    const chips = orangeChips(scenario);
    const libero = chips.filter(({ isLibero }) => isLibero);
    expect(libero).toHaveLength(1);
    expect(libero[0]).toMatchObject({ memberId: SAMPLE_LIBERO_ID, name: LIBERO_NAME, zone: 6 });
    expect(chips.map(({ memberId }) => memberId)).not.toContain(MIDDLE_BLOCKERS[1]);
  });

  test("serving: the libero does not stand in position 1, where the middle blocker serves", async () => {
    const zone = SETTER_ZONES.find((setterZone) => {
      const bySlot = getLineupBySlot(SAMPLE_ORANGE_LINEUP, setterZone);
      return MIDDLE_BLOCKERS.includes(bySlot[0]);
    });
    if (zone === undefined) throw new Error("no rotation puts a middle blocker in position 1");
    const scenario = await startScenario(withSetup("a", zone));
    const chips = orangeChips(scenario);
    expect(chips.some(({ isLibero }) => isLibero)).toBe(false);
    expect(chips.find((chip) => chip.zone === SERVING_ZONE)).toMatchObject({ isServer: true });
    expect(MIDDLE_BLOCKERS).toContain(chips[0]?.memberId);
  });

  test("the libero is not in position 4: the middle blocker plays there, and the libero only covers the back row", async () => {
    const zone = SETTER_ZONES.find((setterZone) => {
      const bySlot = getLineupBySlot(SAMPLE_ORANGE_LINEUP, setterZone);
      return MIDDLE_BLOCKERS.includes(bySlot[FRONT_ZONE_4 - 1]);
    });
    if (zone === undefined) throw new Error("no rotation puts a middle blocker in position 4");
    for (const firstServer of ["a", "b"] as const) {
      const chips = orangeChips(await startScenario(withSetup(firstServer, zone)));
      expect(chips[FRONT_ZONE_4 - 1]).toMatchObject({ isLibero: false });
      expect(MIDDLE_BLOCKERS).toContain(chips[FRONT_ZONE_4 - 1]?.memberId);
    }
  });

  test("through a long match, the chips follow the engine at every point", async () => {
    const scenario = await startScenario(withSetup("a", 1));
    const rallies = "ba".repeat(10) + "abb".repeat(3);
    for (const letter of rallies) {
      await score(scenario, letter);
      const { state, phase, liberoSlot } = engineView(scenario);
      const chips = orangeChips(scenario);
      expect(chips.find(({ isLibero }) => isLibero)?.zone).toBe(liberoSlot ?? undefined);
      expect(chips.map(({ memberId }) => memberId)).toEqual(getOnCourtBySlot(state, phase));
      expect(chips.filter(({ isLibero }) => isLibero).length).toBeLessThanOrEqual(1);
    }
  });

  test("Azul has no libero: no chip of it is marked", async () => {
    const scenario = await startScenario(withSetup("b", 1));
    const model = selectCourtScreen(scenario.timeline(), ROSTER);
    expect(model?.teams.b.chips.some(({ isLibero }) => isLibero)).toBe(false);
  });
});
