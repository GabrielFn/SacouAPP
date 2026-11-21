/**
 * Where each part of the card sits, as a share of the card itself (`.kc` of Perfil.dc.html: the inside is
 * 260 x 368 once the 5 of the frame are taken). Percentages, so the card keeps its shape at any size.
 */
export const cardLayout = {
  mesh: { height: "48.37%" },
  /** `maxWidth` stops short of the avatar (it starts at 46.92%): the text shrinks instead of going under it. */
  position: { left: "6.15%", top: "3.26%", maxWidth: "38%" },
  avatar: { top: "9.24%", right: "8.46%", width: "44.62%" },
  nameBand: { top: "47.28%", height: "15.22%" },
  /** From the end of the name band (47.28% + 15.22%) to the bottom: the grid of numbers, then the footer. */
  lower: { top: "62.5%" },
  stats: { side: "4.62%" },
  /**
   * `bottom` is a margin of the footer, and a margin in percent is a share of the WIDTH of the parent (260):
   * 10 of the drawing (`.kft`) over 260.
   */
  footer: { side: "5.38%", bottom: "3.85%" },
  /** One of the three columns of the grid of numbers. */
  statColumn: "33.33%",
} as const;

/** The mesh of the top (`.kmesh`), in a box of the width of the card. */
export const MESH_VIEW_BOX = { width: 260, height: 178 } as const;

/** The six squares of the glyph, in the viewBox of the drawing (`.klv svg`): 3 by 2, the last lit. */
export const GLYPH_VIEW_BOX = "0 0 26 18";
export const GLYPH_SQUARE = 7;
export const GLYPH_RADIUS = 1.5;
export const GLYPH_COLUMNS = [0, 9.5, 19] as const;
export const GLYPH_ROWS = [0, 10] as const;

/** A box that touches the edge of its parent. */
export const FLUSH = 0;
