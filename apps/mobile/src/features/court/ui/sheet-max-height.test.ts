import { describe, expect, it } from "vitest";

import { createScaledTokens } from "../../../theme/scale";
import { bottomSheetMaxHeight, MIN_VISIBLE_ZONE_HEIGHT } from "./sheet-max-height";

describe("bottomSheetMaxHeight", () => {
  it.each([
    { width: 780, height: 360, fontScale: 1 },
    { width: 780, height: 360, fontScale: 1.3 },
    { width: 640, height: 360, fontScale: 1 },
    { width: 640, height: 360, fontScale: 1.3 },
  ])("leaves the zones tappable at $width x $height, font $fontScale", (window) => {
    const tokens = createScaledTokens({ windowWidth: window.height, fontScale: window.fontScale });
    const topBar = tokens.court.sizes.menuButton;
    const sheet = bottomSheetMaxHeight(window.height, topBar);
    expect(window.height - topBar - sheet).toBeGreaterThanOrEqual(MIN_VISIBLE_ZONE_HEIGHT);
  });

  it("takes the share of the window when there is room", () => {
    expect(bottomSheetMaxHeight(800, 44)).toBeCloseTo(528);
  });

  it("never goes negative", () => {
    expect(bottomSheetMaxHeight(60, 44)).toBe(0);
  });
});
