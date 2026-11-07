// Shared steps of the score commands: refusals, drafts through the parser and the open set.
import { err, ok, type Result } from "@sacou/volley-rules";

import { MATCH_ENDED_EVENT_TYPE } from "../constants.data.js";
import { parseScorePayload } from "../parse-payloads.js";
import { getSetWinner } from "../scoring-rules.js";
import type {
  CourtSessionState,
  MatchScore,
  MatchSet,
  ScoreCommandError,
  ScoreCommandResult,
  ScoreEventDraft,
  ScoreEventType,
  ScorePayloadField,
  ScoreRefusalCode,
  TeamSide,
} from "../types.js";

export function refuse(code: ScoreRefusalCode): ScoreCommandResult {
  return err({ code });
}

export function invalidField(field: ScorePayloadField): ScoreCommandResult {
  return err({ code: "invalid-payload", field });
}

/** Every command drafts through the parser, so what it returns is what the replay accepts. */
export function draftEvent(
  type: ScoreEventType,
  payload: unknown,
): Result<ScoreEventDraft, ScoreCommandError> {
  const parsed = parseScorePayload(type, payload);
  return parsed.ok ? ok({ type, payload: parsed.value }) : parsed;
}

export function emit(type: ScoreEventType, payload: unknown): ScoreCommandResult {
  const draft = draftEvent(type, payload);
  return draft.ok ? ok([draft.value]) : draft;
}

export function draftMatchWon(
  matchId: string,
  winner: TeamSide,
): Result<ScoreEventDraft, ScoreCommandError> {
  return draftEvent(MATCH_ENDED_EVENT_TYPE, { endReason: "sets-won", matchId, winner });
}

interface UndecidedSet {
  readonly match: MatchScore;
  readonly set: MatchSet;
}

/** The open match and its open set, while the set has no winner yet. */
export function readUndecidedSet(
  state: CourtSessionState,
): Result<UndecidedSet, ScoreCommandError> {
  const match = state.currentMatch;
  if (match === null) {
    return err({ code: "no-open-match" });
  }
  const set = match.currentSet;
  if (set === null) {
    return err({ code: "no-open-set" });
  }
  if (getSetWinner(set.score, set.targetPoints, match.scoring.winMargin) !== null) {
    return err({ code: "set-decided" });
  }
  return ok({ match, set });
}
