import type { Result } from "@sacou/volley-rules";

import type {
  MatchScore,
  MemberId,
  PointKind,
  ScoreEventDraft,
  ScorePayloadError,
  TeamSide,
} from "../score/types.js";

/**
 * Who scored an active point, and how, by the last valid `PointAttributed` that points at it. Only
 * IDs: the screens and the statistics find the names elsewhere.
 */
export interface PointAttribution {
  readonly pointEventId: string;
  readonly matchId: string;
  readonly setNumber: number;
  readonly team: TeamSide;
  readonly kind: PointKind;
  readonly author: MemberId | null;
}

/** The answer to "De quem foi?": `author` is `null` only for an error of the opponent. */
export interface PointAuthorship {
  readonly kind: PointKind;
  readonly author: MemberId | null;
}

/**
 * The rally of a recorded point, read from the state right **before** it: the match then, the team
 * that scored and the team that served.
 */
export interface Rally {
  readonly match: MatchScore;
  readonly team: TeamSide;
  readonly servingTeam: TeamSide;
}

export type AttributionRefusalCode =
  "invalid-attribution-target" | "invalid-point-author" | "invalid-point-kind" | "no-open-match";

/** Carries only a code, never the received event id, kind or author. */
export type AttributionError = ScorePayloadError | { readonly code: AttributionRefusalCode };

export type AttributionCommandResult = Result<readonly ScoreEventDraft[], AttributionError>;
