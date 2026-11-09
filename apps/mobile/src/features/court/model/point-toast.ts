import {
  POINT_SCORED_EVENT_TYPE,
  type CourtSessionTimeline,
  type TeamSide,
} from "@sacou/match-engine";

/** The point that is the last active event of the log, with the score right after it. */
export interface LastPoint {
  readonly side: TeamSide;
  /** Points of the team that scored, then of the other one. */
  readonly own: number;
  readonly other: number;
}

function sideOf(value: unknown): TeamSide | null {
  return value === "a" || value === "b" ? value : null;
}

/** `null` unless the last active event is a `PointScored`: an undo or a set end shows no toast. */
export function selectLastPoint(timeline: CourtSessionTimeline): LastPoint | null {
  const last = timeline.entries.at(-1);
  if (last?.event.type !== POINT_SCORED_EVENT_TYPE) {
    return null;
  }
  const side = sideOf(last.event.payload.team);
  const score = last.state.currentMatch?.currentSet?.score;
  if (side === null || score === undefined) {
    return null;
  }
  return { side, own: score[side], other: score[side === "a" ? "b" : "a"] };
}
