import { nightRgb } from "./tokens.data";

// Measures of the three sheets of the court (PontoIndividual.dc.html, MenuQuadra.dc.html,
// Corrigir.dc.html), in canvas pixels, scaled by the window like the other tokens.
export const sheetSizes = {
  /** A player card of the point author sheet (.pl). */
  playerCard: 64,
  /** The setter badge on that card (.st). */
  authorBadge: 18,
  /** A row of the match menu (.it). */
  menuRow: 52,
  /** The A/B mark of a line of Corrigir (.tm). */
  teamMark: 24,
  /** Cancel and confirm of the "Voltar o jogo para...?" panel. */
  revertButton: 52,
} as const;

export const sheetFontSizes = {
  titleLarge: 30,
  titleMenu: 28,
  authorBadge: 10,
  rowScore: 23,
  revertTitle: 26,
} as const;

export const sheetRadii = { teamMark: 7 } as const;

/** The scrim over the court and the grab handle; the sand of the sheet is `palette.sand`. */
export const sheetColors = {
  scrim: `rgba(${nightRgb}, 0.62)`,
  handle: `rgba(${nightRgb}, 0.25)`,
} as const;

/** Targets of the sheets that must reach the touch floor. */
export const sheetTouchHeights = [
  sheetSizes.playerCard,
  sheetSizes.menuRow,
  sheetSizes.revertButton,
] as const;
