import { describe, expect, test } from "vitest";

import { contrastRatio } from "./contrast";
import { createScaledTokens } from "./scale";
import { appTheme } from "./themes";
import { accessibilityFloors, fontScaleCap, sizes } from "./tokens.data";

const AA_TEXT = 4.5;
const WIDTHS = [320, 390, 600];

function ratio(first: string, second: string): number {
  const result = contrastRatio(first, second);
  return result.ok ? result.value : 0;
}

describe("the colors of the MVP ballot (L2)", () => {
  test("the grey line of a candidate keeps AA on white and on the chosen row", () => {
    expect(ratio(appTheme.textMuted, appTheme.surface)).toBeGreaterThanOrEqual(AA_TEXT);
    expect(ratio(appTheme.textMuted, appTheme.choiceFill)).toBeGreaterThanOrEqual(AA_TEXT);
  });

  test("the name on the chosen row and the dark text on the orange button keep AA", () => {
    expect(ratio(appTheme.text, appTheme.choiceFill)).toBeGreaterThanOrEqual(AA_TEXT);
    expect(ratio(appTheme.onPrimary, appTheme.primary)).toBeGreaterThanOrEqual(AA_TEXT);
  });
});

describe("the measures of the MVP ballot (L1)", () => {
  test.each(WIDTHS.flatMap((width) => [1, fontScaleCap].map((fontScale) => [width, fontScale])))(
    "at %d wide and font %d a row and the button stay over the touch floor",
    (windowWidth, fontScale) => {
      const tokens = createScaledTokens({ windowWidth, fontScale });
      expect(tokens.sizes.ballotRowMin).toBeGreaterThanOrEqual(accessibilityFloors.touchTarget);
      expect(tokens.sizes.primaryButton).toBeGreaterThanOrEqual(accessibilityFloors.touchTarget);
      expect(tokens.sizes.radioDot).toBeGreaterThan(0);
    },
  );

  test("the row of the canvas is 58 high", () => {
    expect(sizes.ballotRowMin).toBe(58);
  });
});
