import { readFileSync } from "node:fs";

import { describe, expect, test } from "vitest";

import { RATING_PARAMS } from "./params.js";
import { ratePool } from "./rate-pool.js";
import type { MemberRating, MemberSeed, RatedRound } from "./types.js";

interface RatingPoolCase {
  readonly id: string;
  readonly seeds: readonly MemberSeed[];
  readonly rounds: readonly RatedRound[];
  readonly expected: readonly MemberRating[];
}

const CASES = JSON.parse(
  readFileSync(new URL("../golden/rating-pools.json", import.meta.url), "utf8"),
) as readonly RatingPoolCase[];

/** Literal, never read from the file: a case that disappears must fail. */
const EXPECTED_IDS: readonly string[] = [
  "p1-the-admin-seed-moves-less-than-an-unconfirmed-one",
  "p2-no-winner-rates-nobody",
  "p3-the-bench-that-never-came-in-is-not-rated",
  "p4-indoor-and-beach-are-rated-apart",
  "p5-beach-2x2-and-beach-4x4-share-a-pool",
  "p6-play-order-not-arrival-order",
  "p7-a-canceled-round-is-out",
  "p8-a-member-without-a-rated-match-keeps-the-seed",
  "p9-a-member-without-a-seed-starts-at-the-default",
  "p10-two-days-of-six-against-six-with-a-bench",
];

const KEY_ORDER = ["memberId", "pool", "seedTenths", "seedSource", "mu", "sigma", "matchesRated"];

function rated(seeds: readonly MemberSeed[], rounds: readonly RatedRound[]) {
  const result = ratePool(RATING_PARAMS, seeds, rounds);
  if (!result.ok) {
    throw new Error(`rating failed: ${result.error.code}`);
  }
  return result.value;
}

function byId(id: string): RatingPoolCase {
  const found = CASES.find((candidate) => candidate.id === id);
  if (found === undefined) {
    throw new Error(`missing case ${id}`);
  }
  return found;
}

function ratingOf(id: string, memberId: string): MemberRating | undefined {
  return byId(id).expected.find((rating) => rating.memberId === memberId);
}

describe("golden rating-pools.json", () => {
  test("has every case, in order", () => {
    expect(CASES.map(({ id }) => id)).toEqual(EXPECTED_IDS);
  });

  test("was written with rating parameters version 1", () => {
    expect(RATING_PARAMS.ratingParamsVersion).toBe(1);
  });

  test.each(CASES.map((testCase) => [testCase.id, testCase] as const))(
    "%s: ratePool gives the expected ratings, in order, with the key order of the contract",
    (_id, testCase) => {
      const ratings = rated(testCase.seeds, testCase.rounds);
      expect(ratings).toEqual(testCase.expected);
      ratings.forEach((rating) => {
        expect(Object.keys(rating)).toEqual(KEY_ORDER);
      });
    },
  );

  test.each(CASES.map((testCase) => [testCase.id, testCase] as const))(
    "%s: the arrival order of the rounds changes nothing",
    (_id, testCase) => {
      expect(rated(testCase.seeds, [...testCase.rounds].reverse())).toEqual(testCase.expected);
    },
  );

  test("an unconfirmed seed moves more than an admin one, in the same match", () => {
    const id = "p1-the-admin-seed-moves-less-than-an-unconfirmed-one";
    const admin = ratingOf(id, "b1000000-0000-4000-8000-000000000001");
    const suggested = ratingOf(id, "b1000000-0000-4000-8000-000000000002");
    const gainOf = (rating: MemberRating | undefined) => (rating?.mu ?? 0) - RATING_PARAMS.mu0;
    expect(gainOf(suggested)).toBeGreaterThan(gainOf(admin));
    expect(gainOf(admin)).toBeGreaterThan(0);
  });

  test("the bench, the canceled round and the match nobody played leave the seed", () => {
    const bench = ratingOf(
      "p3-the-bench-that-never-came-in-is-not-rated",
      "b1000000-0000-4000-8000-000000000005",
    );
    expect(bench).toMatchObject({ mu: 1700, sigma: 200, matchesRated: 0 });
    const emptyCourt = ratingOf(
      "p8-a-member-without-a-rated-match-keeps-the-seed",
      "b1000000-0000-4000-8000-000000000005",
    );
    expect(emptyCourt).toMatchObject({ mu: 1800, sigma: 100, matchesRated: 0 });
    const canceledOnly = ratingOf(
      "p7-a-canceled-round-is-out",
      "b1000000-0000-4000-8000-000000000005",
    );
    expect(canceledOnly).toBeUndefined();
  });

  test("the same member has an indoor and a beach rating", () => {
    const pools = byId("p4-indoor-and-beach-are-rated-apart")
      .expected.filter(({ memberId }) => memberId === "b1000000-0000-4000-8000-000000000001")
      .map(({ pool, matchesRated }) => [pool, matchesRated]);
    expect(pools).toEqual([
      ["indoor", 1],
      ["beach", 1],
    ]);
  });
});
