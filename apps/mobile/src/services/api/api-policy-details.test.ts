import { describe, expect, test } from "vitest";

import { classifyFailure, DEFAULT_RETRY_AFTER_MS, detailsOf, type RawAnswer } from "./api-policy";

const NOW = Date.parse("2026-11-18T12:00:00Z");
const EVENT_ID = "e0000000-0000-4000-8000-000000000007";

function answer(status: number, body: unknown, retryAfter: string | null = null): RawAnswer {
  return { status, contentType: "application/problem+json", retryAfter, body };
}

describe("the court answers of the API (E4.11, P5)", () => {
  test("422 is a rule error with its code and the refused event", () => {
    const body = { code: "matches.event-rejected", eventId: EVENT_ID, reason: "set-decided" };
    expect(classifyFailure(answer(422, body), NOW)).toEqual({
      kind: "problem",
      status: 422,
      code: "matches.event-rejected",
      details: { eventId: EVENT_ID },
    });
  });

  test("409 keeps the counts of the closed list", () => {
    const body = { code: "matches.not-the-writer", currentBatch: 3, lastSequence: 10 };
    expect(classifyFailure(answer(409, body), NOW)).toEqual({
      kind: "problem",
      status: 409,
      code: "matches.not-the-writer",
      details: { currentBatch: 3, lastSequence: 10 },
    });
  });

  test("429 waits the Retry-After, and the default without it", () => {
    expect(classifyFailure(answer(429, { code: "api.rate-limited" }, "7"), NOW)).toEqual({
      kind: "rate-limited",
      retryAfterMs: 7_000,
    });
    expect(classifyFailure(answer(429, null), NOW)).toEqual({
      kind: "rate-limited",
      retryAfterMs: DEFAULT_RETRY_AFTER_MS,
    });
  });

  test("503 with an HTTP date waits until it", () => {
    const later = new Date(NOW + 5_000).toUTCString();
    expect(classifyFailure(answer(503, null, later), NOW)).toEqual({
      kind: "unavailable",
      retryAfterMs: 5_000,
    });
  });

  test("a field outside the list is dropped, and so is the problem without any", () => {
    expect(
      classifyFailure(
        answer(409, { code: "matches.round-canceled", title: "x", detail: "y" }),
        NOW,
      ),
    ).toEqual({ kind: "problem", status: 409, code: "matches.round-canceled" });
  });

  test.each<[string, unknown]>([
    ["negative", -1],
    ["too large to be exact", 1e400],
    ["not whole", 2.5],
    ["a text", "10"],
    ["unsafe", Number.MAX_SAFE_INTEGER + 2],
  ])("a count that is %s is dropped", (_name, value) => {
    expect(detailsOf({ lastSequence: value, expectedSequence: 4 })).toEqual({
      expectedSequence: 4,
    });
  });

  test("an eventId that is not a lowercase UUID is dropped", () => {
    expect(detailsOf({ eventId: EVENT_ID.toUpperCase() })).toEqual({});
    expect(detailsOf({ eventId: "<script>" })).toEqual({});
  });

  test("an inherited field is never read", () => {
    const body: unknown = Object.create({ lastSequence: 5 });
    expect(detailsOf(body)).toEqual({});
    expect(detailsOf(null)).toEqual({});
  });
});
