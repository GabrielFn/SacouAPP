/** Which part of the app caught the error: a fixed name, never a value typed by someone. */
export interface ErrorContext {
  readonly area: string;
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
