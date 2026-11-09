import { courtPalette, nightAlpha, nightRgb, palette } from "./tokens.data";

export const THEME_ROLES = [
  "background",
  "surface",
  "text",
  "textMuted",
  "primary",
  "onPrimary",
  "accent",
  "link",
  "borderCard",
  "borderDivider",
  "borderChip",
  "borderField",
  "borderDashed",
  "waitingFill",
  "waitingBorder",
  "scoreHighlight",
  "serverOutline",
  "queueSurface",
] as const;

export type ThemeRole = (typeof THEME_ROLES)[number];
export type Theme = Readonly<Record<ThemeRole, string>>;

function nightWithAlpha(alpha: number): string {
  return `rgba(${nightRgb}, ${String(alpha)})`;
}

export const appTheme = {
  background: palette.sand,
  surface: palette.white,
  text: palette.night,
  textMuted: palette.textSecondary,
  primary: palette.serveOrange,
  onPrimary: palette.night,
  accent: palette.ballYellow,
  link: palette.netBlue,
  borderCard: nightWithAlpha(nightAlpha.card),
  borderDivider: nightWithAlpha(nightAlpha.divider),
  borderChip: nightWithAlpha(nightAlpha.chip),
  borderField: nightWithAlpha(nightAlpha.field),
  borderDashed: nightWithAlpha(nightAlpha.dashed),
  waitingFill: palette.waitingFill,
  waitingBorder: palette.waitingBorder,
  scoreHighlight: palette.night,
  serverOutline: palette.night,
  queueSurface: palette.sand,
} as const satisfies Theme;

/**
 * `scoreHighlight` is the color of the score at set point: the yellow does not reach 3:1 on white,
 * so the sun theme keeps the text color and only the tag is yellow; on black the number is yellow
 * (QuadraNoite.dc.html). `serverOutline` is the border of the chip of the server, and
 * `queueSurface` the ground of the queue strip: sand by day, navy by night.
 */
interface CourtColors {
  readonly background: string;
  readonly foreground: string;
  readonly muted: string;
  readonly scoreHighlight: string;
  readonly serverOutline: string;
  readonly queueSurface: string;
}

function courtTheme(colors: CourtColors): Theme {
  return {
    background: colors.background,
    surface: colors.background,
    text: colors.foreground,
    textMuted: colors.muted,
    primary: palette.serveOrange,
    onPrimary: palette.night,
    accent: palette.ballYellow,
    link: colors.foreground,
    borderCard: colors.muted,
    borderDivider: colors.muted,
    borderChip: colors.muted,
    borderField: colors.muted,
    borderDashed: colors.muted,
    waitingFill: palette.waitingFill,
    waitingBorder: palette.waitingBorder,
    scoreHighlight: colors.scoreHighlight,
    serverOutline: colors.serverOutline,
    queueSurface: colors.queueSurface,
  };
}

export const courtSunTheme = courtTheme({
  ...courtPalette.sun,
  scoreHighlight: courtPalette.sun.foreground,
  serverOutline: courtPalette.sun.foreground,
  queueSurface: palette.sand,
});
export const courtNightTheme = courtTheme({
  ...courtPalette.night,
  scoreHighlight: palette.ballYellow,
  serverOutline: palette.ballYellow,
  queueSurface: palette.night,
});

export const themes = {
  app: appTheme,
  courtSun: courtSunTheme,
  courtNight: courtNightTheme,
} as const;

export type ThemeName = keyof typeof themes;
