import { getServingPlayer } from "../score/rotation-rules.js";
import type { MemberId, PointKind } from "../score/types.js";
import { LIBERO_IMPOSSIBLE_POINT_KINDS, SERVE_POINT_KINDS } from "./constants.data.js";
import type { Rally } from "./types.js";

/**
 * A product decision of the command only, never of the applier nor of the golden, so it is easy to
 * drop (ADR 0031, P1): an ace is only of the server of the rally, so the team that scored must have
 * served, and with its rotation on the author must be in slot 1. The libero never has an ace nor a
 * block. With the rotation off nobody is known to be in slot 1, nor to be the libero.
 */
export function isPlausibleAuthor(
  { match, servingTeam, team }: Rally,
  kind: PointKind,
  author: MemberId,
): boolean {
  const teamState = match.rotations[team];
  if (teamState?.libero?.memberId === author && LIBERO_IMPOSSIBLE_POINT_KINDS.includes(kind)) {
    return false;
  }
  if (!SERVE_POINT_KINDS.includes(kind)) {
    return true;
  }
  if (servingTeam !== team) {
    return false;
  }
  return teamState === null || getServingPlayer(teamState.lineup, teamState.setterZone) === author;
}
