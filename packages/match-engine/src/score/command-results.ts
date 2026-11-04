import { err, ok, type Result } from "@sacou/volley-rules";

import { parseScorePayload } from "./parse-payloads.js";
import type {
  ScoreCommandError,
  ScoreCommandResult,
  ScoreEventDraft,
  ScoreEventType,
  ScorePayloadField,
  ScoreRefusalCode,
} from "./types.js";

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
