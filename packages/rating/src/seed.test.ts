import { describe, expect, test } from "vitest";

import { RATING_PARAMS } from "./params.js";
import { isValidLevelTenths, levelOf, muOfLevel, seedOf } from "./seed.js";

describe("seedOf", () => {
  test("level 3.0 is μ 1500; each level is 200 (ADR 0018 and 0071)", () => {
    expect(muOfLevel(RATING_PARAMS, 30)).toBe(1500);
    expect(muOfLevel(RATING_PARAMS, 40)).toBe(1700);
    expect(muOfLevel(RATING_PARAMS, 10)).toBe(1100);
    expect(muOfLevel(RATING_PARAMS, 35)).toBe(1600);
  });

  test("the admin grade starts with a low σ; a suggestion or the default with a high one", () => {
    expect(seedOf(RATING_PARAMS, { levelTenths: 40, source: "admin" })).toEqual({
      mu: 1700,
      sigma: 100,
    });
    expect(seedOf(RATING_PARAMS, { levelTenths: 40, source: "suggested" })).toEqual({
      mu: 1700,
      sigma: 200,
    });
    expect(seedOf(RATING_PARAMS, { levelTenths: 30, source: "default" })).toEqual({
      mu: 1500,
      sigma: 200,
    });
  });
});

describe("levelOf", () => {
  const halfLevels = [10, 15, 20, 25, 30, 35, 40, 45, 50];

  test.each(halfLevels)("goes back to the exact level %i from its seed", (levelTenths) => {
    const { mu } = seedOf(RATING_PARAMS, { levelTenths, source: "admin" });
    expect(levelOf(RATING_PARAMS, mu)).toBe(levelTenths);
  });

  test("is limited to 1.0 and 5.0", () => {
    expect(levelOf(RATING_PARAMS, -5000)).toBe(10);
    expect(levelOf(RATING_PARAMS, 1099)).toBe(10);
    expect(levelOf(RATING_PARAMS, 1901)).toBe(50);
    expect(levelOf(RATING_PARAMS, 9000)).toBe(50);
  });

  test("rounds half up, to the nearest tenth", () => {
    expect(levelOf(RATING_PARAMS, 1509.99)).toBe(30);
    expect(levelOf(RATING_PARAMS, 1510)).toBe(31);
    expect(levelOf(RATING_PARAMS, 1490)).toBe(30);
    expect(levelOf(RATING_PARAMS, 1489.99)).toBe(29);
  });
});

describe("isValidLevelTenths", () => {
  test("accepts whole tenths from 10 to 50 only", () => {
    expect([10, 30, 50].every(isValidLevelTenths)).toBe(true);
    expect([9, 51, 30.5, Number.NaN].some(isValidLevelTenths)).toBe(false);
  });
});
