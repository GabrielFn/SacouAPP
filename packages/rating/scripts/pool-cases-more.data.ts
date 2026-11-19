/** Pool cases p7 to p10 of `golden/rating-pools.json`. */
import {
  ALL_ADMIN_3,
  F1,
  F2,
  F3,
  F4,
  M1,
  M10,
  M11,
  M12,
  M13,
  M14,
  M2,
  M3,
  M4,
  M5,
  M6,
  M7,
  M8,
  M9,
  NOBODY,
  NOV_1,
  NOV_2,
  NOV_8,
  ONE_TO_FOUR,
  PAIR_12,
  PAIR_34,
  R1,
  R2,
  type PoolCaseInput,
} from "./pool-fixtures.data.ts";

export const POOL_CASES_MORE: readonly PoolCaseInput[] = [
  {
    id: "p7-a-canceled-round-is-out",
    seeds: ALL_ADMIN_3,
    rounds: [
      {
        roundId: R1,
        startsAt: NOV_1,
        canceled: false,
        modality: "indoor-6x6",
        matches: [
          {
            matchId: F1,
            winner: "a",
            teams: { a: PAIR_12, b: PAIR_34 },
            onCourt: { a: PAIR_12, b: PAIR_34 },
          },
        ],
      },
      {
        roundId: R2,
        startsAt: NOV_2,
        canceled: true,
        modality: "indoor-6x6",
        matches: [
          {
            matchId: F2,
            winner: "b",
            teams: { a: [M1, M5], b: [M3, M6] },
            onCourt: { a: [M1, M5], b: [M3, M6] },
          },
        ],
      },
    ],
    steps: [{ pool: "indoor", a: PAIR_12, b: PAIR_34, winner: "a" }],
    members: ONE_TO_FOUR,
  },
  {
    id: "p8-a-member-without-a-rated-match-keeps-the-seed",
    seeds: [
      ...ALL_ADMIN_3,
      { memberId: M5, levelTenths: 45, source: "admin" },
      { memberId: M6, levelTenths: 20, source: "suggested" },
    ],
    rounds: [
      {
        roundId: R1,
        startsAt: NOV_1,
        canceled: false,
        modality: "indoor-6x6",
        matches: [
          {
            matchId: F1,
            winner: null,
            teams: { a: PAIR_12, b: PAIR_34 },
            onCourt: { a: PAIR_12, b: PAIR_34 },
          },
          {
            matchId: F2,
            winner: "a",
            teams: { a: [M5, M6], b: [M7, M8] },
            onCourt: { a: NOBODY, b: NOBODY },
          },
          {
            matchId: F3,
            winner: "a",
            teams: { a: PAIR_12, b: PAIR_34 },
            onCourt: { a: PAIR_12, b: PAIR_34 },
          },
        ],
      },
    ],
    steps: [{ pool: "indoor", a: PAIR_12, b: PAIR_34, winner: "a" }],
    members: [{ pool: "indoor", memberIds: [M1, M2, M3, M4, M5, M6, M7, M8] }],
  },
  {
    id: "p9-a-member-without-a-seed-starts-at-the-default",
    seeds: [
      { memberId: M1, levelTenths: 50, source: "admin" },
      { memberId: M2, levelTenths: 10, source: "suggested" },
    ],
    rounds: [
      {
        roundId: R1,
        startsAt: NOV_1,
        canceled: false,
        modality: "indoor-6x6",
        matches: [
          {
            matchId: F1,
            winner: "b",
            teams: { a: PAIR_12, b: PAIR_34 },
            onCourt: { a: PAIR_12, b: PAIR_34 },
          },
        ],
      },
    ],
    steps: [{ pool: "indoor", a: PAIR_12, b: PAIR_34, winner: "b" }],
    members: ONE_TO_FOUR,
  },
  {
    id: "p10-two-days-of-six-against-six-with-a-bench",
    seeds: [
      { memberId: M1, levelTenths: 40, source: "admin" },
      { memberId: M2, levelTenths: 35, source: "admin" },
      { memberId: M3, levelTenths: 30, source: "suggested" },
      { memberId: M4, levelTenths: 25, source: "admin" },
      { memberId: M5, levelTenths: 30, source: "default" },
      { memberId: M6, levelTenths: 45, source: "suggested" },
      { memberId: M7, levelTenths: 20, source: "admin" },
      { memberId: M8, levelTenths: 35, source: "admin" },
      { memberId: M9, levelTenths: 30, source: "admin" },
      { memberId: M10, levelTenths: 15, source: "suggested" },
      { memberId: M11, levelTenths: 30, source: "default" },
      { memberId: M12, levelTenths: 40, source: "suggested" },
      { memberId: M13, levelTenths: 25, source: "admin" },
      { memberId: M14, levelTenths: 35, source: "default" },
    ],
    rounds: [
      {
        roundId: R2,
        startsAt: NOV_8,
        canceled: false,
        modality: "indoor-6x6",
        matches: [
          {
            matchId: F4,
            winner: "b",
            teams: { a: [M1, M3, M5, M7, M9, M11], b: [M2, M4, M6, M8, M10, M12] },
            onCourt: { a: [M1, M3, M5, M7, M9, M11], b: [M2, M4, M6, M8, M10, M12] },
          },
        ],
      },
      {
        roundId: R1,
        startsAt: NOV_1,
        canceled: false,
        modality: "indoor-6x6",
        matches: [
          {
            matchId: F1,
            winner: "a",
            teams: { a: [M1, M2, M3, M4, M5, M6, M7], b: [M8, M9, M10, M11, M12, M13] },
            onCourt: { a: [M1, M2, M3, M4, M5, M6], b: [M8, M9, M10, M11, M12, M13] },
          },
          {
            matchId: F2,
            winner: "b",
            teams: { a: [M1, M2, M3, M4, M5, M6, M7], b: [M8, M9, M10, M11, M12, M13] },
            onCourt: { a: [M1, M2, M3, M4, M5, M7, M6], b: [M8, M9, M10, M11, M12, M13] },
          },
          {
            matchId: F3,
            winner: "a",
            teams: { a: [M1, M2, M3, M4, M5, M6, M7], b: [M14, M8, M9, M10, M11, M12] },
            onCourt: { a: [M1, M2, M3, M4, M5, M6], b: [M14, M8, M9, M10, M11, M12] },
          },
        ],
      },
    ],
    steps: [
      { pool: "indoor", a: [M1, M2, M3, M4, M5, M6], b: [M8, M9, M10, M11, M12, M13], winner: "a" },
      {
        pool: "indoor",
        a: [M1, M2, M3, M4, M5, M7, M6],
        b: [M8, M9, M10, M11, M12, M13],
        winner: "b",
      },
      { pool: "indoor", a: [M1, M2, M3, M4, M5, M6], b: [M14, M8, M9, M10, M11, M12], winner: "a" },
      { pool: "indoor", a: [M1, M3, M5, M7, M9, M11], b: [M2, M4, M6, M8, M10, M12], winner: "b" },
    ],
    members: [
      {
        pool: "indoor",
        memberIds: [M1, M2, M3, M4, M5, M6, M7, M8, M9, M10, M11, M12, M13, M14],
      },
    ],
  },
];
