import { resolvePointAttributions } from "../attributions/resolve.js";
import type { PointAttribution } from "../attributions/types.js";
import type { CourtSessionTimeline } from "../corrections/types.js";
import type { MemberId, PointKind } from "../score/types.js";
import { groupByMatch, tally } from "./by-match.js";
import { CREDITED_POINT_KINDS } from "./constants.data.js";
import type { CreditedPointKind, PointsByKind } from "./types.js";

export const NO_POINTS: PointsByKind = { attack: 0, block: 0, ace: 0, other: 0 };

function isCreditedPointKind(kind: PointKind): kind is CreditedPointKind {
  return (CREDITED_POINT_KINDS as readonly PointKind[]).includes(kind);
}

function creditAuthor(
  { author, kind }: PointAttribution,
  points: ReadonlyMap<MemberId, PointsByKind>,
): readonly (readonly [MemberId, PointsByKind])[] {
  if (author === null || !isCreditedPointKind(kind)) {
    return [];
  }
  const current = points.get(author) ?? NO_POINTS;
  return [[author, { ...current, [kind]: current[kind] + 1 }]];
}

/**
 * The points each member scored, by kind and by match: every match with an attribution, the open
 * one too, so the caller keeps only the finished ones. Only a resolved attribution counts, the last
 * valid one of each active point (ADR 0031); an error of the opponent has no author.
 */
export function getPointsByMatch(
  timeline: CourtSessionTimeline,
): ReadonlyMap<string, ReadonlyMap<MemberId, PointsByKind>> {
  const attributions = resolvePointAttributions(timeline);
  return new Map(
    [...groupByMatch(attributions)].map(([matchId, ofMatch]) => [
      matchId,
      tally(ofMatch, creditAuthor),
    ]),
  );
}
