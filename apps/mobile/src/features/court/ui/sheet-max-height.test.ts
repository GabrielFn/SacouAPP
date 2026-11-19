import { describe, expect, it } from "vitest";

import { createScaledTokens } from "../../../theme/scale";
import { bottomSheetMaxHeight, isShortWindow, sheetGap } from "./sheet-max-height";

const LANDSCAPE = { width: 780, height: 360 } as const;
/** The safe area of a phone on its side, at the top and at the bottom, in dp. */
const SAFE_AREA = 24;
/** Lines the footnote takes in the narrow column of the sheet (a generous count). */
const FOOTNOTE_LINES = 3;
const LINE_HEIGHT_RATIO = 1.4;
/** The 3 of the black top border over the 2 of the other outlines (`SheetPanel`). */
const TOP_BORDER_RATIO = 1.5;
/** Four kinds, four a line (`KIND_COLUMNS`): one row of chips. */
const KIND_ROWS = 1;
const PLAYER_ROWS = 2;

/** The tallest column of the point author sheet on its side, with the gaps `AttributionSheet` uses. */
function sheetContentHeight(fontScale: number): number {
  const { spacing, sizes, sheet, fontSizes, borderWidths } = createScaledTokens({
    windowWidth: LANDSCAPE.height,
    fontScale,
  });
  const gap = sheetGap(spacing, LANDSCAPE.height);
  const kinds = KIND_ROWS * sizes.chip + (KIND_ROWS - 1) * spacing.s;
  const left =
    sizes.statusPill + gap + sheet.fontSizes.titleLarge + gap + kinds + gap + sizes.primaryButton;
  const caption = fontSizes.caption * LINE_HEIGHT_RATIO;
  const grid = PLAYER_ROWS * sheet.sizes.playerCard + (PLAYER_ROWS - 1) * spacing.s;
  const footnote = FOOTNOTE_LINES * caption;
  const right = caption + spacing.s6 + grid + gap + sizes.primaryButton + gap + footnote;
  const inkBorder = borderWidths.thick * TOP_BORDER_RATIO;
  return inkBorder + spacing.s10 + Math.max(left, right) + SAFE_AREA + gap;
}

describe("bottomSheetMaxHeight", () => {
  it("fits the two columns of screen 31 at 780 x 360 with a 24 dp safe area on both edges", () => {
    expect(sheetContentHeight(1)).toBeLessThanOrEqual(
      bottomSheetMaxHeight(LANDSCAPE.height, SAFE_AREA),
    );
  });

  it("takes the height under the top safe area on its side", () => {
    expect(bottomSheetMaxHeight(360, 24)).toBe(336);
  });

  it("takes the share of the window upright", () => {
    expect(bottomSheetMaxHeight(800, 0)).toBeCloseTo(528);
  });

  it("never goes negative", () => {
    expect(bottomSheetMaxHeight(60, 80)).toBe(0);
  });
});

describe("isShortWindow", () => {
  it("is true for a phone on its side (360 dp high)", () => {
    expect(isShortWindow(360)).toBe(true);
  });

  it("is false upright", () => {
    expect(isShortWindow(844)).toBe(false);
  });
});
