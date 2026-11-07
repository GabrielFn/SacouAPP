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
} as const satisfies Theme;

function courtTheme(colors: { background: string; foreground: string; muted: string }): Theme {
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
  };
}

export const courtSunTheme = courtTheme(courtPalette.sun);
export const courtNightTheme = courtTheme(courtPalette.night);

export const themes = {
  app: appTheme,
  courtSun: courtSunTheme,
  courtNight: courtNightTheme,
} as const;

export type ThemeName = keyof typeof themes;
