import { describe, expect, it } from "vitest";

import { contrastRatio } from "./contrast";
import { courtNightTheme, courtSunTheme } from "./themes";
import { accessibilityFloors, canvasWidth } from "./tokens.data";
import { createScaledTokens } from "./scale";

const AA_TEXT = 4.5;
const AA_NON_TEXT = 3;
const WIDTHS = [320, canvasWidth, 600];

function ratio(first: string, second: string): number {
  const result = contrastRatio(first, second);
  if (!result.ok) throw new Error(`invalid color ${first} ${second}`);
  return result.value;
}

// Screens 23a and 31 (E4.10, part 3): the picked row swaps text and background, an option off is
// muted by color, and a refusal is in its own role, in both themes of the court.
describe.each([
  ["sun", courtSunTheme],
  ["night", courtNightTheme],
] as const)("contrast of the players' sheets in the %s theme", (_name, theme) => {
  it("the picked row reads (background on text)", () => {
    expect(ratio(theme.background, theme.text)).toBeGreaterThanOrEqual(AA_TEXT);
  });

  it("names and details read on the rows and the player buttons", () => {
    expect(ratio(theme.text, theme.surface)).toBeGreaterThanOrEqual(AA_TEXT);
    expect(ratio(theme.textMuted, theme.surface)).toBeGreaterThanOrEqual(AA_TEXT);
  });

  it("the edge of an option off still shows, and the refusal reads on the sheet", () => {
    expect(ratio(theme.textMuted, theme.background)).toBeGreaterThanOrEqual(AA_NON_TEXT);
    expect(ratio(theme.refusal, theme.background)).toBeGreaterThanOrEqual(AA_TEXT);
  });
});

describe("the touch targets of screens 23a and 31", () => {
  it.each(WIDTHS)("rows, Autor and the players keep 44 at %i of width", (width) => {
    const tokens = createScaledTokens({ windowWidth: width, fontScale: 1 });
    expect(tokens.sizes.minTouchTarget).toBeGreaterThanOrEqual(accessibilityFloors.touchTarget);
    expect(tokens.sizes.primaryButton).toBeGreaterThanOrEqual(accessibilityFloors.touchTarget);
    expect(tokens.sizes.chip).toBeGreaterThanOrEqual(accessibilityFloors.touchTarget);
  });
});
