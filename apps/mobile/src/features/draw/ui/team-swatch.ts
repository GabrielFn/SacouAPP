import { TEAM_PALETTES } from "../../../theme/team-colors";
import type { Theme } from "../../../theme/themes";
import type { TeamColor } from "../model/team-identity";

export interface TeamSwatch {
  readonly fill: string;
  readonly onFill: string;
}

/** Laranja and Azul wear their court colors; from the third team on, the card is navy (D4). */
export function teamSwatch(color: TeamColor, colors: Theme): TeamSwatch {
  if (color === "neutral") return { fill: colors.panelSurface, onFill: colors.onPanel };
  const { fill, onFill } = TEAM_PALETTES[color];
  return { fill, onFill };
}
