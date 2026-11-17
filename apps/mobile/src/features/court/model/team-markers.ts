import type { ScaledTokens } from "../../../theme/scale";
import {
  COLUMN_LINE_HEIGHT_EM,
  HALF,
  LANDSCAPE_SQUARE_TOP_SHARE,
  LABEL_CHAR_WIDTH_EM,
  LABEL_ELLIPSIS_WIDTH_EM,
  LABEL_LINE_HEIGHT_EM,
  LABEL_UPPER_CHAR_WIDTH_EM,
  LABEL_WIDE_CHAR_WIDTH_EM,
  MARKER_ZONE_MARGIN,
} from "../court.data";
import {
  placeMarkers,
  type MarkerSpec,
  type NameOption,
  type PlacedMarker,
  type PlacementFrame,
  type Rect,
} from "./marker-placement";
import type { CourtEnd } from "./court-geometry";
import type { CourtLayout } from "./court-layout";
import type { PlayerChipModel, TeamPanelModel } from "./court-screen.types";
import { scoreTextSize } from "./score-display";

const BOTTOM_ALIGNED_ENDS: readonly CourtEnd[] = ["right", "bottom"];
const ELLIPSIS = "…";
/** An abbreviation is the start of the second name and a dot: "Ana C.", "Ana Ca.". */
const ABBREVIATION = /^(.+) (\p{L}+\.)$/u;
const WIDE_LETTERS = /^[MWmw]$/u;
const UPPER_LETTER = /^\p{Lu}$/u;

/** A marker ready to draw: the circle at the point of the formation and its name beside it. */
export interface DrawnMarker {
  readonly chip: PlayerChipModel;
  readonly placed: PlacedMarker;
}

export interface TeamMarkersInput {
  readonly panel: TeamPanelModel;
  readonly layout: CourtLayout;
  readonly tokens: ScaledTokens;
  readonly end: CourtEnd;
}

/** The font size of the name under a circle: the one the name is drawn with and its width is worked out with. */
export function nameFontSize(tokens: ScaledTokens): number {
  return tokens.fontSizes.caption;
}

/** The radius of the circle with the number of the position. */
export function markerRadius(tokens: ScaledTokens): number {
  return tokens.court.sizes.chip / HALF;
}

function letterEm(letter: string): number {
  if (letter === ELLIPSIS) return LABEL_ELLIPSIS_WIDTH_EM;
  if (WIDE_LETTERS.test(letter)) return LABEL_WIDE_CHAR_WIDTH_EM;
  return UPPER_LETTER.test(letter) ? LABEL_UPPER_CHAR_WIDTH_EM : LABEL_CHAR_WIDTH_EM;
}

/** The width of a text in ems of its font: wide and upper case letters and the "…" count more. */
export function textWidthInEm(text: string): number {
  return Array.from(text).reduce((sum, letter) => sum + letterEm(letter), 0);
}

/** The width of a name under a circle; it is drawn with this same measure and font size. */
export function nameTextWidth(text: string, tokens: ScaledTokens): number {
  return textWidthInEm(text) * nameFontSize(tokens);
}

/** The longest start of the text that, with the "…", fits the room (at least one letter). */
function shortened(text: string, room: number, tokens: ScaledTokens): string {
  const letters = Array.from(text);
  const fits = (count: number) =>
    nameTextWidth(`${letters.slice(0, count).join("")}${ELLIPSIS}`, tokens) <= room;
  const count = letters.reduce((best, _, index) => (fits(index + 1) ? index + 1 : best), 1);
  return `${letters.slice(0, count).join("")}${ELLIPSIS}`;
}

/**
 * The name as drawn within `room` pixels: whole when it fits; otherwise "…" ends it. An abbreviation
 * ("Ana C.") keeps its last word whole and shortens the first name before it, never the initial.
 */
export function fitName(name: string, room: number, tokens: ScaledTokens): string {
  if (nameTextWidth(name, tokens) <= room) {
    return name;
  }
  const parts = ABBREVIATION.exec(name);
  if (parts === null) {
    return shortened(name, room, tokens);
  }
  const [, first = "", last = ""] = parts;
  return `${shortened(first, room - nameTextWidth(` ${last}`, tokens), tokens)} ${last}`;
}

/** A cut name keeps at least three letters before the "…" ("Fir…"); fewer reads badly. */
const MIN_CUT_LETTERS = 3;
const WORDS = /\s+/u;

/** The start of a word with the "…", from one letter short down to three letters. */
function cutsOf(word: string): readonly string[] {
  const letters = Array.from(word);
  return letters
    .map((_, index) => letters.length - 1 - index)
    .filter((count) => count >= MIN_CUT_LETTERS)
    .map((count) => `${letters.slice(0, count).join("")}${ELLIPSIS}`);
}

/**
 * The whole name, then shorter ones from the widest to the narrowest, without repeats: "First I."
 * (the initial of the last name), the first name alone, and the first name cut to no fewer than
 * three letters ("Fir…").
 */
export function nameOptions(name: string, tokens: ScaledTokens): readonly NameOption[] {
  const words = name
    .trim()
    .split(WORDS)
    .filter((word) => word !== "");
  const first = words[0] ?? name;
  const last = words.length > 1 ? words.at(-1) : undefined;
  const initial = last === undefined ? [] : [`${first} ${Array.from(last)[0] ?? ""}.`];
  const texts = [name, ...initial, first, ...cutsOf(first)];
  return texts
    .filter((text, index) => texts.indexOf(text) === index)
    .map((text) => ({ text, width: nameTextWidth(text, tokens) }))
    .filter((option, index, all) => index === 0 || option.width <= (all[0]?.width ?? 0))
    .sort((a, b) => b.width - a.width);
}

function hasBadge(chip: PlayerChipModel): boolean {
  return chip.isServer || chip.isSetter || chip.isLibero;
}

/** The height of the team column, from its lines: it is the part of the zone the chips keep clear of. */
export function columnHeight({ panel, layout, tokens }: Omit<TeamMarkersInput, "end">): number {
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
      y: (zoneHeight - halfCourtSide) * LANDSCAPE_SQUARE_TOP_SHARE,
    };
  }
  return {
    x: zoneWidth - edgeInset - halfCourtSide,
    y: end === "top" ? zoneHeight - halfCourtSide : 0,
  };
}

/** Where the column of the team stands in its zone, in pixels from the corner of the zone. */
function columnRectInZone(input: TeamMarkersInput): Rect {
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
export function placementFrame(input: TeamMarkersInput): PlacementFrame {
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
  const margin = MARKER_ZONE_MARGIN;
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

/** Places the six circles of a team, or the seven with a libero, each with its name beside it. */
export function layoutTeamMarkers(input: TeamMarkersInput): readonly DrawnMarker[] {
  const { panel, tokens } = input;
  const reach = markerRadius(tokens) + tokens.court.spacing.badgeOffsetX;
  const specs = panel.chips.map<MarkerSpec>((chip) => ({
    id: chip.memberId,
    point: chip.point,
    radius: markerRadius(tokens),
    reach: hasBadge(chip) ? reach : markerRadius(tokens),
    names: nameOptions(chip.displayName, tokens),
    nameHeight: nameFontSize(tokens) * LABEL_LINE_HEIGHT_EM,
  }));
  const placed = new Map(placeMarkers(placementFrame(input), specs).map((m) => [m.id, m]));
  return panel.chips.flatMap((chip) => {
    const at = placed.get(chip.memberId);
    return at === undefined ? [] : [{ chip, placed: at }];
  });
}
