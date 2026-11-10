import type { Theme } from "../../../theme/themes";
import { palette } from "../../../theme/tokens.data";
import type { PlayerChipModel } from "./court-screen.types";

export interface ChipColors {
  readonly fill: string;
  readonly border: string;
  readonly ink: string;
  readonly subtleInk: string;
}

type ChipColorTheme = Pick<Theme, "accent" | "background" | "serverOutline" | "text" | "textMuted">;

/**
 * The colors of a chip. The server wears the yellow with black ink; the libero inverts the court
 * (text color as the fill, background as the ink); everyone else is the court with a text border.
 * The server wins over the libero: the libero never serves, so the two never meet.
 */
export function chipColors(
  chip: Pick<PlayerChipModel, "isServer" | "isLibero">,
  colors: ChipColorTheme,
): ChipColors {
  if (chip.isServer) {
    return {
      fill: colors.accent,
      border: colors.serverOutline,
      ink: palette.black,
      subtleInk: palette.black,
    };
  }
  if (chip.isLibero) {
    return {
      fill: colors.text,
      border: colors.text,
      ink: colors.background,
      subtleInk: colors.background,
    };
  }
  return {
    fill: colors.background,
    border: colors.text,
    ink: colors.text,
    subtleInk: colors.textMuted,
  };
}
