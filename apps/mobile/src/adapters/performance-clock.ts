import type { Clock } from "../features/court/ports/clock";

export const performanceClock: Clock = { now: () => performance.now() };
