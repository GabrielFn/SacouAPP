import { cardAvatarColor, cardLabelColor, cardMeshColor } from "./card-tokens.data";
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
  "badgeSurface",
  "trackOff",
  "segmentSurface",
  "avatarSurface",
  "infoFill",
  "infoText",
  "danger",
  "refusal",
  "dangerFill",
  "dangerTitle",
  "panelSurface",
  "onPanel",
  "panelAccent",
  "noticeFill",
  "suggestBorder",
  "suggestText",
  "goingFill",
  "goingText",
  "selectFill",
  "selectOutline",
  "meterBand",
  "cardAvatarSurface",
  "cardLabel",
  "cardMesh",
] as const;

export type ThemeRole = (typeof THEME_ROLES)[number];
export type Theme = Readonly<Record<ThemeRole, string>>;

function nightWithAlpha(alpha: number): string {
  return `rgba(${nightRgb}, ${String(alpha)})`;
}

/** Colors that do not change with the theme: member rows, notices, the danger text and the dark panel of the round. */
const memberColors = {
  avatarSurface: palette.avatarSurface,
  infoFill: palette.infoFill,
  infoText: palette.infoText,
  danger: palette.danger,
  dangerFill: palette.dangerFill,
  dangerTitle: palette.dangerTitle,
  // The dark panel of the round (Rodada.dc.html, RodadaJogador.dc.html): sand text, yellow counts.
  panelSurface: palette.night,
  onPanel: palette.sand,
  panelAccent: palette.ballYellow,
  noticeFill: palette.noticeFill,
  suggestBorder: palette.suggestBorder,
  suggestText: palette.suggestText,
  goingFill: palette.goingFill,
  goingText: palette.goingText,
  // The draw (Sorteio.dc.html): a selected name and the band of the meter.
  selectFill: palette.selectFill,
  selectOutline: palette.netBlue,
  meterBand: palette.meterBand,
  // The player card (Perfil.dc.html .kc): the avatar blue, the labels and the mesh over the night.
  cardAvatarSurface: cardAvatarColor,
  cardLabel: cardLabelColor,
  cardMesh: cardMeshColor,
} as const;

/** One ground and its text for the day strip of a round card (Grupos.dc.html .day). */
export interface DayStripSwatch {
  readonly fill: string;
  readonly text: string;
}

/**
 * The day strips of the canvas, in order: orange, navy and yellow. Each group keeps one, picked from its
 * `groupId`, so the same group has the same color on the home and on the list (AA checked in the tests).
 */
export const dayStripSwatches: readonly DayStripSwatch[] = [
  { fill: palette.serveOrange, text: palette.night },
  { fill: palette.night, text: palette.sand },
  { fill: palette.ballYellow, text: palette.night },
];

export const appTheme = {
  background: palette.sand,
  surface: palette.white,
  text: palette.night,
  textMuted: palette.textSecondary,
  refusal: palette.danger,
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
  badgeSurface: nightWithAlpha(nightAlpha.badge),
  trackOff: nightWithAlpha(nightAlpha.trackOff),
  segmentSurface: nightWithAlpha(nightAlpha.segment),
  ...memberColors,
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
  readonly refusal: string;
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
    refusal: colors.refusal,
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
    badgeSurface: colors.background,
    trackOff: colors.muted,
    segmentSurface: colors.background,
    // The court has no member rows: the same colors as the app, for a complete theme.
    ...memberColors,
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
