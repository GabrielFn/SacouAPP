import type { MemberId, TeamSide } from "@sacou/match-engine";
import type { CourtPoint, FormationSystem, RotationSlot } from "@sacou/volley-rules";

import type { TeamColorName } from "../../../theme/team-colors";
import type { HintLine } from "./hint-line";
import type { WinStreak } from "./win-streak";

/** `playing` is the court; `set-decided` waits for the confirmation of the set; the others have no court. */
export type CourtPhase = "no-match" | "playing" | "set-decided" | "match-ended";

export interface PlayerChipModel {
  readonly memberId: MemberId;
  readonly name: string;
  readonly zone: RotationSlot;
  readonly point: CourtPoint;
  readonly isServer: boolean;
  readonly isSetter: boolean;
  /** The libero stands in this slot. The screen draws it in part 4 of E4.9 (pergunta 14). */
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
  readonly name: string;
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

/** What the placeholder of the end of the set shows (screen 25 is E4.10). */
export interface SetEndModel {
  readonly setNumber: number;
  readonly winnerLabel: string;
  readonly scores: Readonly<Record<TeamSide, { readonly label: string; readonly score: number }>>;
  /** The deciding set of a series needs the toss: who serves first. */
  readonly needsFirstServer: boolean;
}

export interface MatchEndModel {
  readonly winnerLabel: string | null;
  readonly sets: readonly { readonly setNumber: number; readonly a: number; readonly b: number }[];
}
