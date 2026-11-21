import { sandRgb } from "./tokens.data";

/**
 * The player card (Perfil.dc.html `.kc`, Cartinha.dc.html), in canvas pixels of the FULL card (270 wide).
 * They scale by the real width of the card (`cardMeasuresFor`; the window only gives the first guess), and
 * the text by the system font scale up to `cardFontScaleCap`: the card is a picture with a fixed shape, so its text must not outgrow its bands.
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

/** The most the system font scale grows the text of the card (lower than the app cap: the bands are fixed). */
export const cardFontScaleCap = 1.15;

/**
 * The most the system font scale grows the six numbers and their labels: two rows of them and the footer
 * must fit under the name band (`player-card-budget.ts`), and at 1.15 they would not.
 */
export const cardStatsFontScaleCap = 1.05;

/** The number has `line-height: 1` (`.kst b`) and so has the brand; the label keeps the CSS `normal`. */
export const CARD_TIGHT_LINE_HEIGHT = 1;
export const CARD_LABEL_LINE_HEIGHT = 1.2;

/** How far the position may shrink to stay beside the avatar. */
export const POSITION_MIN_FONT_SCALE = 0.5;

/** How far the nickname may shrink to fit its band (adjustsFontSizeToFit). */
export const NAME_MIN_FONT_SCALE = 0.4;

/** The number of a stat tile of screen 14 (`.st`), in canvas pixels; grows with the system font scale. */
export const statTileValueFont = 30;

/** The width of the full card in the canvas (`.kc`), frame included: every card measure is relative to it. */
export const CARD_CANVAS_WIDTH = 270;

/** 190 of the compact card over the 270 of the full one: the ratio of the canvas (Perfil.dc.html). */
export const CARD_COMPACT_RATIO = 190 / CARD_CANVAS_WIDTH;

/** The shape of the card (`.kc`: 270 x 378). */
export const CARD_ASPECT_RATIO = CARD_CANVAS_WIDTH / 378;

/** The blue of the avatar (Perfil.dc.html `.kj`), one color for everyone (question 161). */
export const cardAvatarColor = "#33496B";

/** The sand of the labels over the night: 82% of opacity (`.kst span`). */
export const cardLabelColor = `rgba(${sandRgb}, 0.82)`;
/** The mesh lines: sand at 9% (`.kmesh`). */
export const cardMeshColor = `rgba(${sandRgb}, 0.09)`;
