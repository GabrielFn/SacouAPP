import {
  COURT_FLEX_WEIGHTS,
  COURT_TOTAL_WEIGHT,
  COURT_ZONE_RATIOS,
  HALF_COURT_WIDTH_RATIO,
  HALF_COURT_ZONE_RATIO,
  LANDSCAPE_FLEX_WEIGHTS,
  LANDSCAPE_HALF_COURT_WIDTH_RATIO,
  LANDSCAPE_HALF_COURT_ZONE_RATIO,
  LANDSCAPE_SCORE_ZONE_RATIO,
  NET_MIN_WIDTH,
  LANDSCAPE_TOTAL_HEIGHT_WEIGHT,
  LANDSCAPE_TOTAL_WIDTH_WEIGHT,
  LANDSCAPE_WIDTH_WEIGHTS,
  LANDSCAPE_ZONE_RATIOS,
  QUEUE_PILL_MAX_WIDTH_RATIO,
  SCORE_DIGIT_WIDTH_EM,
  SCORE_FULL_SIZE_MAX_DIGITS,
  SCORE_ZONE_RATIO,
} from "../court.data";

export interface CourtLayoutInput {
  readonly windowWidth: number;
  readonly windowHeight: number;
  readonly insetTop: number;
  readonly insetBottom: number;
  /** The notch or the side navigation bar when the phone is on its side. */
  readonly insetLeft: number;
  readonly insetRight: number;
}

/** What both layouts give the zone of a team, in pixels, all derived from the window. */
export interface ZoneLayout {
  readonly zoneHeight: number;
  /** The width of the zone, the side the team column and the square share. */
  readonly zoneWidth: number;
  readonly sideWidth: number;
  readonly halfCourtSide: number;
  /** The fraction of the zone height the score takes. */
  readonly scoreZoneRatio: number;
}

/** The court on its side (the layout of E4.17): the main one, since the court locks in landscape. */
export interface LandscapeCourtLayout extends ZoneLayout {
  readonly kind: "landscape";
  /** The width the net column takes between the two zones. */
  readonly netWidth: number;
  /** The margin of the zone to the column, same for the team on each side. */
  readonly edgeInset: number;
  /** The widest a pill of the queue gets before its name ends in "…". */
  readonly queuePillMaxWidth: number;
}

/** The court upright: the fallback when the phone is not on its side (large tablet, split screen). */
export interface PortraitCourtLayout extends ZoneLayout {
  readonly kind: "portrait";
  readonly edgeInset: number;
}

export type CourtLayout = LandscapeCourtLayout | PortraitCourtLayout;

const BOTH_ZONES = 2;

function usable(total: number, start: number, end: number): number {
  return Math.max(0, total - start - end);
}

function computeLandscape(input: CourtLayoutInput): LandscapeCourtLayout {
  const width = usable(input.windowWidth, input.insetLeft, input.insetRight);
  const height = usable(input.windowHeight, input.insetTop, input.insetBottom);
  const zoneHeight = (height * LANDSCAPE_FLEX_WEIGHTS.middle) / LANDSCAPE_TOTAL_HEIGHT_WEIGHT;
  const netWidth = Math.max(
    (width * LANDSCAPE_WIDTH_WEIGHTS.net) / LANDSCAPE_TOTAL_WIDTH_WEIGHT,
    NET_MIN_WIDTH,
  );
  const zoneWidth = (width - netWidth) / BOTH_ZONES;
  // A phone less wide than the sketch (640 x 360) needs a wider column for two digits at 38% of the
  // height, and the square gives up the difference.
  const scoreColumn =
    zoneHeight * LANDSCAPE_SCORE_ZONE_RATIO * SCORE_FULL_SIZE_MAX_DIGITS * SCORE_DIGIT_WIDTH_EM;
  const sideWidth = Math.max(zoneWidth * LANDSCAPE_ZONE_RATIOS.side, scoreColumn);
  const edgeInset = zoneWidth * LANDSCAPE_ZONE_RATIOS.edge;
  return {
    kind: "landscape",
    zoneHeight,
    zoneWidth,
    netWidth,
    sideWidth,
    edgeInset,
    queuePillMaxWidth: width * QUEUE_PILL_MAX_WIDTH_RATIO,
    halfCourtSide: Math.min(
      zoneWidth * LANDSCAPE_HALF_COURT_WIDTH_RATIO,
      zoneHeight * LANDSCAPE_HALF_COURT_ZONE_RATIO,
      zoneWidth - edgeInset - sideWidth,
    ),
    scoreZoneRatio: LANDSCAPE_SCORE_ZONE_RATIO,
  };
}

function computePortrait(input: CourtLayoutInput): PortraitCourtLayout {
  const usableHeight = usable(input.windowHeight, input.insetTop, input.insetBottom);
  const zoneHeight = (usableHeight * COURT_FLEX_WEIGHTS.zone) / COURT_TOTAL_WEIGHT;
  return {
    kind: "portrait",
    zoneHeight,
    zoneWidth: input.windowWidth,
    sideWidth: input.windowWidth * COURT_ZONE_RATIOS.side,
    edgeInset: input.windowWidth * COURT_ZONE_RATIOS.edge,
    halfCourtSide: Math.min(
      input.windowWidth * HALF_COURT_WIDTH_RATIO,
      zoneHeight * HALF_COURT_ZONE_RATIO,
    ),
    scoreZoneRatio: SCORE_ZONE_RATIO,
  };
}

/**
 * The window decides the layout (never a copy of the orientation): wider than tall is landscape,
 * and a square counts as upright. The zones share the area left by the insets in weights, and the
 * half court stays a square inside its zone.
 */
export function computeCourtLayout(input: CourtLayoutInput): CourtLayout {
  return input.windowWidth > input.windowHeight ? computeLandscape(input) : computePortrait(input);
}
