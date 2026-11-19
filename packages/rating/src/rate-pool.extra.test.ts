import { describe, expect, test } from "vitest";

import { RATING_PARAMS } from "./params.js";
import { ratePool } from "./rate-pool.js";
import { levelOf, muOfLevel } from "./seed.js";
import type { MemberSeed, RatedMatch, RatedRound } from "./types.js";

const A = "b1000000-0000-4000-8000-000000000001";
const B = "b1000000-0000-4000-8000-000000000002";
const C = "b1000000-0000-4000-8000-000000000003";

function match(matchId: string, winner: "a" | "b" | null, a = [A], b = [B]): RatedMatch {
  return { matchId, winner, teams: { a, b }, onCourt: { a, b } };
}

function round(roundId: string, startsAt: string, matches: readonly RatedMatch[]): RatedRound {
  return { roundId, startsAt, canceled: false, modality: "indoor-6x6", matches };
}

const SEEDS: readonly MemberSeed[] = [
  { memberId: A, levelTenths: 30, source: "admin" },
  { memberId: B, levelTenths: 30, source: "admin" },
];

function rated(seeds: readonly MemberSeed[], rounds: readonly RatedRound[]) {
  const result = ratePool(RATING_PARAMS, seeds, rounds);
  if (!result.ok) {
    throw new Error(result.error.code);
  }
  return result.value;
}

function muOf(list: ReturnType<typeof rated>, id: string): number {
  const found = list.find((r) => r.memberId === id);
  if (found === undefined) {
    throw new Error("missing");
  }
  return found.mu;
}

describe("ratePool, extra", () => {
  const r1 = round("r1", "2026-11-01T22:00:00Z", [match("m1", "a")]);
  const r2 = round("r2", "2026-11-02T22:00:00Z", [match("m2", "a"), match("m3", "b")]);
  const r3 = round("r3", "2026-11-03T22:00:00Z", [match("m4", "b")]);

  test("shuffled round input gives the same result", () => {
    const sorted = rated(SEEDS, [r1, r2, r3]);
    expect(rated(SEEDS, [r3, r1, r2])).toEqual(sorted);
    expect(rated(SEEDS, [r2, r3, r1])).toEqual(sorted);
  });

  test("shuffled seed input gives the same ratings", () => {
    const rounds = [r1, r2];
    const forward = rated(SEEDS, rounds);
    const backward = rated([...SEEDS].reverse(), rounds);
    expect(backward).toEqual(forward);
  });

  test("same startsAt: roundId breaks the tie, whatever the input order", () => {
    const x = round("a-round", "2026-11-01T22:00:00Z", [match("m1", "a")]);
    const y = round("b-round", "2026-11-01T22:00:00Z", [match("m2", "b"), match("m3", "b")]);
    expect(rated(SEEDS, [y, x])).toEqual(rated(SEEDS, [x, y]));
  });

  test("order matters: a different play order gives a different rating", () => {
    const early = round("r1", "2026-11-01T22:00:00Z", [match("m1", "a"), match("m2", "a")]);
    const late = round("r2", "2026-11-02T22:00:00Z", [match("m3", "b")]);
    const swapped = [
      { ...early, startsAt: "2026-11-03T22:00:00Z" },
      { ...late, startsAt: "2026-11-01T22:00:00Z" },
    ];
    expect(muOf(rated(SEEDS, [early, late]), A)).not.toBe(muOf(rated(SEEDS, swapped), A));
  });

  test("a new admin grade rebuilds everything from zero (question 98)", () => {
    const rounds = [r1, r2];
    const before = rated(SEEDS, rounds);
    const changed = rated(
      [{ memberId: A, levelTenths: 45, source: "admin" }, SEEDS[1] as MemberSeed],
      rounds,
    );
    const fresh = rated(
      [{ memberId: A, levelTenths: 45, source: "admin" }, SEEDS[1] as MemberSeed],
      rounds,
    );
    expect(changed).toEqual(fresh);
    expect(changed.find((x) => x.memberId === A)?.seedTenths).toBe(45);
    expect(before.find((x) => x.memberId === A)?.seedTenths).toBe(30);
    expect(muOf(changed, A)).toBeGreaterThan(muOf(before, A));
  });

  test("keeps the seed used, and the source, on each rating", () => {
    const list = rated([{ memberId: A, levelTenths: 20, source: "suggested" }], [r1]);
    const mine = list.find((x) => x.memberId === A);
    expect(mine?.seedTenths).toBe(20);
    expect(mine?.seedSource).toBe("suggested");
    const other = list.find((x) => x.memberId === B);
    expect(other?.seedTenths).toBe(30);
    expect(other?.seedSource).toBe("default");
  });

  test("a draw or an open match changes nothing and does not count", () => {
    const list = rated(SEEDS, [round("r1", "2026-11-01T22:00:00Z", [match("m1", null)])]);
    list.forEach((x) => {
      expect(x.matchesRated).toBe(0);
      expect(x.mu).toBe(muOfLevel(RATING_PARAMS, 30));
    });
  });

  test("the winner gains and the loser loses, symmetric for equal seeds", () => {
    const base = muOfLevel(RATING_PARAMS, 30);
    const aWins = rated(SEEDS, [r1]);
    expect(muOf(aWins, A)).toBeGreaterThan(base);
    expect(muOf(aWins, B)).toBeLessThan(base);
    expect(muOf(aWins, A) - base).toBeCloseTo(base - muOf(aWins, B), 9);
    const bWins = rated(SEEDS, [round("r1", "2026-11-01T22:00:00Z", [match("m1", "b")])]);
    expect(muOf(bWins, B)).toBeCloseTo(muOf(aWins, A), 9);
  });

  test("a winner of low seed gains more than a winner of high seed", () => {
    const seeds: readonly MemberSeed[] = [
      { memberId: A, levelTenths: 20, source: "admin" },
      { memberId: B, levelTenths: 40, source: "admin" },
    ];
    const underdog = rated(seeds, [r1]);
    const favorite = rated(seeds, [round("r1", "2026-11-01T22:00:00Z", [match("m1", "b")])]);
    expect(muOf(underdog, A) - muOfLevel(RATING_PARAMS, 20)).toBeGreaterThan(
      muOf(favorite, B) - muOfLevel(RATING_PARAMS, 40),
    );
  });

  test("rejects NaN, infinity and a malformed startsAt", () => {
    [Number.NaN, Number.POSITIVE_INFINITY, 0, -30].forEach((levelTenths) => {
      const r = ratePool(RATING_PARAMS, [{ memberId: A, levelTenths, source: "admin" }], [r1]);
      expect(r.ok).toBe(false);
    });
    ["2026-11-01", "2026-11-01T22:00:00+00:00", "2026-11-01 22:00:00Z", ""].forEach((startsAt) => {
      const r = ratePool(RATING_PARAMS, SEEDS, [round("x", startsAt, [])]);
      expect(r).toEqual({ ok: false, error: { code: "invalid-starts-at", roundId: "x" } });
    });
  });

  test("the bench does not move; the member on court does", () => {
    const m: RatedMatch = {
      matchId: "m1",
      winner: "a",
      teams: { a: [A, C], b: [B] },
      onCourt: { a: [A], b: [B] },
    };
    const list = rated(SEEDS, [round("r1", "2026-11-01T22:00:00Z", [m])]);
    expect(muOf(list, C)).toBe(muOfLevel(RATING_PARAMS, 30));
    expect(list.find((x) => x.memberId === C)?.matchesRated).toBe(0);
  });

  test("tau widens sigma: sigma after one match exceeds the no-tau value", () => {
    const withTau = rated(SEEDS, [r1])[0]?.sigma ?? 0;
    const noTau = ratePool({ ...RATING_PARAMS, tau: 0 }, SEEDS, [r1]);
    expect(noTau.ok).toBe(true);
    expect(withTau).toBeGreaterThan(noTau.ok ? (noTau.value[0]?.sigma ?? Infinity) : Infinity);
  });
});

describe("levelOf, extra", () => {
  const mu = (tenths: number) => RATING_PARAMS.mu0 + ((tenths - 30) * RATING_PARAMS.levelStep) / 10;
  const tenth = RATING_PARAMS.levelStep / 10;

  test("rounds exactly half up, and just under half down", () => {
    expect(levelOf(RATING_PARAMS, mu(30) + tenth / 2)).toBe(31);
    expect(levelOf(RATING_PARAMS, mu(30) - tenth / 2)).toBe(30);
    expect(levelOf(RATING_PARAMS, mu(30) + tenth / 2 - 0.001)).toBe(30);
    expect(levelOf(RATING_PARAMS, mu(30) - tenth / 2 - 0.001)).toBe(29);
  });

  test("round trips every tenth and clamps far values", () => {
    for (let t = 10; t <= 50; t += 1) {
      expect(levelOf(RATING_PARAMS, mu(t))).toBe(t);
    }
    expect(levelOf(RATING_PARAMS, -1e9)).toBe(10);
    expect(levelOf(RATING_PARAMS, 1e9)).toBe(50);
  });
});
