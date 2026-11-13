import { describe, expect, test } from "vitest";

import { createScaledTokens, shortSide } from "../../../theme/scale";
import { CHIP_SAFE_NAME_LETTERS } from "../court.data";
import { computeCourtLayout } from "./court-layout";
import type { PlayerChipModel } from "./court-screen.types";
import { chipMaxWidth, chipNameFontSize, chipSizes, chipTextWidth, fitName } from "./team-chips";

const SCREENS = [
  { width: 640, height: 360 },
  { width: 844, height: 390 },
  { width: 891, height: 411 },
  { width: 932, height: 430 },
] as const;
const ELLIPSIS = "…";
const NAMES = [
  "Ana",
  "Marcos",
  "Pedro",
  "Duda",
  "Wellington",
  "Bernardete",
  "Guilhermina",
] as const;
const PATTERN_ABBREVIATED = ["Ana C.", "Ana B.", "Wellington P.", "Guilhermina Ca."] as const;

function chipOf(displayName: string, isServer = false): PlayerChipModel {
  return {
    memberId: displayName,
    name: displayName,
    displayName,
    zone: 1,
    point: { x: 50, y: 50 },
    isServer,
    isSetter: false,
    isLibero: false,
  };
}

function inputOf({ width, height }: { width: number; height: number }) {
  return {
    layout: computeCourtLayout({
      windowWidth: width,
      windowHeight: height,
      insetTop: 0,
      insetBottom: 0,
      insetLeft: 0,
      insetRight: 0,
    }),
    tokens: createScaledTokens({ windowWidth: shortSide(width, height), fontScale: 1 }),
  };
}

describe("the name on a chip", () => {
  test.each(SCREENS)("names of up to eight letters are never cut at $width x $height", (screen) => {
    const input = inputOf(screen);
    for (const name of ["Marcos", "Pedro", "Duda", "Ana", "Jaqueline", "Christian"]) {
      if (Array.from(name).length > CHIP_SAFE_NAME_LETTERS) continue;
      for (const isServer of [false, true]) {
        expect(chipSizes(chipOf(name, isServer), input).label).toBe(name);
      }
    }
  });

  test.each(SCREENS)(
    "the width of the chip covers the label drawn, same font and size at $width x $height",
    (screen) => {
      const input = inputOf(screen);
      const { tokens } = input;
      const frame = (tokens.court.spacing.chipPadding + tokens.borderWidths.thick) * 2;
      for (const name of [...NAMES, ...PATTERN_ABBREVIATED]) {
        const { width, label } = chipSizes(chipOf(name), input);
        const drawnText = Array.from(label).length * chipNameFontSize(tokens) * 0.68;
        expect(chipTextWidth(label, tokens)).toBeCloseTo(drawnText, 6);
        expect(width).toBeGreaterThanOrEqual(frame + chipTextWidth(label, tokens));
        expect(width).toBeLessThanOrEqual(chipMaxWidth(input.layout, tokens) + 0.001);
      }
    },
  );

  test("an abbreviation never loses its initial: the first name is shortened before it", () => {
    const { tokens } = inputOf(SCREENS[1]);
    const fits = fitName("Wellington P.", chipTextWidth("Welli…", tokens) + 1, tokens);
    expect(fits.endsWith(" P.")).toBe(true);
    expect(fits).toContain(ELLIPSIS);
    expect(fitName("Ana C.", chipTextWidth("Ana C.", tokens), tokens)).toBe("Ana C.");
    expect(fitName("Ana C.", 1, tokens)).toBe(`A${ELLIPSIS} C.`);
  });

  test("a cut name ends in the ellipsis character, never in two dots", () => {
    const { tokens } = inputOf(SCREENS[1]);
    const cut = fitName("Guilhermina", chipTextWidth("Guilh", tokens), tokens);
    expect(cut.endsWith(ELLIPSIS)).toBe(true);
    expect(cut).not.toContain("..");
    expect(Array.from(cut).length).toBeLessThan(Array.from("Guilhermina").length);
  });
});
