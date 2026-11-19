/** Windows shorter than this, in dp, are the court on its side: the sheet tightens its spacing. */
export const SHORT_WINDOW_HEIGHT = 480;

/** The share of the window the point author sheet may take (the 66% of PontoIndividual.dc.html). */
export const BOTTOM_SHEET_HEIGHT_SHARE = 0.66;

/**
 * The tallest the bottom sheet may be. Upright, the share of the window. On its side (a short
 * window) the sheet may take all the height under the top safe area, so the two columns fit still
 * (decision of Gabriel, 19/11/2026): a tap outside the sheet closes it, there is no zone to keep.
 */
export function bottomSheetMaxHeight(windowHeight: number, safeTop: number): number {
  const available = Math.max(0, windowHeight - safeTop);
  return isShortWindow(windowHeight)
    ? available
    : Math.min(available, windowHeight * BOTTOM_SHEET_HEIGHT_SHARE);
}

/** True for a window as short as a phone on its side (780 x 360 dp), where every dp of the sheet counts. */
export function isShortWindow(windowHeight: number): boolean {
  return windowHeight < SHORT_WINDOW_HEIGHT;
}

/** The gap between the blocks of the bottom sheet: the tight one on its side, the roomy one upright. */
export function sheetGap(
  spacing: { readonly s: number; readonly m: number },
  windowHeight: number,
): number {
  return isShortWindow(windowHeight) ? spacing.s : spacing.m;
}
