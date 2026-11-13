import type { CourtPoint } from "@sacou/volley-rules";

import { PERCENT } from "../court.data";

/**
 * The end of the screen a team is at, which is also the side its net is on: the team on top has the
 * net below it, the one at the bottom above it, the one on the left (landscape) has it to its right
 * and the one on the right to its left.
 */
export type CourtEnd = "top" | "bottom" | "left" | "right";

/** A place on the half court square, in percent of its width and height (0 left/top, 100 right/bottom). */
export interface ScreenPlace {
  readonly x: number;
  readonly y: number;
}

const DECIMALS = 2;

/**
 * The catalog places a team looking at the net: x from its left to its right, y from the net (0) to
 * the end line (1), and above 1 behind the line, where the server stands (rotacoes.md). Each end
 * turns the team to look at its net:
 * - bottom: drawn as is (the net is above);
 * - top: half a turn, both axes mirrored; its server lands above the square (a negative `y`);
 * - left: the net is on the right, so depth runs right to left and the team's right hand is down;
 * - right: the net is on the left, so depth runs left to right and the team's right hand is up.
 */
export function placeOnHalfCourt({ x, y }: CourtPoint, end: CourtEnd): ScreenPlace {
  const turned = (value: number) => PERCENT * (1 - value);
  switch (end) {
    case "bottom":
      return { x: x * PERCENT, y: y * PERCENT };
    case "top":
      return { x: turned(x), y: turned(y) };
    case "left":
      return { x: turned(y), y: x * PERCENT };
    case "right":
      return { x: y * PERCENT, y: turned(x) };
  }
}

export function toPercentText(value: number): string {
  return `${value.toFixed(DECIMALS)}%`;
}

export function ratioToPercentText(ratio: number): string {
  return toPercentText(ratio * PERCENT);
}
