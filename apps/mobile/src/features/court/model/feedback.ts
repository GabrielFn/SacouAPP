import {
  getSetPointTeams,
  type CourtSessionState,
  type MatchScore,
  type TeamSide,
} from "@sacou/match-engine";

/** In order of strength: the phone plays the last one of a list. */
export type FeedbackKind =
  "point" | "side-out" | "set-point" | "set-ended" | "match-ended" | "refused";

const ONE_POINT = 1;

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
  if (after.finishedMatches.length > before.finishedMatches.length) {
    return ["match-ended"];
  }
  const { currentMatch: previous } = before;
  const { currentMatch: next } = after;
  if (previous === null || next === null || !sameMatch(previous, next)) {
    return [];
  }
  if (next.completedSets.length > previous.completedSets.length) {
    return ["set-ended"];
  }
  return isOnePointLater(previous, next) ? pointFeedback(previous, next) : [];
}

/** The one the phone plays: the strongest of the list, or `null` for nothing. */
export function strongestFeedback(kinds: readonly FeedbackKind[]): FeedbackKind | null {
  return kinds.at(-1) ?? null;
}
