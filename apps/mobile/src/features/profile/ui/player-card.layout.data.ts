/**
 * Where each part of the card sits, as a share of the card itself (`.kc` of Perfil.dc.html: the inside is
 * 260 x 368 once the 5 of the frame are taken). Percentages, so the card keeps its shape at any size.
 */
export const cardLayout = {
  mesh: { height: "48.37%" },
  level: { left: "6.15%", top: "3.26%" },
  avatar: { top: "9.24%", right: "8.46%", width: "44.62%" },
  nameBand: { top: "47.28%", height: "15.22%" },
  stats: { side: "4.62%", top: "65.76%" },
  footer: { side: "5.38%", bottom: "2.72%" },
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
