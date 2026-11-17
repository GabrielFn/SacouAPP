import { accessibilityFloors, courtBorderWidths, courtSpacing } from "../../theme/tokens.data";

// Constants of the court screens. Measures come from QuadraSol.dc.html (390 x 844 canvas).

/**
 * The height of the screen is shared in weights, not in pixels: the bar, a team zone, the middle
 * strip and the queue (the canvas has 44 + 288 + 104 + 288 + 120 = 844).
 */
export const COURT_FLEX_WEIGHTS = {
  bar: 44,
  zone: 288,
  strip: 104,
  queue: 120,
} as const;

export const COURT_TOTAL_WEIGHT =
  COURT_FLEX_WEIGHTS.bar +
  COURT_FLEX_WEIGHTS.zone * 2 +
  COURT_FLEX_WEIGHTS.strip +
  COURT_FLEX_WEIGHTS.queue;

/** The columns of a team zone, as fractions of the width: 16 | 140 | 8 | 210 | 16 of 390. */
export const COURT_ZONE_RATIOS = {
  edge: 16 / 390,
  side: 140 / 390,
} as const;

/** The half court is a square of this fraction of the width (210 of 390)... */
export const HALF_COURT_WIDTH_RATIO = 210 / 390;
/** ...and never taller than this fraction of its zone (210 of 288). */
export const HALF_COURT_ZONE_RATIO = 210 / 288;

/** The attack line sits 70 of 210 from the net. */
export const ATTACK_LINE_RATIO = 70 / 210;

export const PERCENT = 100;

/** Chips lie on the half court; the net is at 0 on the y axis and the end line at 1. */
export const NET_Y = 0;
export const END_LINE_Y = 1;

/*
 * Landscape (E4.17): the court turned on its side, 844 x 390. There is no screen in design/, so the
 * measures come from the sketch the product owner approved, docs/estado/tarefas/E4.17-paisagem.html.
 */

/** The height is shared as: bar 44, the middle (zones and net) 294, queue 52 of 390. */
export const LANDSCAPE_FLEX_WEIGHTS = { bar: 44, middle: 294, queue: 52 } as const;

export const LANDSCAPE_TOTAL_HEIGHT_WEIGHT =
  LANDSCAPE_FLEX_WEIGHTS.bar + LANDSCAPE_FLEX_WEIGHTS.middle + LANDSCAPE_FLEX_WEIGHTS.queue;

/**
 * The width is shared as: team A 382 | net 80 | team B 382 of 844. The net was 112 wide in the
 * approved sketch; the phone test of 13/11/2026 asked for a bigger court (ADR 0052), and the net
 * keeps what its two buttons need (64 wide in 844 x 390; the words are small so they have air), never less than `NET_MIN_WIDTH`.
 */
export const LANDSCAPE_WIDTH_WEIGHTS = { zone: 382, net: 80 } as const;

/** The two sides of the net column, and the breath a button keeps from them (in canvas pixels). */
const BOTH_SIDES_OF_THE_NET = 2;
const NET_BREATH = 4;

/**
 * The net column is never narrower than this: the touch target of its buttons, the frame of the net
 * and the air at its sides on both sides, and a little breath, so no button spills over a zone.
 */
export const NET_MIN_WIDTH =
  accessibilityFloors.touchTarget +
  (courtBorderWidths.frame + courtSpacing.hairGap) * BOTH_SIDES_OF_THE_NET +
  NET_BREATH;

export const LANDSCAPE_TOTAL_WIDTH_WEIGHT =
  LANDSCAPE_WIDTH_WEIGHTS.zone * 2 + LANDSCAPE_WIDTH_WEIGHTS.net;

/**
 * In a zone of 382: 4 of margin, the column of 103 (the two digits of the score of 112 are 103 wide)
 * and the square of 275 at the net.
 */
export const LANDSCAPE_ZONE_RATIOS = { edge: 4 / 382, side: 103 / 382 } as const;

/** The square is at most 280 of the 382 of the zone width (the column leaves it 275)... */
export const LANDSCAPE_HALF_COURT_WIDTH_RATIO = 280 / 382;
/**
 * ...and never more than 256 of the 294 of its height: the phone test of 17/11/2026 showed the end
 * line and the names of the bottom row under the queue, so the zone keeps 38 free for the names.
 */
export const LANDSCAPE_HALF_COURT_ZONE_RATIO = 256 / 294;

/** Of the free height of the zone, the square leaves this share above it and the rest below, for the names (0.4 or less crosses names at 640 x 360). */
export const LANDSCAPE_SQUARE_TOP_SHARE = 0.5;

/**
 * The score is 38% of the zone height in landscape (112 of the 294), a little less than the 45% of
 * produto.md:134: the court grew by decision of the product owner on 13/11/2026 (ADR 0052).
 */
export const LANDSCAPE_SCORE_ZONE_RATIO = 0.38;

/** In the net column: Desfazer takes what Corrigir (64) leaves of the 274 inside the padding. */
export const NET_COLUMN_FLEX = { undo: 202, correct: 64 } as const;

/** The score is at least this fraction of the height of its zone (132 of 288, produto.md:134). */
export const SCORE_ZONE_RATIO = 132 / 288;
/** The score keeps full size up to two digits; three or more digits shrink it. */
export const SCORE_FULL_SIZE_MAX_DIGITS = 2;
export const SCORE_THREE_DIGIT_RATIO = 0.7;
export const SCORE_MANY_DIGIT_RATIO = 0.5;
/** Width of a digit of the display font as a fraction of its size, with the tight tracking. */
export const SCORE_DIGIT_WIDTH_EM = 0.46;
/** The score is tight (-4 of 132) and its line is a little shorter than the font. */
export const SCORE_LETTER_SPACING_EM = -4 / 132;
export const SCORE_LINE_HEIGHT_EM = 0.92;

/** Layout of the strip between the zones: Corrigir keeps 112 of the 358 of free width. */
export const STRIP_FLEX = { undo: 246, correct: 112 } as const;

/** The mesh of the net: lines at 45 degrees every 7 units, 1.2 thick (QuadraSol.dc.html:34). */
export const NET_MESH = { period: 7, line: 1.2 } as const;
export const NET_MESH_PATTERN_ID = "net-mesh";

/** A recent win streak shown in the queue is a whole count of finished matches. */
export const MIN_STREAK_TO_SHOW = 1;

/** An edge flush with its parent: styles do not take bare numbers, so zero has a name. */
export const FLUSH = 0;

/** After a point the zones ignore taps for this long, against a double tap (produto.md:136). */
export const POINT_COOLDOWN_MS = 700;

/** A touch with this many fingers or more is a palm, not a point. */
export const MIN_PALM_TOUCHES = 2;

/** One breath of the set point tag, from the yellow to the light yellow (screen 10). */
export const SET_POINT_PULSE_MS = 700;

/** The keep-awake tag of the court: the screen stays on while the court is open. */
export const KEEP_AWAKE_TAG = "sacou-court";

/** A DESFAZER with nothing to undo; the state is also told to the screen reader. */
export const DISABLED_OPACITY = 0.4;

/** More than this many waiting in the queue and the rest is a "+k": the strip keeps one row. */
export const MAX_QUEUE_PILLS = 4;

/** The lines of text in the team column have this line height, so its height can be known beforehand. */
export const COLUMN_LINE_HEIGHT_EM = 1.35;

/**
 * The name under a circle is drawn at an average letter width (a little wide, so the font never cuts
 * it), as a fraction of its font size: lower case, upper case, wide letters (Inter Bold: M 0.93,
 * W 1.04) and the ellipsis, which measures a whole em in Inter Bold.
 */
export const LABEL_CHAR_WIDTH_EM = 0.72;
export const LABEL_UPPER_CHAR_WIDTH_EM = 0.9;
export const LABEL_WIDE_CHAR_WIDTH_EM = 1.04;
export const LABEL_ELLIPSIS_WIDTH_EM = 1;
/** The line of the name is this high, as a fraction of its font size. */
export const LABEL_LINE_HEIGHT_EM = 1.2;
/** Names of up to this many letters are never cut while there is room (a test holds it). */
export const LABEL_SAFE_NAME_LETTERS = 8;
/** The air kept between the circles and names and the edges of the zone (the bar, the queue, the screen). */
export const MARKER_ZONE_MARGIN = 10;

/** A pill of the queue in the row of landscape is at most 220 of the 844 of the width wide, so a name is cut only when the strip is really full. */
export const QUEUE_PILL_MAX_WIDTH_RATIO = 220 / LANDSCAPE_TOTAL_WIDTH_WEIGHT;

/** Halves a length: the middle of a chip, a zone or the net. */
export const HALF = 2;

/** Below this battery level (0 to 1) the court suggests plugging the phone in (ADR 0046). */
export const BATTERY_WARNING_LEVEL = 0.2;

/** The battery level is shown as a percentage of this. */
export const PERCENT_BASE = 100;
