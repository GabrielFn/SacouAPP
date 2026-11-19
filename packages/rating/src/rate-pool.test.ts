import type { FinishedMatchResult, SettingsModality } from "@sacou/match-engine";
import { describe, expect, expectTypeOf, test } from "vitest";

import { RATING_PARAMS } from "./params.js";
import { orderRounds, poolOf, ratePool } from "./rate-pool.js";
import type { MemberSeed, Modality, RatedMatch, RatedRound } from "./types.js";

const A = "b1000000-0000-4000-8000-000000000001";
const B = "b1000000-0000-4000-8000-000000000002";

const MATCH: RatedMatch = {
  matchId: "f1000000-0000-4000-8000-000000000001",
  winner: "a",
  teams: { a: [A], b: [B] },
  onCourt: { a: [A], b: [B] },
};

function round(roundId: string, startsAt: string, canceled = false): RatedRound {
  return { roundId, startsAt, canceled, modality: "indoor-6x6", matches: [MATCH] };
}

const SEEDS: readonly MemberSeed[] = [
  { memberId: A, levelTenths: 30, source: "admin" },
  { memberId: B, levelTenths: 30, source: "admin" },
];

function deepFreeze<T>(value: T): T {
  if (typeof value === "object" && value !== null) {
    Object.values(value).forEach(deepFreeze);
    Object.freeze(value);
  }
  return value;
}

describe("ratePool", () => {
  test("takes the result of the match engine as it is", () => {
    expectTypeOf<FinishedMatchResult>().toExtend<RatedMatch>();
    expectTypeOf<SettingsModality>().toEqualTypeOf<Modality>();
  });

  test("changes neither the input nor the parameters", () => {
    const rounds = deepFreeze([round("c1", "2026-11-01T22:00:00Z")]);
    const result = ratePool(RATING_PARAMS, deepFreeze([...SEEDS]), rounds);
    expect(result.ok).toBe(true);
    expect(RATING_PARAMS.mu0).toBe(1500);
  });

  test("rebuilt twice from the same input, gives the same result", () => {
    const rounds = [round("c1", "2026-11-01T22:00:00Z"), round("c2", "2026-11-02T22:00:00Z")];
    expect(ratePool(RATING_PARAMS, SEEDS, rounds)).toEqual(ratePool(RATING_PARAMS, SEEDS, rounds));
  });

  test("a group without rounds has no ratings", () => {
    expect(ratePool(RATING_PARAMS, SEEDS, [])).toEqual({ ok: true, value: [] });
  });

  test("rejects a level outside 1.0 to 5.0 or not in whole tenths", () => {
    const rounds = [round("c1", "2026-11-01T22:00:00Z")];
    [9, 51, 30.5].forEach((levelTenths) => {
      expect(
        ratePool(RATING_PARAMS, [{ memberId: A, levelTenths, source: "admin" }], rounds),
      ).toEqual({ ok: false, error: { code: "invalid-level", memberId: A } });
    });
  });

  test("rejects two seeds for the same member", () => {
    const seeds = [...SEEDS, { memberId: A, levelTenths: 40, source: "suggested" } as const];
    expect(ratePool(RATING_PARAMS, seeds, [])).toEqual({
      ok: false,
      error: { code: "duplicate-seed", memberId: A },
    });
  });

  test.each(["2026-11-01T22:00Z", "2026-11-01T22:00:00.000Z", "2026-11-01T19:00:00-03:00", ""])(
    "rejects startsAt %j, whose text order would not be the time order",
    (startsAt) => {
      expect(ratePool(RATING_PARAMS, SEEDS, [round("c1", startsAt, true)])).toEqual({
        ok: false,
        error: { code: "invalid-starts-at", roundId: "c1" },
      });
    },
  );
});

describe("orderRounds", () => {
  test("drops canceled rounds and orders by startsAt, then roundId in ordinal order", () => {
    const rounds = [
      round("c3", "2026-11-03T22:00:00Z"),
      round("c2", "2026-11-01T22:00:00Z", true),
      round("cB", "2026-11-01T22:00:00Z"),
      round("ca", "2026-11-01T22:00:00Z"),
    ];
    expect(orderRounds(rounds).map(({ roundId }) => roundId)).toEqual(["cB", "ca", "c3"]);
  });
});

describe("poolOf", () => {
  test("indoor alone; the two beach modalities share a pool", () => {
    expect(poolOf("indoor-6x6")).toBe("indoor");
    expect(poolOf("beach-2x2")).toBe("beach");
    expect(poolOf("beach-4x4")).toBe("beach");
  });
});
