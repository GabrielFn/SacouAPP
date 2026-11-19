/** The share of the window the point author sheet may take (the 66% of PontoIndividual.dc.html). */
export const BOTTOM_SHEET_HEIGHT_SHARE = 0.66;

/** The least height of the point zones that stays tappable above the sheet, in dp (touch floor). */
export const MIN_VISIBLE_ZONE_HEIGHT = 44;

/**
 * The tallest the bottom sheet may be. The share of the window, never so tall that less than
 * `MIN_VISIBLE_ZONE_HEIGHT` of the point zones is left under the top bar: the next point can be
 * scored with the sheet open. The scroll view of the sheet absorbs what does not fit.
 */
export function bottomSheetMaxHeight(windowHeight: number, topBarHeight: number): number {
  const byShare = windowHeight * BOTTOM_SHEET_HEIGHT_SHARE;
  const byZones = windowHeight - topBarHeight - MIN_VISIBLE_ZONE_HEIGHT;
  return Math.max(0, Math.min(byShare, byZones));
}
