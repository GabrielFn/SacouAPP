import type { AuthFailure } from "../services/auth/auth-session";
import type { ErrorDetails, ErrorReporter } from "../services/error-reporting/error-reporter";
import { redactText } from "../services/error-reporting/scrub-event";

/**
 * The sign-in failures the app did not expect, as they reach Sentry (E5.2b, ADR 0080, D16). Only the
 * stage, a validated code, a validated error type, the stack frames and the Google signals leave: never
 * the SDK's message, which may carry the e-mail, nor any other property of the original error.
 */

/** Each call of the Google and Firebase SDKs in a sign-in, as the tag `auth.stage` names it. */
export type AuthStage =
  | "google-play-services"
  | "google-picker"
  | "google-response"
  | "firebase-google-credential"
  | "firebase-email-sign-in"
  | "firebase-email-sign-up"
  | "firebase-password-reset"
  | "firebase-reauth-google"
  | "firebase-reauth-password";

/** The failures worth an event: the unexpected one, and a provider the SDK says is off. */
export type ReportedAuthFailure = Extract<AuthFailure, "unexpected" | "provider-unavailable">;

export type GoogleResponseType = "success" | "cancelled" | "other";

/** What the Google picker answered, read only at the `google-response` stage. */
export interface GoogleResponseSignals {
  readonly responseType: GoogleResponseType;
  readonly hasIdToken: boolean;
}

/** One failed stage: the error the SDK threw (`thrown`), or none when the answer itself was wrong. */
export interface AuthFailureInput {
  readonly stage: AuthStage;
  readonly failure: AuthFailure;
  readonly thrown?: { readonly error: unknown };
  readonly google?: GoogleResponseSignals;
}

export interface AuthFailureReport {
  readonly stage: AuthStage;
  readonly failure: ReportedAuthFailure;
  readonly code: string;
  readonly errorType: string;
  readonly detail: string | null;
  readonly frames: readonly string[];
  readonly google: GoogleResponseSignals | null;
}

/** Reports a failed sign-in stage when it is worth an event; never throws and never changes the result. */
export interface AuthFailureReporter {
  report(input: AuthFailureInput): void;
}

export const NO_VALUE = "none";
export const UNRECOGNIZED = "unrecognized";
export const NON_ERROR = "non-error";
const DEFAULT_ERROR_TYPE = "Error";
const AUTH_AREA = "auth";

const CODE_PATTERN = /^(auth\/[a-z0-9-]{1,60}|-?[0-9]{1,6}|[A-Z][A-Z0-9_]{0,39})$/;
const ERROR_TYPE_PATTERN = /^[A-Za-z][A-Za-z0-9_]{0,59}$/;
const FRAME_PATTERN = /^\s*at\s/;
const DETAIL_PATTERN = /\[\s*([A-Z][A-Z0-9_]{1,59}|[0-9]{1,6}):?\s*\]/;
const LINE_BREAK = /\r?\n/;
const REPORTED_FAILURES: readonly AuthFailure[] = ["unexpected", "provider-unavailable"];

function isReported(failure: AuthFailure): failure is ReportedAuthFailure {
  return REPORTED_FAILURES.includes(failure);
}

function isObject(value: unknown): value is object {
  return typeof value === "object" && value !== null;
}

function propertyOf(error: unknown, key: string): unknown {
  return isObject(error) && key in error
    ? (error as Readonly<Record<string, unknown>>)[key]
    : undefined;
}

/** The code of the SDK only when it fits a closed shape (criterion 9): an e-mail never does. */
export function codeOf(thrown: AuthFailureInput["thrown"]): string {
  const code = propertyOf(thrown?.error, "code");
  if (typeof code !== "string" && typeof code !== "number") return NO_VALUE;
  const text = String(code);
  return CODE_PATTERN.test(text) ? text : UNRECOGNIZED;
}

/** The `name` of the error only when it looks like a class name (criterion 10). */
export function errorTypeOf(thrown: AuthFailureInput["thrown"]): string {
  if (thrown === undefined) return NO_VALUE;
  if (!isObject(thrown.error)) return NON_ERROR;
  const name = propertyOf(thrown.error, "name");
  if (typeof name !== "string") return DEFAULT_ERROR_TYPE;
  return ERROR_TYPE_PATTERN.test(name) ? name : UNRECOGNIZED;
}

/** Only the `at ...` lines of the stack, each one filtered: the first line repeats the message. */
export function framesOf(thrown: AuthFailureInput["thrown"]): readonly string[] {
  const stack = propertyOf(thrown?.error, "stack");
  if (typeof stack !== "string") return [];
  return stack
    .split(LINE_BREAK)
    .filter((line) => FRAME_PATTERN.test(line))
    .map(redactText);
}

/** The first `[ CODE ]` of the SDK's message (question 255), and nothing else of it. */
export function detailOf(thrown: AuthFailureInput["thrown"]): string | null {
  const message = propertyOf(thrown?.error, "message");
  if (typeof message !== "string") return null;
  return DETAIL_PATTERN.exec(message)?.[1] ?? null;
}

/** The report of a failed stage, or `null` when the failure is expected (criteria 1 to 3). */
export function authFailureReportOf(input: AuthFailureInput): AuthFailureReport | null {
  if (!isReported(input.failure)) return null;
  return {
    stage: input.stage,
    failure: input.failure,
    code: codeOf(input.thrown),
    errorType: errorTypeOf(input.thrown),
    detail: detailOf(input.thrown),
    frames: framesOf(input.thrown),
    google: input.google ?? null,
  };
}

/**
 * The error sent in place of the original (door 2): its name is the validated type, its message is
 * `<stage>: <code>`, its stack only the filtered frames. No `cause` and no other property of its own.
 */
export class UnexpectedAuthFailure extends Error {
  constructor(report: AuthFailureReport) {
    super(`${report.stage}: ${report.code}`);
    this.name = report.errorType;
    // Without frames it keeps the stack of where it was built, which Sentry reads too.
    if (report.frames.length > 0) this.stack = report.frames.join("\n");
  }
}

/** The tags of the event (door 1); only the keys of the closed list. */
export function authFailureDetails(report: AuthFailureReport): ErrorDetails {
  return {
    "auth.stage": report.stage,
    "auth.failure": report.failure,
    "auth.code": report.code,
    "auth.error_type": report.errorType,
    ...(report.detail === null ? {} : { "auth.detail": report.detail }),
    ...(report.google === null
      ? {}
      : {
          "auth.google.response_type": report.google.responseType,
          "auth.google.has_id_token": String(report.google.hasIdToken),
        }),
  };
}

export function createAuthFailureReporter(errorReporter: ErrorReporter): AuthFailureReporter {
  return {
    report(input) {
      try {
        const report = authFailureReportOf(input);
        if (report === null) return;
        errorReporter.captureError(new UnexpectedAuthFailure(report), {
          area: AUTH_AREA,
          details: authFailureDetails(report),
        });
      } catch {
        // Reporting never breaks a sign-in (criterion 8): the screen shows the same failure anyway.
      }
    },
  };
}
