import type { CourtPoint } from "@sacou/volley-rules";

import { PERCENT } from "../court.data";

/** The team on top has the net below it, and the one at the bottom has it above. */
export type CourtEnd = "top" | "bottom";

/** A place on the half court square, in percent of its width and height (0 left/top, 100 right/bottom). */
export interface ScreenPlace {
  readonly x: number;
  readonly y: number;
}

const DECIMALS = 2;
/** The holder of a chip is this many courts wide, so the chip is centered on its point. */
const HOLDER_WIDTH_FACTOR = 2;

/**
 * The catalog places a team looking at the net: x from its left to its right, y from the net (0) to
 * the end line (1), and above 1 behind the line, where the server stands (rotacoes.md). The team at
 * the bottom of the screen looks up, so it is drawn as is. The team on top is turned half a turn:
 * both axes are mirrored, and its server lands above the square (a negative `y`).
 */
export function placeOnHalfCourt({ x, y }: CourtPoint, end: CourtEnd): ScreenPlace {
  const turned = end === "top";
  return {
    x: (turned ? 1 - x : x) * PERCENT,
    y: (turned ? 1 - y : y) * PERCENT,
  };
}

export function toPercentText(value: number): string {
  return `${value.toFixed(DECIMALS)}%`;
}

export function ratioToPercentText(ratio: number): string {
  return toPercentText(ratio * PERCENT);
}

export interface ChipAnchor {
  readonly left: string;
  readonly top: string;
  readonly width: string;
}

/**
 * A chip is as wide as its text, so it cannot be positioned by its own left edge. Its holder is twice
 * the width of the court and centered on the point: the chip is centered in it by `alignItems`, and
 * the holder is centered vertically by a `translateY` of -50%.
 */
export function anchorAt({ x, y }: ScreenPlace): ChipAnchor {
  return {
    left: toPercentText(x - PERCENT),
    top: toPercentText(y),
    width: toPercentText(PERCENT * HOLDER_WIDTH_FACTOR),
  };
}
