/**
 * The keys an error may carry besides its area, each one a Sentry tag (E5.2b, ADR 0080, D16). A closed
 * list: the scrubber lets only these through, and every value still passes through its text filter.
 */
export const ERROR_DETAIL_KEYS = [
  "auth.stage",
  "auth.failure",
  "auth.code",
  "auth.error_type",
  "auth.detail",
  "auth.google.response_type",
  "auth.google.has_id_token",
] as const;

export type ErrorDetailKey = (typeof ERROR_DETAIL_KEYS)[number];

export type ErrorDetails = Readonly<Partial<Record<ErrorDetailKey, string>>>;

/** Which part of the app caught the error: fixed names and validated values, never typed text. */
export interface ErrorContext {
  readonly area: string;
  readonly details?: ErrorDetails;
}

/**
 * Where the app sends the errors it did not expect (frontend.md, rule 3; E5.2, ADR 0080). The real one
 * cleans every event of personal data before it leaves; without a DSN nothing is sent at all.
 */
export interface ErrorReporter {
  captureError(error: unknown, context?: ErrorContext): void;
  /** Development screen only: crashes the native side, to prove that native crashes arrive. */
  crashNatively(): void;
}
