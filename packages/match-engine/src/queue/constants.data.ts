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
