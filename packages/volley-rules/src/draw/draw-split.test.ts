import { readFileSync } from "node:fs";

import { describe, expect, test } from "vitest";

import { err, ok } from "../result.js";
import { drawLayout, splitByArrival } from "./draw-split.js";
import type { DrawSplit } from "./types.js";

interface DrawSplitGoldenCase {
  readonly id: string;
  readonly playerCount: number;
  readonly playersPerTeam: number;
  readonly expected: DrawSplit<number> | { readonly error: "not-enough-players" };
}

// The same file the C# `DrawSplitGoldenTests` reads: "Montar times" splits as the server draws.
const GOLDEN_URL = new URL("../../golden/draw-split.json", import.meta.url);
const GOLDEN_CASES = JSON.parse(
  readFileSync(GOLDEN_URL, "utf8"),
) as readonly DrawSplitGoldenCase[];

/** Arrival positions 1..n, as the golden names the players. */
function arrivals(count: number): readonly number[] {
  return Array.from({ length: count }, (_, index) => index + 1);
}

describe("splitByArrival", () => {
  test("the golden file has cases", () => {
    expect(GOLDEN_CASES.length).toBeGreaterThan(0);
  });

  test.each(GOLDEN_CASES)("golden $id", ({ playerCount, playersPerTeam, expected }) => {
    const split = splitByArrival(arrivals(playerCount), playersPerTeam);
    expect(split).toEqual("error" in expected ? err({ code: expected.error }) : ok(expected));
  });

  test("keeps the players as given, in order", () => {
    expect(splitByArrival(["Ana", "João", "Pedro", "Lia", "Bia"], 2)).toEqual(
      ok({ teams: [["Ana", "João"], ["Pedro", "Lia"]], reserves: ["Bia"] }),
    );
  });

  test.each([0, -1, 2.5, Number.NaN])("a team size of %s fails closed", (size) => {
    expect(splitByArrival(arrivals(12), size)).toEqual(err({ code: "invalid-size" }));
  });
});

describe("drawLayout", () => {
  test("every player is in a team or in the queue", () => {
    for (let players = 4; players <= 40; players += 1) {
      for (const perTeam of [2, 4, 6]) {
        const layout = drawLayout(players, perTeam);
        expect(layout.ok).toBe(true);
        if (layout.ok) {
          const { teamCount, teamSize, reserveCount } = layout.value;
          expect(teamCount * teamSize + reserveCount).toBe(players);
          expect(reserveCount).toBeLessThan(Math.max(teamSize, 2));
        }
      }
    }
  });

  test("an empty round is not enough", () => {
    expect(drawLayout(0, 6)).toEqual(err({ code: "not-enough-players" }));
  });
});
