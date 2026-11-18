import type { GroupSettings } from "@sacou/match-engine";

import type { PositionOf } from "../../draw/model/default-lineup";
import type { ArrivalEntry } from "../next-match/next-match-input";
import type { CourtSessionOrigin } from "./court-event-log";

/** What screen 11 needs of the round of the session to plan the next match (E4.10, D7). */
export interface CourtRound {
  /** The resolved settings of the round; `null` when the round is not on the phone or does not parse. */
  readonly settings: GroupSettings | null;
  /** The confirmed of the round in order of arrival (`going` and `promoted`). */
  readonly confirmed: readonly ArrivalEntry[];
  /** The position of each member, for the default lineup of a team that comes in. */
  readonly positionOf: PositionOf;
}

/**
 * The court is offline by design (E4.9): it reads the round from what the phone already has, the
 * persisted cache, and never asks the network. The real one reads the TanStack cache.
 */
export interface CourtRoundSource {
  read(origin: CourtSessionOrigin): CourtRound;
}
