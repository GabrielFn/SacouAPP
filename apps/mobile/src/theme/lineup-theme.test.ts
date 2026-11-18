import { describe, expect, it } from "vitest";

import { contrastRatio } from "./contrast";
import { createScaledTokens, scaleFactor } from "./scale";
import { TEAM_PALETTES } from "./team-colors";
import { appTheme } from "./themes";
import { accessibilityFloors, canvasWidth } from "./tokens.data";

const AA_TEXT = 4.5;
const AA_GRAPHIC = 3;
const ORDER_CELL = 52;
const LINEUP_BADGE = 20;
/** Portrait phones and a tablet, then two phones on their side (D8). */
const WIDTHS = [320, canvasWidth, 600, 640, 844] as const;

function ratio(first: string, second: string): number {
  const result = contrastRatio(first, second);
  if (!result.ok) throw new Error("invalid test color");
  return result.value;
}

describe("the colors of the lineup (screen 22) reach AA", () => {
  it.each([
    ["a name on its white chip", appTheme.text, appTheme.surface],
    ["the server on the yellow chip and the warning strip", appTheme.text, appTheme.accent],
    ["the checked rotation", appTheme.background, appTheme.text],
    ["the number of the official order", appTheme.textMuted, appTheme.surface],
    ["the server cell of the order", appTheme.text, appTheme.waitingFill],
    ["the libero chip, inverted", appTheme.surface, appTheme.text],
    ["a selected name on the pale blue", appTheme.text, appTheme.selectFill],
    ["Salvar escalação", appTheme.onPrimary, appTheme.primary],
  ])("%s (text)", (_name, foreground, background) => {
    expect(ratio(foreground, background)).toBeGreaterThanOrEqual(AA_TEXT);
  });

  it.each([
    ["the frame of Laranja on the court", TEAM_PALETTES.orange.fill, appTheme.surface],
    ["the frame of Azul on the court", TEAM_PALETTES.blue.fill, appTheme.surface],
    ["the outline of a selected chip", appTheme.selectOutline, appTheme.selectFill],
  ])("%s (graphic, 3:1)", (_name, foreground, background) => {
    expect(ratio(foreground, background)).toBeGreaterThanOrEqual(AA_GRAPHIC);
  });
});

describe("the lineup tokens scale and keep the touch floor", () => {
  it.each(WIDTHS)("at width %s", (windowWidth) => {
    const { sizes } = createScaledTokens({ windowWidth, fontScale: 2 });
    const factor = scaleFactor(windowWidth);
    expect(sizes.orderCell).toBe(Math.round(ORDER_CELL * factor));
    expect(sizes.lineupBadge).toBe(Math.round(LINEUP_BADGE * factor));
    for (const target of [sizes.chip, sizes.segment, sizes.primaryButton, sizes.iconButton]) {
      expect(target).toBeGreaterThanOrEqual(accessibilityFloors.touchTarget);
    }
  });
});
