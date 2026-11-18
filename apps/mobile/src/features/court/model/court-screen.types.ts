import type { MemberId, TeamSide } from "@sacou/match-engine";
import type { CourtPoint, FormationSystem, RotationSlot } from "@sacou/volley-rules";

import type { TeamColorName } from "../../../theme/team-colors";
import type { HintLine } from "./hint-line";
import type { WinStreak } from "./win-streak";

/**
 * `playing` is the court; `set-decided` waits for the confirmation of the set; `match-pending` is a
 * match whose deciding `SetEnded` is stored without its `MatchEnded` (a confirmation stored half);
 * the others have no court.
 */
export type CourtPhase = "no-match" | "playing" | "set-decided" | "match-pending" | "match-ended";

export interface PlayerChipModel {
  readonly memberId: MemberId;
  /** The full name, for the screen reader. */
  readonly name: string;
  /** What the chip draws: the first name, or "Ana C." when another player has the same one. */
  readonly displayName: string;
  readonly zone: RotationSlot;
  readonly point: CourtPoint;
  readonly isServer: boolean;
  readonly isSetter: boolean;
  /** The libero stands in this slot: the chip has inverted colors and the "Lí" badge (pergunta 14). */
  readonly isLibero: boolean;
}

export interface RotationModel {
  readonly system: FormationSystem;
  readonly setterZone: RotationSlot;
}

export interface TeamPanelModel {
  readonly side: TeamSide;
  readonly label: string;
  readonly color: TeamColorName;
  readonly score: number;
  readonly isServing: boolean;
  /** `null` when the rotation of this team is off: the court shows the phase and no chips. */
  readonly rotation: RotationModel | null;
  readonly hasSetPoint: boolean;
  readonly serverName: string | null;
  readonly chips: readonly PlayerChipModel[];
}

/** One dot per set played or in play; `winner` is `null` while the set is open. */
export interface SetDotModel {
  readonly winner: TeamSide | null;
}

export interface QueuedPlayerModel {
  readonly memberId: MemberId;
  /** The full name, for the screen reader. */
  readonly name: string;
  /** What the pill draws (see `PlayerChipModel.displayName`). */
  readonly displayName: string;
}

export interface QueuedTeamModel {
  /** The first member of the team, which a member can be in one place of the queue only (ADR 0029). */
  readonly key: MemberId;
  readonly players: readonly QueuedPlayerModel[];
}

export interface QueueModel {
  /** Whole teams waiting. */
  readonly teams: readonly QueuedTeamModel[];
  /** Players waiting alone, the reserves. */
  readonly players: readonly QueuedPlayerModel[];
  /** `partial` when there are only loose players: they come in for part of the losing team. */
  readonly exit: "partial" | "full";
}

export interface CourtScreenModel {
  readonly phase: CourtPhase;
  readonly setNumber: number;
  readonly dots: readonly SetDotModel[];
  readonly teams: Readonly<Record<TeamSide, TeamPanelModel>>;
  readonly queue: QueueModel | null;
  readonly streak: (WinStreak & { readonly label: string }) | null;
  readonly hint: HintLine;
  readonly canUndo: boolean;
}

/** What screen 25 shows: the set that was decided and what its confirmation does. */
export interface SetEndModel {
  readonly setNumber: number;
  readonly winner: TeamSide;
  readonly winnerLabel: string;
  readonly scores: Readonly<Record<TeamSide, { readonly label: string; readonly score: number }>>;
  /** The sets of each team once this one is confirmed. */
  readonly setsAfter: Readonly<Record<TeamSide, number>>;
  /** The deciding set of a series needs the toss: who serves first. */
  readonly needsFirstServer: boolean;
  /** Who serves first in the next set (it alternates); `null` with the toss or when the match ends. */
  readonly nextFirstServer: TeamSide | null;
  /** The confirmation ends the match: "Confirmar fim da partida". */
  readonly endsMatch: boolean;
  /** The `SetEnded` of the deciding set is stored and only the `MatchEnded` is missing. */
  readonly pendingMatchEnd: boolean;
}

export interface MatchEndModel {
  readonly winnerLabel: string | null;
  readonly sets: readonly { readonly setNumber: number; readonly a: number; readonly b: number }[];
}
