import { describe, expect, it } from "vitest";

import { createScaledTokens } from "./scale";
import { sheetTouchHeights } from "./sheet-tokens.data";
import { accessibilityFloors } from "./tokens.data";

const SMALL_PHONE = 320;
const WIDE_PHONE = 780;

describe("sheet tokens", () => {
  it.each([SMALL_PHONE, WIDE_PHONE])("keep the touch floor at %i dp", (windowWidth) => {
    const { sheet } = createScaledTokens({ windowWidth, fontScale: 1 });
    const scaled = [sheet.sizes.playerCard, sheet.sizes.menuRow, sheet.sizes.revertButton];
    expect(sheetTouchHeights).toHaveLength(scaled.length);
    for (const height of scaled) {
      expect(height).toBeGreaterThanOrEqual(accessibilityFloors.touchTarget);
    }
  });
});
