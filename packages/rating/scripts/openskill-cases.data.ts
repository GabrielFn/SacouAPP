/**
 * Inputs of `golden/openskill-plackett-luce.json` (E3.9 part 2, plan 5.2), written by hand. The
 * expected values come from `openskill` itself, called by `generate-golden.ts` with these options
 * and nothing else from this package.
 */

export interface SkillInput {
  readonly mu: number;
  readonly sigma: number;
}

export interface OpenSkillCaseInput {
  readonly id: string;
  readonly options: {
    readonly beta: number;
    readonly tau: number;
    readonly kappa: number;
    readonly limitSigma: boolean;
  };
  readonly teams: readonly [readonly SkillInput[], readonly SkillInput[]];
  /** One `rank` per match, in order; each match rates the result of the one before. */
  readonly ranks: readonly (readonly [number, number])[];
}

const PILOT = { beta: 100, tau: 1, kappa: 0.0001, limitSigma: false } as const;

const LEVEL_3_UNCONFIRMED = { mu: 1500, sigma: 200 } as const;
const LEVEL_3_ADMIN = { mu: 1500, sigma: 100 } as const;

const A_WINS = [1, 2] as const;
const B_WINS = [2, 1] as const;

export const OPENSKILL_CASES: readonly OpenSkillCaseInput[] = [
  {
    id: "o1-one-against-one",
    options: PILOT,
    teams: [[LEVEL_3_UNCONFIRMED], [LEVEL_3_UNCONFIRMED]],
    ranks: [A_WINS],
  },
  {
    id: "o2-two-against-two",
    options: PILOT,
    teams: [
      [LEVEL_3_ADMIN, { mu: 1700, sigma: 200 }],
      [{ mu: 1300, sigma: 200 }, LEVEL_3_ADMIN],
    ],
    ranks: [B_WINS],
  },
  {
    id: "o3-six-against-six",
    options: PILOT,
    teams: [
      [
        { mu: 1500, sigma: 100 },
        { mu: 1620, sigma: 200 },
        { mu: 1380, sigma: 100 },
        { mu: 1700, sigma: 200 },
        { mu: 1440, sigma: 100 },
        { mu: 1560, sigma: 200 },
      ],
      [
        { mu: 1600, sigma: 200 },
        { mu: 1400, sigma: 100 },
        { mu: 1500, sigma: 200 },
        { mu: 1300, sigma: 100 },
        { mu: 1660, sigma: 200 },
        { mu: 1540, sigma: 100 },
      ],
    ],
    ranks: [A_WINS],
  },
  {
    id: "o4-six-against-five",
    options: PILOT,
    teams: [
      [
        LEVEL_3_UNCONFIRMED,
        LEVEL_3_UNCONFIRMED,
        LEVEL_3_ADMIN,
        { mu: 1800, sigma: 100 },
        { mu: 1200, sigma: 200 },
        LEVEL_3_ADMIN,
      ],
      [
        { mu: 1900, sigma: 100 },
        LEVEL_3_UNCONFIRMED,
        { mu: 1700, sigma: 200 },
        LEVEL_3_ADMIN,
        { mu: 1100, sigma: 200 },
      ],
    ],
    ranks: [B_WINS],
  },
  {
    id: "o5-upset-the-weak-team-wins",
    options: PILOT,
    teams: [
      [
        { mu: 2300, sigma: 100 },
        { mu: 2300, sigma: 100 },
      ],
      [
        { mu: 700, sigma: 100 },
        { mu: 700, sigma: 200 },
      ],
    ],
    ranks: [B_WINS],
  },
  {
    id: "o6-sigma-held-by-the-kappa-floor",
    options: { ...PILOT, kappa: 0.99 },
    teams: [[LEVEL_3_UNCONFIRMED, LEVEL_3_ADMIN], [LEVEL_3_UNCONFIRMED]],
    ranks: [A_WINS],
  },
  {
    id: "o7-twenty-matches-of-the-same-players",
    options: PILOT,
    teams: [
      [LEVEL_3_ADMIN, LEVEL_3_UNCONFIRMED, { mu: 1600, sigma: 200 }],
      [{ mu: 1400, sigma: 200 }, LEVEL_3_ADMIN, LEVEL_3_UNCONFIRMED],
    ],
    ranks: [
      A_WINS,
      A_WINS,
      B_WINS,
      A_WINS,
      A_WINS,
      A_WINS,
      B_WINS,
      B_WINS,
      A_WINS,
      A_WINS,
      B_WINS,
      A_WINS,
      A_WINS,
      A_WINS,
      A_WINS,
      B_WINS,
      A_WINS,
      B_WINS,
      A_WINS,
      A_WINS,
    ],
  },
  {
    id: "o8-large-and-small-mu",
    options: PILOT,
    teams: [
      [
        { mu: 4200, sigma: 300 },
        { mu: 3100, sigma: 30 },
      ],
      [
        { mu: 60, sigma: 300 },
        { mu: 0.5, sigma: 30 },
      ],
    ],
    ranks: [B_WINS, A_WINS],
  },
  {
    id: "o9-limit-sigma-on",
    options: { ...PILOT, limitSigma: true },
    teams: [
      [LEVEL_3_UNCONFIRMED, { mu: 1650, sigma: 100 }],
      [LEVEL_3_ADMIN, LEVEL_3_UNCONFIRMED],
    ],
    ranks: [A_WINS, B_WINS],
  },
];
