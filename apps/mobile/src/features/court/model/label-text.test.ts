import { describe, expect, test } from "vitest";

import { createScaledTokens, shortSide } from "../../../theme/scale";
import { LABEL_SAFE_NAME_LETTERS } from "../court.data";
import { fitName, nameFontSize, nameOptions, nameTextWidth, textWidthInEm } from "./team-markers";

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
  "Ana C.",
  "Wellington P.",
  "Guilhermina Ca.",
] as const;

function tokensOf({ width, height }: { width: number; height: number }) {
  return createScaledTokens({ windowWidth: shortSide(width, height), fontScale: 1 });
}

describe("the name under a circle", () => {
  test.each(SCREENS)("the whole name is the first option at $width x $height", (screen) => {
    const tokens = tokensOf(screen);
    for (const name of NAMES) {
      expect(nameOptions(name, tokens)[0]?.text).toBe(name);
    }
  });

  test.each(SCREENS)(
    "the width of an option is the width of its text, same font and size at $width x $height",
    (screen) => {
      const tokens = tokensOf(screen);
      for (const name of NAMES) {
        for (const option of nameOptions(name, tokens)) {
          expect(option.width).toBeCloseTo(textWidthInEm(option.text) * nameFontSize(tokens), 6);
          expect(option.width).toBeCloseTo(nameTextWidth(option.text, tokens), 6);
        }
      }
    },
  );

  test.each(SCREENS)("the options shrink and never repeat at $width x $height", (screen) => {
    const tokens = tokensOf(screen);
    for (const name of NAMES) {
      const options = nameOptions(name, tokens);
      expect(new Set(options.map(({ text }) => text)).size).toBe(options.length);
      options.slice(1).forEach((option, index) => {
        expect(option.width).toBeLessThanOrEqual((options[index]?.width ?? 0) + 0.001);
      });
    }
  });

  test("a name of up to eight letters is shown whole when it has the room it asks for", () => {
    const tokens = tokensOf(SCREENS[1]);
    for (const name of ["Marcos", "Pedro", "Duda", "Ana", "Jaqueline", "Christian"]) {
      if (Array.from(name).length > LABEL_SAFE_NAME_LETTERS) continue;
      expect(fitName(name, nameTextWidth(name, tokens), tokens)).toBe(name);
    }
  });

  test("an abbreviation never loses its initial: the first name is shortened before it", () => {
    const tokens = tokensOf(SCREENS[1]);
    const fits = fitName("Wellington P.", nameTextWidth("Welli… P.", tokens), tokens);
    expect(fits.endsWith(" P.")).toBe(true);
    expect(fits).toContain(ELLIPSIS);
    expect(fitName("Ana C.", nameTextWidth("Ana C.", tokens), tokens)).toBe("Ana C.");
    expect(fitName("Ana C.", 1, tokens)).toBe(`A${ELLIPSIS} C.`);
  });

  test("two-letter abbreviations stay whole when the name is cut", () => {
    const tokens = tokensOf(SCREENS[1]);
    const cut = fitName("Guilhermina Ca.", nameTextWidth("Guilh… Ca.", tokens), tokens);
    expect(cut.endsWith(" Ca.")).toBe(true);
  });

  test("a cut name ends in the ellipsis character, never in two dots", () => {
    const tokens = tokensOf(SCREENS[1]);
    const cut = fitName("Guilhermina", nameTextWidth("Guilh", tokens), tokens);
    expect(cut.endsWith(ELLIPSIS)).toBe(true);
    expect(cut).not.toContain("..");
    expect(Array.from(cut).length).toBeLessThan(Array.from("Guilhermina").length);
  });
});
