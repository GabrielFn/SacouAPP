import {
  SCORE_DIGIT_WIDTH_EM,
  SCORE_FULL_SIZE_MAX_DIGITS,
  SCORE_LETTER_SPACING_EM,
  SCORE_LINE_HEIGHT_EM,
  SCORE_MANY_DIGIT_RATIO,
  SCORE_THREE_DIGIT_RATIO,
  SCORE_ZONE_RATIO,
} from "../court.data";

const THREE_DIGITS = 3;

export interface ScoreSizeInput {
  readonly zoneHeight: number;
  readonly sideWidth: number;
  readonly score: number;
}

export interface ScoreTextSize {
  readonly fontSize: number;
  readonly lineHeight: number;
  readonly letterSpacing: number;
}

export function countDigits(score: number): number {
  return String(Math.trunc(Math.abs(score))).length;
}

function digitRatio(digits: number): number {
  if (digits <= SCORE_FULL_SIZE_MAX_DIGITS) {
    return 1;
  }
  return digits === THREE_DIGITS ? SCORE_THREE_DIGIT_RATIO : SCORE_MANY_DIGIT_RATIO;
}

/**
 * There is no ceiling on the score. Up to two digits the number is 45% of the height of its zone
 * (produto.md:134); from three digits it shrinks, and it never gets wider than the side column.
 */
export function scoreTextSize({ zoneHeight, sideWidth, score }: ScoreSizeInput): ScoreTextSize {
  const digits = countDigits(score);
  const wanted = zoneHeight * SCORE_ZONE_RATIO * digitRatio(digits);
  const fontSize = Math.min(wanted, sideWidth / (digits * SCORE_DIGIT_WIDTH_EM));
  return {
    fontSize,
    lineHeight: fontSize * SCORE_LINE_HEIGHT_EM,
    letterSpacing: fontSize * SCORE_LETTER_SPACING_EM,
  };
}
