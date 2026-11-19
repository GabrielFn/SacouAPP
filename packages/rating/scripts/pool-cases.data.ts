/** Pool cases p1 to p6 of `golden/rating-pools.json`; the inputs are in `pool-fixtures.data.ts`. */
import {
  ALL_ADMIN_3,
  F1,
  F2,
  F3,
  M1,
  M2,
  M3,
  M4,
  M5,
  M6,
  M7,
  M8,
  NOV_1,
  NOV_2,
  NOV_3,
  ONE_TO_FOUR,
  PAIR_12,
  PAIR_34,
  R1,
  R2,
  R3,
  type PoolCaseInput,
} from "./pool-fixtures.data.ts";

export const POOL_CASES_FIRST: readonly PoolCaseInput[] = [
  {
    id: "p1-the-admin-seed-moves-less-than-an-unconfirmed-one",
    seeds: [
      { memberId: M1, levelTenths: 30, source: "admin" },
      { memberId: M2, levelTenths: 30, source: "suggested" },
      { memberId: M3, levelTenths: 30, source: "default" },
      { memberId: M4, levelTenths: 30, source: "admin" },
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
            winner: "a",
            teams: { a: PAIR_12, b: PAIR_34 },
            onCourt: { a: PAIR_12, b: PAIR_34 },
          },
        ],
      },
    ],
    steps: [{ pool: "indoor", a: PAIR_12, b: PAIR_34, winner: "a" }],
    members: ONE_TO_FOUR,
  },
  {
    id: "p2-no-winner-rates-nobody",
    seeds: [
      { memberId: M1, levelTenths: 35, source: "admin" },
      { memberId: M2, levelTenths: 30, source: "admin" },
      { memberId: M3, levelTenths: 25, source: "admin" },
      { memberId: M4, levelTenths: 40, source: "admin" },
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
    id: "p3-the-bench-that-never-came-in-is-not-rated",
    seeds: [...ALL_ADMIN_3, { memberId: M5, levelTenths: 40, source: "suggested" }],
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
            teams: { a: [M1, M2, M5], b: PAIR_34 },
            onCourt: { a: PAIR_12, b: PAIR_34 },
          },
        ],
      },
    ],
    steps: [{ pool: "indoor", a: PAIR_12, b: PAIR_34, winner: "a" }],
    members: [{ pool: "indoor", memberIds: [M1, M2, M5, M3, M4] }],
  },
  {
    id: "p4-indoor-and-beach-are-rated-apart",
    seeds: ALL_ADMIN_3,
    rounds: [
      {
        roundId: R2,
        startsAt: NOV_2,
        canceled: false,
        modality: "beach-2x2",
        matches: [
          {
            matchId: F2,
            winner: "b",
            teams: { a: [M1, M3], b: [M2, M4] },
            onCourt: { a: [M1, M3], b: [M2, M4] },
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
            teams: { a: PAIR_12, b: PAIR_34 },
            onCourt: { a: PAIR_12, b: PAIR_34 },
          },
        ],
      },
    ],
    steps: [
      { pool: "indoor", a: PAIR_12, b: PAIR_34, winner: "a" },
      { pool: "beach", a: [M1, M3], b: [M2, M4], winner: "b" },
    ],
    members: [
      { pool: "indoor", memberIds: [M1, M2, M3, M4] },
      { pool: "beach", memberIds: [M1, M3, M2, M4] },
    ],
  },
  {
    id: "p5-beach-2x2-and-beach-4x4-share-a-pool",
    seeds: ALL_ADMIN_3,
    rounds: [
      {
        roundId: R1,
        startsAt: NOV_1,
        canceled: false,
        modality: "beach-2x2",
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
        canceled: false,
        modality: "beach-4x4",
        matches: [
          {
            matchId: F2,
            winner: "b",
            teams: { a: [M1, M5, M6, M7], b: [M2, M3, M4, M8] },
            onCourt: { a: [M1, M5, M6, M7], b: [M2, M3, M4, M8] },
          },
        ],
      },
    ],
    steps: [
      { pool: "beach", a: PAIR_12, b: PAIR_34, winner: "a" },
      { pool: "beach", a: [M1, M5, M6, M7], b: [M2, M3, M4, M8], winner: "b" },
    ],
    members: [{ pool: "beach", memberIds: [M1, M2, M3, M4, M5, M6, M7, M8] }],
  },
  {
    id: "p6-play-order-not-arrival-order",
    seeds: [
      { memberId: M1, levelTenths: 35, source: "admin" },
      { memberId: M2, levelTenths: 30, source: "suggested" },
      { memberId: M3, levelTenths: 25, source: "default" },
      { memberId: M4, levelTenths: 45, source: "admin" },
    ],
    rounds: [
      {
        roundId: R3,
        startsAt: NOV_3,
        canceled: false,
        modality: "indoor-6x6",
        matches: [
          {
            matchId: F3,
            winner: "b",
            teams: { a: [M1, M4], b: [M2, M3] },
            onCourt: { a: [M1, M4], b: [M2, M3] },
          },
        ],
      },
      {
        roundId: R2,
        startsAt: NOV_1,
        canceled: false,
        modality: "indoor-6x6",
        matches: [
          {
            matchId: F2,
            winner: "a",
            teams: { a: [M1, M3], b: [M2, M4] },
            onCourt: { a: [M1, M3], b: [M2, M4] },
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
            teams: { a: PAIR_12, b: PAIR_34 },
            onCourt: { a: PAIR_12, b: PAIR_34 },
          },
        ],
      },
    ],
    steps: [
      { pool: "indoor", a: PAIR_12, b: PAIR_34, winner: "a" },
      { pool: "indoor", a: [M1, M3], b: [M2, M4], winner: "a" },
      { pool: "indoor", a: [M1, M4], b: [M2, M3], winner: "b" },
    ],
    members: ONE_TO_FOUR,
  },
];
