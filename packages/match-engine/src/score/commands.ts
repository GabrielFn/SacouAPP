import { FORMATION_CATALOG_VERSION, ok, type Result } from "@sacou/volley-rules";

import { draftEvent, emit, invalidField, refuse } from "./command-results.js";
import {
  MATCH_ENDED_EVENT_TYPE,
  MATCH_STARTED_EVENT_TYPE,
  MAX_FINISHED_MATCHES,
  POINT_SCORED_EVENT_TYPE,
  SERVING_TEAM_CHANGED_EVENT_TYPE,
  SET_ENDED_EVENT_TYPE,
  SUPPORTED_RULES_VERSIONS,
} from "./constants.data.js";
import { parseMatchStartedPayload } from "./parse-payloads.js";
import { getNextSetFirstServer, getOpponent } from "./rotation-rules.js";
import { getMatchWinner, getSetWinner, targetPointsForSet } from "./scoring-rules.js";
import type {
  ConfirmSetEndOptions,
  CourtSessionState,
  MatchScore,
  MatchSet,
  MatchStartedPayload,
  ScoreCommandError,
  ScoreCommandResult,
  ScoreEventDraft,
  SetScore,
  SetterZones,
  TeamRotations,
  TeamSide,
} from "./types.js";

export { changeLineup, shiftRotation, substitutePlayer } from "./lineup-commands.js";

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
  const { formationsVersion, matchId, rulesVersion } = parsed.value;
  if (!SUPPORTED_RULES_VERSIONS.includes(rulesVersion)) {
    return refuse("unsupported-rules-version");
  }
  if (formationsVersion !== FORMATION_CATALOG_VERSION) {
    return refuse("unsupported-formations-version");
  }
  if (state.currentMatch !== null) {
    return refuse("match-already-open");
  }
  if (state.finishedMatches.length >= MAX_FINISHED_MATCHES) {
    return refuse("too-many-matches");
  }
  if (state.finishedMatches.some((match) => match.matchId === matchId)) {
    return invalidField("matchId");
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

/**
 * The rotation each team starts the next set in: it carries on from where it stopped, by decision
 * of the product owner (ADR 0024). This is the only place that chooses it; the event records the
 * result.
 */
function chooseNextSetZones({ a, b }: TeamRotations): SetterZones {
  return { a: a?.setterZone ?? null, b: b?.setterZone ?? null };
}

function endSet(
  match: MatchScore,
  { firstServer, setNumber }: MatchSet,
  winner: TeamSide,
  options: ConfirmSetEndOptions,
): ScoreCommandResult {
  const { matchId, rotations, scoring, setsWon } = match;
  const setsWonAfter = { ...setsWon, [winner]: setsWon[winner] + 1 };
  const matchWinner = getMatchWinner(setsWonAfter, scoring.bestOf);
  const nextSet =
    matchWinner === null
      ? {
          firstServer:
            options.firstServer === undefined
              ? getNextSetFirstServer(firstServer)
              : options.firstServer,
          setterZones: chooseNextSetZones(rotations),
          targetPoints: targetPointsForSet(scoring, setNumber + 1),
        }
      : null;
  const setEnded = draftEvent(SET_ENDED_EVENT_TYPE, { matchId, nextSet, setNumber, winner });
  if (!setEnded.ok || matchWinner === null) {
    return setEnded.ok ? ok([setEnded.value]) : setEnded;
  }
  const matchEnded = draftMatchWon(matchId, matchWinner);
  return matchEnded.ok ? ok([setEnded.value, matchEnded.value]) : matchEnded;
}

/**
 * The two events of a deciding confirmation are stored together by the caller. The next set
 * alternates who serves first, unless the caller brings `firstServer` from the toss of a deciding
 * set: the screen that holds the toss decides when to bring it (E4.10).
 */
export function confirmSetEnd(
  state: CourtSessionState,
  options: ConfirmSetEndOptions = {},
): ScoreCommandResult {
  const match = state.currentMatch;
  if (match === null) {
    return refuse("no-open-match");
  }
  const set = match.currentSet;
  if (set === null) {
    return finishPendingMatch(match);
  }
  const winner = getSetWinner(set.score, set.targetPoints, match.scoring.winMargin);
  return winner === null ? refuse("set-not-decided") : endSet(match, set, winner, options);
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

function hasNoPoints({ a, b }: SetScore): boolean {
  return a === 0 && b === 0;
}

/**
 * "Trocar sacador" on screen 24: only the serve changes, and nobody rotates. At 0–0 it also corrects
 * who served first, so the next set alternates from the corrected one; afterwards, who served first
 * stays (ADR 0030).
 */
export function switchServingTeam(state: CourtSessionState): ScoreCommandResult {
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
  const servingTeam = getOpponent(set.servingTeam);
  return emit(SERVING_TEAM_CHANGED_EVENT_TYPE, {
    firstServer: hasNoPoints(set.score) ? servingTeam : set.firstServer,
    matchId: match.matchId,
    servingTeam,
    setNumber: set.setNumber,
  });
}
