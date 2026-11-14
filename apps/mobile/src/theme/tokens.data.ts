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
  // The light end of the set point tag pulse (QuadraNoite.dc.html:16).
  ballYellowLight: "#FFE08A",
} as const;

export const nightAlpha = {
  card: 0.12,
  divider: 0.14,
  chip: 0.18,
  field: 0.25,
  dashed: 0.4,
  badge: 0.07,
  // Off track of the switch, darker than the canvas (0.22) to reach 3:1 against the card (WCAG 1.4.11).
  trackOff: 0.5,
  segment: 0.08,
} as const;

export const courtPalette = {
  sun: { background: "#FFFFFF", foreground: "#000000", muted: "#3A3A3A" },
  night: { background: "#000000", foreground: "#FFFFFF", muted: "#C8C8C8" },
} as const;

/**
 * The fill of a button with nothing to do (DESFAZER with nothing to undo), the same in both themes:
 * light enough to tell from the black or white of the active button, and 4.5:1 or more against the
 * white and the black of the labels.
 */
export const courtDisabledFill = "#767676";

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
  displayBrand: 24,
  displayMedium: 32,
  statusPill: 14,
  link: 16,
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
  statusPill: 15,
  tabPill: 15,
  roleBadge: 13,
} as const;

export const borderWidths = { thin: 1.5, thick: 2 } as const;

// Icon stroke in viewBox units (Inicio.dc.html:26).
export const iconStroke = { plus: 2.2, check: 2.5 } as const;

export const sizes = {
  minTouchTarget: 44,
  primaryButton: 56,
  iconButton: 48,
  field: 48,
  chip: 44,
  statusPill: 30,
  logo: 26,
  plusIcon: 22,
  checkIcon: 16,
  // Navigation tabs (Grupos.dc.html, bottom bar): the pill behind the active icon, and the touch
  // target of each tab, taller than the floor because the label sits under the icon.
  tabPillWidth: 56,
  tabPillHeight: 30,
  tabItem: 56,
  tabIcon: 22,
  backIcon: 24,
  // Group card (Grupos.dc.html .main, .foot, .role) and the round list card of the home.
  groupCardMin: 128,
  cardFooter: 46,
  roleBadge: 26,
  // Switch (AjustesGrupo.dc.html .sw/.tr): track, knob and a touch target taller than the track.
  switchTrackWidth: 50,
  switchTrackHeight: 30,
  switchKnob: 24,
  switchInset: 3,
  switchTargetWidth: 58,
  switchTarget: 44,
  // Radio of the queue rule (RegraFila.dc.html .rd): the ring, and the thick border of the chosen one.
  radioDot: 24,
  radioDotSelectedBorder: 7,
  // Create group (CriarModelo.dc.html, CriarPerguntas.dc.html).
  templateOptionMin: 84,
  templateOptionZeroMin: 60,
  templateIconWidth: 44,
  templateIconHeight: 56,
  selectedBadge: 28,
  courtOption: 56,
  segment: 44,
  progressBar: 4,
  // Settings rows and the rotation systems grid.
  settingRowMin: 48,
  blockHeaderMin: 56,
  systemButton: 56,
  proBadge: 22,
  sheetHandle: 4,
  chevronIcon: 20,
  courtIconWidth: 30,
  courtIconHeight: 22,
  // Round screens (CriarRodada.dc.html, Rodada.dc.html): the orange dot of a leaf set only for the round.
  highlightDot: 8,
} as const;

/** Width of the day strip of a card, in proportion to the card (78 of the 358 of the canvas list). */
export const dayStripBasis = "22%";

export const interactiveHeights = [
  sizes.primaryButton,
  sizes.iconButton,
  sizes.field,
  sizes.chip,
  sizes.tabItem,
  sizes.cardFooter,
  sizes.switchTarget,
  sizes.segment,
  sizes.systemButton,
  sizes.templateOptionMin,
  sizes.courtOption,
  sizes.blockHeaderMin,
] as const;

// Channels of palette.night, for the translucent borders.
export const nightRgb = "15, 27, 45";

// Canvas frame width (design/telas): the base of the scale. Accessibility floors are in dp.
export const canvasWidth = 390;
export const scaleLimits = { min: 0.85, max: 1.4 } as const;
export const fontScaleCap = 1.3;
export const accessibilityFloors = { touchTarget: 44, hairline: 1 } as const;

// Measures of the court screens (QuadraSol.dc.html, QuadraNoite.dc.html), in canvas pixels. They are
// scaled by the window like the other tokens; the touch targets keep the floor of 44.
export const courtSizes = {
  chip: 30,
  setDot: 12,
  badge: 18,
  tag: 30,
  tagBadge: 22,
  pill: 32,
  pillBadge: 20,
  undoButton: 54,
  menuButton: 44,
  netMesh: 9,
  savedIcon: 15,
  menuIcon: 18,
  undoIcon: 22,
  correctIcon: 17,
  flameIcon: 17,
  ballIcon: 14,
  // The widest the plain pages of the court (menu, corrections, end of set and match) grow, so that
  // on a phone on its side the text keeps a readable line and the buttons are not a wide strip.
  sheetMaxWidth: 480,
} as const;

export const courtFontSizes = {
  setTitle: 22,
  chipNumber: 14,
  badge: 10,
  tag: 21,
  tagBadge: 15,
  pill: 19,
} as const;

export const courtBorderWidths = { outline: 2.5, frame: 3 } as const;

export const courtSpacing = {
  hairGap: 5,
  scoreGap: 22,
  badgeOffsetX: 6,
  badgeOffsetY: 9,
  chipGap: 4,
} as const;
