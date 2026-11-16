import { describe, expect, it } from "vitest";

import { contrastRatio } from "./contrast";
import { createScaledTokens } from "./scale";
import { appTheme } from "./themes";
import { accessibilityFloors, canvasWidth } from "./tokens.data";

const AA_TEXT = 4.5;
const WIDTHS = [320, canvasWidth, 600] as const;

function ratio(first: string, second: string): number {
  const result = contrastRatio(first, second);
  if (!result.ok) throw new Error("invalid test color");
  return result.value;
}

describe("the dark panel of the round (06 and 26)", () => {
  it.each([
    ["sand text on the panel", appTheme.onPanel, appTheme.panelSurface],
    ["yellow counts on the panel", appTheme.panelAccent, appTheme.panelSurface],
    ["check on the orange circle", appTheme.onPrimary, appTheme.primary],
    ["initial on the avatar", appTheme.text, appTheme.avatarSurface],
  ])("%s reaches AA", (_name, foreground, background) => {
    expect(ratio(foreground, background)).toBeGreaterThanOrEqual(AA_TEXT);
  });

  it.each(WIDTHS)("keeps the touch floor of the confirmed cell at width %s", (windowWidth) => {
    const { sizes } = createScaledTokens({ windowWidth, fontScale: 1 });
    expect(sizes.minTouchTarget).toBeGreaterThanOrEqual(accessibilityFloors.touchTarget);
  });
});
