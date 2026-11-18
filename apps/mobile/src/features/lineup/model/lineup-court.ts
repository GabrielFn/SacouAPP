import {
  getServeAlignment,
  getServingPlayer,
  SETTER_LINEUP_INDEXES,
  type MemberId,
  type ServeAlignment,
} from "@sacou/match-engine";
import { ROTATION_SLOTS, type FormationPhase, type RotationSlot } from "@sacou/volley-rules";

import { lineupStrings } from "../../../strings/lineup.pt-BR";
import { placeOnHalfCourt, type ScreenPlace } from "../../court/model/court-geometry";
import type { LineupDraft } from "./lineup-moves";

const { chip: texts } = lineupStrings;

const LIBERO_ROLE = "L";
const SERVING_SLOT: RotationSlot = 1;
/** The canvas draws the net below the team, as the admin looks from the net (Escalacao.dc.html). */
const NET_BELOW = "top";

/** One member on the half court of screen 22 (D2), all read from the engine's alignment. */
export interface LineupChip {
  readonly memberId: MemberId;
  readonly name: string;
  readonly slot: RotationSlot;
  /** In percent of the square, the net below it; the server stands above it (negative `y`). */
  readonly place: ScreenPlace;
  readonly isServer: boolean;
  readonly isSetter: boolean;
  readonly isLibero: boolean;
  readonly isMisplaced: boolean;
  readonly isSelected: boolean;
  /** "João, posição 1, sacando" (Escalacao.dc.html). */
  readonly accessibilityLabel: string;
}

export interface ChipContext {
  readonly draft: LineupDraft;
  readonly phase: FormationPhase;
  readonly misplaced: readonly MemberId[];
  readonly selection: MemberId | null;
  readonly nameOf: (memberId: MemberId) => string;
}

/** Who serves: slot 1 of the team that serves; `null` for the team that receives. */
export function serverOf(draft: LineupDraft, phase: FormationPhase): MemberId | null {
  return phase === "serving" ? getServingPlayer(draft.lineup, draft.setterZone) : null;
}

/** The lineup indexes of the setters: one in the 5x1, two in the 6x2 and the 4x2, none in the free. */
export function isSetterOf(draft: LineupDraft, memberId: MemberId): boolean {
  return SETTER_LINEUP_INDEXES[draft.system].includes(draft.lineup.indexOf(memberId));
}

function chipLabel(name: string, slot: RotationSlot, flags: readonly (string | null)[]): string {
  const parts = [name, texts.position(slot), ...flags];
  return parts.filter((part): part is string => part !== null).join(texts.separator);
}

function chipOf(context: ChipContext, alignment: ServeAlignment, slot: RotationSlot): LineupChip {
  const { draft, phase, misplaced, selection, nameOf } = context;
  const { memberId, role, point } = alignment.slots[slot];
  const isLibero = role === LIBERO_ROLE;
  const isServer = !isLibero && phase === "serving" && slot === SERVING_SLOT;
  const isSetter = !isLibero && isSetterOf(draft, memberId);
  const isMisplaced = !isLibero && misplaced.includes(memberId);
  const name = nameOf(memberId);
  return {
    memberId,
    name,
    slot,
    place: placeOnHalfCourt(point, NET_BELOW),
    isServer,
    isSetter,
    isLibero,
    isMisplaced,
    isSelected: memberId === selection,
    accessibilityLabel: isLibero
      ? [name, texts.libero].join(texts.separator)
      : chipLabel(name, slot, [
          isServer ? texts.serving : null,
          isSetter ? texts.setter : null,
          isMisplaced ? texts.misplaced : null,
        ]),
  };
}

/** The six chips at the moment of the serve: the libero in the slot the engine gives it (D2, D5). */
export function courtChips(context: ChipContext): readonly LineupChip[] {
  const alignment = getServeAlignment(context.draft, context.phase);
  return ROTATION_SLOTS.map((slot) => chipOf(context, alignment, slot));
}
