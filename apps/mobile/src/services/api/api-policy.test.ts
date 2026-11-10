import { describe, expect, test } from "vitest";

import {
  classifyFailure,
  finalError,
  nextStep,
  parseRetryAfter,
  type RawAnswer,
} from "./api-policy";

const NOW = Date.parse("2026-11-10T12:00:00Z");
const PROBLEM = "application/problem+json";

function answer(status: number, body: unknown = null, extra: Partial<RawAnswer> = {}): RawAnswer {
  return { status, contentType: PROBLEM, retryAfter: null, body, ...extra };
}

describe("classifyFailure (P1)", () => {
  test.each([400, 403, 404, 409])("%i with a known code is a problem", (status) => {
    expect(classifyFailure(answer(status, { code: "groups.last-admin" }), NOW)).toEqual({
      kind: "problem",
      status,
      code: "groups.last-admin",
    });
  });

  test.each([
    ["an unknown code", answer(409, { code: "groups.new-rule" })],
    ["no code", answer(400, { title: "Bad" })],
    [
      "a body that is not JSON",
      answer(404, { code: "groups.last-admin" }, { contentType: "text/html" }),
    ],
    ["no content type", answer(404, { code: "groups.last-admin" }, { contentType: null })],
    ["a 500", answer(500)],
    ["a redirect", answer(302)],
    ["a status nobody expects", answer(418)],
  ])("%s is unexpected", (_name, raw) => {
    expect(classifyFailure(raw, NOW)).toEqual({ kind: "unexpected", status: raw.status });
  });

  test("401 is a session to renew, 403 not-registered is its own kind, 413 is too large", () => {
    expect(classifyFailure(answer(401), NOW)).toEqual({ kind: "session-expired" });
    expect(classifyFailure(answer(403, { code: "identity.user-not-registered" }), NOW)).toEqual({
      kind: "not-registered",
    });
    expect(classifyFailure(answer(413, null, { contentType: null }), NOW)).toEqual({
      kind: "too-large",
    });
  });

  test("503 waits what Retry-After says", () => {
    expect(classifyFailure(answer(503, null, { retryAfter: "5" }), NOW)).toEqual({
      kind: "unavailable",
      retryAfterMs: 5_000,
    });
  });
});

describe("parseRetryAfter (P1)", () => {
  test.each([
    ["5", 5_000],
    [" 5 ", 5_000],
    ["0", 0],
    ["99999", 60_000],
    [null, 30_000],
    ["soon", 30_000],
    ["-3", 30_000],
    ["Tue, 10 Nov 2026 12:00:20 GMT", 20_000],
    ["Tue, 10 Nov 2026 13:00:00 GMT", 60_000],
    ["Tue, 10 Nov 2026 11:00:00 GMT", 0],
  ])("%s is %i ms", (header, expected) => {
    expect(parseRetryAfter(header, NOW)).toBe(expected);
  });
});

describe("nextStep (P2, P3)", () => {
  const fresh = { renewedToken: false, signedIn: false };

  test("a 401 renews the token once, then gives up", () => {
    expect(nextStep({ kind: "session-expired" }, fresh)).toBe("renew-token");
    expect(nextStep({ kind: "session-expired" }, { ...fresh, renewedToken: true })).toBe("give-up");
  });

  test("not-registered signs in once, then is shown as the rule error", () => {
    expect(nextStep({ kind: "not-registered" }, fresh)).toBe("sign-in");
    expect(nextStep({ kind: "not-registered" }, { ...fresh, signedIn: true })).toBe("give-up");
    expect(finalError({ kind: "not-registered" })).toEqual({
      kind: "problem",
      status: 403,
      code: "identity.user-not-registered",
    });
  });

  test.each([{ kind: "offline" as const }, { kind: "unavailable" as const, retryAfterMs: 1 }])(
    "%o is never repeated by the client",
    (error) => {
      expect(nextStep(error, fresh)).toBe("give-up");
    },
  );
});
