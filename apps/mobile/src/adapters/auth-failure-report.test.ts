import { describe, expect, test } from "vitest";

import type { AuthFailure } from "../services/auth/auth-session";
import { ANONYMOUS_USER, scrubEvent } from "../services/error-reporting/scrub-event";
import {
  authFailureReportOf,
  codeOf,
  createAuthFailureReporter,
  detailOf,
  errorTypeOf,
  framesOf,
  UnexpectedAuthFailure,
  type AuthFailureReport,
} from "./auth-failure-report";
import { createFakeErrorReporter } from "./fake-error-reporter";

const EMAIL = "ana@x.com";
const JWT = "eyJhbGciOiJSUzI1NiJ9.eyJzdWIiOiJ1aWQtOTkifQ.c2ln";
const thrown = (error: unknown) => ({ error });
const withCode = (code: unknown) => thrown({ code });
const LONG_FIREBASE_CODE = `auth/${"a".repeat(61)}`;

describe("the code of a failed sign-in (criterion 9)", () => {
  test.each([
    [10, "10"],
    ["12500", "12500"],
    ["DEVELOPER_ERROR", "DEVELOPER_ERROR"],
    ["auth/internal-error", "auth/internal-error"],
    [EMAIL, "unrecognized"],
    [LONG_FIREBASE_CODE, "unrecognized"],
  ])("%s becomes %s", (code, expected) => {
    expect(codeOf(withCode(code))).toBe(expected);
  });

  test("an error without a code, or no error at all, is `none`", () => {
    expect(codeOf(thrown(new Error("x")))).toBe("none");
    expect(codeOf(undefined)).toBe("none");
  });
});

describe("the type of a failed sign-in (criterion 10)", () => {
  test("the name of the error when it looks like a class name", () => {
    expect(errorTypeOf(thrown(new TypeError("x")))).toBe("TypeError");
    expect(errorTypeOf(thrown({ name: EMAIL }))).toBe("unrecognized");
    expect(errorTypeOf(thrown({ code: "10" }))).toBe("Error");
  });

  test("a thrown value that is not an object is `non-error`; no error at all is `none`", () => {
    expect(errorTypeOf(thrown(EMAIL))).toBe("non-error");
    expect(errorTypeOf(thrown(undefined))).toBe("non-error");
    expect(errorTypeOf(thrown(10))).toBe("non-error");
    expect(errorTypeOf(undefined)).toBe("none");
  });
});

describe("the stack of a failed sign-in (criterion 11)", () => {
  test("only the frame lines leave, each one filtered", () => {
    const stack = `Error: falhou ${EMAIL}\nsegunda ${EMAIL}\n    at f (index.bundle:1:2)`;
    expect(framesOf(thrown({ stack }))).toEqual(["    at f (index.bundle:1:2)"]);
    expect(framesOf(thrown({ stack: `x\n    at f (${EMAIL}:1:2)` }))).toEqual([
      "    at f ([filtrado]:1:2)",
    ]);
  });

  test("without a stack text there are no frames, and the new error keeps its own stack", () => {
    expect(framesOf(thrown({ stack: 10 }))).toEqual([]);
    const report = authFailureReportOf({
      stage: "google-picker",
      failure: "unexpected",
      thrown: thrown({ code: "10" }),
    });
    if (report === null) throw new Error("report expected");
    expect(new UnexpectedAuthFailure(report).stack).toContain("google-picker: 10");
  });
});

describe("the bracketed detail of the Firebase message (criterion 13)", () => {
  test.each([
    [
      "[auth/unknown] An internal error has occurred. [ CONFIGURATION_NOT_FOUND ]",
      "CONFIGURATION_NOT_FOUND",
    ],
    ["A failure [ 10: ]", "10"],
    [`[ ${EMAIL} ]`, null],
    ["no brackets at all", null],
    ["[auth/unknown] only", null],
  ])("%s gives %s", (message, expected) => {
    expect(detailOf(thrown({ message }))).toBe(expected);
  });
});

describe("the error sent in place of the original (criterion 12)", () => {
  test("its type, its value and no property of its own besides name, message and stack", () => {
    const report = authFailureReportOf({
      stage: "google-picker",
      failure: "unexpected",
      thrown: thrown(Object.assign(new Error(EMAIL), { code: 10, cause: new Error(EMAIL) })),
    });
    if (report === null) throw new Error("report expected");
    const error = new UnexpectedAuthFailure(report);
    expect(error.name).toBe("Error");
    expect(error.message).toBe("google-picker: 10");
    expect(error.cause).toBeUndefined();
    const own = Object.getOwnPropertyNames(error);
    expect(own.every((key) => ["name", "message", "stack"].includes(key))).toBe(true);
  });
});

describe("the reporter behind the sign-in stages", () => {
  test.each<AuthFailure>([
    "cancelled",
    "offline",
    "invalid-credentials",
    "email-unavailable",
    "weak-password",
    "too-many-requests",
  ])("an expected `%s` is never reported (criterion 2)", (failure) => {
    const errors = createFakeErrorReporter();
    createAuthFailureReporter(errors).report({ stage: "google-picker", failure });
    expect(errors.captured()).toEqual([]);
  });

  test("an unexpected failure is one event with the area and the tags (criteria 1, 3)", () => {
    const errors = createFakeErrorReporter();
    const reporter = createAuthFailureReporter(errors);
    reporter.report({ stage: "google-picker", failure: "unexpected", thrown: withCode("10") });
    reporter.report({
      stage: "firebase-email-sign-in",
      failure: "provider-unavailable",
      thrown: withCode("auth/operation-not-allowed"),
    });
    expect(errors.captured().map(({ context }) => context)).toEqual([
      {
        area: "auth",
        details: {
          "auth.stage": "google-picker",
          "auth.failure": "unexpected",
          "auth.code": "10",
          "auth.error_type": "Error",
        },
      },
      {
        area: "auth",
        details: {
          "auth.stage": "firebase-email-sign-in",
          "auth.failure": "provider-unavailable",
          "auth.code": "auth/operation-not-allowed",
          "auth.error_type": "Error",
        },
      },
    ]);
  });

  test("a capture that throws never reaches the sign-in (criterion 8)", () => {
    const reporter = createAuthFailureReporter({
      captureError: () => {
        throw new Error("sentry down");
      },
      crashNatively: () => undefined,
    });
    expect(() => {
      reporter.report({ stage: "google-picker", failure: "unexpected" });
    }).not.toThrow();
  });
});

/** The event as the Sentry SDK builds it from the captured error and context, before `beforeSend`. */
function sentryEventOf(error: unknown, tags: Readonly<Record<string, string>>) {
  if (!(error instanceof Error)) throw new Error("an Error expected");
  return {
    exception: {
      values: [
        {
          type: error.name,
          value: error.message,
          stacktrace: {
            frames: (error.stack ?? "").split("\n").map((line) => ({ function: line })),
          },
        },
      ],
    },
    tags,
    user: { id: "uid-99", email: EMAIL },
  };
}

describe("from the SDK error to the event that leaves the phone (criteria 14, 16)", () => {
  test("no message, e-mail, token or other property of the original survives", () => {
    const original = Object.assign(
      new Error(`[auth/unknown] ${EMAIL} ${JWT} [ CONFIGURATION_NOT_FOUND ]`),
      {
        code: EMAIL,
        userInfo: { email: EMAIL, idToken: JWT },
        nativeStackAndroid: [{ methodName: EMAIL }],
        cause: new Error(JWT),
        stack: `Error: ${EMAIL}\n${JWT}\n    at f (index.bundle:1:2)\n    at ${EMAIL} ${JWT}`,
      },
    );
    const errors = createFakeErrorReporter();
    createAuthFailureReporter(errors).report({
      stage: "firebase-google-credential",
      failure: "unexpected",
      thrown: { error: original },
    });
    const [captured] = errors.captured();
    if (captured === undefined) throw new Error("one event expected");
    const event = scrubEvent(
      sentryEventOf(captured.error, { area: "auth", ...captured.context?.details }),
    );
    const text = JSON.stringify(event);
    expect(text).not.toContain(EMAIL);
    expect(text).not.toContain("eyJ");
    expect(text).not.toContain("@");
    expect(event.exception.values[0]?.value).toBe("firebase-google-credential: unrecognized");
    expect(event.tags).toMatchObject({ "auth.detail": "CONFIGURATION_NOT_FOUND" });
    expect(event.user).toBe(ANONYMOUS_USER);
  });
});

describe("the tags of the Google answer (criterion 5)", () => {
  test("a success without an ID token", () => {
    const report: AuthFailureReport | null = authFailureReportOf({
      stage: "google-response",
      failure: "unexpected",
      google: { responseType: "success", hasIdToken: false },
    });
    expect(report).toMatchObject({ code: "none", errorType: "none", frames: [] });
  });
});
