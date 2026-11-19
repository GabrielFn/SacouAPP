import { describe, expect, it } from "vitest";

import { createScaledTokens } from "../../../theme/scale";
import { bottomSheetMaxHeight, isShortWindow } from "./sheet-max-height";

const LANDSCAPE = { width: 780, height: 360 } as const;
/** Lines the footnote takes in the narrow column of the sheet (a generous count). */
const FOOTNOTE_LINES = 3;
const LINE_HEIGHT_RATIO = 1.4;

/** The tallest column of the point author sheet on its side, from the tokens (no safe area). */
function tallestColumn(fontScale: number): number {
  const { spacing, sizes, sheet, fontSizes } = createScaledTokens({
    windowWidth: LANDSCAPE.height,
    fontScale,
  });
  const gap = spacing.s;
  const kindRows = 2 * sizes.chip + spacing.s;
  const status = sizes.statusPill;
  const question = sheet.fontSizes.titleLarge;
  const footnote = FOOTNOTE_LINES * fontSizes.caption * LINE_HEIGHT_RATIO;
  const left = status + question + kindRows + sizes.primaryButton + footnote + 4 * gap;
  const chrome = spacing.s10 + sizes.sheetHandle + 2 * gap;
  return chrome + left;
}

describe("bottomSheetMaxHeight", () => {
  it("fits the two columns of screen 31 still at 780 x 360, with the bottom safe area", () => {
    const bottomInset = 24;
    const sheet = bottomSheetMaxHeight(LANDSCAPE.height, 0);
    expect(tallestColumn(1) + bottomInset).toBeLessThanOrEqual(sheet);
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
