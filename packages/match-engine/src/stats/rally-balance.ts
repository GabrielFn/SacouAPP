import type { CourtSessionTimeline } from "../corrections/types.js";
import type { TimelineEntry } from "../event-log/types.js";
import { POINT_SCORED_EVENT_TYPE, TEAM_SIDES } from "../score/constants.data.js";
import { onCourtInTheRally } from "../score/on-court.js";
import { parsePointScoredPayload } from "../score/parse-payloads.js";
import type { CourtSessionState, MemberId, TeamSide } from "../score/types.js";
import { groupByMatch, tally } from "./by-match.js";
import type { CourtBalance } from "./types.js";

type Entry = TimelineEntry<CourtSessionState>;

/** Who stood on each side of the court in a rally, and the side that won it. */
export interface PlayedRally {
  readonly matchId: string;
  readonly team: TeamSide;
  readonly onCourt: Readonly<Record<TeamSide, readonly MemberId[]>>;
}

export const NO_BALANCE: CourtBalance = { pointsFor: 0, pointsAgainst: 0 };

/**
 * The rally of an active point, from the state right **before** it: the court and the serve of that
 * moment, never the ones after the side-out (ADR 0032).
 */
function playedRallyOf(before: Entry | undefined, { event }: Entry): readonly PlayedRally[] {
  if (event.type !== POINT_SCORED_EVENT_TYPE) {
    return [];
  }
  const parsed = parsePointScoredPayload(event.payload);
  const match = before?.state.currentMatch ?? null;
  const set = match?.currentSet ?? null;
  if (!parsed.ok || match === null || set === null || match.matchId !== parsed.value.matchId) {
    return [];
  }
  const onCourtOf = (side: TeamSide) => onCourtInTheRally(match, set.servingTeam, side);
  return [
    {
      matchId: match.matchId,
      team: parsed.value.team,
      onCourt: { a: onCourtOf("a"), b: onCourtOf("b") },
    },
  ];
}

function credit(balance: CourtBalance, won: boolean): CourtBalance {
  return won
    ? { ...balance, pointsFor: balance.pointsFor + 1 }
    : { ...balance, pointsAgainst: balance.pointsAgainst + 1 };
}

function creditsOf(
  { team, onCourt }: PlayedRally,
  balances: ReadonlyMap<MemberId, CourtBalance>,
): readonly (readonly [MemberId, CourtBalance])[] {
  return TEAM_SIDES.flatMap((side) =>
    onCourt[side].map(
      (memberId) =>
        [memberId, credit(balances.get(memberId) ?? NO_BALANCE, side === team)] as const,
    ),
  );
}

/**
 * Every active rally of the timeline, in order, the open match too: a reverted point is not on the
 * timeline. One pass over the entries.
 */
export function getPlayedRallies({ entries }: CourtSessionTimeline): readonly PlayedRally[] {
  return entries.flatMap((entry, index) => playedRallyOf(entries[index - 1], entry));
}

/**
 * Points for and against each member while on the court, by match: every match with a point, the
 * open one too, so the caller keeps only the finished ones.
 */
export function getCourtBalancesByMatch(
  timeline: CourtSessionTimeline,
): ReadonlyMap<string, ReadonlyMap<MemberId, CourtBalance>> {
  const rallies = getPlayedRallies(timeline);
  return new Map(
    [...groupByMatch(rallies)].map(([matchId, played]) => [matchId, tally(played, creditsOf)]),
  );
}
