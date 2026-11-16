import { palette, sandAlpha, sandRgb } from "./tokens.data";

function sandWithAlpha(alpha: number): string {
  return `rgba(${sandRgb}, ${String(alpha)})`;
}

/** The night top of the login (Login.dc.html): the ground, the lines of the court and the light text. */
export const loginColors = {
  ground: palette.night,
  foreground: palette.sand,
  heroMuted: sandWithAlpha(sandAlpha.heroMuted),
  courtLine: sandWithAlpha(sandAlpha.courtLine),
  net: sandWithAlpha(sandAlpha.net),
  mesh: sandWithAlpha(sandAlpha.mesh),
  googleBadge: palette.white,
  googleMark: palette.netBlue,
} as const;
