import {
  CURRENT_RULES_VERSION,
  type GroupSettings,
  type MatchStartedPayload,
  type MemberId,
  type ScoringRules,
  type TeamSide,
  type TeamState,
} from "@sacou/match-engine";
import {
  err,
  FORMATION_CATALOG_VERSION,
  ok,
  ROTATION_SLOTS,
  type FormationSystem,
  type Result,
} from "@sacou/volley-rules";

import type { DrawArrangement } from "./draw-arrangement";
import { defaultLineup, type PositionOf } from "./default-lineup";
import { chosenOr, type PreGameChoices } from "./pre-game";

/** Only a team of six rotates (ADR 0024): any other size plays with the rotation off. */
export const ROTATING_TEAM_SIZE = ROTATION_SLOTS.length;

/** The pre-game always starts with the setter in zone 1 (D6); screen 22 changes it (E4.8). */
const STARTING_SETTER_ZONE = 1;

const SIDES: readonly TeamSide[] = ["a", "b"];
const SIDE_INDEX: Readonly<Record<TeamSide, number>> = { a: 0, b: 1 };
const FIRST_QUEUED_TEAM = SIDES.length;

export interface MatchStartInput {
  readonly arrangement: DrawArrangement;
  readonly preGame: PreGameChoices;
  readonly settings: GroupSettings;
  readonly positionOf: PositionOf;
}

export function teamOfSide(arrangement: DrawArrangement, side: TeamSide): readonly MemberId[] {
  return arrangement.teams[SIDE_INDEX[side]] ?? [];
}

export function systemOf(
  preGame: PreGameChoices,
  settings: GroupSettings,
  side: TeamSide,
): FormationSystem {
  return chosenOr(preGame.systems[side], settings.rotation.system);
}

/** Whether a team rotates: the round has the rotation on and the team has six (ADR 0024, D6). */
export function rotates(settings: GroupSettings, team: readonly MemberId[]): boolean {
  return settings.rotation.enabled && team.length === ROTATING_TEAM_SIZE;
}

/** `null` turns the rotation off; else the default lineup, the setter in zone 1, no bench nor libero. */
export function teamRotation(input: MatchStartInput, side: TeamSide): TeamState | null {
  const team = teamOfSide(input.arrangement, side);
  if (!rotates(input.settings, team)) return null;
  const system = systemOf(input.preGame, input.settings, side);
  const lineup = defaultLineup(team, system, input.positionOf);
  // A team that cannot fill the six seats plays with the rotation off, as any other size (ADR 0024).
  if (!lineup.ok) return null;
  return {
    system,
    lineup: lineup.value,
    setterZone: STARTING_SETTER_ZONE,
    bench: [],
    // The libero is chosen on screen 22 (question 73): the match starts without one.
    libero: null,
  };
}

export function scoringOf({
  preGame,
  settings,
}: Pick<MatchStartInput, "preGame" | "settings">): ScoringRules {
  const { scoring } = settings;
  const bestOf = chosenOr(preGame.bestOf, scoring.bestOf);
  return {
    bestOf,
    pointsPerSet: chosenOr(preGame.pointsPerSet, scoring.pointsPerSet),
    tieBreakPoints: bestOf > 1 && scoring.tieBreakEnabled ? scoring.tieBreakPoints : null,
    winMargin: scoring.winMargin,
  };
}

export type MatchStartError = "not-enough-teams";

/**
 * The `MatchStarted` of the draw (D7): only `MemberId`s, never a level, a name nor a position. Teams 1
 * and 2 play in order of arrival, which is the first order of the bench; the others and the reserves
 * wait in the queue, in order. `matchId` comes from outside, so the function stays pure.
 */
export function buildMatchStart(
  input: MatchStartInput,
  matchId: string,
): Result<MatchStartedPayload, MatchStartError> {
  const { arrangement, preGame } = input;
  if (arrangement.teams.length < SIDES.length) return err("not-enough-teams");
  return ok({
    matchId,
    rulesVersion: CURRENT_RULES_VERSION,
    formationsVersion: FORMATION_CATALOG_VERSION,
    scoring: scoringOf(input),
    teams: {
      a: { memberIds: teamOfSide(arrangement, "a") },
      b: { memberIds: teamOfSide(arrangement, "b") },
    },
    rotations: { a: teamRotation(input, "a"), b: teamRotation(input, "b") },
    firstServer: preGame.firstServer,
    queue: {
      teams: arrangement.teams.slice(FIRST_QUEUED_TEAM).map((memberIds) => ({ memberIds })),
      players: arrangement.reserves,
    },
  });
}
