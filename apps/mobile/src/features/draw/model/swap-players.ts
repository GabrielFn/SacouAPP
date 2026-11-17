import type { MemberId } from "@sacou/match-engine";

import { placeOf, type DrawArrangement, type DrawPlace } from "./draw-arrangement";

function replaced(
  members: readonly MemberId[],
  index: number,
  memberId: MemberId,
): readonly MemberId[] {
  return members.map((current, at) => (at === index ? memberId : current));
}

function put(arrangement: DrawArrangement, place: DrawPlace, memberId: MemberId): DrawArrangement {
  if (place.kind === "reserve") {
    return { ...arrangement, reserves: replaced(arrangement.reserves, place.index, memberId) };
  }
  return {
    ...arrangement,
    teams: arrangement.teams.map((members, team) =>
      team === place.team ? replaced(members, place.index, memberId) : members,
    ),
  };
}

function sameTeam(first: DrawPlace, second: DrawPlace): boolean {
  return first.kind === "team" && second.kind === "team" && first.team === second.team;
}

/**
 * "Trocar" of screen 07: each one takes the place of the other, team by team or team and queue, so who
 * goes to the reserves takes the place in the queue of who came out. Two of the same team, or someone
 * not in the draw, change nothing. Pure: the arrangement passed in is never changed.
 */
export function swapPlayers(
  arrangement: DrawArrangement,
  first: MemberId,
  second: MemberId,
): DrawArrangement {
  const firstPlace = placeOf(arrangement, first);
  const secondPlace = placeOf(arrangement, second);
  if (firstPlace === null || secondPlace === null || first === second) return arrangement;
  if (sameTeam(firstPlace, secondPlace)) return arrangement;
  return put(put(arrangement, firstPlace, second), secondPlace, first);
}
