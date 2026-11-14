/** A monotonic clock in milliseconds: only differences mean anything (the wait after a point, the benchmark). */
export interface Clock {
  now(): number;
}
