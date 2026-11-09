import { palette } from "./tokens.data";

/** The color name a team wears; the roster says which, the theme says what it looks like. */
export type TeamColorName = "orange" | "blue";

/** How a team looks in the court: its color, the text on it and the letter badge (QuadraSol.dc.html:77). */
export interface TeamPalette {
  readonly fill: string;
  readonly onFill: string;
  readonly badgeFill: string;
  readonly onBadge: string;
}

export const TEAM_PALETTES: Readonly<Record<TeamColorName, TeamPalette>> = {
  orange: {
    fill: palette.serveOrange,
    onFill: palette.black,
    badgeFill: palette.black,
    onBadge: palette.white,
  },
  blue: {
    fill: palette.netBlue,
    onFill: palette.white,
    badgeFill: palette.white,
    onBadge: palette.black,
  },
};
