/** A sample in [0, 1) for what only needs to vary (the backoff of the upload), never a secret. */
export interface RandomSource {
  next(): number;
}
