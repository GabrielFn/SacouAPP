import { CURRENT_RULES_VERSION, type MatchStartedPayload } from "@sacou/match-engine";
import { FORMATION_CATALOG_VERSION } from "@sacou/volley-rules";

/**
 * The teams of the design screens (Laranja: Pedro, Ana, Lia, Marcos, Bia, João; Azul: Gabi, Rafa,
 * Caio, Nina, Duda, Léo; queue: Davi, Sofia), as ids only: names never enter the log (eventos.md).
 * Each lineup has the setter first, then the others by ascending position.
 */
export const SAMPLE_ORANGE_LINEUP: readonly string[] = [
  "a0000000-0000-4000-8000-000000000001",
  "a0000000-0000-4000-8000-000000000002",
  "a0000000-0000-4000-8000-000000000003",
  "a0000000-0000-4000-8000-000000000004",
  "a0000000-0000-4000-8000-000000000005",
  "a0000000-0000-4000-8000-000000000006",
];

export const SAMPLE_BLUE_LINEUP: readonly string[] = [
  "b0000000-0000-4000-8000-000000000001",
  "b0000000-0000-4000-8000-000000000002",
  "b0000000-0000-4000-8000-000000000003",
  "b0000000-0000-4000-8000-000000000004",
  "b0000000-0000-4000-8000-000000000005",
  "b0000000-0000-4000-8000-000000000006",
];

export const SAMPLE_QUEUE_PLAYERS: readonly string[] = [
  "c0000000-0000-4000-8000-000000000001",
  "c0000000-0000-4000-8000-000000000002",
];

/** The libero of the "with libero" sample: Laranja, covering both middle blockers. */
export const SAMPLE_LIBERO_ID = "a0000000-0000-4000-8000-000000000007";

/** The lineup indexes of the two middle blockers of a 5x1 (S, OH1, MB1, OPP, OH2, MB2). */
const SAMPLE_MIDDLE_BLOCKER_INDEXES = [2, 5] as const;

export const SAMPLE_MATCH_ID = "f0000000-0000-4000-8000-000000000001";

/** One set of 25, the default match (decisoes.md). */
export const SAMPLE_SCORING_ONE_SET = {
  bestOf: 1,
  pointsPerSet: 25,
  tieBreakPoints: null,
  winMargin: 2,
} as const;

/** Best of three, the second option of the development screen. */
export const SAMPLE_SCORING_BEST_OF_THREE = {
  bestOf: 3,
  pointsPerSet: 25,
  tieBreakPoints: 15,
  winMargin: 2,
} as const;

export const SAMPLE_MATCH_BEST_OF_THREE: MatchStartedPayload = {
  firstServer: "a",
  formationsVersion: FORMATION_CATALOG_VERSION,
  matchId: SAMPLE_MATCH_ID,
  queue: { players: SAMPLE_QUEUE_PLAYERS, teams: [] },
  rotations: {
    // The setter zone of each team at the start, as on screen 09 (Laranja in 1, Azul in 5).
    a: { bench: [], libero: null, lineup: SAMPLE_ORANGE_LINEUP, setterZone: 1, system: "5x1" },
    b: { bench: [], libero: null, lineup: SAMPLE_BLUE_LINEUP, setterZone: 5, system: "5x1" },
  },
  rulesVersion: CURRENT_RULES_VERSION,
  scoring: SAMPLE_SCORING_BEST_OF_THREE,
  teams: {
    a: { memberIds: SAMPLE_ORANGE_LINEUP },
    b: { memberIds: SAMPLE_BLUE_LINEUP },
  },
};

export const SAMPLE_MATCH_ONE_SET: MatchStartedPayload = {
  ...SAMPLE_MATCH_BEST_OF_THREE,
  scoring: SAMPLE_SCORING_ONE_SET,
};

/** Best of three with a libero for Laranja, covering both middle blockers (`replacedIndexes [2, 5]`). */
export const SAMPLE_MATCH_WITH_LIBERO: MatchStartedPayload = {
  ...SAMPLE_MATCH_BEST_OF_THREE,
  rotations: {
    a: {
      bench: [],
      libero: { memberId: SAMPLE_LIBERO_ID, replacedIndexes: SAMPLE_MIDDLE_BLOCKER_INDEXES },
      lineup: SAMPLE_ORANGE_LINEUP,
      setterZone: 1,
      system: "5x1",
    },
    b: SAMPLE_MATCH_BEST_OF_THREE.rotations.b,
  },
  teams: {
    a: { memberIds: [...SAMPLE_ORANGE_LINEUP, SAMPLE_LIBERO_ID] },
    b: { memberIds: SAMPLE_BLUE_LINEUP },
  },
};
