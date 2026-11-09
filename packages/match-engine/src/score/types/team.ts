// Teams of a court session: members, rosters, lineups and the queue.
import type { FormationSystem, SetterZone } from "@sacou/volley-rules";

import type {
  BEST_OF_VALUES,
  END_REASONS,
  POINT_KINDS,
  ROTATION_DIRECTIONS,
  TEAM_SIDES,
  WIN_MARGIN_VALUES,
} from "../constants.data.js";

/** A lowercase UUID. Where this type lives is decided in E3.2. */
export type MemberId = string;

export type TeamSide = (typeof TEAM_SIDES)[number];
export type BestOf = (typeof BEST_OF_VALUES)[number];
export type WinMargin = (typeof WIN_MARGIN_VALUES)[number];
export type MatchEndReason = (typeof END_REASONS)[number];
export type RotationDirection = (typeof ROTATION_DIRECTIONS)[number];
export type PointKind = (typeof POINT_KINDS)[number];

export interface ScoringRules {
  readonly bestOf: BestOf;
  readonly pointsPerSet: number;
  /** `null` turns the tie-break off. */
  readonly tieBreakPoints: number | null;
  /** 2 means advantage; 1 means none. It also applies to the tie-break. */
  readonly winMargin: WinMargin;
}

export interface TeamRoster {
  readonly memberIds: readonly MemberId[];
}

export interface MatchTeams {
  readonly a: TeamRoster;
  readonly b: TeamRoster;
}

/**
 * The libero of a team and the positions it covers, by index of `lineup` and never by `MemberId`: one
 * index, or two on a diagonal in ascending order, never of a setter. Who stands in the court at each
 * moment is derived from `setterZone` and the phase, never recorded (ADR 0028).
 */
export interface TeamLibero {
  readonly memberId: MemberId;
  readonly replacedIndexes: readonly number[];
}

/**
 * The part of a team that changes during a match; `teams` stays the frozen copy of the event.
 * `lineup` has six members anchored on the setter: `lineup[0]` is the setter and the others follow
 * in ascending position, so a rotation only changes `setterZone`. In the free system, which has no
 * setter, `setterZone` is the zone of the first member of the lineup. The order of the lineup also
 * gives each member a role: `S, OH1, MB1, OPP, OH2, MB2` in the 5x1 and `S1, OH1, MB1, S2, OH2, MB2`
 * in the 6x2 and the 4x2 (ADR 0026). `bench` is whoever of the team is not in the lineup, in queue
 * order: only a recorded `LineupChanged` changes it, never a point (ADR 0027). `libero` is outside the
 * lineup and the bench, and `null` turns it off (ADR 0028).
 */
export interface TeamState {
  readonly bench: readonly MemberId[];
  readonly libero: TeamLibero | null;
  readonly lineup: readonly MemberId[];
  readonly setterZone: SetterZone;
  readonly system: FormationSystem;
}

/** `null` turns the rotation off for that team: a team without six players has it off. */
export interface TeamRotations {
  readonly a: TeamState | null;
  readonly b: TeamState | null;
}

export interface SetterZones {
  readonly a: SetterZone | null;
  readonly b: SetterZone | null;
}

/**
 * Who waits for the court, in order: whole teams first, then single players by arrival. A member is
 * in it once, and never in a team on the court (ADR 0029).
 */
export interface TeamQueue {
  readonly players: readonly MemberId[];
  readonly teams: readonly TeamRoster[];
}

/** Who stands where in a team: what a change of lineup records. `system` does not change. */
export type LineupAllocation = Pick<TeamState, "bench" | "libero" | "lineup" | "setterZone">;
