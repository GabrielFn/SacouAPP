import {
  getMatchWinner,
  getSetPointTeams,
  getSetWinner,
  INITIAL_COURT_SESSION_STATE,
  setsToWin,
  undoLastAction,
  type CourtSessionState,
  type CourtSessionTimeline,
  type MatchScore,
  type MatchSet,
  type TeamSide,
} from "@sacou/match-engine";

import type { CourtRoster } from "../ports/court-roster";
import type {
  CourtPhase,
  CourtScreenModel,
  MatchEndModel,
  SetDotModel,
  SetEndModel,
} from "./court-screen.types";
import { selectHintLine } from "./hint-line";
import { selectQueue } from "./queue-model";
import { withDisplayNames } from "./screen-display-names";
import { buildTeamPanel } from "./team-panel";
import { selectWinStreak } from "./win-streak";

const NEXT = 1;

export function stateOfTimeline(timeline: CourtSessionTimeline): CourtSessionState {
  return timeline.entries.at(-1)?.state ?? INITIAL_COURT_SESSION_STATE;
}

function decidedWinner(match: MatchScore, set: MatchSet): TeamSide | null {
  return getSetWinner(set.score, set.targetPoints, match.scoring.winMargin);
}

/** The screen the state needs: no match, the court, the confirmation of a set, or the end. */
export function selectCourtPhase(state: CourtSessionState): CourtPhase {
  const { currentMatch, finishedMatches } = state;
  if (currentMatch === null) {
    return finishedMatches.length > 0 ? "match-ended" : "no-match";
  }
  const set = currentMatch.currentSet;
  if (set === null) {
    return "match-ended";
  }
  return decidedWinner(currentMatch, set) === null ? "playing" : "set-decided";
}

function selectDots(match: MatchScore): readonly SetDotModel[] {
  if (match.scoring.bestOf === 1) {
    return [];
  }
  const played = match.completedSets.map(({ winner }) => ({ winner }));
  return match.currentSet === null ? played : [...played, { winner: null }];
}

/** What the court shows, derived from the replay of the log: the model has no state of its own. */
export function selectCourtScreen(
  timeline: CourtSessionTimeline,
  roster: CourtRoster,
): CourtScreenModel | null {
  const state = stateOfTimeline(timeline);
  const match = state.currentMatch;
  const set = match?.currentSet ?? null;
  if (match === null || set === null) {
    return null;
  }
  const streak = selectWinStreak(state);
  const { teams, queue } = withDisplayNames(
    { a: buildTeamPanel(match, set, "a", roster), b: buildTeamPanel(match, set, "b", roster) },
    selectQueue(state.queue, roster),
  );
  return {
    phase: selectCourtPhase(state),
    setNumber: set.setNumber,
    dots: selectDots(match),
    teams,
    queue,
    streak:
      streak === null
        ? null
        : { ...streak, label: roster.teamAppearance(match.matchId, streak.side).label },
    hint: selectHintLine(getSetPointTeams(set.score, set.targetPoints, match.scoring.winMargin)),
    canUndo: undoLastAction(timeline).ok,
  };
}

function labelOf(roster: CourtRoster, matchId: string, side: TeamSide): string {
  return roster.teamAppearance(matchId, side).label;
}

/** The deciding set of a series is preceded by the toss of who serves first. */
function needsFirstServer(match: MatchScore, set: MatchSet, winner: TeamSide): boolean {
  const { bestOf } = match.scoring;
  const matchEnds = match.setsWon[winner] + NEXT >= setsToWin(bestOf);
  return !matchEnds && bestOf > NEXT && set.setNumber + NEXT === bestOf;
}

/** For the end-of-set placeholder; `null` while the set is still being played. */
export function selectSetEnd(
  timeline: CourtSessionTimeline,
  roster: CourtRoster,
): SetEndModel | null {
  const match = stateOfTimeline(timeline).currentMatch;
  const set = match?.currentSet ?? null;
  const winner = match === null || set === null ? null : decidedWinner(match, set);
  if (match === null || set === null || winner === null) {
    return null;
  }
  const side = (team: TeamSide) => ({
    label: labelOf(roster, match.matchId, team),
    score: set.score[team],
  });
  return {
    setNumber: set.setNumber,
    winnerLabel: labelOf(roster, match.matchId, winner),
    scores: { a: side("a"), b: side("b") },
    needsFirstServer: needsFirstServer(match, set, winner),
  };
}

/** For the end-of-match placeholder; `null` while a match is open. */
export function selectMatchEnd(
  timeline: CourtSessionTimeline,
  roster: CourtRoster,
): MatchEndModel | null {
  const state = stateOfTimeline(timeline);
  const finished = state.currentMatch === null ? (state.finishedMatches.at(-1) ?? null) : null;
  if (finished === null) {
    return null;
  }
  const winner = finished.winner ?? getMatchWinner(finished.setsWon, finished.scoring.bestOf);
  return {
    winnerLabel: winner === null ? null : labelOf(roster, finished.matchId, winner),
    sets: finished.completedSets.map(({ setNumber, score }) => ({
      setNumber,
      a: score.a,
      b: score.b,
    })),
  };
}
