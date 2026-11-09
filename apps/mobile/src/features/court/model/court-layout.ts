import {
  COURT_FLEX_WEIGHTS,
  COURT_TOTAL_WEIGHT,
  COURT_ZONE_RATIOS,
  HALF_COURT_WIDTH_RATIO,
  HALF_COURT_ZONE_RATIO,
} from "../court.data";

export interface CourtLayoutInput {
  readonly windowWidth: number;
  readonly windowHeight: number;
  readonly insetTop: number;
  readonly insetBottom: number;
}

/** What the screen needs in pixels, all derived from the window (no measuring after drawing). */
export interface CourtLayout {
  readonly zoneHeight: number;
  readonly sideWidth: number;
  readonly halfCourtSide: number;
}

/** The zones share the height left by the insets in weights; the half court stays a square inside. */
export function computeCourtLayout(input: CourtLayoutInput): CourtLayout {
  const usable = Math.max(0, input.windowHeight - input.insetTop - input.insetBottom);
  const zoneHeight = (usable * COURT_FLEX_WEIGHTS.zone) / COURT_TOTAL_WEIGHT;
  return {
    zoneHeight,
    sideWidth: input.windowWidth * COURT_ZONE_RATIOS.side,
    halfCourtSide: Math.min(
      input.windowWidth * HALF_COURT_WIDTH_RATIO,
      zoneHeight * HALF_COURT_ZONE_RATIO,
    ),
  };
}
