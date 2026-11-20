import { sandRgb } from "./tokens.data";

/**
 * The player card (Perfil.dc.html `.kc`, Cartinha.dc.html), in canvas pixels of the FULL card (270 wide).
 * They scale by the window like the other tokens, but not by the system font scale: the card is a
 * picture with a fixed shape, and its text must not outgrow its bands (ADR 0046 of the pilot card).
 * The compact card (screen 14) is the full one times `CARD_COMPACT_RATIO`, declared once here.
 */
export const cardMeasures = {
  /** "Ponteiro" over the mesh. */
  positionFont: 20,
  /** The initials in the avatar. */
  initialsFont: 50,
  /** The nickname in the orange band. */
  nameFont: 46,
  statValueFont: 30,
  statLabelFont: 12,
  brandFont: 17,
  seasonFont: 12,
  /** The glyph of the six squares under the position. */
  glyphWidth: 34,
  glyphHeight: 22,
  glyphGap: 6,
  seasonHeight: 22,
  seasonPadding: 9,
  statRowGap: 8,
  frameRadius: 24,
  /** Half the avatar (`.kj`: 116), so it is a circle at any size. */
  avatarRadius: 58,
  seasonRadius: 11,
  frameBorder: 5,
  avatarBorder: 3,
  /** The spacing of the lines of the mesh. */
  meshStep: 12,
  meshStroke: 1.5,
} as const;

/** 190 of the compact card over the 270 of the full one: the ratio of the canvas (Perfil.dc.html). */
export const CARD_COMPACT_RATIO = 190 / 270;

/** The shape of the card (`.kc`: 270 x 378). */
export const CARD_ASPECT_RATIO = 270 / 378;

/** The sand of the labels over the night: 82% of opacity (`.kst span`). */
export const cardLabelColor = `rgba(${sandRgb}, 0.82)`;
/** The mesh lines: sand at 9% (`.kmesh`). */
export const cardMeshColor = `rgba(${sandRgb}, 0.09)`;
