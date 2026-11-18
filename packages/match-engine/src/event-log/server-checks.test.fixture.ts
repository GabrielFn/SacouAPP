import type { Result } from "@sacou/volley-rules";

import { attributePoint } from "../attributions/commands.js";
import { undoLastAction } from "../corrections/commands.js";
import { changeQueue } from "../queue/commands.js";
import { INITIAL_COURT_SESSION_STATE, SCORE_APPLIERS } from "../score/appliers.js";
import {
  confirmSetEnd,
  endMatchManually,
  scorePoint,
  shiftRotation,
  startMatch,
  switchServingTeam,
} from "../score/commands.js";
import type {
  CourtSessionState,
  MatchStartedPayload,
  MemberId,
  PointKind,
  RotationDirection,
  TeamQueue,
  TeamSide,
} from "../score/types.js";
import { parseEventEnvelope } from "./parse-envelope.js";
import { replayTimeline } from "./replay-events.js";
import type { EventEnvelope, JsonObject, ReplayedTimeline } from "./types.js";

/** Test-only: plays the commands of an accepted case of `server-checks.json`, as the app would. */
export const SERVER_CHECKS_COURT_SESSION_ID = "c0000000-0000-4000-8000-000000000001";
const DEVICE_ID = "d0000000-0000-4000-8000-000000000001";
/** The phone that takes the court over in a case with `takeoverAt` (ADR 0063). */
const TAKEOVER_DEVICE_ID = "d0000000-0000-4000-8000-000000000002";
const FIRST_BATCH = 1;
const TAKEOVER_BATCH = 2;
const SCHEMA_VERSION = 1;
const ID_DIGITS = 12;

/** One command of the engine, by name, with its input as the golden file writes it. */
export type GoldenCommand =
  | { readonly command: "startMatch"; readonly input: MatchStartedPayload }
  | { readonly command: "scorePoint"; readonly team: TeamSide }
  | { readonly command: "confirmSetEnd"; readonly firstServer?: TeamSide }
  | { readonly command: "switchServingTeam" }
  | { readonly command: "endMatchManually"; readonly winner: TeamSide | null }
  | { readonly command: "changeQueue"; readonly queue: TeamQueue }
  | {
      readonly command: "shiftRotation";
      readonly team: TeamSide;
      readonly direction: RotationDirection;
    }
  | {
      readonly command: "attributePoint";
      readonly pointEventId: string;
      readonly kind: PointKind;
      readonly author: MemberId | null;
    }
  | { readonly command: "undoLastAction" };

interface Draft {
  readonly type: string;
  readonly payload: unknown;
}

type Timeline = ReplayedTimeline<CourtSessionState>;

function eventIdOf(sequence: number): string {
  return `e0000000-0000-4000-8000-${String(sequence).padStart(ID_DIGITS, "0")}`;
}

/** Who stamps an envelope: the device, its batch, and its own sequence, which starts at 1 for each device. */
interface Stamp {
  readonly deviceId: string;
  readonly batch: number;
  readonly sequence: number;
}

/**
 * The stamp of the event at `position` (from 1): the first phone writes batch 1, and from `takeoverAt`
 * (an index of the log) on, the phone that took the court over writes batch 2.
 */
function stampOf(position: number, takeoverAt: number | undefined): Stamp {
  return takeoverAt === undefined || position <= takeoverAt
    ? { deviceId: DEVICE_ID, batch: FIRST_BATCH, sequence: position }
    : { deviceId: TAKEOVER_DEVICE_ID, batch: TAKEOVER_BATCH, sequence: position - takeoverAt };
}

/** The envelope as the app writes it, through the parser: the golden file holds the same object. */
export function toGoldenEnvelope(
  { type, payload }: Draft,
  position: number,
  stamp: Stamp,
): EventEnvelope {
  const parsed = parseEventEnvelope({
    eventId: eventIdOf(position),
    courtSessionId: SERVER_CHECKS_COURT_SESSION_ID,
    ...stamp,
    schemaVersion: SCHEMA_VERSION,
    type,
    payload: payload as JsonObject,
  });
  if (!parsed.ok) {
    throw new Error(`invalid envelope: ${parsed.error.field}`);
  }
  return parsed.value;
}

function replay(events: readonly EventEnvelope[]): Timeline {
  const timeline = replayTimeline(
    {
      courtSessionId: SERVER_CHECKS_COURT_SESSION_ID,
      initialState: INITIAL_COURT_SESSION_STATE,
      appliers: SCORE_APPLIERS,
    },
    events,
  );
  if (!timeline.ok) {
    throw new Error(`replay failed: ${timeline.error.code}`);
  }
  return timeline.value;
}

function run(
  command: GoldenCommand,
  timeline: Timeline,
): Result<readonly Draft[], { readonly code: string }> {
  const state = timeline.entries.at(-1)?.state ?? INITIAL_COURT_SESSION_STATE;
  switch (command.command) {
    case "startMatch":
      return startMatch(state, command.input);
    case "scorePoint":
      return scorePoint(state, command.team);
    case "confirmSetEnd":
      return confirmSetEnd(
        state,
        command.firstServer === undefined ? {} : { firstServer: command.firstServer },
      );
    case "switchServingTeam":
      return switchServingTeam(state);
    case "endMatchManually":
      return endMatchManually(state, command.winner);
    case "changeQueue":
      return changeQueue(state, command.queue);
    case "shiftRotation":
      return shiftRotation(state, command.team, command.direction);
    case "attributePoint":
      return attributePoint(timeline, command.pointEventId, command);
    case "undoLastAction":
      return undoLastAction(timeline);
  }
}

/**
 * Every envelope the commands emit, numbered one after the other; a refused command throws. With
 * `takeoverAt`, the events from that index on are written by the phone that took the court over.
 */
export function playCommands(
  commands: readonly GoldenCommand[],
  takeoverAt?: number,
): readonly EventEnvelope[] {
  return commands.reduce<readonly EventEnvelope[]>((events, command) => {
    const drafts = run(command, replay(events));
    if (!drafts.ok) {
      throw new Error(`${command.command} refused: ${drafts.error.code}`);
    }
    return [
      ...events,
      ...drafts.value.map((draft, index) => {
        const position = events.length + index + 1;
        return toGoldenEnvelope(draft, position, stampOf(position, takeoverAt));
      }),
    ];
  }, []);
}
