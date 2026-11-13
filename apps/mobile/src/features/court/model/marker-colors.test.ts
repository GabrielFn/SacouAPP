import { describe, expect, it } from "vitest";

import { contrastRatio } from "../../../theme/contrast";
import { TEAM_PALETTES } from "../../../theme/team-colors";
import { courtNightTheme, courtSunTheme } from "../../../theme/themes";
import { palette } from "../../../theme/tokens.data";
import { markerColors } from "./marker-colors";

const AA_TEXT = 4.5;
const themes = [
  ["sun", courtSunTheme],
  ["night", courtNightTheme],
] as const;
const teams = [
  ["orange", TEAM_PALETTES.orange],
  ["blue", TEAM_PALETTES.blue],
] as const;

function ratio(first: string, second: string): number {
  const result = contrastRatio(first, second);
  if (!result.ok) throw new Error(`invalid color ${first} ${second}`);
  return result.value;
}

describe.each(themes)("marker colors in the %s theme", (_name, theme) => {
  const states = [
    ["libero", { isServer: false, isLibero: true }],
    ["server", { isServer: true, isLibero: false }],
    ["regular", { isServer: false, isLibero: false }],
  ] as const;

  describe.each(teams)("team %s", (_team, palette_) => {
    it.each(states)("%s: the number reaches AA on the circle", (_label, chip) => {
      const colors = markerColors(chip, palette_, theme);
      expect(ratio(colors.ink, colors.fill)).toBeGreaterThanOrEqual(AA_TEXT);
    });
  });

  it("the name under the circle reaches AA on the court", () => {
    expect(ratio(theme.text, theme.background)).toBeGreaterThanOrEqual(AA_TEXT);
  });

  it("the regular circle wears the team color and the libero inverts the court", () => {
    const regular = markerColors({ isServer: false, isLibero: false }, TEAM_PALETTES.blue, theme);
    expect(regular).toMatchObject({
      fill: TEAM_PALETTES.blue.fill,
      ink: TEAM_PALETTES.blue.onFill,
    });
    const libero = markerColors({ isServer: false, isLibero: true }, TEAM_PALETTES.blue, theme);
    expect(libero).toMatchObject({ fill: theme.text, ink: theme.background });
  });

  it("the server stays yellow with black ink even if flagged as libero", () => {
    const colors = markerColors({ isServer: true, isLibero: true }, TEAM_PALETTES.orange, theme);
    expect(colors).toMatchObject({ fill: theme.accent, ink: palette.black });
  });
});
