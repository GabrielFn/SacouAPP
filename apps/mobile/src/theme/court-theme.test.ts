import { describe, expect, it } from "vitest";

import { contrastRatio } from "./contrast";
import { createScaledTokens } from "./scale";
import { TEAM_PALETTES } from "./team-colors";
import { courtNightTheme, courtSunTheme, type Theme } from "./themes";
import {
  accessibilityFloors,
  canvasWidth,
  courtBorderWidths,
  courtFontSizes,
  courtSizes,
  courtSpacing,
  palette,
} from "./tokens.data";
import golden from "./tokens.golden.json";

const AA_TEXT = 4.5;
const AA_LARGE = 3;
const SCORE_MIN = 7;
const WIDTHS = [320, canvasWidth, 600];
/** The touch targets of the court (menu button, lock, DESFAZER and Corrigir). */
const TOUCH_SIZES = ["menuButton", "lockButton", "undoButton"] as const;

function ratio(first: string, second: string): number {
  const result = contrastRatio(first, second);
  if (!result.ok) throw new Error(`invalid color ${first} ${second}`);
  return result.value;
}

describe("court tokens match the canvas golden", () => {
  it("sizes, fonts, borders and spacing of screens 09 and 10", () => {
    expect(courtSizes).toEqual(golden.courtTokens.sizes);
    expect(courtFontSizes).toEqual(golden.courtTokens.fontSizes);
    expect(courtBorderWidths).toEqual(golden.courtTokens.borderWidths);
    expect(courtSpacing).toEqual(golden.courtTokens.spacing);
    expect(palette.ballYellowLight).toBe(golden.courtTokens.pulseYellow);
  });
});

describe("court tokens scale with the window", () => {
  it.each(WIDTHS)("keeps the touch targets at 44 or more at width %s", (windowWidth) => {
    const { court } = createScaledTokens({ windowWidth, fontScale: 1 });
    for (const key of TOUCH_SIZES) {
      expect(court.sizes[key]).toBeGreaterThanOrEqual(accessibilityFloors.touchTarget);
    }
    for (const width of Object.values(court.borderWidths)) {
      expect(width).toBeGreaterThanOrEqual(accessibilityFloors.hairline);
    }
  });

  it("grows the chip and the type with the window, never past the cap of the font scale", () => {
    const small = createScaledTokens({ windowWidth: 320, fontScale: 1 }).court;
    const large = createScaledTokens({ windowWidth: 600, fontScale: 1 }).court;
    expect(large.sizes.chip).toBeGreaterThan(small.sizes.chip);
    expect(large.fontSizes.tag).toBeGreaterThan(small.fontSizes.tag);
    const capped = createScaledTokens({ windowWidth: canvasWidth, fontScale: 3 }).court;
    const atCap = createScaledTokens({ windowWidth: canvasWidth, fontScale: 1.3 }).court;
    expect(capped.fontSizes).toEqual(atCap.fontSizes);
  });

  it("is the canvas at the canvas width", () => {
    const { court } = createScaledTokens({ windowWidth: canvasWidth, fontScale: 1 });
    expect(court.sizes).toEqual(courtSizes);
    expect(court.fontSizes).toEqual(courtFontSizes);
  });
});

function pairsOf(theme: Theme) {
  return [
    ["text on the court", theme.text, theme.background],
    ["muted text on the court", theme.textMuted, theme.background],
    ["score at set point", theme.scoreHighlight, theme.background],
    ["text on the queue strip", theme.text, theme.queueSurface],
    ["muted text on the queue strip", theme.textMuted, theme.queueSurface],
  ] as const;
}

describe.each([
  ["sun", courtSunTheme],
  ["night", courtNightTheme],
] as const)("contrast of the %s theme", (_name, theme) => {
  it.each(pairsOf(theme))("%s reaches 7:1", (_label, foreground, background) => {
    expect(ratio(foreground, background)).toBeGreaterThanOrEqual(SCORE_MIN);
  });

  it("black on the yellow of the server and of the set point tag reaches 7:1", () => {
    expect(ratio(palette.black, theme.accent)).toBeGreaterThanOrEqual(SCORE_MIN);
  });
});

describe("why the sun theme keeps the score in the text color", () => {
  it("yellow on white does not reach even 3:1", () => {
    expect(ratio(palette.ballYellow, palette.white)).toBeLessThan(AA_LARGE);
  });

  it("the score at set point is the text color in the sun and yellow in the night", () => {
    expect(courtSunTheme.scoreHighlight).toBe(courtSunTheme.text);
    expect(courtNightTheme.scoreHighlight).toBe(palette.ballYellow);
  });

  it("the yellow tag has a black edge in the sun and no visible one in the night", () => {
    expect(ratio(courtSunTheme.serverOutline, courtSunTheme.background)).toBeGreaterThanOrEqual(
      SCORE_MIN,
    );
    expect(courtNightTheme.serverOutline).toBe(courtNightTheme.accent);
  });
});

describe("the colors of the teams", () => {
  it.each(Object.entries(TEAM_PALETTES))(
    "%s: text on its color and the letter badge",
    (_n, team) => {
      expect(ratio(team.onFill, team.fill)).toBeGreaterThanOrEqual(AA_TEXT);
      expect(ratio(team.onBadge, team.badgeFill)).toBeGreaterThanOrEqual(SCORE_MIN);
    },
  );

  it("each team edge reads on both court backgrounds", () => {
    for (const { fill } of Object.values(TEAM_PALETTES)) {
      expect(ratio(fill, palette.white)).toBeGreaterThanOrEqual(AA_LARGE);
      expect(ratio(fill, palette.black)).toBeGreaterThanOrEqual(AA_LARGE);
    }
  });

  it("the white pills of the queue read with black text in both themes", () => {
    expect(ratio(palette.black, palette.white)).toBeGreaterThanOrEqual(SCORE_MIN);
  });
});
