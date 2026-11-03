import { getOnCourtBySlot } from "./rotation-rules.js";
import type { MatchScore, MemberId, TeamSide } from "./types.js";

/**
 * Who of `team` stood on the court in a rally, from the match right **before** the point and the
 * team that served it: the libero included when the projection puts it in, the bench never. With the
 * rotation of that team off there is no bench, so anyone of the team (ADR 0028, ADR 0031).
 */
export function onCourtInTheRally(
  match: MatchScore,
  servingTeam: TeamSide,
  team: TeamSide,
): readonly MemberId[] {
  const teamState = match.rotations[team];
  if (teamState === null) {
    return match.teams[team].memberIds;
  }
  return getOnCourtBySlot(teamState, servingTeam === team ? "serving" : "receiving");
}
