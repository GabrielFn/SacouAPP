import type { Result, SetterZone } from "@sacou/volley-rules";

import type { REVERTED_TO_EVENT_TYPE } from "../event-log/constants.data.js";
import type { ReplayedTimeline } from "../event-log/types.js";
import type {
  CourtSessionState,
  MemberId,
  PointKind,
  SetScore,
  TeamSide,
} from "../score/types.js";

/** The replayed log of a court session, with the state after each active event. */
export type CourtSessionTimeline = ReplayedTimeline<CourtSessionState>;

export interface RevertedToPayload {
  readonly targetEventId: string;
}

/** An event without an envelope: `eventId` and `sequence` come from outside the pure engine. */
export interface RevertDraft {
  readonly type: typeof REVERTED_TO_EVENT_TYPE;
  readonly payload: RevertedToPayload;
}

export type CorrectionRefusalCode = "invalid-revert-target" | "no-open-match" | "nothing-to-undo";

/** Carries only a code, never the received event id. */
export interface CorrectionError {
  readonly code: CorrectionRefusalCode;
}

export type CorrectionCommandResult = Result<readonly RevertDraft[], CorrectionError>;

/**
 * A line of screen 24. Who served and which team served are the ones **before** the point; the
 * score is the one after it. `setterZone` is the zone the winner rotated to on a side-out, and
 * `null` without a side-out or with its rotation off. `servingPlayer` is `null` with the rotation
 * of the serving team off. `author` and `kind` are who scored it and how, by the last valid
 * `PointAttributed`: both `null` without an answer, and only `author` for an error of the opponent.
 */
export interface RecentPoint {
  readonly eventId: string;
  readonly team: TeamSide;
  readonly score: SetScore;
  readonly servingTeam: TeamSide;
  readonly servingPlayer: MemberId | null;
  readonly sideOut: boolean;
  readonly setterZone: SetterZone | null;
  readonly author: MemberId | null;
  readonly kind: PointKind | null;
}

export interface SetSnapshot {
  readonly setNumber: number;
  readonly score: SetScore;
}

/** A team whose rotation the revert changes, from the current zone to the zone after it. */
export interface RotationChange {
  readonly team: TeamSide;
  readonly from: SetterZone;
  readonly to: SetterZone;
}

export type RemovedActionKey =
  | "points"
  | "lineupChanges"
  | "queueChanges"
  | "servingChanges"
  | "setEnds"
  | "attributions";

/** How many actions leave the timeline. Nothing is erased from the log: a revert only appends. */
export type RemovedActions = Readonly<Record<RemovedActionKey, number>>;

/**
 * What the dialog of screen 24 shows before going back: the set now and after the revert, who serves
 * after it, the teams whose rotation changes, and what leaves the timeline. A closed set is `null`.
 */
export interface RevertPreview {
  readonly targetEventId: string;
  readonly current: SetSnapshot | null;
  readonly reverted: SetSnapshot | null;
  readonly servingTeam: TeamSide | null;
  readonly servingPlayer: MemberId | null;
  readonly rotationChanges: readonly RotationChange[];
  readonly removed: RemovedActions;
}
