import {
  FORMATION_CATALOG,
  FORMATION_CATALOG_VERSION,
  FORMATION_SYSTEMS,
  getFormation,
  OVERLAP_RELATIONS,
  ROTATION_SLOTS,
  type FormationPhase,
  type FormationSystem,
  type OverlapRuleMode,
  type PlayerRole,
  type SetterZone,
} from "@sacou/volley-rules";
import { describe, expect, test } from "vitest";

import { REVERTED_TO_EVENT_TYPE } from "../event-log/constants.data.js";
import type { EventEnvelope } from "../event-log/types.js";
import { INITIAL_COURT_SESSION_STATE } from "./appliers.js";
import { confirmSetEnd, endMatchManually, scorePoint, startMatch } from "./commands.js";
import { SETTER_ZONE_SEQUENCE, ZONE_FORMATIONS } from "./constants.data.js";
import {
  BLUE_LINEUP,
  matchInput,
  ORANGE_LINEUP,
  replayAll,
  rotationMatchInput,
  type RotationSetup,
  toEnvelope,
} from "./match-player.test.fixture.js";
import { getServingPlayer } from "./rotation-rules.js";
import {
  getServeAlignment,
  getTeamServeAlignment,
  validateServeAlignment,
} from "./serve-alignment.js";
import type {
  CourtSessionState,
  MatchScore,
  ScoreCommandResult,
  ScoringRules,
  ServeAlignment,
  TeamState,
} from "./types.js";

const MD3: ScoringRules = { bestOf: 3, pointsPerSet: 2, tieBreakPoints: 1, winMargin: 2 };
const LONG_SET: ScoringRules = { bestOf: 1, pointsPerSet: 99, tieBreakPoints: null, winMargin: 2 };

const PHASES: readonly FormationPhase[] = ["receiving", "serving"];
const MODES: readonly OverlapRuleMode[] = ["fivb-2025-28", "classic"];
const STRICT_TOLERANCE = 0;
const RECEIVING_RELATIONS = OVERLAP_RELATIONS.length;
const CLASSIC_SERVING_RELATIONS = 5;

/** The order of the lineup, written apart from the engine: decision D2 of the E2.4 plan. */
const ROLES_BY_LINEUP_INDEX: Readonly<Partial<Record<FormationSystem, readonly PlayerRole[]>>> = {
  "5x1": ["S", "OH1", "MB1", "OPP", "OH2", "MB2"],
  "6x2": ["S1", "OH1", "MB1", "S2", "OH2", "MB2"],
  "4x2": ["S1", "OH1", "MB1", "S2", "OH2", "MB2"],
};

interface Combination {
  readonly system: FormationSystem;
  readonly setterZone: SetterZone;
  readonly phase: FormationPhase;
}

const COMBINATIONS: readonly Combination[] = FORMATION_SYSTEMS.flatMap((system) =>
  SETTER_ZONE_SEQUENCE.flatMap((setterZone) =>
    PHASES.map((phase) => ({ system, setterZone, phase })),
  ),
);

function teamState({ system, setterZone }: Pick<Combination, "system" | "setterZone">): TeamState {
  return { bench: [], libero: null, lineup: ORANGE_LINEUP, setterZone, system };
}

function alignmentOf(combination: Combination): ServeAlignment {
  return getServeAlignment(teamState(combination), combination.phase);
}

function checkedOf(alignment: ServeAlignment, mode: OverlapRuleMode, tolerance?: number) {
  const result = validateServeAlignment(
    alignment,
    tolerance === undefined ? { mode } : { mode, tolerance },
  );
  if (!result.ok) {
    throw new Error(`overlap: ${result.error.code}`);
  }
  return result.value.checked;
}

describe("the 48 combinations against the catalog", () => {
  test("cover 4 systems, 6 zones and 2 phases", () => {
    const SYSTEMS_COUNT = 4;
    const ZONES_COUNT = 6;
    expect(COMBINATIONS).toHaveLength(SYSTEMS_COUNT * ZONES_COUNT * PHASES.length);
  });

  test.each(COMBINATIONS)("$system zone $setterZone $phase: points of the formation", (c) => {
    const alignment = alignmentOf(c);
    const formation = getFormation(c.system, alignment.formationKey, c.phase);

    expect(formation).toBeDefined();
    ROTATION_SLOTS.forEach((slot) => {
      expect(alignment.slots[slot].point).toStrictEqual(formation?.slots[slot].point);
    });
  });

  test.each(COMBINATIONS)("$system zone $setterZone $phase: passes the validator", (c) => {
    const alignment = alignmentOf(c);

    MODES.forEach((mode) => {
      expect(checkedOf(alignment, mode)).toStrictEqual(
        checkedOf(alignment, mode, STRICT_TOLERANCE),
      );
    });
    if (c.phase === "receiving") {
      MODES.forEach((mode) => {
        expect(checkedOf(alignment, mode)).toHaveLength(RECEIVING_RELATIONS);
      });
    } else {
      expect(checkedOf(alignment, "fivb-2025-28")).toHaveLength(0);
      expect(checkedOf(alignment, "classic")).toHaveLength(CLASSIC_SERVING_RELATIONS);
    }
  });

  test("the validator reports a violation and a bad tolerance, and blocks nothing itself", () => {
    const alignment = alignmentOf({ system: "5x1", setterZone: 1, phase: "receiving" });
    const crossed: ServeAlignment = {
      ...alignment,
      slots: {
        ...alignment.slots,
        2: { ...alignment.slots[2], point: { x: 0.8, y: 0.9 } },
        1: { ...alignment.slots[1], point: { x: 0.95, y: 0.1 } },
      },
    };

    expect(validateServeAlignment(crossed, { mode: "fivb-2025-28" })).toStrictEqual({
      ok: false,
      error: { code: "overlap", violations: ["1-behind-2"] },
    });
    expect(
      validateServeAlignment(alignment, { mode: "fivb-2025-28", tolerance: Number.NaN }),
    ).toStrictEqual({ ok: false, error: { code: "invalid-tolerance" } });
  });
});

describe("properties of the alignment", () => {
  test.each(COMBINATIONS)("$system zone $setterZone $phase", (c) => {
    const alignment = alignmentOf(c);
    const slots = ROTATION_SLOTS.map((slot) => alignment.slots[slot]);

    expect(new Set(slots.map(({ memberId }) => memberId)).size).toBe(ROTATION_SLOTS.length);
    expect([...slots.map(({ memberId }) => memberId)].sort()).toStrictEqual(
      [...ORANGE_LINEUP].sort(),
    );
    expect(slots.map(({ role }) => role)).not.toContain("L");
    expect(alignment.slots[c.setterZone].memberId).toBe(ORANGE_LINEUP[0]);
    if (c.phase === "serving") {
      expect(alignment.slots[1].memberId).toBe(getServingPlayer(ORANGE_LINEUP, c.setterZone));
    }
    expect(alignment).toMatchObject({
      system: c.system,
      setterZone: c.setterZone,
      phase: c.phase,
    });
  });

  test.each(COMBINATIONS.filter(({ system }) => system !== "livre"))(
    "$system zone $setterZone $phase: the role follows the member",
    (c) => {
      const alignment = alignmentOf(c);
      const roles = ROLES_BY_LINEUP_INDEX[c.system];

      ROTATION_SLOTS.forEach((slot) => {
        const { memberId, role } = alignment.slots[slot];
        expect(role).toBe(roles?.[ORANGE_LINEUP.indexOf(memberId)]);
      });
    },
  );

  test.each(COMBINATIONS.filter(({ system }) => system === "livre"))(
    "livre zone $setterZone $phase: the role is the position, and the members rotate",
    (c) => {
      const alignment = alignmentOf(c);

      expect(alignment.formationKey).toBe(0);
      ROTATION_SLOTS.forEach((slot) => {
        expect(alignment.slots[slot].role).toBe(`P${String(slot)}`);
      });
      expect(alignment.actingSetter).toBe(alignment.slots[3].memberId);
    },
  );

  test("does not touch the state it reads", () => {
    const lineup = [...ORANGE_LINEUP];

    getServeAlignment({ libero: null, lineup, setterZone: 4, system: "6x2" }, "receiving");

    expect(lineup).toStrictEqual(ORANGE_LINEUP);
  });
});

describe("who sets", () => {
  const BACK_ROW_ZONES: readonly SetterZone[] = [1, 6, 5];
  const SECOND_SETTER_INDEX = 3;

  function setterOfZone(system: FormationSystem, setterZone: SetterZone) {
    return alignmentOf({ system, setterZone, phase: "receiving" }).actingSetter;
  }

  test.each(SETTER_ZONE_SEQUENCE)("5x1 zone %i: always the one setter", (zone) => {
    expect(setterOfZone("5x1", zone)).toBe(ORANGE_LINEUP[0]);
  });

  test.each(SETTER_ZONE_SEQUENCE)("6x2 zone %i: the setter in the back row", (zone) => {
    const expected = BACK_ROW_ZONES.includes(zone) ? 0 : SECOND_SETTER_INDEX;
    expect(setterOfZone("6x2", zone)).toBe(ORANGE_LINEUP[expected]);
  });

  test.each(SETTER_ZONE_SEQUENCE)("4x2 zone %i: the setter at the net", (zone) => {
    const expected = BACK_ROW_ZONES.includes(zone) ? SECOND_SETTER_INDEX : 0;
    expect(setterOfZone("4x2", zone)).toBe(ORANGE_LINEUP[expected]);
  });
});

describe("the table of zones", () => {
  test.each(FORMATION_SYSTEMS)("%s plays the rotation order of the catalog", (system) => {
    const { rotationOrder } = FORMATION_CATALOG.systems[system];
    const keys = SETTER_ZONE_SEQUENCE.map((zone) => ZONE_FORMATIONS[system][zone].formationKey);

    // Six zones walk the order of the catalog, from the start, as many times as it fits.
    expect(keys).toStrictEqual(
      SETTER_ZONE_SEQUENCE.map((_, index) => rotationOrder[index % rotationOrder.length]),
    );
  });

  test.each(FORMATION_SYSTEMS)("%s only swaps the pairs on the second pass", (system) => {
    const { rotationOrder } = FORMATION_CATALOG.systems[system];
    const swaps = SETTER_ZONE_SEQUENCE.map((zone) => ZONE_FORMATIONS[system][zone].swapPairs);
    const passOf = (index: number) => Math.floor(index / rotationOrder.length);

    expect(swaps).toStrictEqual(
      SETTER_ZONE_SEQUENCE.map(
        (_, index) => system !== "livre" && system !== "5x1" && passOf(index) === 1,
      ),
    );
  });
});

describe("getTeamServeAlignment", () => {
  function play(
    commands: readonly ((state: CourtSessionState) => ScoreCommandResult)[],
  ): readonly EventEnvelope[] {
    return commands.reduce<readonly EventEnvelope[]>((events, command) => {
      const result = command(replayAll(events));
      if (!result.ok) {
        throw new Error(`refused: ${result.error.code}`);
      }
      return [
        ...events,
        ...result.value.map((draft, index) => toEnvelope(draft, events.length + index + 1)),
      ];
    }, []);
  }

  function start(setup: RotationSetup = {}, scoring: ScoringRules = LONG_SET) {
    return (state: CourtSessionState) => startMatch(state, rotationMatchInput(scoring, setup));
  }

  function openMatch(events: readonly EventEnvelope[]): MatchScore {
    const match = replayAll(events).currentMatch;
    if (match === null) {
      throw new Error("no open match");
    }
    return match;
  }

  test("is null with no match", () => {
    expect(getTeamServeAlignment(INITIAL_COURT_SESSION_STATE.currentMatch, "a")).toBeNull();
  });

  test("is null for a team with the rotation off, whose rival still has it", () => {
    const match = openMatch(play([start({ zones: [null, 1] })]));

    expect(getTeamServeAlignment(match, "a")).toBeNull();
    expect(getTeamServeAlignment(match, "b")).not.toBeNull();
  });

  test("is null for both teams when the teams have no rotation", () => {
    const match = openMatch(play([(state) => startMatch(state, matchInput(LONG_SET))]));

    expect(getTeamServeAlignment(match, "a")).toBeNull();
    expect(getTeamServeAlignment(match, "b")).toBeNull();
  });

  test("is null with no open set, as in a deciding set waiting for the end of the match", () => {
    const match = openMatch(play([start()]));

    expect(getTeamServeAlignment({ ...match, currentSet: null }, "a")).toBeNull();
    expect(getTeamServeAlignment({ ...match, currentSet: null }, "b")).toBeNull();
  });

  test("is null for a catalog this app does not have", () => {
    const match = openMatch(play([start()]));
    const recorded = { ...match, formationsVersion: FORMATION_CATALOG_VERSION + 1 };

    expect(getTeamServeAlignment(recorded, "a")).toBeNull();
    expect(getTeamServeAlignment(recorded, "b")).toBeNull();
  });

  test("the team that serves is serving, and the other is receiving", () => {
    const match = openMatch(play([start({ firstServer: "b" })]));

    expect(getTeamServeAlignment(match, "b")?.phase).toBe("serving");
    expect(getTeamServeAlignment(match, "a")?.phase).toBe("receiving");
  });

  test("after a side-out the winner serves in the next zone and the other keeps its zone", () => {
    const match = openMatch(play([start(), (state) => scorePoint(state, "b")]));

    expect(getTeamServeAlignment(match, "b")).toMatchObject({ phase: "serving", setterZone: 6 });
    expect(getTeamServeAlignment(match, "a")).toMatchObject({ phase: "receiving", setterZone: 1 });
    expect(getTeamServeAlignment(match, "b")?.slots[1].memberId).toBe(BLUE_LINEUP[1]);
  });

  test("winning while serving changes nothing", () => {
    const before = openMatch(play([start()]));
    const after = openMatch(play([start(), (state) => scorePoint(state, "a")]));

    expect(getTeamServeAlignment(after, "a")).toStrictEqual(getTeamServeAlignment(before, "a"));
    expect(getTeamServeAlignment(after, "b")).toStrictEqual(getTeamServeAlignment(before, "b"));
  });

  test("each team has its own system", () => {
    const match = openMatch(play([start({ systems: ["5x1", "livre"], firstServer: "b" })]));

    expect(getTeamServeAlignment(match, "a")).toMatchObject({ system: "5x1", formationKey: 1 });
    expect(getTeamServeAlignment(match, "b")).toMatchObject({ system: "livre", formationKey: 0 });
  });

  test("the next set keeps the system of each team and the zone where it stopped", () => {
    const events = play([
      start({ systems: ["6x2", "4x2"] }, MD3),
      (state) => scorePoint(state, "b"),
      (state) => scorePoint(state, "b"),
      (state) => confirmSetEnd(state),
    ]);
    const match = openMatch(events);

    expect(match.currentSet?.setNumber).toBe(2);
    expect(getTeamServeAlignment(match, "a")).toMatchObject({ system: "6x2", setterZone: 1 });
    expect(getTeamServeAlignment(match, "b")).toMatchObject({ system: "4x2", setterZone: 6 });
  });

  test("RevertedTo goes back to the previous alignment", () => {
    const beforeSideOut = play([start({ systems: ["6x2", "livre"] })]);
    const withSideOut = play([start({ systems: ["6x2", "livre"] }), (s) => scorePoint(s, "b")]);
    const [matchStarted, sideOut] = withSideOut as readonly [EventEnvelope, EventEnvelope];
    const revert: EventEnvelope = {
      ...sideOut,
      eventId: "e0000000-0000-4000-8000-000000000099",
      payload: { targetEventId: matchStarted.eventId },
      sequence: withSideOut.length + 1,
      type: REVERTED_TO_EVENT_TYPE,
    };
    const expected = openMatch(beforeSideOut);
    const reverted = openMatch([...withSideOut, revert]);

    expect(getTeamServeAlignment(reverted, "a")).toStrictEqual(
      getTeamServeAlignment(expected, "a"),
    );
    expect(getTeamServeAlignment(reverted, "b")).toStrictEqual(
      getTeamServeAlignment(expected, "b"),
    );
  });

  test("a finished match has no open match to show", () => {
    const events = play([start(), (state) => endMatchManually(state, null)]);

    expect(replayAll(events).currentMatch).toBeNull();
    expect(getTeamServeAlignment(replayAll(events).currentMatch, "a")).toBeNull();
  });
});
