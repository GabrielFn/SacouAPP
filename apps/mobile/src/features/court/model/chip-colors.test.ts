import { describe, expect, it } from "vitest";

import { contrastRatio } from "../../../theme/contrast";
import { courtNightTheme, courtSunTheme } from "../../../theme/themes";
import { palette } from "../../../theme/tokens.data";
import { chipColors } from "./chip-colors";

const AA_TEXT = 4.5;
const themes = [
  ["sun", courtSunTheme],
  ["night", courtNightTheme],
] as const;

function ratio(first: string, second: string): number {
  const result = contrastRatio(first, second);
  if (!result.ok) throw new Error(`invalid color ${first} ${second}`);
  return result.value;
}

describe.each(themes)("chip colors in the %s theme", (_name, theme) => {
  const states = [
    ["libero", { isServer: false, isLibero: true }],
    ["server", { isServer: true, isLibero: false }],
    ["regular", { isServer: false, isLibero: false }],
  ] as const;

  it.each(states)("%s: name and zone reach AA on the fill", (_label, chip) => {
    const colors = chipColors(chip, theme);
    expect(ratio(colors.ink, colors.fill)).toBeGreaterThanOrEqual(AA_TEXT);
    expect(ratio(colors.subtleInk, colors.fill)).toBeGreaterThanOrEqual(AA_TEXT);
  });

  it("the libero inverts the court and the regular chip does not", () => {
    const libero = chipColors({ isServer: false, isLibero: true }, theme);
    expect(libero).toMatchObject({ fill: theme.text, ink: theme.background });
    expect(chipColors({ isServer: false, isLibero: false }, theme).fill).toBe(theme.background);
  });

  it("the libero chip stands out from the court it is drawn on", () => {
    expect(
      ratio(chipColors({ isServer: false, isLibero: true }, theme).fill, theme.background),
    ).toBeGreaterThanOrEqual(AA_TEXT);
  });

  it("the server stays yellow with black ink even if flagged as libero", () => {
    const colors = chipColors({ isServer: true, isLibero: true }, theme);
    expect(colors).toMatchObject({ fill: theme.accent, ink: palette.black });
  });
});
