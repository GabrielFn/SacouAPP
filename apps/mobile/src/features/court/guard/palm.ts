import { MIN_PALM_TOUCHES } from "../court.data";

const SINGLE_TOUCH = 1;

/** Two fingers or more at the same time on a zone are a palm resting on the screen. */
export function isPalmTouch(touchCount: number): boolean {
  return touchCount >= MIN_PALM_TOUCHES;
}

/**
 * The most fingers seen in one gesture. A single finger down starts a new gesture; any other count
 * only raises the peak, so the palm is still known when the fingers lift one by one.
 */
export function nextPeakTouches(peak: number, touchCount: number): number {
  return touchCount === SINGLE_TOUCH ? SINGLE_TOUCH : Math.max(peak, touchCount);
}
