import { FORMATION_SYSTEMS, ROTATION_SLOTS, type FormationPhase } from "@sacou/volley-rules";
import { describe, expect, test } from "vitest";

import { replayEvents } from "../event-log/replay-events.js";
import type { EventEnvelope } from "../event-log/types.js";
import { INITIAL_COURT_SESSION_STATE, SCORE_APPLIERS } from "./appliers.js";
import {
  changeLineup,
  confirmSetEnd,
  endMatchManually,
  scorePoint,
  startMatch,
  substitutePlayer,
} from "./commands.js";
import {
  LINEUP_CHANGED_EVENT_TYPE,
  MAX_BENCH_MEMBERS,
  MAX_TEAM_MEMBERS,
  SETTER_ZONE_SEQUENCE,
} from "./constants.data.js";
import {
  BLUE_LINEUP,
  COURT_SESSION_ID,
  MATCH_ID,
  ORANGE_LINEUP,
  replayAll,
  rotationMatchInput,
  type RotationSetup,
  toEnvelope,
} from "./match-player.test.fixture.js";
import { parseLineupChangedPayload, parseMatchStartedPayload } from "./parse-payloads.js";
import { getCurrentServingPlayer, isRosterPartition } from "./rotation-rules.js";
import { getServeAlignment, validateServeAlignment } from "./serve-alignment.js";
import type {
  CourtSessionState,
  LineupAllocation,
  MatchScore,
  MemberId,
  ScoreCommandResult,
  ScoreEventDraft,
  ScoringRules,
  TeamSide,
  TeamState,
} from "./types.js";

const MD3: ScoringRules = { bestOf: 3, pointsPerSet: 25, tieBreakPoints: 15, winMargin: 2 };
const CANARY = "CANARY-do-not-echo";
const PHASES: readonly FormationPhase[] = ["serving", "receiving"];

const [A, B, C, D, E, F] = ORANGE_LINEUP as readonly [
  MemberId,
  MemberId,
  MemberId,
  MemberId,
  MemberId,
  MemberId,
];
const G = "a0000000-0000-4000-8000-000000000007";
const H = "a0000000-0000-4000-8000-000000000008";
const OUTSIDER = "a0000000-0000-4000-8000-000000000099";
const U = BLUE_LINEUP[0] as MemberId;
const S = "b0000000-0000-4000-8000-000000000007";
const T = "b0000000-0000-4000-8000-000000000008";

interface Player {
  readonly events: () => readonly EventEnvelope[];
  readonly state: () => CourtSessionState;
  readonly match: () => MatchScore;
  readonly team: (side: TeamSide) => TeamState;
  readonly run: (command: (state: CourtSessionState) => ScoreCommandResult) => void;
  readonly points: (teams: string) => void;
}

/** Plays commands through envelopes, parser and replay, proving the replay accepts their events. */
function createPlayer(setup: RotationSetup): Player {
  const events: EventEnvelope[] = [];
  const state = () => replayAll(events);
  const match = () => {
    const current = state().currentMatch;
    if (current === null) {
      throw new Error("no open match");
    }
    return current;
  };
  const run: Player["run"] = (command) => {
    const result = command(state());
    if (!result.ok) {
      throw new Error(`command refused: ${result.error.code}`);
    }
    result.value.forEach((draft) => events.push(toEnvelope(draft, events.length + 1)));
  };
  run((current) => startMatch(current, rotationMatchInput(MD3, setup)));
  return {
    events: () => events,
    state,
    match,
    team: (side) => {
      const teamState = match().rotations[side];
      if (teamState === null) {
        throw new Error("rotation off");
      }
      return teamState;
    },
    run,
    points: (teams) => {
      teams.split("").forEach((team) => {
        run((current) => scorePoint(current, team as TeamSide));
      });
    },
  };
}

function refusal(result: ScoreCommandResult) {
  return result.ok ? null : result.error;
}

function lineupEvent(team: TeamSide, allocation: LineupAllocation): ScoreEventDraft {
  return {
    type: LINEUP_CHANGED_EVENT_TYPE,
    payload: { ...allocation, matchId: MATCH_ID, team },
  };
}

function deepFreeze<T>(value: T): T {
  if (typeof value === "object" && value !== null) {
    Object.values(value).forEach(deepFreeze);
    Object.freeze(value);
  }
  return value;
}

describe("a point never changes who plays", () => {
  test("a whole set with a full bench only moves the zones", () => {
    const player = createPlayer({ teamSize: 8 });
    const benchA = player.team("a").bench;
    const benchB = player.team("b").bench;

    player.points("baba".repeat(11) + "ba" + "aa");

    expect(player.team("a")).toMatchObject({ bench: benchA, lineup: ORANGE_LINEUP, setterZone: 2 });
    expect(player.team("b")).toMatchObject({ bench: benchB, lineup: BLUE_LINEUP, setterZone: 2 });
    expect(player.match().currentSet?.score).toStrictEqual({ a: 25, b: 23 });
  });
});

describe("substitutePlayer", () => {
  test("whoever comes in takes the position, and the zone stays", () => {
    const player = createPlayer({ teamSize: 8, zones: [4, 1] });

    player.run((state) => substitutePlayer(state, "a", D, H));

    expect(player.team("a")).toStrictEqual({
      bench: [G, D],
      libero: null,
      lineup: [A, B, C, H, E, F],
      setterZone: 4,
      system: "5x1",
    });
  });

  test("the rest of the bench keeps its order, and whoever leaves goes to the end", () => {
    const player = createPlayer({ teamSize: 8 });

    player.run((state) => substitutePlayer(state, "a", D, H));
    player.run((state) => substitutePlayer(state, "a", A, G));
    player.run((state) => substitutePlayer(state, "a", H, D));

    expect(player.team("a")).toMatchObject({
      bench: [A, H],
      lineup: [G, B, C, D, E, F],
    });
  });

  test("whoever replaces the server serves, on the same turn", () => {
    const player = createPlayer({ teamSize: 7 });
    player.points("a");

    player.run((state) => substitutePlayer(state, "a", A, G));

    expect(getCurrentServingPlayer(player.match())).toBe(G);
    expect(player.match().currentSet).toMatchObject({ servingTeam: "a", score: { a: 1, b: 0 } });
  });

  test("the bench of the other team does not move", () => {
    const player = createPlayer({ teamSize: 8 });
    const before = player.team("b");

    player.run((state) => substitutePlayer(state, "a", A, G));

    expect(player.team("b")).toStrictEqual(before);
  });

  test("works on team b", () => {
    const player = createPlayer({ teamSize: 8 });

    player.run((state) => substitutePlayer(state, "b", U, T));

    expect(player.team("b").bench).toStrictEqual([S, U]);
    expect(player.team("b").lineup[0]).toBe(T);
  });

  test("six players have nobody to bring in", () => {
    const player = createPlayer({});

    expect(refusal(substitutePlayer(player.state(), "a", A, G))).toStrictEqual({
      code: "invalid-payload",
      field: "bench",
    });
  });

  test.each([
    ["outgoing is on the bench", G, H, "lineup"],
    ["outgoing is outside the team", OUTSIDER, G, "lineup"],
    ["incoming is on the court", A, B, "bench"],
    ["incoming is outside the team", A, OUTSIDER, "bench"],
    ["both are the same member", A, A, "bench"],
  ])("refuses when %s", (_, outgoing, incoming, field) => {
    const player = createPlayer({ teamSize: 8 });

    expect(refusal(substitutePlayer(player.state(), "a", outgoing, incoming))).toStrictEqual({
      code: "invalid-payload",
      field,
    });
  });

  test("the refusal does not echo what it received", () => {
    const player = createPlayer({ teamSize: 8 });

    const result = substitutePlayer(player.state(), "a", CANARY, CANARY);

    expect(JSON.stringify(result)).not.toContain(CANARY);
  });

  test("refuses without an open match and with the rotation off", () => {
    expect(refusal(substitutePlayer(INITIAL_COURT_SESSION_STATE, "a", A, G))).toStrictEqual({
      code: "no-open-match",
    });
    const player = createPlayer({ teamSize: 7, zones: [null, 1] });
    expect(refusal(substitutePlayer(player.state(), "a", A, G))).toStrictEqual({
      code: "rotation-off",
    });
  });

  test("a team outside the schema is an invalid payload, even a key of Object.prototype", () => {
    const player = createPlayer({ teamSize: 7 });

    expect(refusal(substitutePlayer(player.state(), "c" as TeamSide, A, G))).toStrictEqual({
      code: "invalid-payload",
      field: "team",
    });
    expect(refusal(substitutePlayer(player.state(), "__proto__" as TeamSide, A, G))).toStrictEqual({
      code: "invalid-payload",
      field: "team",
    });
  });
});

describe("changeLineup", () => {
  test("screen 22: a swap of two on the court, with the bench untouched and a new zone", () => {
    const player = createPlayer({ teamSize: 7 });
    const allocation = {
      bench: [G],
      libero: null,
      lineup: [A, B, D, C, E, F],
      setterZone: 4 as const,
    };

    expect(changeLineup(player.state(), "a", allocation)).toStrictEqual({
      ok: true,
      value: [lineupEvent("a", allocation)],
    });
    player.run((state) => changeLineup(state, "a", allocation));

    expect(player.team("a")).toStrictEqual({ ...allocation, system: "5x1" });
  });

  test("changing only the zone is a change", () => {
    const player = createPlayer({ teamSize: 7 });

    const { bench, lineup } = player.team("a");

    player.run((state) => changeLineup(state, "a", { bench, libero: null, lineup, setterZone: 3 }));

    expect(player.team("a").setterZone).toBe(3);
  });

  test("changing only the order of the bench is a change", () => {
    const player = createPlayer({ teamSize: 8 });
    const { lineup, setterZone } = player.team("a");

    player.run((state) =>
      changeLineup(state, "a", { bench: [H, G], libero: null, lineup, setterZone }),
    );

    expect(player.team("a").bench).toStrictEqual([H, G]);
  });

  test("a system in the input is refused: it does not change in a match", () => {
    const player = createPlayer({ teamSize: 7 });
    const withSystem = { ...player.team("a"), setterZone: 3 as const };

    expect(refusal(changeLineup(player.state(), "a", withSystem))).toStrictEqual({
      code: "invalid-payload",
      field: "unknown-field",
    });
  });

  test("the identical allocation is refused", () => {
    const player = createPlayer({ teamSize: 8 });
    const { bench, lineup, setterZone } = player.team("a");

    expect(
      refusal(changeLineup(player.state(), "a", { bench, libero: null, lineup, setterZone })),
    ).toStrictEqual({ code: "lineup-unchanged" });
  });

  test.each([
    [
      "a member left out",
      { bench: [G], libero: null, lineup: ORANGE_LINEUP, setterZone: 1 },
      "bench",
    ],
    [
      "an outsider on the bench",
      { bench: [G, OUTSIDER], libero: null, lineup: ORANGE_LINEUP, setterZone: 1 },
      "bench",
    ],
    [
      "an outsider in the lineup",
      { bench: [G, H], libero: null, lineup: [OUTSIDER, B, C, D, E, F], setterZone: 1 },
      "lineup",
    ],
    [
      "the bench overlaps the lineup",
      { bench: [G, A], libero: null, lineup: ORANGE_LINEUP, setterZone: 1 },
      "bench",
    ],
    [
      "five in the lineup",
      { bench: [F, G, H], libero: null, lineup: [A, B, C, D, E], setterZone: 1 },
      "lineup",
    ],
    [
      "an invalid zone",
      { bench: [G, H], libero: null, lineup: ORANGE_LINEUP, setterZone: 7 },
      "setterZone",
    ],
  ])("refuses %s", (_, allocation, field) => {
    const player = createPlayer({ teamSize: 8 });

    expect(
      refusal(changeLineup(player.state(), "a", allocation as unknown as LineupAllocation)),
    ).toStrictEqual({ code: "invalid-payload", field });
  });

  test("refuses without an open match, after the end, and with the rotation off", () => {
    const allocation = {
      bench: [A],
      libero: null,
      lineup: [G, B, C, D, E, F],
      setterZone: 1 as const,
    };
    expect(refusal(changeLineup(INITIAL_COURT_SESSION_STATE, "a", allocation))).toStrictEqual({
      code: "no-open-match",
    });

    const ended = createPlayer({ teamSize: 7 });
    ended.run((state) => endMatchManually(state, null));
    expect(refusal(changeLineup(ended.state(), "a", allocation))).toStrictEqual({
      code: "no-open-match",
    });

    const off = createPlayer({ teamSize: 7, zones: [null, 1] });
    expect(refusal(changeLineup(off.state(), "a", allocation))).toStrictEqual({
      code: "rotation-off",
    });
  });
});

describe("the rotation off has no bench", () => {
  test("the replay rejects the change, and the other team goes on", () => {
    const player = createPlayer({ teamSize: 7, zones: [null, 1] });
    const forged = toEnvelope(
      lineupEvent("a", { bench: [A], libero: null, lineup: [G, B, C, D, E, F], setterZone: 1 }),
      player.events().length + 1,
    );

    const replayed = replayEvents(
      {
        courtSessionId: COURT_SESSION_ID,
        initialState: INITIAL_COURT_SESSION_STATE,
        appliers: SCORE_APPLIERS,
      },
      [...player.events(), forged],
    );

    expect(replayed).toStrictEqual({
      ok: false,
      error: { code: "event-rejected", eventId: forged.eventId },
    });
    const bench = player.team("b").bench;
    player.points("b");
    expect(player.team("b")).toMatchObject({ bench, setterZone: 6 });
    expect(player.match().rotations.a).toBeNull();
  });
});

describe("the serve alignment after a substitution", () => {
  const combinations = FORMATION_SYSTEMS.flatMap((system) =>
    SETTER_ZONE_SEQUENCE.flatMap((setterZone) =>
      PHASES.flatMap((phase) =>
        ORANGE_LINEUP.map((outgoing) => ({ system, setterZone, phase, outgoing })),
      ),
    ),
  );

  test.each(combinations)(
    "$system zone $setterZone $phase, out $outgoing",
    ({ system, setterZone, phase, outgoing }) => {
      const before = getServeAlignment(
        { libero: null, lineup: ORANGE_LINEUP, setterZone, system },
        phase,
      );
      const lineup = ORANGE_LINEUP.map((id) => (id === outgoing ? G : id));

      const after = getServeAlignment({ libero: null, lineup, setterZone, system }, phase);

      expect(after.actingSetter).toBe(before.actingSetter === outgoing ? G : before.actingSetter);
      expect(after.formationKey).toBe(before.formationKey);
      ROTATION_SLOTS.forEach((slot) => {
        const { memberId, ...position } = before.slots[slot];
        expect(after.slots[slot]).toStrictEqual({
          ...position,
          memberId: memberId === outgoing ? G : memberId,
        });
      });
      expect(validateServeAlignment(after, { mode: "fivb-2025-28" }).ok).toBe(true);
    },
  );
});

describe("the frozen copy and the state", () => {
  test("the team stays the frozen copy after a change", () => {
    const player = createPlayer({ teamSize: 8 });
    const { teams } = player.match();

    player.run((state) => substitutePlayer(state, "a", A, G));

    expect(player.match().teams).toStrictEqual(teams);
    expect(isRosterPartition(player.team("a").lineup, player.team("a").bench, null, teams.a)).toBe(
      true,
    );
  });

  test("turning the set keeps the bench and the lineup", () => {
    const player = createPlayer({ teamSize: 8 });
    player.run((state) => substitutePlayer(state, "a", A, G));
    const before = player.team("a");
    player.points("a".repeat(MD3.pointsPerSet));

    player.run((state) => confirmSetEnd(state));

    expect(player.match().currentSet?.setNumber).toBe(2);
    expect(player.team("a")).toStrictEqual(before);
  });

  test("the finished match has the bench of its end", () => {
    const player = createPlayer({ teamSize: 8 });
    player.run((state) => substitutePlayer(state, "a", A, G));
    player.run((state) => endMatchManually(state, null));

    expect(player.state().finishedMatches[0]?.rotations.a?.bench).toStrictEqual([H, A]);
  });

  test("the replay gives the same state in any order of arrival", () => {
    const player = createPlayer({ teamSize: 8 });
    player.points("ab");
    player.run((state) => substitutePlayer(state, "a", D, H));
    player.points("ba");
    player.run((state) => substitutePlayer(state, "b", U, T));
    const events = player.events();

    expect(JSON.stringify(replayAll([...events].reverse()))).toBe(
      JSON.stringify(replayAll(events)),
    );
  });

  test("the applier and the commands work on a frozen state and do not mutate it", () => {
    const player = createPlayer({ teamSize: 8 });
    const state = deepFreeze(player.state());
    const snapshot = JSON.stringify(state);
    const drafted = substitutePlayer(state, "a", A, G);
    if (!drafted.ok) {
      throw new Error("refused");
    }
    const [draft] = drafted.value as readonly [ScoreEventDraft];
    const applier = SCORE_APPLIERS.get(LINEUP_CHANGED_EVENT_TYPE);

    const applied = applier?.(state, toEnvelope(draft, 2));

    expect(applied?.ok).toBe(true);
    expect(JSON.stringify(state)).toBe(snapshot);
  });

  test("the event holds its own lists, apart from the input", () => {
    const player = createPlayer({ teamSize: 7 });
    const lineup = [G, B, C, D, E, F];
    const bench = [A];

    const result = changeLineup(player.state(), "a", {
      bench,
      libero: null,
      lineup,
      setterZone: 1,
    });
    lineup.reverse();
    bench.pop();

    expect(result).toStrictEqual({
      ok: true,
      value: [
        lineupEvent("a", { bench: [A], libero: null, lineup: [G, B, C, D, E, F], setterZone: 1 }),
      ],
    });
  });
});

describe("the parser of the bench", () => {
  const withBench = (bench: unknown, teamSize = 8, memberIds?: readonly MemberId[]) => {
    const input = rotationMatchInput(MD3, { teamSize });
    return {
      ...input,
      teams: memberIds === undefined ? input.teams : { ...input.teams, a: { memberIds } },
      rotations: { ...input.rotations, a: { ...input.rotations.a, bench } },
    };
  };
  const members = (count: number) =>
    Array.from(
      { length: count },
      (_, index) => `a0000000-0000-4000-8000-${String(index + 1).padStart(12, "0")}`,
    );

  test("the limit of the bench is the team without the lineup", () => {
    expect(MAX_BENCH_MEMBERS).toBe(MAX_TEAM_MEMBERS - ROTATION_SLOTS.length);
    expect(MAX_BENCH_MEMBERS).toBe(18);
  });

  test("24 members have a bench of 18, and 19 is past the limit", () => {
    const roster = members(MAX_TEAM_MEMBERS);

    expect(
      parseMatchStartedPayload(withBench(roster.slice(ROTATION_SLOTS.length), 8, roster)).ok,
    ).toBe(true);
    const nineteen = [...roster.slice(ROTATION_SLOTS.length), OUTSIDER];
    expect(parseMatchStartedPayload(withBench(nineteen, 8, roster))).toStrictEqual({
      ok: false,
      error: { code: "invalid-payload", field: "rotations.a.bench" },
    });
  });

  test("holes in a sparse bench are rejected", () => {
    const bench = new Array<string>(2);
    bench[0] = G;

    expect(parseMatchStartedPayload(withBench(bench))).toStrictEqual({
      ok: false,
      error: { code: "invalid-payload", field: "rotations.a.bench" },
    });
  });

  test("the parsed bench is detached from the input", () => {
    const bench = [G, H];

    const parsed = parseMatchStartedPayload(withBench(bench));
    bench.reverse();

    expect(parsed.ok && parsed.value.rotations.a?.bench).toStrictEqual([G, H]);
  });

  test("the parsed change has its keys in UTF-16 order", () => {
    const parsed = parseLineupChangedPayload({
      team: "a",
      setterZone: 1,
      matchId: MATCH_ID,
      lineup: ORANGE_LINEUP,
      bench: [],
      libero: null,
    });

    expect(parsed.ok && Object.keys(parsed.value)).toStrictEqual([
      "bench",
      "libero",
      "lineup",
      "matchId",
      "setterZone",
      "team",
    ]);
  });

  test.each([
    ["the lineup", { lineup: [CANARY, B, C, D, E, F] }],
    ["the bench", { bench: [CANARY] }],
    ["the zone", { setterZone: CANARY }],
    ["the team", { team: CANARY }],
    ["the match", { matchId: CANARY }],
    ["a key", { [CANARY]: 1 }],
  ])("an error in %s does not echo it", (_, change) => {
    const parsed = parseLineupChangedPayload({
      matchId: MATCH_ID,
      team: "a",
      lineup: ORANGE_LINEUP,
      setterZone: 1,
      bench: [],
      ...change,
    });

    expect(parsed.ok).toBe(false);
    expect(JSON.stringify(parsed)).not.toContain(CANARY);
  });

  test("an error in the bench of the start does not echo it", () => {
    const parsed = parseMatchStartedPayload(withBench([CANARY, H]));

    expect(parsed.ok).toBe(false);
    expect(JSON.stringify(parsed)).not.toContain(CANARY);
  });
});
