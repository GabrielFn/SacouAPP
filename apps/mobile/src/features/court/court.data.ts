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

/**
 * How long the Menu button is held to open the menu (decision of the plan; the lock itself arrives
 * with the device resources in part 3 of E4.9).
 */
export const HOLD_TO_OPEN_MENU_MS = 800;

/** How long the lock is held to unlock the screen. */
export const HOLD_TO_UNLOCK_MS = 800;

/** After a point the zones ignore taps for this long, against a double tap (produto.md:136). */
export const POINT_COOLDOWN_MS = 700;

/** How long the toast "+1 Laranja (19-15)" stays in the line of the middle strip. */
export const POINT_TOAST_MS = 1500;

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
