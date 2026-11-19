import { describe, expect, it } from "vitest";

import { createScaledTokens } from "./scale";
import { sheetSizes, sheetTouchHeights } from "./sheet-tokens.data";
import { accessibilityFloors } from "./tokens.data";

const SMALL_PHONE = 320;
const COMMON_PHONE = 390;
const WIDE_PHONE = 780;

/** The sizes of `sheetTouchHeights`, by key, so the list is not written twice. */
const touchKeys = (Object.keys(sheetSizes) as (keyof typeof sheetSizes)[]).filter((key) =>
  (sheetTouchHeights as readonly number[]).includes(sheetSizes[key]),
);

describe("sheet tokens", () => {
  it.each([SMALL_PHONE, COMMON_PHONE, WIDE_PHONE])(
    "keep the touch floor at %i dp",
    (windowWidth) => {
      const { sheet } = createScaledTokens({ windowWidth, fontScale: 1 });
      expect(touchKeys).toHaveLength(sheetTouchHeights.length);
      for (const key of touchKeys) {
        expect(sheet.sizes[key]).toBeGreaterThanOrEqual(accessibilityFloors.touchTarget);
      }
    },
  );
});
