import { parseEventEnvelope } from "../event-log/parse-envelope.js";
import { replayEvents } from "../event-log/replay-events.js";
import type { EventEnvelope } from "../event-log/types.js";
import { INITIAL_COURT_SESSION_STATE, SCORE_APPLIERS } from "./appliers.js";
import type {
  CourtSessionState,
  MatchStartedPayload,
  ScoreEventDraft,
  ScoringRules,
} from "./types.js";

/** Test-only: builds envelopes and replays them through the parser, as the app will. */
export const COURT_SESSION_ID = "c0000000-0000-4000-8000-000000000001";
export const MATCH_ID = "f0000000-0000-4000-8000-000000000001";
const DEVICE_ID = "d0000000-0000-4000-8000-000000000001";
const ID_DIGITS = 12;

export function matchInput(scoring: ScoringRules, matchId = MATCH_ID): MatchStartedPayload {
  return {
    matchId,
    rulesVersion: 1,
    scoring,
    teams: {
      a: { memberIds: ["a0000000-0000-4000-8000-000000000001"] },
      b: { memberIds: ["b0000000-0000-4000-8000-000000000001"] },
    },
  };
}

export function toEnvelope(draft: ScoreEventDraft, sequence: number): EventEnvelope {
  const parsed = parseEventEnvelope({
    eventId: `e0000000-0000-4000-8000-${String(sequence).padStart(ID_DIGITS, "0")}`,
    courtSessionId: COURT_SESSION_ID,
    deviceId: DEVICE_ID,
    batch: 1,
    sequence,
    schemaVersion: 1,
    type: draft.type,
    payload: draft.payload,
  });
  if (!parsed.ok) {
    throw new Error(`invalid envelope: ${parsed.error.field}`);
  }
  return parsed.value;
}

export function replayAll(events: readonly EventEnvelope[]): CourtSessionState {
  const replayed = replayEvents(
    {
      courtSessionId: COURT_SESSION_ID,
      initialState: INITIAL_COURT_SESSION_STATE,
      appliers: SCORE_APPLIERS,
    },
    events,
  );
  if (!replayed.ok) {
    throw new Error(`replay failed: ${replayed.error.code}`);
  }
  return replayed.value.state;
}
