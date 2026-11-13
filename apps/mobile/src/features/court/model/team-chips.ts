import type { ScaledTokens } from "../../../theme/scale";
import {
  CHIP_CHAR_WIDTH_EM,
  CHIP_ELLIPSIS_WIDTH_EM,
  CHIP_UPPER_CHAR_WIDTH_EM,
  CHIP_WIDE_CHAR_WIDTH_EM,
  CHIP_MAX_WIDTH_RATIOS,
  CHIP_NUMBER_DIGITS,
  CHIP_SAFE_NAME_LETTERS,
  CHIP_ZONE_MARGIN,
  COLUMN_LINE_HEIGHT_EM,
  HALF,
} from "../court.data";
import { placeChips, type ChipSpec, type PlacementFrame, type Rect } from "./chip-placement";
import type { CourtEnd } from "./court-geometry";
import type { CourtLayout } from "./court-layout";
import type { PlayerChipModel, TeamPanelModel } from "./court-screen.types";
import { scoreTextSize } from "./score-display";

const BOTH_SIDES = 2;
const BOTTOM_ALIGNED_ENDS: readonly CourtEnd[] = ["right", "bottom"];

/** A chip ready to draw: its center in pixels from the corner of the square, and its width. */
export interface DrawnChip {
  readonly chip: PlayerChipModel;
  readonly x: number;
  readonly y: number;
  readonly width: number;
  /** The text of the name as drawn: the display name, or shortened to end in "…" when it does not fit. */
  readonly label: string;
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

/** What a chip is made of besides the name: padding, borders, the ball of the server, the gap and the number. */
function chipAround(tokens: ScaledTokens, isServer: boolean): number {
  const { sizes, spacing, fontSizes } = tokens.court;
  const frame = (spacing.chipPadding + tokens.borderWidths.thick) * BOTH_SIDES;
  const number = CHIP_NUMBER_DIGITS * fontSizes.chipNumber * CHIP_CHAR_WIDTH_EM;
  const ball = isServer ? sizes.ballIcon + tokens.spacing.xs : 0;
  return frame + ball + tokens.spacing.xs + number;
}

/**
 * The widest a chip gets, from the side of its square: longer names end in "…". It never falls
 * below the room of a name of `CHIP_SAFE_NAME_LETTERS` letters on the chip of the server.
 */
export function chipMaxWidth(layout: CourtLayout, tokens: ScaledTokens): number {
  const widest = (CHIP_SAFE_NAME_LETTERS - 1) * CHIP_CHAR_WIDTH_EM + CHIP_WIDE_CHAR_WIDTH_EM;
  const safe = chipAround(tokens, true) + widest * tokens.fontSizes.caption;
  return Math.max(layout.halfCourtSide * CHIP_MAX_WIDTH_RATIOS[layout.kind], safe);
}

const ELLIPSIS = "…";
/** A short name is an initial and a dot: "Ana C." (a longer last word is not an abbreviation). */
const ABBREVIATION = /^(.+) (\p{L}\.)$/u;
const WIDE_LETTERS = /^[MWmw]$/u;
const UPPER_LETTER = /^\p{Lu}$/u;

/** The font size of the name on a chip: the one the chip draws and the one its width is worked out with. */
export function chipNameFontSize(tokens: ScaledTokens): number {
  return tokens.fontSizes.caption;
}

function letterEm(letter: string): number {
  if (letter === ELLIPSIS) return CHIP_ELLIPSIS_WIDTH_EM;
  if (WIDE_LETTERS.test(letter)) return CHIP_WIDE_CHAR_WIDTH_EM;
  return UPPER_LETTER.test(letter) ? CHIP_UPPER_CHAR_WIDTH_EM : CHIP_CHAR_WIDTH_EM;
}

/** The width of a text in ems of its font: wide and upper case letters and the "…" count more. */
export function textWidthInEm(text: string): number {
  return Array.from(text).reduce((sum, letter) => sum + letterEm(letter), 0);
}

/** The width of a text on a chip; the chip draws with this same measure and font size. */
export function chipTextWidth(text: string, tokens: ScaledTokens): number {
  return textWidthInEm(text) * chipNameFontSize(tokens);
}

/** The longest start of the text that, with the "…", fits the room (at least one letter). */
function shortened(text: string, room: number, tokens: ScaledTokens): string {
  const letters = Array.from(text);
  const fits = (count: number) =>
    chipTextWidth(`${letters.slice(0, count).join("")}${ELLIPSIS}`, tokens) <= room;
  const count = letters.reduce((best, _, index) => (fits(index + 1) ? index + 1 : best), 1);
  return `${letters.slice(0, count).join("")}${ELLIPSIS}`;
}

/**
 * The name as drawn within `room` pixels: whole when it fits; otherwise "…" ends it. An abbreviation
 * ("Ana C.") keeps its last word whole and shortens the first name before it, never the initial.
 */
export function fitName(name: string, room: number, tokens: ScaledTokens): string {
  if (chipTextWidth(name, tokens) <= room) {
    return name;
  }
  const parts = ABBREVIATION.exec(name);
  if (parts === null) {
    return shortened(name, room, tokens);
  }
  const [, first = "", last = ""] = parts;
  return `${shortened(first, room - chipTextWidth(` ${last}`, tokens), tokens)} ${last}`;
}

interface ChipSizes {
  readonly width: number;
  readonly label: string;
}

/**
 * The width of a chip without measuring the text after it is drawn: padding, borders, the name at
 * an average letter width (a little wide, so the font never cuts it), the number of the position and
 * the ball of the server, never more than `chipMaxWidth`. A name of up to eight letters always fits.
 * The chip is drawn with this width and this label, so what is placed is what is seen.
 */
export function chipSizes(
  chip: PlayerChipModel,
  input: Pick<TeamChipsInput, "layout" | "tokens">,
): ChipSizes {
  const { tokens, layout } = input;
  const around = chipAround(tokens, chip.isServer);
  const room = chipMaxWidth(layout, tokens) - around;
  const label = fitName(chip.displayName, room, tokens);
  return { width: around + chipTextWidth(label, tokens), label };
}

export function chipWidth(
  chip: PlayerChipModel,
  input: Pick<TeamChipsInput, "layout" | "tokens">,
): number {
  return chipSizes(chip, input).width;
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
  const rotation = panel.rotation === null ? 0 : (panel.hasSetPoint ? tokens.spacing.xs : 0) + line;
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
    return {
      x: end === "left" ? zoneWidth - halfCourtSide : 0,
      y: (zoneHeight - halfCourtSide) / HALF,
    };
  }
  return {
    x: zoneWidth - edgeInset - halfCourtSide,
    y: end === "top" ? zoneHeight - halfCourtSide : 0,
  };
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
  const zone = shifted(
    { left: 0, top: 0, right: layout.zoneWidth, bottom: layout.zoneHeight },
    origin,
  );
  const side = layout.halfCourtSide;
  const net: Partial<Rect> = {
    left: { right: side },
    right: { left: 0 },
    top: { bottom: side },
    bottom: { top: 0 },
  }[end];
  const margin = CHIP_ZONE_MARGIN;
  const inner: Rect = {
    left: zone.left + margin,
    top: zone.top + margin,
    right: zone.right - margin,
    bottom: zone.bottom - margin,
  };
  return {
    end,
    side,
    bounds: { ...inner, ...net },
    column: shifted(columnRectInZone(input), origin),
    gap: tokens.court.spacing.chipGap,
  };
}

/** Places the six chips of a team, or the seven with a libero, without any covering another. */
export function layoutTeamChips(input: TeamChipsInput): readonly DrawnChip[] {
  const { panel, tokens } = input;
  const { sizes, spacing } = tokens.court;
  const fits = new Map(panel.chips.map((chip) => [chip.memberId, chipSizes(chip, input)]));
  const widths = new Map([...fits].map(([id, fit]) => [id, fit.width]));
  const specs = panel.chips.map<ChipSpec>((chip) => ({
    id: chip.memberId,
    point: chip.point,
    halfWidth:
      (widths.get(chip.memberId) ?? 0) / HALF + (hasBadge(chip) ? spacing.badgeOffsetX : 0),
    halfHeight: sizes.chip / HALF + (hasBadge(chip) ? spacing.badgeOffsetY : 0),
  }));
  const placed = new Map(placeChips(placementFrame(input), specs).map((chip) => [chip.id, chip]));
  return panel.chips.flatMap((chip) => {
    const at = placed.get(chip.memberId);
    return at === undefined
      ? []
      : [
          {
            chip,
            x: at.x,
            y: at.y,
            width: widths.get(chip.memberId) ?? 0,
            label: fits.get(chip.memberId)?.label ?? chip.displayName,
          },
        ];
  });
}
