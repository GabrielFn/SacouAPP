import type { MemberId, TeamSide } from "@sacou/match-engine";
import type { FormationPhase } from "@sacou/volley-rules";

import type { TeamColorName } from "../../../theme/team-colors";
import type { PositionOf } from "../../draw/model/default-lineup";
import type { LineupBase } from "./lineup-editor.reducer";

/** One team as its host gives it to screen 22 (D1): the pre-game (08) or the match (menu 23). */
export interface LineupTeamSource {
  readonly side: TeamSide;
  readonly name: string;
  readonly color: TeamColorName;
  /** How many the team has: the count of the line without rotation. */
  readonly size: number;
  /** `null` for a team without rotation: the tab only says so. */
  readonly base: LineupBase | null;
  /**
   * `serving` for the team that serves first (pre-game) or serves now (match); `null` between sets,
   * when who serves next is not known yet (E4.8, D7).
   */
  readonly phase: FormationPhase | null;
  /**
   * Who can be the libero in the pre-game: the reserves of the queue, in order. In a match the pool is
   * the bench of the draft, so a libero turned off can come back (`liberoExit: "bench"`, D5).
   */
  readonly liberoPool: readonly MemberId[];
  /**
   * Who can wait on the bench of the team in the pre-game: the reserves of the queue, in order (R96).
   * `null` in a match, where the bench cannot take anyone from the queue.
   */
  readonly benchPool: readonly MemberId[] | null;
  /** What the "Líbero" row says with nobody to choose. */
  readonly noLiberoText: string;
}

/** What screen 22 reads from its host, without knowing which one it is (D1). No level ever comes. */
export interface LineupSource {
  readonly subtitle: string;
  readonly teams: Readonly<Record<TeamSide, LineupTeamSource>>;
  readonly nameOf: (memberId: MemberId) => string;
  readonly positionOf: PositionOf;
}

export const LINEUP_SIDES: readonly TeamSide[] = ["a", "b"];

/** The bases of the teams that rotate, in the order of the tabs. */
export function basesOf(source: LineupSource): readonly LineupBase[] {
  return LINEUP_SIDES.flatMap((side) => {
    const base = source.teams[side].base;
    return base === null ? [] : [base];
  });
}
