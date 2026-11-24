import type { ErrorContext, ErrorReporter } from "../services/error-reporting/error-reporter";

export interface ReportedError {
  readonly error: unknown;
  readonly context: ErrorContext | undefined;
}

export interface FakeErrorReporter extends ErrorReporter {
  readonly captured: () => readonly ReportedError[];
  readonly nativeCrashes: () => number;
}

export function createFakeErrorReporter(): FakeErrorReporter {
  const captured = { value: [] as readonly ReportedError[] };
  const nativeCrashes = { value: 0 };
  return {
    captureError: (error, context) => {
      captured.value = [...captured.value, { error, context }];
    },
    crashNatively: () => {
      nativeCrashes.value += 1;
    },
    captured: () => captured.value,
    nativeCrashes: () => nativeCrashes.value,
  };
}
