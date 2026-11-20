import type { RoundSummaryReport } from "../../../services/api/sacou-api";

/** The first member of the simulated round of the E2.9 (plan, "Rodada simulada"), with the ID of the golden r1. */
export const BIA = "a0000000-0000-4000-8000-000000000001";

/**
 * The answer of the summary for the simulated round, with the numbers copied from the table made by hand
 * in `docs/estado/tarefas/E2.9.md` (not from the code): 4 matches finished (M5 is open), Laranja (a)
 * won M1 and M2, Azul (b) M3, M4 has no winner. The MVP is the first of a1 to a6: +2, 2 wins in 3.
 */
export const E2_9_ROUND: RoundSummaryReport = {
  roundId: "11111111-1111-4111-8111-111111111111",
  modality: "indoor-6x6",
  mvpFormulaVersion: 1,
  finishedMatches: 4,
  mvp: {
    kind: "player",
    memberIds: [BIA],
    side: "a",
    plusMinus: 2,
    wins: 2,
    matchesPlayed: 3,
    longestWinStreak: 2,
  },
  sides: {
    mostWins: { side: "a", wins: 2 },
    longestStreak: { side: "a", longestWinStreak: 2 },
  },
  players: [],
  ranking: null,
};
