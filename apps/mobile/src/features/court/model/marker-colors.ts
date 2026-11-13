import type { TeamPalette } from "../../../theme/team-colors";
import type { Theme } from "../../../theme/themes";
import { palette } from "../../../theme/tokens.data";
import type { PlayerChipModel } from "./court-screen.types";

export interface MarkerColors {
  readonly fill: string;
  readonly border: string;
  /** The color of the number of the position, on the fill. */
  readonly ink: string;
}

type MarkerColorTheme = Pick<Theme, "accent" | "background" | "serverOutline" | "text">;

/**
 * The colors of the circle of a position. It wears the color of its team with the ink that team
 * uses; the server wears the yellow with black ink; the libero inverts the court (text color as the
 * fill, background as the ink). The server wins over the libero: the libero never serves.
 */
export function markerColors(
  chip: Pick<PlayerChipModel, "isServer" | "isLibero">,
  team: Pick<TeamPalette, "fill" | "onFill">,
  colors: MarkerColorTheme,
): MarkerColors {
  if (chip.isServer) {
    return { fill: colors.accent, border: colors.serverOutline, ink: palette.black };
  }
  if (chip.isLibero) {
    return { fill: colors.text, border: colors.text, ink: colors.background };
  }
  return { fill: team.fill, border: colors.text, ink: team.onFill };
}
