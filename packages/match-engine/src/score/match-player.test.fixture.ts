import { parseEventEnvelope } from "../event-log/parse-envelope.js";
import { replayEvents } from "../event-log/replay-events.js";
import type { EventEnvelope } from "../event-log/types.js";
import { INITIAL_COURT_SESSION_STATE, SCORE_APPLIERS } from "./appliers.js";
import {
  FORMATION_CATALOG_VERSION,
  type FormationSystem,
  type SetterZone,
} from "@sacou/volley-rules";

import type {
  CourtSessionState,
  MatchStartedPayload,
  MemberId,
  ScoreEventDraft,
  ScoringRules,
  TeamSide,
} from "./types.js";

/** Test-only: builds envelopes and replays them through the parser, as the app will. */
export const COURT_SESSION_ID = "c0000000-0000-4000-8000-000000000001";
export const MATCH_ID = "f0000000-0000-4000-8000-000000000001";
const DEVICE_ID = "d0000000-0000-4000-8000-000000000001";
const ID_DIGITS = 12;
const LINEUP_SIZE = 6;

function membersOf(side: TeamSide, teamSize: number): readonly MemberId[] {
  return Array.from({ length: teamSize }, (_, index) => {
    const memberNumber = String(index + 1).padStart(ID_DIGITS, "0");
    return `${side}0000000-0000-4000-8000-${memberNumber}`;
  });
}

/** Stand-ins for the team of the screens, setter first: Pedro, Ana, Lia, Marcos, Bia, João. */
export const ORANGE_LINEUP = membersOf("a", LINEUP_SIZE);
/** Stand-ins for the team of the screens, setter first: Gabi, Rafa, Caio, Nina, Duda, Léo. */
export const BLUE_LINEUP = membersOf("b", LINEUP_SIZE);

/** The teams of the score tests: one member each, with the rotation off and `a` serving first. */
export function matchInput(scoring: ScoringRules, matchId = MATCH_ID): MatchStartedPayload {
  return {
    firstServer: "a",
    formationsVersion: FORMATION_CATALOG_VERSION,
    matchId,
    rotations: { a: null, b: null },
    rulesVersion: 1,
    scoring,
    teams: {
      a: { memberIds: membersOf("a", 1) },
      b: { memberIds: membersOf("b", 1) },
    },
  };
}

export interface RotationSetup {
  readonly firstServer?: TeamSide;
  readonly zones?: readonly [SetterZone | null, SetterZone | null];
  readonly systems?: readonly [FormationSystem, FormationSystem];
  readonly matchId?: string;
  readonly teamSize?: number;
}

/** The teams of the screens, with their rotations: by default `a` serves and both are in zone 1. */
export function rotationMatchInput(
  scoring: ScoringRules,
  {
    firstServer = "a",
    zones = [1, 1],
    systems = ["5x1", "5x1"],
    matchId = MATCH_ID,
    teamSize = LINEUP_SIZE,
  }: RotationSetup = {},
): MatchStartedPayload {
  const [zoneA, zoneB] = zones;
  const [systemA, systemB] = systems;
  return {
    firstServer,
    formationsVersion: FORMATION_CATALOG_VERSION,
    matchId,
    rotations: {
      a:
        zoneA === null
          ? null
          : {
              bench: membersOf("a", teamSize).slice(LINEUP_SIZE),
              libero: null,
              lineup: ORANGE_LINEUP,
              setterZone: zoneA,
              system: systemA,
            },
      b:
        zoneB === null
          ? null
          : {
              bench: membersOf("b", teamSize).slice(LINEUP_SIZE),
              libero: null,
              lineup: BLUE_LINEUP,
              setterZone: zoneB,
              system: systemB,
            },
    },
    rulesVersion: 1,
    scoring,
    teams: {
      a: { memberIds: membersOf("a", teamSize) },
      b: { memberIds: membersOf("b", teamSize) },
    },
  };
}

export function numberedMatchId(matchNumber: number): string {
  return `f0000000-0000-4000-8000-${String(matchNumber).padStart(ID_DIGITS, "0")}`;
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
