import { readFileSync } from "node:fs";

import { describe, expect, test } from "vitest";

import { err, ok } from "../result.js";
import { playerCardLevelFromRating } from "./player-card-level.js";
import type { PlayerCardLevel } from "./types.js";

interface PlayerCardLevelGoldenCase {
  readonly id: string;
  readonly rating: number;
  readonly expected: PlayerCardLevel;
}

const GOLDEN_URL = new URL("../../golden/player-card-level.json", import.meta.url);
const GOLDEN_CASES = JSON.parse(
  readFileSync(GOLDEN_URL, "utf8"),
) as readonly PlayerCardLevelGoldenCase[];

describe("playerCardLevelFromRating", () => {
  test.each(GOLDEN_CASES)("golden $id", ({ rating, expected }) => {
    expect(playerCardLevelFromRating(rating)).toEqual(ok(expected));
  });

  test.each([Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY])(
    "fails closed on the non-finite rating %s",
    (rating) => {
      expect(playerCardLevelFromRating(rating)).toEqual(err({ code: "invalid-rating" }));
    },
  );
});
