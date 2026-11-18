/** The draw of who leaves the court (criterion `draw`, E4.10 D7): never `Math.random` in a screen. */
export interface Shuffler {
  shuffle<T>(items: readonly T[]): readonly T[];
}
