import type { ScaledTokens } from "../../../theme/scale";
import {
  CHIP_CHAR_WIDTH_EM,
  CHIP_MAX_WIDTH_RATIOS,
  CHIP_NUMBER_DIGITS,
  COLUMN_LINE_HEIGHT_EM,
} from "../court.data";
import { placeChips, type ChipSpec, type PlacementFrame, type Rect } from "./chip-placement";
import type { CourtEnd } from "./court-geometry";
import type { CourtLayout } from "./court-layout";
import type { PlayerChipModel, TeamPanelModel } from "./court-screen.types";
import { scoreTextSize } from "./score-display";

const HALF = 2;
const BOTH_SIDES = 2;
const BOTTOM_ALIGNED_ENDS: readonly CourtEnd[] = ["right", "bottom"];

/** A chip ready to draw: its center in pixels from the corner of the square, and its width. */
export interface DrawnChip {
  readonly chip: PlayerChipModel;
  readonly x: number;
  readonly y: number;
  readonly width: number;
}

export interface TeamChipsInput {
  readonly panel: TeamPanelModel;
  readonly layout: CourtLayout;
  readonly tokens: ScaledTokens;
  readonly end: CourtEnd;
}

function hasBadge(chip: PlayerChipModel): boolean {
  return chip.isSetter || chip.isLibero;
}

/** The widest a chip gets, from the side of its square: longer names end in "…". */
export function chipMaxWidth(layout: CourtLayout): number {
  return layout.halfCourtSide * CHIP_MAX_WIDTH_RATIOS[layout.kind];
}

/**
 * The width of a chip without measuring the text after it is drawn: padding, borders, the name at
 * an average letter width, the number of the position and the ball of the server, never more than
 * `chipMaxWidth`. The chip is drawn with this width, so what is placed is what is seen.
 */
export function chipWidth(chip: PlayerChipModel, input: Pick<TeamChipsInput, "layout" | "tokens">): number {
  const { tokens, layout } = input;
  const { sizes, spacing, fontSizes } = tokens.court;
  const frame = (spacing.chipPadding + tokens.borderWidths.thick) * BOTH_SIDES;
  const name = [...chip.displayName].length * tokens.fontSizes.caption * CHIP_CHAR_WIDTH_EM;
  const number = CHIP_NUMBER_DIGITS * fontSizes.chipNumber * CHIP_CHAR_WIDTH_EM;
  const ball = chip.isServer ? sizes.ballIcon + tokens.spacing.xs : 0;
  const natural = frame + ball + name + tokens.spacing.xs + number;
  return Math.min(natural, chipMaxWidth(layout));
}

/** The height of the team column, from its lines: it is the part of the zone the chips keep clear of. */
export function columnHeight({ panel, layout, tokens }: Omit<TeamChipsInput, "end">): number {
  const { sizes, spacing } = tokens.court;
  const line = tokens.fontSizes.caption * COLUMN_LINE_HEIGHT_EM;
  const score = scoreTextSize({
    zoneHeight: layout.zoneHeight,
    sideWidth: layout.sideWidth,
    score: panel.score,
    scoreZoneRatio: layout.scoreZoneRatio,
  }).lineHeight;
  const indicator = panel.hasSetPoint ? tokens.spacing.xs + sizes.tag : tokens.spacing.s6 + line;
  const rotation =
    panel.rotation === null ? 0 : (panel.hasSetPoint ? tokens.spacing.xs : 0) + line;
  return sizes.tag + spacing.scoreGap + score + indicator + rotation;
}

/** How far the column starts from the edge of the zone it sits at (the top or the bottom). */
export function columnOffset(layout: CourtLayout, tokens: ScaledTokens): number {
  return layout.kind === "landscape" ? tokens.spacing.s : tokens.spacing.s14;
}

export interface SquareOrigin {
  readonly x: number;
  readonly y: number;
}

/** Where the top left corner of the half court square is in its zone, in pixels. */
export function squareOrigin(layout: CourtLayout, end: CourtEnd): SquareOrigin {
  const { zoneWidth, zoneHeight, halfCourtSide, edgeInset } = layout;
  if (layout.kind === "landscape") {
    return { x: end === "left" ? zoneWidth - halfCourtSide : 0, y: (zoneHeight - halfCourtSide) / HALF };
  }
  return { x: zoneWidth - edgeInset - halfCourtSide, y: end === "top" ? zoneHeight - halfCourtSide : 0 };
}

/** Where the column of the team stands in its zone, in pixels from the corner of the zone. */
function columnRectInZone(input: TeamChipsInput): Rect {
  const { layout, tokens, end } = input;
  const height = columnHeight(input);
  const offset = columnOffset(layout, tokens);
  const onRight = end === "right";
  const left = onRight ? layout.zoneWidth - layout.edgeInset - layout.sideWidth : layout.edgeInset;
  const top = BOTTOM_ALIGNED_ENDS.includes(end) ? layout.zoneHeight - offset - height : offset;
  return { left, top, right: left + layout.sideWidth, bottom: top + height };
}

function shifted(rect: Rect, origin: SquareOrigin): Rect {
  return {
    left: rect.left - origin.x,
    right: rect.right - origin.x,
    top: rect.top - origin.y,
    bottom: rect.bottom - origin.y,
  };
}

/** The frame of one team: the zone, ending at the net, and the column to stay out of. */
export function placementFrame(input: TeamChipsInput): PlacementFrame {
  const { layout, end, tokens } = input;
  const origin = squareOrigin(layout, end);
  const zone = shifted({ left: 0, top: 0, right: layout.zoneWidth, bottom: layout.zoneHeight }, origin);
  const side = layout.halfCourtSide;
  const net: Partial<Rect> = {
    left: { right: side },
    right: { left: 0 },
    top: { bottom: side },
    bottom: { top: 0 },
  }[end];
  return {
    end,
    side,
    bounds: { ...zone, ...net },
    column: shifted(columnRectInZone(input), origin),
    gap: tokens.court.spacing.chipGap,
  };
}

/** Places the six chips of a team, or the seven with a libero, without any covering another. */
export function layoutTeamChips(input: TeamChipsInput): readonly DrawnChip[] {
  const { panel, tokens } = input;
  const { sizes, spacing } = tokens.court;
  const widths = new Map(panel.chips.map((chip) => [chip.memberId, chipWidth(chip, input)]));
  const specs = panel.chips.map<ChipSpec>((chip) => ({
    id: chip.memberId,
    point: chip.point,
    halfWidth: (widths.get(chip.memberId) ?? 0) / HALF + (hasBadge(chip) ? spacing.badgeOffsetX : 0),
    halfHeight: sizes.chip / HALF + (hasBadge(chip) ? spacing.badgeOffsetY : 0),
  }));
  const placed = new Map(placeChips(placementFrame(input), specs).map((chip) => [chip.id, chip]));
  return panel.chips.flatMap((chip) => {
    const at = placed.get(chip.memberId);
    return at === undefined ? [] : [{ chip, x: at.x, y: at.y, width: widths.get(chip.memberId) ?? 0 }];
  });
}
