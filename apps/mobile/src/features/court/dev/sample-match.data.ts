import { CURRENT_RULES_VERSION, type MatchStartedPayload, type TeamState } from "@sacou/match-engine";
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

export const SAMPLE_MATCH_ID = "f0000000-0000-4000-8000-000000000001";

/** The setter zone of each team at the start, as on screen 09 (Laranja in 1, Azul in 5). */
const SAMPLE_ORANGE_SETTER_ZONE = 1;
const SAMPLE_BLUE_SETTER_ZONE = 5;

function sampleTeamState(lineup: readonly string[], setterZone: 1 | 5): TeamState {
  return { bench: [], libero: null, lineup, setterZone, system: "5x1" };
}

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
    a: sampleTeamState(SAMPLE_ORANGE_LINEUP, SAMPLE_ORANGE_SETTER_ZONE),
    b: sampleTeamState(SAMPLE_BLUE_LINEUP, SAMPLE_BLUE_SETTER_ZONE),
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
