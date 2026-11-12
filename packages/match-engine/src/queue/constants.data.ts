/**
 * Who leaves a losing team when fewer are waiting than a team (ADR 0029). The keys are the names of
 * the `IQueueExitCriterion` of the C#; "nível" is out of the MVP, by decision of the product owner.
 */
export const QUEUE_EXIT_CRITERION_KEYS = [
  "consecutive-matches",
  "arrival-order",
  "draw",
  "manual",
] as const;

/** The default of a group, by `decisoes.md:11`. */
export const DEFAULT_QUEUE_EXIT_CRITERION = "consecutive-matches";

/** A team in the queue has at least one member: the parser rejects an empty one. */
export const MIN_PLAYERS_PER_TEAM = 1;

/**
 * Who leaves the losing team (E2.12, ADR 0050): the automatic mode of the MVP, the whole team, or a
 * fixed count. The keys are the names of the `IQueueExitModeStep` of the C#.
 */
export const QUEUE_EXIT_MODE_KINDS = ["automatic", "whole-team", "fixed-count"] as const;

/** The default of a group: the mode of E2.6. */
export const DEFAULT_QUEUE_EXIT_MODE = "automatic";

/** A fixed count goes from one to a whole team (`MAX_TEAM_MEMBERS`). */
export const MIN_FIXED_EXIT_COUNT = 1;

/** The count of screen 18a when a group picks the fixed count. */
export const DEFAULT_FIXED_EXIT_COUNT = 2;

/** "Vencedor também sai" after X wins in a row: a small product limit, easy to change. */
export const MIN_WINNER_EXIT_WINS = 1;
export const MAX_WINNER_EXIT_WINS = 10;

/** Off in a new group, with X ready at 3 (question P3 of E2.12, recommendation adopted). */
export const DEFAULT_WINNER_EXIT_ENABLED = false;
export const DEFAULT_WINNER_EXIT_WINS = 3;
