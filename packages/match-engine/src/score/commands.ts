import { err, FORMATION_CATALOG_VERSION, ok, type Result } from "@sacou/volley-rules";

import {
  LINEUP_CHANGED_EVENT_TYPE,
  MATCH_ENDED_EVENT_TYPE,
  MATCH_STARTED_EVENT_TYPE,
  MAX_FINISHED_MATCHES,
  POINT_SCORED_EVENT_TYPE,
  SET_ENDED_EVENT_TYPE,
  SUPPORTED_RULES_VERSIONS,
  TEAM_SIDES,
} from "./constants.data.js";
import {
  parseLineupChangedPayload,
  parseMatchStartedPayload,
  parseScorePayload,
} from "./parse-payloads.js";
import { getNextSetFirstServer, isRosterPartition } from "./rotation-rules.js";
import { getMatchWinner, getSetWinner, targetPointsForSet } from "./scoring-rules.js";
import type {
  ConfirmSetEndOptions,
  CourtSessionState,
  LineupAllocation,
  MatchScore,
  MatchSet,
  MatchStartedPayload,
  MemberId,
  ScoreCommandError,
  ScoreCommandResult,
  ScoreEventDraft,
  ScoreEventType,
  ScorePayloadField,
  ScoreRefusalCode,
  SetterZones,
  TeamRotations,
  TeamSide,
  TeamState,
} from "./types.js";

function refuse(code: ScoreRefusalCode): ScoreCommandResult {
  return err({ code });
}

function invalidField(field: ScorePayloadField): ScoreCommandResult {
  return err({ code: "invalid-payload", field });
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

function isSameOrder(first: readonly MemberId[], second: readonly MemberId[]): boolean {
  return first.length === second.length && first.every((id, index) => id === second[index]);
}

function isSameAllocation(teamState: TeamState, allocation: LineupAllocation): boolean {
  return (
    teamState.setterZone === allocation.setterZone &&
    isSameOrder(teamState.lineup, allocation.lineup) &&
    isSameOrder(teamState.bench, allocation.bench)
  );
}

function recordAllocation(
  { matchId, teams }: MatchScore,
  teamState: TeamState,
  team: TeamSide,
  input: LineupAllocation,
): ScoreCommandResult {
  const parsed = parseLineupChangedPayload({ ...input, matchId, team });
  if (!parsed.ok) {
    return parsed;
  }
  const { bench, lineup } = parsed.value;
  const roster = teams[team];
  if (!isRosterPartition(lineup, bench, roster)) {
    const isLineupOfTheTeam = lineup.every((id) => roster.memberIds.includes(id));
    return invalidField(isLineupOfTheTeam ? "bench" : "lineup");
  }
  return isSameAllocation(teamState, parsed.value)
    ? refuse("lineup-unchanged")
    : ok([{ type: LINEUP_CHANGED_EVENT_TYPE, payload: parsed.value }]);
}

/** Whoever has no rotation has no bench, so there is nothing to change (ADR 0027). */
function withOpenTeam(
  state: CourtSessionState,
  team: TeamSide,
  run: (match: MatchScore, teamState: TeamState) => ScoreCommandResult,
): ScoreCommandResult {
  const match = state.currentMatch;
  if (match === null) {
    return refuse("no-open-match");
  }
  if (!TEAM_SIDES.includes(team)) {
    return invalidField("team");
  }
  const teamState = match.rotations[team];
  return teamState === null ? refuse("rotation-off") : run(match, teamState);
}

/**
 * Saves the whole allocation of a team, as screen 22 has it: a swap between two members on the
 * court, the rotation selector or a new anchor of the setter. `system` does not change in a match.
 */
export function changeLineup(
  state: CourtSessionState,
  team: TeamSide,
  allocation: LineupAllocation,
): ScoreCommandResult {
  return withOpenTeam(state, team, (match, teamState) =>
    recordAllocation(match, teamState, team, allocation),
  );
}

/**
 * The member who comes in takes the position of the one who goes out, and the zone stays. The rest
 * of the bench keeps its order, and the member who goes out goes to the end of it.
 */
export function substitutePlayer(
  state: CourtSessionState,
  team: TeamSide,
  outgoing: MemberId,
  incoming: MemberId,
): ScoreCommandResult {
  return withOpenTeam(state, team, (match, teamState) => {
    const { bench, lineup, setterZone } = teamState;
    if (!lineup.includes(outgoing)) {
      return invalidField("lineup");
    }
    if (!bench.includes(incoming)) {
      return invalidField("bench");
    }
    return recordAllocation(match, teamState, team, {
      bench: [...bench.filter((id) => id !== incoming), outgoing],
      lineup: lineup.map((id) => (id === outgoing ? incoming : id)),
      setterZone,
    });
  });
}
