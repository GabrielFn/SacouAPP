/** A monotonic clock in milliseconds: only differences mean anything (the lock, the toast, the benchmark). */
export interface Clock {
  now(): number;
}
