import { describe, expect, test } from "vitest";

import { contrastRatio } from "./contrast";
import { createScaledTokens } from "./scale";
import { appTheme } from "./themes";
import { accessibilityFloors, fontScaleCap, interactiveHeights, sizes } from "./tokens.data";

const AA_TEXT = 4.5;
const AA_GRAPHIC = 3;
const WIDTHS = [320, 390, 600];

function ratio(first: string, second: string): number {
  const result = contrastRatio(first, second);
  return result.ok ? result.value : 0;
}

describe("the colors of screen 28 and the bell (E3.11)", () => {
  test("the text of the permission card and of its button keep AA", () => {
    expect(ratio(appTheme.onPanel, appTheme.panelSurface)).toBeGreaterThanOrEqual(AA_TEXT);
    expect(ratio(appTheme.onPrimary, appTheme.primary)).toBeGreaterThanOrEqual(AA_TEXT);
  });

  test("the subtitle and the time of a line keep AA on white, the icon 3:1 on its circle", () => {
    expect(ratio(appTheme.textMuted, appTheme.surface)).toBeGreaterThanOrEqual(AA_TEXT);
    expect(ratio(appTheme.text, appTheme.surface)).toBeGreaterThanOrEqual(AA_TEXT);
    expect(ratio(appTheme.goingText, appTheme.goingFill)).toBeGreaterThanOrEqual(AA_GRAPHIC);
  });

  test("Marcar como lidas keeps AA on the sand", () => {
    expect(ratio(appTheme.text, appTheme.background)).toBeGreaterThanOrEqual(AA_TEXT);
  });
});

describe("M9 the measures of screen 28 in three widths", () => {
  test.each(WIDTHS.flatMap((width) => [1, fontScaleCap].map((fontScale) => [width, fontScale])))(
    "at %d wide and font %d the line, Ativar and Marcar como lidas stay over the touch floor",
    (windowWidth, fontScale) => {
      const tokens = createScaledTokens({ windowWidth, fontScale });
      const floor = accessibilityFloors.touchTarget;
      expect(tokens.sizes.notificationRowMin).toBeGreaterThanOrEqual(floor);
      expect(tokens.sizes.minTouchTarget).toBeGreaterThanOrEqual(floor);
      expect(tokens.sizes.headerTextButton).toBeGreaterThanOrEqual(floor);
      expect(tokens.sizes.iconButton).toBeGreaterThanOrEqual(floor);
      expect(tokens.sizes.unreadDot).toBeGreaterThan(0);
      expect(tokens.sizes.notificationIcon).toBeGreaterThan(0);
    },
  );

  test("the measures of the canvas, and the targets in the list of the floors", () => {
    expect([sizes.notificationRowMin, sizes.notificationIcon, sizes.unreadDot]).toEqual([
      48, 40, 8,
    ]);
    expect([sizes.permissionIcon, sizes.headerTextButton]).toEqual([44, 48]);
    expect(interactiveHeights).toContain(sizes.notificationRowMin);
    expect(interactiveHeights).toContain(sizes.headerTextButton);
  });

  test("the dot scales with the window: smaller on a small phone, larger on a tablet", () => {
    const small = createScaledTokens({ windowWidth: 320, fontScale: 1 }).sizes.unreadDot;
    const large = createScaledTokens({ windowWidth: 600, fontScale: 1 }).sizes.unreadDot;
    expect(small).toBeLessThan(large);
  });
});
