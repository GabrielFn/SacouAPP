import type { RotationSlot } from "@sacou/volley-rules";

/** The players of the rally as the canvas of screen 31 lays them: the front row (2, 3, 4), then the
 * back row under them (1, 6, 5). */
export const RALLY_DISPLAY_SLOTS: readonly RotationSlot[] = [2, 3, 4, 1, 6, 5];
