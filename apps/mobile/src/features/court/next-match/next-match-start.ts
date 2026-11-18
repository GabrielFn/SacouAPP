import {
  CURRENT_RULES_VERSION,
  type FinishedMatch,
  type GroupSettings,
  type MatchStartedPayload,
  type NextMatchPlan,
  type TeamSide,
  type TeamState,
} from "@sacou/match-engine";
import { FORMATION_CATALOG_VERSION } from "@sacou/volley-rules";

import { defaultLineup, type PositionOf } from "../../draw/model/default-lineup";
import { rotates } from "../../draw/model/match-start";

/** A team that comes in starts with the setter in zone 1, as the pre-game (E4.7 D6). */
const STARTING_SETTER_ZONE = 1;

export interface NextMatchStartInput {
  readonly plan: NextMatchPlan;
  readonly finished: FinishedMatch;
  readonly settings: GroupSettings;
  readonly matchId: string;
  readonly firstServer: TeamSide;
  readonly positionOf: PositionOf;
}

/**
 * A team that comes in whole gets the default lineup of the round's system when it rotates (six
 * players and the rotation on), or plays with the rotation off; the libero is chosen on screen 22.
 */
function enteringRotation(
  { settings, positionOf }: NextMatchStartInput,
  memberIds: readonly string[],
): TeamState | null {
  if (!rotates(settings, memberIds)) return null;
  const { system } = settings.rotation;
  const lineup = defaultLineup(memberIds, system, positionOf);
  return lineup.ok
    ? { system, lineup: lineup.value, setterZone: STARTING_SETTER_ZONE, bench: [], libero: null }
    : null;
}

/** The plan keeps the rotation of a team that stays; a new or rebuilt team has none and gets one. */
function rotationOf(input: NextMatchStartInput, side: TeamSide): TeamState | null {
  const { plan } = input;
  return plan.rotations[side] ?? enteringRotation(input, plan.teams[side].memberIds);
}

/**
 * The `MatchStarted` of the next match from the plan of the queue (D7): the teams, the queue and the
 * rotations of the plan, so a team that stays keeps its lineup, bench and setter zone (ADR 0029), and
 * the scoring of the finished match, since screen 08 does not open again. Only `MemberId`s.
 */
export function buildNextMatchStart(input: NextMatchStartInput): MatchStartedPayload {
  const { plan, finished } = input;
  return {
    matchId: input.matchId,
    rulesVersion: CURRENT_RULES_VERSION,
    formationsVersion: FORMATION_CATALOG_VERSION,
    scoring: finished.scoring,
    teams: plan.teams,
    rotations: { a: rotationOf(input, "a"), b: rotationOf(input, "b") },
    firstServer: input.firstServer,
    queue: plan.queue,
  };
}
