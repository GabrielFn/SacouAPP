import { readFileSync } from "node:fs";

import { describe, expect, test } from "vitest";

import { err, ok } from "../result.js";
import { drawBalance, teamAverageTenths } from "./draw-balance.js";
import type { DrawBalance } from "./types.js";

interface DrawBalanceGoldenCase {
  readonly id: string;
  readonly teamsLevelsTenths: readonly (readonly number[])[];
  readonly expected: DrawBalance;
}

// The same file the C# `DrawBalanceGoldenTests` reads: the app and the server show the same meter.
const GOLDEN_URL = new URL("../../golden/draw-balance.json", import.meta.url);
const GOLDEN_CASES = JSON.parse(
  readFileSync(GOLDEN_URL, "utf8"),
) as readonly DrawBalanceGoldenCase[];

describe("drawBalance", () => {
  test("the golden file has cases", () => {
    expect(GOLDEN_CASES.length).toBeGreaterThan(0);
  });

  test.each(GOLDEN_CASES)("golden $id", ({ teamsLevelsTenths, expected }) => {
    expect(drawBalance(teamsLevelsTenths)).toEqual(ok(expected));
  });

  test("a draw with no team fails closed", () => {
    expect(drawBalance([])).toEqual(err({ code: "no-teams" }));
  });

  test("a team with nobody fails closed", () => {
    expect(drawBalance([[30, 30], []])).toEqual(err({ code: "empty-team" }));
  });
});

describe("teamAverageTenths", () => {
  test.each([
    ["the floor of the scale", [10, 10, 10], 10],
    ["the top of the scale", [50, 50], 50],
    ["a pair with an odd sum rounds half up (37,5 is 38)", [35, 40], 38],
    ["just under a half rounds down (36,4 is 36)", [36, 37, 36, 36, 37], 36],
    ["a single player is their level", [45], 45],
  ])("%s", (_name, levels, expected) => {
    expect(teamAverageTenths(levels)).toEqual(ok(expected));
  });

  test("never returns a fraction", () => {
    const average = teamAverageTenths([40, 40, 35, 35, 40, 30]);
    expect(average.ok && Number.isInteger(average.value)).toBe(true);
  });
});
