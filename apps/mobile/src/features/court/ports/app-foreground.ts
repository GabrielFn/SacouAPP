/** Tells when the app comes back to the front, a moment to try the upload again (ADR 0067, D3). */
export interface AppForeground {
  /** Returns the function that stops listening. */
  subscribe(listener: () => void): () => void;
}
