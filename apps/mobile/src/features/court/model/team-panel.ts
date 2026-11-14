import {
  getCurrentServingPlayer,
  getSetPointTeams,
  getTeamServeAlignment,
  type MatchScore,
  type MatchSet,
  type ServeAlignment,
  type TeamSide,
} from "@sacou/match-engine";
import { ROTATION_SLOTS } from "@sacou/volley-rules";

import type { CourtRoster } from "../ports/court-roster";
import type { PlayerChipModel, RotationModel, TeamPanelModel } from "./court-screen.types";

const LIBERO_ROLE = "L";
const FREE_SYSTEM = "livre";

interface ChipContext {
  readonly alignment: ServeAlignment;
  readonly serverId: string | null;
  readonly roster: CourtRoster;
}

function buildChips({ alignment, serverId, roster }: ChipContext): readonly PlayerChipModel[] {
  return ROTATION_SLOTS.map((zone) => {
    const { memberId, role, point } = alignment.slots[zone];
    return {
      memberId,
      name: roster.nameOf(memberId),
      displayName: roster.nameOf(memberId),
      zone,
      point,
      isServer: memberId === serverId,
      // The free system has no setter, so no chip wears the badge.
      isSetter: alignment.system !== FREE_SYSTEM && memberId === alignment.actingSetter,
      isLibero: role === LIBERO_ROLE,
    };
  });
}

function rotationOf(match: MatchScore, side: TeamSide): RotationModel | null {
  const state = match.rotations[side];
  return state === null ? null : { system: state.system, setterZone: state.setterZone };
}

/** What one half of the screen shows, all read from the open match (the replay), nothing stored. */
export function buildTeamPanel(
  match: MatchScore,
  set: MatchSet,
  side: TeamSide,
  roster: CourtRoster,
): TeamPanelModel {
  const appearance = roster.teamAppearance(match.matchId, side);
  const isServing = set.servingTeam === side;
  const serverId = isServing ? getCurrentServingPlayer(match) : null;
  const alignment = getTeamServeAlignment(match, side);
  const setPointSides = getSetPointTeams(set.score, set.targetPoints, match.scoring.winMargin);
  return {
    side,
    label: appearance.label,
    color: appearance.color,
    score: set.score[side],
    isServing,
    rotation: rotationOf(match, side),
    hasSetPoint: setPointSides.includes(side),
    serverName: serverId === null ? null : roster.nameOf(serverId),
    chips: alignment === null ? [] : buildChips({ alignment, serverId, roster }),
  };
}
