import {
  getFormation,
  ROTATION_SLOTS,
  type Formation,
  type FormationPhase,
  type FormationSystem,
  type RotationSlot,
  type SetterZone,
} from "@sacou/volley-rules";
import { describe, expect, test } from "vitest";

import { SCORE_APPLIERS } from "./appliers.js";
import { changeLineup, scorePoint, startMatch, substitutePlayer } from "./commands.js";
import {
  BACK_ROW_SLOTS,
  LIBERO_ROLE,
  MIDDLE_BLOCKER_LINEUP_INDEXES,
  SETTER_ZONE_SEQUENCE,
  ZONE_FORMATIONS,
} from "./constants.data.js";
import {
  BLUE_LINEUP,
  MATCH_ID,
  ORANGE_LINEUP,
  replayAll,
  rotationMatchInput,
  type RotationSetup,
  toEnvelope,
} from "./match-player.test.fixture.js";
import { parseLineupChangedPayload, parseMatchStartedPayload } from "./parse-payloads.js";
import {
  getLiberoSlot,
  getLineupBySlot,
  getOnCourtBySlot,
  getServingPlayer,
  isLiberoAllowed,
} from "./rotation-rules.js";
import { getServeAlignment, validateServeAlignment } from "./serve-alignment.js";
import type {
  CourtSessionState,
  LineupAllocation,
  MemberId,
  ScoreCommandResult,
  ScoringRules,
  TeamLibero,
  TeamSide,
  TeamState,
} from "./types.js";

const MD3: ScoringRules = { bestOf: 3, pointsPerSet: 25, tieBreakPoints: 15, winMargin: 2 };
const PHASES: readonly FormationPhase[] = ["receiving", "serving"];
const LIBERO_SYSTEMS: readonly FormationSystem[] = ["5x1", "6x2"];
const LIBERO = "a0000000-0000-4000-8000-000000000007";
const BENCH_MEMBER = "a0000000-0000-4000-8000-000000000008";
const OUTSIDER = "a0000000-0000-4000-8000-000000000099";
const CANARY = "CANARY-do-not-echo";
const FRONT_ZONE_4: RotationSlot = 4;
/** Long enough to go round the zones several times, with runs of points kept and lost. */
const RALLY_PATTERN = "abbaabaaabbbabababbaaabbbbaaab";

const [S, , MB1, , , MB2] = ORANGE_LINEUP as readonly [
  MemberId,
  MemberId,
  MemberId,
  MemberId,
  MemberId,
  MemberId,
];

interface Combination {
  readonly system: FormationSystem;
  readonly setterZone: SetterZone;
  readonly phase: FormationPhase;
}

const COMBINATIONS: readonly Combination[] = LIBERO_SYSTEMS.flatMap((system) =>
  SETTER_ZONE_SEQUENCE.flatMap((setterZone) =>
    PHASES.map((phase) => ({ system, setterZone, phase })),
  ),
);

function middles(replacedIndexes: readonly number[] = MIDDLE_BLOCKER_LINEUP_INDEXES): TeamLibero {
  return { memberId: LIBERO, replacedIndexes };
}

function teamState(
  { system, setterZone }: Pick<Combination, "system" | "setterZone">,
  libero: TeamLibero | null = middles(),
): TeamState {
  return { bench: [], libero, lineup: ORANGE_LINEUP, setterZone, system };
}

/** The slot of the catalog that has the role `L` in the formation the zone plays. */
function catalogLiberoSlot({ system, setterZone, phase }: Combination): RotationSlot | null {
  const { formationKey } = ZONE_FORMATIONS[system][setterZone];
  const formation = getFormation(system, formationKey, phase) as Formation;
  return ROTATION_SLOTS.find((slot) => formation.slots[slot].role === LIBERO_ROLE) ?? null;
}

function slotOf(slot: RotationSlot): number {
  return ROTATION_SLOTS.indexOf(slot);
}

describe("the libero only plays in the back row and never serves", () => {
  test.each(COMBINATIONS)("$system zone $setterZone $phase", (combination) => {
    const state = teamState(combination);
    const { phase } = combination;
    const slot = getLiberoSlot(state, phase);
    const onCourt = getOnCourtBySlot(state, phase);

    expect(slot === null || BACK_ROW_SLOTS.includes(slot)).toBe(true);
    expect(getServingPlayer(state.lineup, state.setterZone)).not.toBe(LIBERO);
    if (phase === "serving") {
      expect(onCourt[0]).not.toBe(LIBERO);
    }
    expect(onCourt.filter((id) => id === LIBERO).length).toBeLessThanOrEqual(1);
  });

  test.each(COMBINATIONS)(
    "$system zone $setterZone $phase: whoever reaches zone 4 is back",
    (c) => {
      const state = teamState(c);
      const onCourt = getOnCourtBySlot(state, c.phase);
      const lineupBySlot = getLineupBySlot(state.lineup, state.setterZone);

      expect(onCourt[slotOf(FRONT_ZONE_4)]).toBe(lineupBySlot[slotOf(FRONT_ZONE_4)]);
    },
  );
});

describe("the middle blockers match the libero of the catalog", () => {
  test.each(COMBINATIONS)("$system zone $setterZone $phase", (combination) => {
    expect(getLiberoSlot(teamState(combination), combination.phase)).toBe(
      catalogLiberoSlot(combination),
    );
  });
});

describe("the libero only swaps with the member it covers", () => {
  test.each(COMBINATIONS)("$system zone $setterZone $phase", (combination) => {
    const state = teamState(combination);
    const onCourt = getOnCourtBySlot(state, combination.phase);
    const lineupBySlot = getLineupBySlot(state.lineup, state.setterZone);
    const slot = getLiberoSlot(state, combination.phase);

    const changed = ROTATION_SLOTS.filter((_, index) => onCourt[index] !== lineupBySlot[index]);
    expect(changed).toStrictEqual(slot === null ? [] : [slot]);
  });
});

describe("edges of the coverage", () => {
  test("one position covers only while that member is in the back row", () => {
    const outZones = SETTER_ZONE_SEQUENCE.filter(
      (setterZone) =>
        getLiberoSlot(teamState({ system: "5x1", setterZone }, middles([4])), "receiving") === null,
    );

    expect(outZones).toStrictEqual([6, 5, 4]);
  });

  test("covering only MB2 is not read from the catalog, which has MB1 in zone 5", () => {
    expect(
      getLiberoSlot(teamState({ system: "5x1", setterZone: 5 }, middles([5])), "receiving"),
    ).toBeNull();
  });

  test.each(COMBINATIONS)("$system zone $setterZone $phase: same setter and points", (c) => {
    const withLibero = getServeAlignment(teamState(c), c.phase);
    const withoutLibero = getServeAlignment(teamState(c, null), c.phase);

    expect(withLibero.actingSetter).toBe(withoutLibero.actingSetter);
    expect(ROTATION_SLOTS.map((slot) => withLibero.slots[slot].point)).toStrictEqual(
      ROTATION_SLOTS.map((slot) => withoutLibero.slots[slot].point),
    );
    expect(validateServeAlignment(withLibero, { mode: "fivb-2025-28" }).ok).toBe(true);
  });

  test("only the slot of the libero has the role L", () => {
    COMBINATIONS.forEach((c) => {
      const alignment = getServeAlignment(teamState(c), c.phase);
      const roles = ROTATION_SLOTS.filter((slot) => alignment.slots[slot].role === LIBERO_ROLE);
      const slot = getLiberoSlot(teamState(c), c.phase);
      expect(roles).toStrictEqual(slot === null ? [] : [slot]);
    });
  });

  test("the libero is allowed only in the 5x1 and the 6x2, and never on a setter", () => {
    expect(isLiberoAllowed("5x1", middles())).toBe(true);
    expect(isLiberoAllowed("6x2", middles())).toBe(true);
    expect(isLiberoAllowed("4x2", middles())).toBe(false);
    expect(isLiberoAllowed("livre", middles())).toBe(false);
    expect(isLiberoAllowed("4x2", null)).toBe(true);
    expect(isLiberoAllowed("5x1", middles([0]))).toBe(false);
    expect(isLiberoAllowed("5x1", middles([3]))).toBe(true);
    expect(isLiberoAllowed("6x2", middles([3]))).toBe(false);
  });
});

/** Plays commands through envelopes and replay, as the app does. */
function play(setup: RotationSetup) {
  const events: ReturnType<typeof toEnvelope>[] = [];
  const state = (): CourtSessionState => replayAll(events);
  const run = (command: (current: CourtSessionState) => ScoreCommandResult) => {
    const result = command(state());
    if (!result.ok) {
      throw new Error(`command refused: ${result.error.code}`);
    }
    result.value.forEach((draft) => events.push(toEnvelope(draft, events.length + 1)));
  };
  run((current) => startMatch(current, rotationMatchInput(MD3, setup)));
  const team = (side: TeamSide): TeamState => {
    const teamState = state().currentMatch?.rotations[side] ?? null;
    if (teamState === null) {
      throw new Error("rotation off");
    }
    return teamState;
  };
  return { state, run, team };
}

function coveredIndex(state: TeamState, phase: FormationPhase): number | null {
  const slot = getLiberoSlot(state, phase);
  if (slot === null) {
    return null;
  }
  const member = getLineupBySlot(state.lineup, state.setterZone)[slotOf(slot)] as MemberId;
  return state.lineup.indexOf(member);
}

function phaseOf(current: CourtSessionState, side: TeamSide): FormationPhase {
  return current.currentMatch?.currentSet?.servingTeam === side ? "serving" : "receiving";
}

describe("a rally between a libero going out and coming in", () => {
  test.each(LIBERO_SYSTEMS)("%s: the covered position never changes in one point", (system) => {
    const player = play({ teamSize: 7, systems: [system, "5x1"], liberoIndexes: [[2, 5], null] });
    const transitions: { before: number | null; after: number | null }[] = [];

    RALLY_PATTERN.split("").forEach((scorer) => {
      const before = coveredIndex(player.team("a"), phaseOf(player.state(), "a"));
      player.run((current) => scorePoint(current, scorer as TeamSide));
      const after = coveredIndex(player.team("a"), phaseOf(player.state(), "a"));
      transitions.push({ before, after });
    });

    const swaps = transitions.filter(
      ({ before, after }) => before !== null && after !== null && before !== after,
    );
    expect(swaps).toStrictEqual([]);
    expect(transitions.some(({ before, after }) => before !== null && after === null)).toBe(true);
    expect(transitions.some(({ before, after }) => before === null && after !== null)).toBe(true);
  });

  test("the libero never serves in a whole cycle, and points keep the libero", () => {
    const player = play({ teamSize: 7, liberoIndexes: [[2, 5], null] });

    RALLY_PATTERN.split("").forEach((scorer) => {
      player.run((current) => scorePoint(current, scorer as TeamSide));
      const { lineup, setterZone, libero } = player.team("a");
      expect(getServingPlayer(lineup, setterZone)).not.toBe(LIBERO);
      expect(libero).toStrictEqual(middles());
    });
  });
});

describe("the parser of the libero", () => {
  const input = rotationMatchInput(MD3, { teamSize: 7, liberoIndexes: [[2, 5], null] });

  function withLibero(libero: unknown) {
    return { ...input, rotations: { ...input.rotations, a: { ...input.rotations.a, libero } } };
  }

  test("a JSON __proto__ key in the libero is rejected", () => {
    const payload: unknown = JSON.parse(
      JSON.stringify(withLibero({ ...middles() })).replace(
        '"replacedIndexes"',
        '"__proto__":{"memberId":"x"},"replacedIndexes"',
      ),
    );

    expect(parseMatchStartedPayload(payload)).toStrictEqual({
      ok: false,
      error: { code: "invalid-payload", field: "unknown-field" },
    });
  });

  test("never echoes a value it rejects", () => {
    const results = [
      parseMatchStartedPayload(withLibero({ memberId: CANARY, replacedIndexes: [2, 5] })),
      parseMatchStartedPayload(withLibero({ memberId: LIBERO, replacedIndexes: [CANARY] })),
      parseMatchStartedPayload(withLibero(CANARY)),
      parseLineupChangedPayload({
        matchId: input.matchId,
        team: "a",
        lineup: ORANGE_LINEUP,
        setterZone: 1,
        bench: [],
        libero: { memberId: CANARY, replacedIndexes: [2, 5] },
      }),
    ];

    results.forEach((result) => {
      expect(result.ok).toBe(false);
      expect(JSON.stringify(result)).not.toContain(CANARY);
    });
  });

  test("the parsed libero is a copy of the input", () => {
    const replacedIndexes = [2, 5];
    const parsed = parseMatchStartedPayload(withLibero({ memberId: LIBERO, replacedIndexes }));
    replacedIndexes.reverse();

    expect(parsed.ok && parsed.value.rotations.a?.libero).toStrictEqual(middles());
  });

  test("the parsed libero has its keys in UTF-16 order", () => {
    const parsed = parseMatchStartedPayload(
      withLibero({ replacedIndexes: [2, 5], memberId: LIBERO }),
    );

    expect(parsed.ok && Object.keys(parsed.value.rotations.a?.libero ?? {})).toStrictEqual([
      "memberId",
      "replacedIndexes",
    ]);
  });
});

function refusal(result: ScoreCommandResult) {
  return result.ok ? null : result.error;
}

describe("commands with a libero", () => {
  const setup: RotationSetup = { teamSize: 8, liberoIndexes: [[2, 5], null] };

  test("the libero cannot go out nor come in by a substitution", () => {
    const player = play(setup);

    expect(refusal(substitutePlayer(player.state(), "a", LIBERO, BENCH_MEMBER))).toStrictEqual({
      code: "invalid-payload",
      field: "lineup",
    });
    expect(refusal(substitutePlayer(player.state(), "a", MB1, LIBERO))).toStrictEqual({
      code: "invalid-payload",
      field: "bench",
    });
  });

  test("whoever comes into a covered position is covered, and the libero stays", () => {
    const player = play(setup);

    player.run((current) => substitutePlayer(current, "a", MB2, BENCH_MEMBER));

    const team = player.team("a");
    expect(team.libero).toStrictEqual(middles());
    expect(team.lineup[MIDDLE_BLOCKER_LINEUP_INDEXES[1] as number]).toBe(BENCH_MEMBER);
    expect(team.bench).toStrictEqual([MB2]);
    expect(getOnCourtBySlot(team, "serving")).toStrictEqual([
      S,
      ...ORANGE_LINEUP.slice(1, 5),
      LIBERO,
    ]);
  });

  test("the identical allocation is refused, and one differing only in the libero is a change", () => {
    const player = play(setup);
    const { bench, libero, lineup, setterZone } = player.team("a");
    const same: LineupAllocation = { bench, libero, lineup, setterZone };

    expect(refusal(changeLineup(player.state(), "a", same))).toStrictEqual({
      code: "lineup-unchanged",
    });
    expect(
      refusal(changeLineup(player.state(), "a", { ...same, libero: middles([5]) })),
    ).toBeNull();
    expect(
      refusal(changeLineup(player.state(), "a", { ...same, libero: middles([2, 5]) })),
    ).toStrictEqual({ code: "lineup-unchanged" });
  });

  test("turning the libero off puts it on the bench", () => {
    const player = play(setup);
    const { bench, lineup, setterZone } = player.team("a");

    player.run((current) =>
      changeLineup(current, "a", { bench: [...bench, LIBERO], libero: null, lineup, setterZone }),
    );

    expect(player.team("a").libero).toBeNull();
    expect(player.team("a").bench).toStrictEqual([BENCH_MEMBER, LIBERO]);
  });

  test.each([
    ["on a setter", { libero: middles([0]) }, "libero"],
    ["outside the team", { libero: { memberId: OUTSIDER, replacedIndexes: [2, 5] } }, "libero"],
    ["of the other team", { libero: { memberId: BLUE_LINEUP[0], replacedIndexes: [5] } }, "libero"],
    ["in the lineup", { libero: { memberId: S, replacedIndexes: [2, 5] } }, "libero"],
    ["leaving a member out", { libero: null }, "bench"],
  ])("refuses a libero %s", (_, override, field) => {
    const player = play(setup);
    const { bench, lineup, setterZone } = player.team("a");
    const allocation = { bench, lineup, setterZone, ...override } as LineupAllocation;

    expect(refusal(changeLineup(player.state(), "a", allocation))).toStrictEqual({
      code: "invalid-payload",
      field,
    });
  });

  test("refuses a libero in a system without one", () => {
    const player = play({ teamSize: 7, systems: ["4x2", "5x1"] });
    const { lineup, setterZone } = player.team("a");

    expect(
      refusal(
        changeLineup(player.state(), "a", { bench: [], libero: middles(), lineup, setterZone }),
      ),
    ).toStrictEqual({ code: "invalid-payload", field: "libero" });
  });

  test("the replay rejects a forged change with a libero on the setter", () => {
    const player = play(setup);
    const { bench, lineup, setterZone } = player.team("a");
    const forged = toEnvelope(
      {
        type: "LineupChanged",
        payload: { bench, libero: middles([0]), lineup, matchId: MATCH_ID, setterZone, team: "a" },
      },
      2,
    );
    const applyLineupChanged = SCORE_APPLIERS.get("LineupChanged");

    expect(applyLineupChanged?.(player.state(), forged)).toStrictEqual({
      ok: false,
      error: { code: "event-rejected" },
    });
  });
});
