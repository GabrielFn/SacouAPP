import type { TeamSide } from "../score/types.js";

/**
 * What the phone that lost the court knows: its own device id and the largest sequence the server
 * stored for it, from the `lastSequence` of the `not-the-writer` refusal (ADR 0063, D8).
 */
export interface RefusedPointsInput {
  readonly deviceId: string;
  readonly lastStoredSequence: number;
}

/** A point screen 09c lists as not stored: the team that scored it ("Ponto do Laranja"). */
export interface RefusedPoint {
  readonly eventId: string;
  readonly team: TeamSide;
}
