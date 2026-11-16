/** `unknown` until the flag is read from the phone. */
export type OnboardingSkipState = "unknown" | "skipped" | "notSkipped";

/**
 * "Pular" with nothing to save (question 40): the quick profile does not open again on this phone until
 * the session ends. A flag only, with nothing of the person; it is forgotten by `clearSession`.
 */
export interface OnboardingSkip {
  /** For `useSyncExternalStore`: the listener is called whenever `snapshot()` changes. */
  subscribe(listener: () => void): () => void;
  snapshot(): OnboardingSkipState;
  markSkipped(): Promise<void>;
  clear(): Promise<void>;
}
