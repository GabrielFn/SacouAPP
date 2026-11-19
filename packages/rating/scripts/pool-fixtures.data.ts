/**
 * Shared inputs of `golden/rating-pools.json` (E3.9 part 2, plan 5.2), written by hand. Each case also
 * says by hand, in `steps`, which matches rate and in which order, and, in `members`, who comes out
 * of each pool: `generate-golden.ts` turns that into numbers with `openskill` alone, so the
 * expected values never come from `ratePool`.
 */
import type { MemberSeed, RatedRound, RatingPool, TeamSide } from "../src/types.ts";

export interface PoolStep {
  readonly pool: RatingPool;
  readonly a: readonly string[];
  readonly b: readonly string[];
  readonly winner: TeamSide;
}

export interface PoolCaseInput {
  readonly id: string;
  readonly seeds: readonly MemberSeed[];
  readonly rounds: readonly RatedRound[];
  readonly steps: readonly PoolStep[];
  readonly members: readonly { readonly pool: RatingPool; readonly memberIds: readonly string[] }[];
}

export const M1 = "b1000000-0000-4000-8000-000000000001";
export const M2 = "b1000000-0000-4000-8000-000000000002";
export const M3 = "b1000000-0000-4000-8000-000000000003";
export const M4 = "b1000000-0000-4000-8000-000000000004";
export const M5 = "b1000000-0000-4000-8000-000000000005";
export const M6 = "b1000000-0000-4000-8000-000000000006";
export const M7 = "b1000000-0000-4000-8000-000000000007";
export const M8 = "b1000000-0000-4000-8000-000000000008";
export const M9 = "b1000000-0000-4000-8000-000000000009";
export const M10 = "b1000000-0000-4000-8000-000000000010";
export const M11 = "b1000000-0000-4000-8000-000000000011";
export const M12 = "b1000000-0000-4000-8000-000000000012";
export const M13 = "b1000000-0000-4000-8000-000000000013";
export const M14 = "b1000000-0000-4000-8000-000000000014";

export const R1 = "c1000000-0000-4000-8000-000000000001";
export const R2 = "c1000000-0000-4000-8000-000000000002";
export const R3 = "c1000000-0000-4000-8000-000000000003";

export const F1 = "f1000000-0000-4000-8000-000000000001";
export const F2 = "f1000000-0000-4000-8000-000000000002";
export const F3 = "f1000000-0000-4000-8000-000000000003";
export const F4 = "f1000000-0000-4000-8000-000000000004";

export const NOV_1 = "2026-11-01T22:00:00Z";
export const NOV_2 = "2026-11-02T22:00:00Z";
export const NOV_3 = "2026-11-03T22:00:00Z";
export const NOV_8 = "2026-11-08T22:00:00Z";

export const PAIR_12 = [M1, M2] as const;
export const PAIR_34 = [M3, M4] as const;
export const NOBODY = [] as const;

export const ALL_ADMIN_3: readonly MemberSeed[] = [
  { memberId: M1, levelTenths: 30, source: "admin" },
  { memberId: M2, levelTenths: 30, source: "admin" },
  { memberId: M3, levelTenths: 30, source: "admin" },
  { memberId: M4, levelTenths: 30, source: "admin" },
];

export const ONE_TO_FOUR = [{ pool: "indoor", memberIds: [M1, M2, M3, M4] }] as const;
