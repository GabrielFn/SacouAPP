/** Blocks the back button of the phone while the court is locked. */
export interface BackGuard {
  /** Starts blocking; the returned function stops it. */
  block(): () => void;
}
