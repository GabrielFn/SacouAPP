import { describe, expect, it } from "vitest";

import { contrastRatio } from "./contrast";
import { createScaledTokens } from "./scale";
import { TEAM_PALETTES } from "./team-colors";
import { appTheme, courtNightTheme, courtSunTheme } from "./themes";
import { accessibilityFloors, canvasWidth } from "./tokens.data";

const AA_TEXT = 4.5;
const AA_LARGE = 3;
const WIDTHS = [320, canvasWidth, 600];
const LARGEST_FONT_SCALE = 2;

function ratio(first: string, second: string): number {
  const result = contrastRatio(first, second);
  if (!result.ok) throw new Error(`invalid color ${first} ${second}`);
  return result.value;
}

// Screens 09a (app theme), 09b and 09c (theme of the court, sun or night): E4.11, part 3.
describe.each([
  ["app", appTheme],
  ["court sun", courtSunTheme],
  ["court night", courtNightTheme],
] as const)("contrast of the take-over screens in the %s theme", (_name, theme) => {
  it("the dialog and the sheet read: text, muted text and the refusal on their ground", () => {
    expect(ratio(theme.text, theme.background)).toBeGreaterThanOrEqual(AA_TEXT);
    expect(ratio(theme.textMuted, theme.background)).toBeGreaterThanOrEqual(AA_TEXT);
    expect(ratio(theme.refusal, theme.background)).toBeGreaterThanOrEqual(AA_TEXT);
    expect(ratio(theme.text, theme.surface)).toBeGreaterThanOrEqual(AA_TEXT);
  });

  it("the 09b banner and the primary button read", () => {
    expect(ratio(theme.onPanel, theme.panelSurface)).toBeGreaterThanOrEqual(AA_TEXT);
    expect(ratio(theme.onPrimary, theme.primary)).toBeGreaterThanOrEqual(AA_TEXT);
  });
});

describe("the score behind the take-over screens", () => {
  it("each number reads on its team color (large text)", () => {
    for (const look of Object.values(TEAM_PALETTES)) {
      expect(ratio(look.onFill, look.fill)).toBeGreaterThanOrEqual(AA_LARGE);
    }
  });
});

describe("the touch targets of screens 09a, 09b and 09c", () => {
  it.each(WIDTHS)(
    "buttons and rows keep 44 at %i of width, and the scale follows the width",
    (width) => {
      const tokens = createScaledTokens({ windowWidth: width, fontScale: 1 });
      expect(tokens.sizes.primaryButton).toBeGreaterThanOrEqual(accessibilityFloors.touchTarget);
      expect(tokens.sizes.minTouchTarget).toBeGreaterThanOrEqual(accessibilityFloors.touchTarget);
      const base = createScaledTokens({ windowWidth: canvasWidth, fontScale: 1 });
      const grows = width >= canvasWidth;
      expect(tokens.spacing.xl >= base.spacing.xl).toBe(grows);
    },
  );

  it.each(WIDTHS)("with the largest system font, the floors hold at %i", (width) => {
    const tokens = createScaledTokens({ windowWidth: width, fontScale: LARGEST_FONT_SCALE });
    expect(tokens.sizes.primaryButton).toBeGreaterThanOrEqual(accessibilityFloors.touchTarget);
    expect(tokens.fontSizes.displayScore).toBeGreaterThan(tokens.fontSizes.displayLevelCard);
  });
});
