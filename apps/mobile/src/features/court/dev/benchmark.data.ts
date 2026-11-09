// Numbers of the Hermes benchmark (E4.9, plan section 4, part 3, step 7).

export const BENCHMARK_WARMUPS = 3;
export const BENCHMARK_REPETITIONS = 20;
/** Taps timed with the real SQLite (a score and an undo, alternating). */
export const BENCHMARK_TAPS = 100;
/** A tap is a point on even turns and its undo on odd ones. */
export const BENCHMARK_TAP_CYCLE = 2;
/** The limit scenario replays 10 thousand events per tap, so it gets fewer taps to stay bearable. */
export const BENCHMARK_LIMIT_TAPS = 30;
/** `undoLastAction` (which looks for the start of the open match) is asked this many times per round. */
export const BENCHMARK_START_INDEX_CALLS = 10;

/** Budget proposed in ADR 0038. */
export const BUDGET_TAP_P95_MS = 100;
export const BUDGET_REOPEN_MS = 1000;

/** Balanced rallies: 4 points each in 8, so neither team runs away. */
export const BALANCED_RALLIES = "abbaabab";

/** A one-set match to 25-22 for Laranja: 40 balanced points, two each and three more (44, then 47). */
export const FINISHED_MATCH_RALLIES = `${BALANCED_RALLIES.repeat(5)}ababaaa`;
/** The match left open: 40 balanced points (20-20), far from the end of the set. */
export const OPEN_MATCH_RALLIES = BALANCED_RALLIES.repeat(5);

/** Matches finished before the open one in the scenarios of a typical round and of the limit. */
export const TYPICAL_ROUND_FINISHED_MATCHES = 29;
export const LIMIT_FINISHED_MATCHES = 199;

/**
 * Best of five with a long advantage set, a decided set 2-2 and a tie-break left open. `A` confirms
 * the set giving Laranja the first serve of the next one; `c` confirms it; `u` undoes the last point.
 */
export const LONG_MATCH_SETS = {
  // 28-26 for Laranja after a long advantage.
  advantage: `${BALANCED_RALLIES.repeat(6)}ababaa`,
  // 20-25 for Azul.
  azulWins: `${BALANCED_RALLIES.repeat(5)}bbbbb`,
  // 25-22 for Laranja and for Azul.
  orangeWins: `${BALANCED_RALLIES.repeat(5)}ababaaa`,
  azulWinsClose: `${BALANCED_RALLIES.repeat(5)}ababbbb`,
  // Tie-break open at 5-5.
  tieBreakOpen: `${BALANCED_RALLIES}ab`,
} as const;

/** One undo (and the same point again) every this many points, up to the count below per set: 20 in the first four sets. */
export const UNDO_EVERY_POINTS = 8;
export const UNDO_PER_SET = 5;

/** The court session id of the scenarios built in memory. */
export const BENCHMARK_SESSION_ID = "c0000000-0000-4000-8000-0000000000b1";
