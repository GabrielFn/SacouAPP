import type { ErrorReporter } from "../services/error-reporting/error-reporter";

/** Sentry off (no DSN in this build): errors stay on the phone, nothing is sent (ADR 0080, D1). */
export const noopErrorReporter: ErrorReporter = {
  captureError: () => undefined,
  crashNatively: () => undefined,
};
