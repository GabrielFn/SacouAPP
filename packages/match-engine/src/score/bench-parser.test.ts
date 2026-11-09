import { ROTATION_SLOTS } from "@sacou/volley-rules";
import { describe, expect, test } from "vitest";

import { MAX_BENCH_MEMBERS, MAX_TEAM_MEMBERS } from "./constants.data.js";
import { MATCH_ID, ORANGE_LINEUP, rotationMatchInput } from "./match-player.test.fixture.js";
import { parseLineupChangedPayload, parseMatchStartedPayload } from "./parse-payloads.js";
import type { MemberId, ScoringRules } from "./types.js";

const MD3: ScoringRules = { bestOf: 3, pointsPerSet: 25, tieBreakPoints: 15, winMargin: 2 };
const CANARY = "CANARY-do-not-echo";

const [, B, C, D, E, F] = ORANGE_LINEUP as readonly [
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
