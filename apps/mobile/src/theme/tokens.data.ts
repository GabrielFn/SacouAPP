// Design tokens read from design/telas/*.dc.html. Numbers live here (data file) and are
// read by name everywhere else. The golden file tokens.golden.json mirrors the canvas.

export const palette = {
  sand: "#F6F1E7",
  night: "#0F1B2D",
  serveOrange: "#FF5A1F",
  ballYellow: "#FFC83D",
  netBlue: "#1F5BFF",
  white: "#FFFFFF",
  black: "#000000",
  textSecondary: "#4A5566",
  waitingFill: "#FFF3CF",
  waitingBorder: "#E0A400",
  highlight: "#F3E3C3",
} as const;

export const nightAlpha = {
  card: 0.12,
  divider: 0.14,
  chip: 0.18,
  field: 0.25,
  dashed: 0.4,
} as const;

export const courtPalette = {
  sun: { background: "#FFFFFF", foreground: "#000000", muted: "#3A3A3A" },
  night: { background: "#000000", foreground: "#FFFFFF", muted: "#C8C8C8" },
} as const;

export const fontFamilies = {
  display600: "BarlowCondensed-SemiBold",
  display700: "BarlowCondensed-Bold",
  display800: "BarlowCondensed-ExtraBold",
  body400: "Inter-Regular",
  body500: "Inter-Medium",
  body600: "Inter-SemiBold",
  body700: "Inter-Bold",
} as const;

export const fontSizes = {
  caption: 13,
  small: 14,
  body: 15,
  field: 16,
  button: 17,
  displayBlock: 18,
  displayMedium: 32,
  displayTitleSmall: 36,
  displayTitle: 40,
  displayTitleLarge: 44,
  displayScore: 132,
} as const;

export const spacing = {
  xs: 4,
  s6: 6,
  s: 8,
  s10: 10,
  m: 12,
  s14: 14,
  l: 16,
  xl: 20,
  xxl: 24,
  xxxl: 28,
} as const;

export const radii = {
  field: 12,
  button: 14,
  option: 15,
  tile: 16,
  card: 18,
  pill: 22,
} as const;

export const borderWidths = { thin: 1.5, thick: 2 } as const;

export const sizes = {
  minTouchTarget: 44,
  primaryButton: 56,
  iconButton: 48,
  field: 48,
  chip: 44,
  statusPill: 30,
  logo: 32,
  checkIcon: 16,
} as const;

export const interactiveHeights = [
  sizes.primaryButton,
  sizes.iconButton,
  sizes.field,
  sizes.chip,
] as const;

// Channels of palette.night, for the translucent borders.
export const nightRgb = "15, 27, 45";

// Canvas frame width (design/telas): the base of the scale. Accessibility floors are in dp.
export const canvasWidth = 390;
export const scaleLimits = { min: 0.85, max: 1.4 } as const;
export const fontScaleCap = 1.3;
export const accessibilityFloors = { touchTarget: 44, hairline: 1 } as const;
