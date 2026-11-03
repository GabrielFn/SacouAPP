import { parseEventEnvelope } from "../event-log/parse-envelope.js";
import { replayEvents, replayTimeline } from "../event-log/replay-events.js";
import type { EventEnvelope, ReplayedState } from "../event-log/types.js";
import { INITIAL_COURT_SESSION_STATE, SCORE_APPLIERS } from "../score/appliers.js";
import { scorePoint, startMatch } from "../score/commands.js";
import { COURT_SESSION_ID } from "../score/match-player.test.fixture.js";
import type {
  CourtSessionState,
  MatchStartedPayload,
  ScoreCommandResult,
  ScoreEventDraft,
  TeamSide,
} from "../score/types.js";
import type { CorrectionCommandResult, CourtSessionTimeline, RevertDraft } from "./types.js";

const DEVICE_ID = "d0000000-0000-4000-8000-000000000001";
const ID_DIGITS = 12;

const CONFIG = {
  courtSessionId: COURT_SESSION_ID,
  initialState: INITIAL_COURT_SESSION_STATE,
  appliers: SCORE_APPLIERS,
};

export type ScoreCommand = (state: CourtSessionState) => ScoreCommandResult;
export type CorrectionCommand = (timeline: CourtSessionTimeline) => CorrectionCommandResult;

export function eventIdOf(sequence: number): string {
  return `e0000000-0000-4000-8000-${String(sequence).padStart(ID_DIGITS, "0")}`;
}

function toEnvelope(draft: ScoreEventDraft | RevertDraft, sequence: number): EventEnvelope {
  const parsed = parseEventEnvelope({
    eventId: eventIdOf(sequence),
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

export function replayOf(events: readonly EventEnvelope[]): ReplayedState<CourtSessionState> {
  const replayed = replayEvents(CONFIG, events);
  if (!replayed.ok) {
    throw new Error(`replay failed: ${replayed.error.code}`);
  }
  return replayed.value;
}

export function timelineOf(events: readonly EventEnvelope[]): CourtSessionTimeline {
  const timeline = replayTimeline(CONFIG, events);
  if (!timeline.ok) {
    throw new Error(`replay failed: ${timeline.error.code}`);
  }
  return timeline.value;
}

function requireLast(events: readonly EventEnvelope[]): EventEnvelope {
  const last = events.at(-1);
  if (last === undefined) {
    throw new Error("empty log");
  }
  return last;
}

/**
 * Test-only: plays score and correction commands as the app does, through the parser and the replay.
 * Immutable: every step returns a new log, and `last` is the envelope it stored last.
 */
export class CorrectionPlayer {
  constructor(readonly events: readonly EventEnvelope[] = []) {}

  static start(input: MatchStartedPayload): CorrectionPlayer {
    return new CorrectionPlayer().run((state) => startMatch(state, input));
  }

  get last(): EventEnvelope {
    return requireLast(this.events);
  }

  state(): CourtSessionState {
    return replayOf(this.events).state;
  }

  timeline(): CourtSessionTimeline {
    return timelineOf(this.events);
  }

  append(draft: ScoreEventDraft | RevertDraft): CorrectionPlayer {
    return new CorrectionPlayer([...this.events, toEnvelope(draft, this.events.length + 1)]);
  }

  run(command: ScoreCommand): CorrectionPlayer {
    const result = command(this.state());
    if (!result.ok) {
      throw new Error(`refused: ${result.error.code}`);
    }
    return result.value.reduce<CorrectionPlayer>((player, draft) => player.append(draft), this);
  }

  correct(command: CorrectionCommand): CorrectionPlayer {
    const result = command(this.timeline());
    if (!result.ok) {
      throw new Error(`refused: ${result.error.code}`);
    }
    return result.value.reduce<CorrectionPlayer>((player, draft) => player.append(draft), this);
  }

  point(team: TeamSide): CorrectionPlayer {
    return this.run((state) => scorePoint(state, team));
  }

  /** One point per letter, `a` or `b`, in order. */
  rallies(winners: string): CorrectionPlayer {
    return Array.from(winners).reduce<CorrectionPlayer>(
      (player, letter) => player.point(letter === "a" ? "a" : "b"),
      this,
    );
  }
}
