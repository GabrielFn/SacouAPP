import { err, ok, type Result } from "@sacou/volley-rules";

import {
  MATCH_ENDED_EVENT_TYPE,
  MATCH_STARTED_EVENT_TYPE,
  POINT_SCORED_EVENT_TYPE,
  SET_ENDED_EVENT_TYPE,
  SUPPORTED_RULES_VERSIONS,
} from "./constants.data.js";
import { parseMatchStartedPayload, parseScorePayload } from "./parse-payloads.js";
import { getMatchWinner, getSetWinner, targetPointsForSet } from "./scoring-rules.js";
import type {
  CourtSessionState,
  MatchScore,
  MatchSet,
  MatchStartedPayload,
  ScoreCommandError,
  ScoreCommandResult,
  ScoreEventDraft,
  ScoreEventType,
  ScoreRefusalCode,
  TeamSide,
} from "./types.js";

function refuse(code: ScoreRefusalCode): ScoreCommandResult {
  return err({ code });
}

/** Every command drafts through the parser, so what it returns is what the replay accepts. */
function draftEvent(
  type: ScoreEventType,
  payload: unknown,
): Result<ScoreEventDraft, ScoreCommandError> {
  const parsed = parseScorePayload(type, payload);
  return parsed.ok ? ok({ type, payload: parsed.value }) : parsed;
}

function emit(type: ScoreEventType, payload: unknown): ScoreCommandResult {
  const draft = draftEvent(type, payload);
  return draft.ok ? ok([draft.value]) : draft;
}

function draftMatchWon(
  matchId: string,
  winner: TeamSide,
): Result<ScoreEventDraft, ScoreCommandError> {
  return draftEvent(MATCH_ENDED_EVENT_TYPE, { endReason: "sets-won", matchId, winner });
}

export function startMatch(
  state: CourtSessionState,
  input: MatchStartedPayload,
): ScoreCommandResult {
  const parsed = parseMatchStartedPayload(input);
  if (!parsed.ok) {
    return parsed;
  }
  const { matchId, rulesVersion } = parsed.value;
  if (!SUPPORTED_RULES_VERSIONS.includes(rulesVersion)) {
    return refuse("unsupported-rules-version");
  }
  if (state.currentMatch !== null) {
    return refuse("match-already-open");
  }
  if (state.finishedMatches.some((match) => match.matchId === matchId)) {
    return err({ code: "invalid-payload", field: "matchId" });
  }
  return ok([{ type: MATCH_STARTED_EVENT_TYPE, payload: parsed.value }]);
}

export function scorePoint(state: CourtSessionState, team: TeamSide): ScoreCommandResult {
  const match = state.currentMatch;
  if (match === null) {
    return refuse("no-open-match");
  }
  const set = match.currentSet;
  if (set === null) {
    return refuse("no-open-set");
  }
  if (getSetWinner(set.score, set.targetPoints, match.scoring.winMargin) !== null) {
    return refuse("set-decided");
  }
  return emit(POINT_SCORED_EVENT_TYPE, { matchId: match.matchId, setNumber: set.setNumber, team });
}

/** Only the first of the two events of a deciding confirmation was stored: emits the other one. */
function finishPendingMatch({ matchId, scoring, setsWon }: MatchScore): ScoreCommandResult {
  const winner = getMatchWinner(setsWon, scoring.bestOf);
  if (winner === null) {
    return refuse("no-open-set");
  }
  const matchEnded = draftMatchWon(matchId, winner);
  return matchEnded.ok ? ok([matchEnded.value]) : matchEnded;
}

function endSet(match: MatchScore, { setNumber }: MatchSet, winner: TeamSide): ScoreCommandResult {
  const { matchId, scoring, setsWon } = match;
  const setsWonAfter = { ...setsWon, [winner]: setsWon[winner] + 1 };
  const matchWinner = getMatchWinner(setsWonAfter, scoring.bestOf);
  const nextSet =
    matchWinner === null ? { targetPoints: targetPointsForSet(scoring, setNumber + 1) } : null;
  const setEnded = draftEvent(SET_ENDED_EVENT_TYPE, { matchId, nextSet, setNumber, winner });
  if (!setEnded.ok || matchWinner === null) {
    return setEnded.ok ? ok([setEnded.value]) : setEnded;
  }
  const matchEnded = draftMatchWon(matchId, matchWinner);
  return matchEnded.ok ? ok([setEnded.value, matchEnded.value]) : matchEnded;
}

/** The two events of a deciding confirmation are stored together by the caller. */
export function confirmSetEnd(state: CourtSessionState): ScoreCommandResult {
  const match = state.currentMatch;
  if (match === null) {
    return refuse("no-open-match");
  }
  const set = match.currentSet;
  if (set === null) {
    return finishPendingMatch(match);
  }
  const winner = getSetWinner(set.score, set.targetPoints, match.scoring.winMargin);
  return winner === null ? refuse("set-not-decided") : endSet(match, set, winner);
}

/** Records the winner the caller decided: who wins an unfinished match is not a rule here. */
export function endMatchManually(
  state: CourtSessionState,
  winner: TeamSide | null,
): ScoreCommandResult {
  const match = state.currentMatch;
  return match === null
    ? refuse("no-open-match")
    : emit(MATCH_ENDED_EVENT_TYPE, { endReason: "manual", matchId: match.matchId, winner });
}
