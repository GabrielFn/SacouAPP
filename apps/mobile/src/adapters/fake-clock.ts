import type { Clock } from "../features/court/ports/clock";

/** A clock that moves only when told to. */
export interface FakeClock extends Clock {
  advance(milliseconds: number): void;
  set(milliseconds: number): void;
}

export function createFakeClock(start = 0): FakeClock {
  const time = { value: start };
  return {
    now: () => time.value,
    advance(milliseconds) {
      time.value += milliseconds;
    },
    set(milliseconds) {
      time.value = milliseconds;
    },
  };
}
