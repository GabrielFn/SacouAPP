import { describe, expect, test } from "vitest";

import rawParams from "./rating-params.json" with { type: "json" };
import { parseRatingParams, RATING_PARAMS } from "./params.js";

describe("rating-params.json", () => {
  test("holds version 1 of the plan, every value explicit (ADR 0071)", () => {
    expect(RATING_PARAMS).toEqual({
      ratingParamsVersion: 1,
      mu0: 1500,
      levelStep: 200,
      sigmaAdmin: 100,
      sigmaUnconfirmed: 200,
      beta: 100,
      tau: 1,
      kappa: 0.0001,
      limitSigma: false,
    });
    expect(Object.isFrozen(RATING_PARAMS)).toBe(true);
  });

  test.each([
    ["mu0", -1],
    ["beta", "100"],
    ["kappa", 0],
    ["tau", Number.POSITIVE_INFINITY],
    ["ratingParamsVersion", 1.5],
    ["limitSigma", "false"],
  ])("rejects %s = %s", (key, value) => {
    expect(() => parseRatingParams({ ...rawParams, [key]: value })).toThrow(key);
  });

  test("rejects a file that is not an object", () => {
    expect(() => parseRatingParams([])).toThrow("$");
  });
});
