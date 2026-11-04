import { readUniqueMemberIds } from "../score/payload-reading.js";
import type { MemberId } from "../score/types.js";
import { getConsecutiveMatches, getMatchesPlayed } from "./consecutive-matches.js";
import type {
  QueueExitCandidates,
  QueueExitChoice,
  QueueExitCriterion,
  QueueExitCriterionInputs,
  QueueExitCriterionKey,
} from "./types.js";

/** A list of members from outside the engine: UUIDs, each one once, or `null`. */
function readMemberList(raw: unknown): readonly MemberId[] | null {
  return Array.isArray(raw) ? readUniqueMemberIds(raw as readonly unknown[]) : null;
}

/** The arrival order of the candidates, which must all be in it; others are ignored. */
function readArrivalOrder(
  raw: unknown,
  { memberIds }: QueueExitCandidates,
): readonly MemberId[] | null {
  const arrivalOrder = readMemberList(raw);
  return arrivalOrder !== null && memberIds.every((id) => arrivalOrder.includes(id))
    ? arrivalOrder.filter((id) => memberIds.includes(id))
    : null;
}

/** Compares two members; negative puts the first one out first. */
type ExitComparator = (first: MemberId, second: MemberId) => number;

function byArrival(arrivalOrder: readonly MemberId[]): ExitComparator {
  return (first, second) => arrivalOrder.indexOf(first) - arrivalOrder.indexOf(second);
}

function byMost(count: (memberId: MemberId) => number): ExitComparator {
  return (first, second) => count(second) - count(first);
}

function inOrder(...comparators: readonly ExitComparator[]): ExitComparator {
  return (first, second) =>
    comparators.reduce((result, compare) => result || compare(first, second), 0);
}

/**
 * The default: who has played the most matches in a row leaves first. A tie goes to whoever played
 * the most matches in the round, and then to whoever arrived first (decision of the product owner).
 */
const consecutiveMatchesCriterion: QueueExitCriterion<
  QueueExitCriterionInputs["consecutive-matches"]
> = {
  choose: (candidates, { arrivalOrder }) => {
    const order = readArrivalOrder(arrivalOrder, candidates);
    if (order === null) {
      return null;
    }
    const { state } = candidates;
    const compare = inOrder(
      byMost((id) => getConsecutiveMatches(state, id)),
      byMost((id) => getMatchesPlayed(state, id)),
      byArrival(order),
    );
    return [...order].sort(compare).slice(0, candidates.count);
  },
};

/** Whoever arrived first leaves first. */
const arrivalOrderCriterion: QueueExitCriterion<QueueExitCriterionInputs["arrival-order"]> = {
  choose: (candidates, input) => {
    const order = readArrivalOrder(input.arrivalOrder, candidates);
    return order === null ? null : order.slice(0, candidates.count);
  },
};

/** The draw comes shuffled from outside: a permutation of the losing team, and the first leave. */
const drawCriterion: QueueExitCriterion<QueueExitCriterionInputs["draw"]> = {
  choose: (candidates, { drawOrder }) => {
    const order = readMemberList(drawOrder);
    const { memberIds } = candidates;
    const isPermutation =
      order !== null &&
      order.length === memberIds.length &&
      order.every((id) => memberIds.includes(id));
    return isPermutation ? order.slice(0, candidates.count) : null;
  },
};

/** Exactly as many as leave, all of the losing team. */
const manualCriterion: QueueExitCriterion<QueueExitCriterionInputs["manual"]> = {
  choose: ({ count, memberIds }, { chosen }) => {
    const choice = readMemberList(chosen);
    const isValid =
      choice !== null && choice.length === count && choice.every((id) => memberIds.includes(id));
    return isValid ? choice : null;
  },
};

const QUEUE_EXIT_CRITERIA: {
  readonly [K in QueueExitCriterionKey]: QueueExitCriterion<QueueExitCriterionInputs[K]>;
} = {
  "consecutive-matches": consecutiveMatchesCriterion,
  "arrival-order": arrivalOrderCriterion,
  draw: drawCriterion,
  manual: manualCriterion,
};

function isCriterionKey(value: unknown): value is QueueExitCriterionKey {
  return typeof value === "string" && Object.hasOwn(QUEUE_EXIT_CRITERIA, value);
}

function runCriterion<K extends QueueExitCriterionKey>(
  { criterion, criterionInput }: QueueExitChoice<K>,
  candidates: QueueExitCandidates,
): readonly MemberId[] | null {
  const strategy: QueueExitCriterion<QueueExitCriterionInputs[K]> = QUEUE_EXIT_CRITERIA[criterion];
  return strategy.choose(candidates, criterionInput);
}

/**
 * Who leaves, by the criterion, in its order; `null` for an unknown criterion or an input that does
 * not choose exactly `count` members of the losing team.
 */
export function chooseOutgoing(
  choice: QueueExitChoice,
  candidates: QueueExitCandidates,
): readonly MemberId[] | null {
  const { criterion, criterionInput } = choice as { criterion: unknown; criterionInput: unknown };
  if (!isCriterionKey(criterion) || typeof criterionInput !== "object" || criterionInput === null) {
    return null;
  }
  return runCriterion(choice, candidates);
}
