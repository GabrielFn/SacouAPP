import {
  getSetPointTeams,
  getSetWinner,
  setsToWin,
  type CourtSessionState,
  type MatchScore,
  type TeamSide,
} from "@sacou/match-engine";

/** In order of strength: the phone plays the last one of a list. */
export type FeedbackKind =
  "point" | "side-out" | "set-point" | "set-ended" | "match-ended" | "refused";

const ONE_POINT = 1;
/** One set more for the winner of the point that decides it. */
const ONE_SET = 1;

function setPointSides(match: MatchScore): readonly TeamSide[] {
  const set = match.currentSet;
  return set === null ? [] : getSetPointTeams(set.score, set.targetPoints, match.scoring.winMargin);
}

function totalPoints(match: MatchScore): number {
  const score = match.currentSet?.score;
  return score === undefined ? 0 : score.a + score.b;
}

/** A point of the same set: one more in the total, and nothing else changed in the set. */
function isOnePointLater(before: MatchScore, after: MatchScore): boolean {
  return (
    before.currentSet !== null &&
    before.currentSet.setNumber === after.currentSet?.setNumber &&
    totalPoints(after) === totalPoints(before) + ONE_POINT
  );
}

/** The set is won on the court but not confirmed yet: the engine still holds it as the current set. */
function decidedWinner(match: MatchScore): TeamSide | null {
  const set = match.currentSet;
  return set === null ? null : getSetWinner(set.score, set.targetPoints, match.scoring.winMargin);
}

/** What the deciding point means: the end of the match, or only the end of a set of a series. */
function decidingPointFeedback(match: MatchScore, winner: TeamSide): FeedbackKind {
  return match.setsWon[winner] + ONE_SET >= setsToWin(match.scoring.bestOf)
    ? "match-ended"
    : "set-ended";
}

function pointFeedback(before: MatchScore, after: MatchScore): readonly FeedbackKind[] {
  const sideOut = before.currentSet?.servingTeam !== after.currentSet?.servingTeam;
  const alreadyAtSetPoint = setPointSides(before);
  const reachedSetPoint = setPointSides(after).some((side) => !alreadyAtSetPoint.includes(side));
  return [
    "point",
    ...(sideOut ? (["side-out"] as const) : []),
    ...(reachedSetPoint ? (["set-point"] as const) : []),
  ];
}

function sameMatch(before: MatchScore | null, after: MatchScore | null): boolean {
  return before !== null && after !== null && before.matchId === after.matchId;
}

/**
 * What the phone should do between two states of the court: pure, and silent for anything that is
 * not a step forward (an undo goes back, so it does not buzz like a point). `refused` is not here:
 * it comes from a command the engine turned down, not from two states.
 */
export function deriveFeedback(
  before: CourtSessionState,
  after: CourtSessionState,
): readonly FeedbackKind[] {
  const { currentMatch: previous } = before;
  const { currentMatch: next } = after;
  // The buzz already played at the point that decided the set: confirming it is silent.
  const confirmsDecidedSet = previous !== null && decidedWinner(previous) !== null;
  if (after.finishedMatches.length > before.finishedMatches.length) {
    return confirmsDecidedSet ? [] : ["match-ended"];
  }
  if (previous === null || next === null || !sameMatch(previous, next)) {
    return [];
  }
  if (next.completedSets.length > previous.completedSets.length) {
    return confirmsDecidedSet ? [] : ["set-ended"];
  }
  return isOnePointLater(previous, next) ? scoredFeedback(previous, next) : [];
}

/** A point of the same set: the one that decides the set buzzes as its end, any other as a point. */
function scoredFeedback(previous: MatchScore, next: MatchScore): readonly FeedbackKind[] {
  const winner = decidedWinner(next);
  return winner === null ? pointFeedback(previous, next) : [decidingPointFeedback(next, winner)];
}

/** The one the phone plays: the strongest of the list, or `null` for nothing. */
export function strongestFeedback(kinds: readonly FeedbackKind[]): FeedbackKind | null {
  return kinds.at(-1) ?? null;
}

/** What to play when the log goes from `before` to `after`; the first state seen (`null`) plays nothing. */
export function feedbackOnChange(
  before: CourtSessionState | null,
  after: CourtSessionState,
): FeedbackKind | null {
  if (before === null || before === after) {
    return null;
  }
  return strongestFeedback(deriveFeedback(before, after));
}
