export interface IdGenerator {
  /** A random lowercase UUID. */
  newId(): string;
}
