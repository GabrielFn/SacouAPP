import { SETTER_LINEUP_INDEXES, type MemberId, type TeamState } from "@sacou/match-engine";
import type { FormationSystem } from "@sacou/volley-rules";

import {
  SECOND_SETTER_INDEX,
  SECOND_SETTER_STAND_IN,
  seatByPosition,
  SLOTS_OF,
  standInIndexOf,
  type PositionOf,
  type SlotPosition,
} from "../../draw/model/default-lineup";
import type { LineupDraft } from "./lineup-moves";

/** The position each index asks for: `null` in the free system, which has no roles (D2). */
export function slotPositions(system: FormationSystem): readonly SlotPosition[] | null {
  return system === "livre" ? null : SLOTS_OF[system];
}

/** The positions that never warn: who plays anything, the libero and who has no profile (D4). */
function isRolePosition(position: ReturnType<PositionOf>): position is SlotPosition {
  return (
    position === "setter" ||
    position === "outsideHitter" ||
    position === "middleBlocker" ||
    position === "opposite"
  );
}

/** Someone of the lineup off the setter seats plays setter: then an opposite in `S2` is out of place. */
function hasSpareSetter(draft: TeamState, positionOf: PositionOf): boolean {
  const setterIndexes = SETTER_LINEUP_INDEXES[draft.system];
  return draft.lineup.some(
    (memberId, index) => !setterIndexes.includes(index) && positionOf(memberId) === "setter",
  );
}

/**
 * The members whose main position does not match the role of their index (question 77), in `lineup`
 * order. `S2` takes a setter and, with no spare setter, an opposite, as the default lineup does.
 */
export function misplacedMembers(draft: TeamState, positionOf: PositionOf): readonly MemberId[] {
  const slots = slotPositions(draft.system);
  if (slots === null) return [];
  const standIn = standInIndexOf(draft.system);
  const spare = hasSpareSetter(draft, positionOf);
  return draft.lineup.filter((memberId, index) => {
    const position = positionOf(memberId);
    if (!isRolePosition(position) || position === slots[index]) return false;
    return !(index === standIn && position === SECOND_SETTER_STAND_IN && !spare);
  });
}

/**
 * "Corrigir" (D4): the setter and the zone stay, and the five other seats are filled again by the rule
 * of the default lineup, in the order they are in now. Who has no seat of their position stays where
 * the rule puts them, and may still be out of place.
 */
export function fixRoles(draft: LineupDraft, positionOf: PositionOf): LineupDraft {
  const slots = slotPositions(draft.system);
  const [setter, ...others] = draft.lineup;
  if (slots === null || setter === undefined) return draft;
  const standIn = standInIndexOf(draft.system);
  const seated = seatByPosition(
    others,
    slots.slice(1),
    standIn === null ? null : SECOND_SETTER_INDEX - 1,
    positionOf,
  );
  return seated === null ? draft : { ...draft, lineup: [setter, ...seated] };
}
