import { describe, expect, it } from "vitest";

import { contrastRatio } from "./contrast";
import { createScaledTokens } from "./scale";
import { TEAM_PALETTES } from "./team-colors";
import { appTheme } from "./themes";
import { accessibilityFloors, canvasWidth, palette } from "./tokens.data";

const AA_TEXT = 4.5;
const AA_GRAPHIC = 3;
const WIDTHS = [320, canvasWidth, 600] as const;

function ratio(first: string, second: string): number {
  const result = contrastRatio(first, second);
  if (!result.ok) throw new Error("invalid test color");
  return result.value;
}

describe("the colors of the draw (screen 07) reach AA", () => {
  it.each([
    ["a name on its sand chip", appTheme.text, appTheme.background],
    ["a selected name on the pale blue", appTheme.text, appTheme.selectFill],
    ["a locked name on the navy", appTheme.onPanel, appTheme.panelSurface],
    ["the yellow lock on the navy", appTheme.panelAccent, appTheme.panelSurface],
    ["the level of a name on its sand chip", appTheme.textMuted, appTheme.background],
    ["the level of a selected name", appTheme.textMuted, appTheme.selectFill],
    ["the letter A on orange", TEAM_PALETTES.orange.onFill, TEAM_PALETTES.orange.fill],
    ["the letter B on blue", TEAM_PALETTES.blue.onFill, TEAM_PALETTES.blue.fill],
    ["a chosen mode button", appTheme.background, appTheme.text],
    ["Confirmar e compartilhar", appTheme.onPrimary, appTheme.primary],
  ])("%s (text)", (_name, foreground, background) => {
    expect(ratio(foreground, background)).toBeGreaterThanOrEqual(AA_TEXT);
  });

  it.each([
    ["the blue outline of a selected name", appTheme.selectOutline, appTheme.selectFill],
    ["the green check of the meter", appTheme.goingText, appTheme.surface],
    ["the green band of the meter", appTheme.meterBand, appTheme.surface],
    ["the warning of an unbalanced draw", appTheme.danger, appTheme.surface],
    ["the strip of Laranja on the card", palette.serveOrange, palette.night],
  ])("%s (graphic, 3:1)", (_name, foreground, background) => {
    expect(ratio(foreground, background)).toBeGreaterThanOrEqual(AA_GRAPHIC);
  });

  it.each(WIDTHS)("keeps the touch floor of the names and the footer at width %s", (windowWidth) => {
    const { sizes } = createScaledTokens({ windowWidth, fontScale: 2 });
    expect(sizes.minTouchTarget).toBeGreaterThanOrEqual(accessibilityFloors.touchTarget);
    expect(sizes.field).toBeGreaterThanOrEqual(accessibilityFloors.touchTarget);
    expect(sizes.primaryButton).toBeGreaterThanOrEqual(accessibilityFloors.touchTarget);
  });

  it.each(WIDTHS)("scales the draw tokens with the window at width %s", (windowWidth) => {
    const { sizes, fontSizes } = createScaledTokens({ windowWidth, fontScale: 1 });
    const factor = windowWidth / canvasWidth;
    expect(sizes.teamBadge).toBeGreaterThan(0);
    expect(fontSizes.drawTitle).toBeGreaterThanOrEqual(Math.floor(29 * Math.max(factor, 0.85)) - 1);
  });
});
