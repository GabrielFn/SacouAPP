import { readFileSync } from "node:fs";

import { describe, expect, test } from "vitest";

import { rateTwoTeams, type TwoRanks, type TwoTeams } from "./openskill-model.js";
import { RATING_PARAMS } from "./params.js";
import type { RatingParams, Skill } from "./types.js";

interface OpenSkillCase {
  readonly id: string;
  readonly options: Pick<RatingParams, "beta" | "tau" | "kappa" | "limitSigma">;
  readonly teams: TwoTeams<Skill>;
  readonly ranks: readonly TwoRanks[];
  readonly expected: readonly TwoTeams<Skill>[];
}

function readJson(path: string): unknown {
  return JSON.parse(readFileSync(new URL(path, import.meta.url), "utf8"));
}

const CASES = readJson("../golden/openskill-plackett-luce.json") as readonly OpenSkillCase[];

/** Literal, never read from the file: a case that disappears must fail. */
const EXPECTED_IDS: readonly string[] = [
  "o1-one-against-one",
  "o2-two-against-two",
  "o3-six-against-six",
  "o4-six-against-five",
  "o5-upset-the-weak-team-wins",
  "o6-sigma-held-by-the-kappa-floor",
  "o7-twenty-matches-of-the-same-players",
  "o8-large-and-small-mu",
  "o9-limit-sigma-on",
];

function replay(testCase: OpenSkillCase): readonly TwoTeams<Skill>[] {
  const params = { ...RATING_PARAMS, ...testCase.options };
  return testCase.ranks.reduce<readonly TwoTeams<Skill>[]>(
    (games, rank) => [...games, rateTwoTeams(params, games.at(-1) ?? testCase.teams, rank)],
    [],
  );
}

describe("golden openskill-plackett-luce.json", () => {
  test("has every case, in order", () => {
    expect(CASES.map(({ id }) => id)).toEqual(EXPECTED_IDS);
  });

  test.each(CASES.map((testCase) => [testCase.id, testCase] as const))(
    "%s: the library gives the same numbers again",
    (_id, testCase) => {
      expect(replay(testCase)).toEqual(testCase.expected);
    },
  );

  test("the kappa floor holds every σ at √κ of its value after τ", () => {
    const floor = CASES.find(({ id }) => id === "o6-sigma-held-by-the-kappa-floor");
    const kappa = floor?.options.kappa ?? 0;
    const tau = floor?.options.tau ?? 0;
    const before = floor?.teams.flat() ?? [];
    const after = floor?.expected[0]?.flat() ?? [];
    expect(after).toHaveLength(before.length);
    after.forEach(({ sigma }, index) => {
      const widened = Math.sqrt((before[index]?.sigma ?? 0) ** 2 + tau ** 2);
      expect(sigma).toBeCloseTo(widened * Math.sqrt(kappa), 9);
    });
  });

  test("openskill is pinned to the version of the golden, without a range", () => {
    const manifest = readJson("../package.json") as {
      readonly dependencies: Readonly<Record<string, string>>;
    };
    expect(manifest.dependencies.openskill).toBe("5.0.1");
  });
});
