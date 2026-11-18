import { describe, expect, test } from "vitest";

import type { ApiErrorCode } from "../../../api/generated/error-codes";
import type { ApiError, ProblemDetails } from "../../../services/api/api-error";
import { apiErr, apiOk } from "../../../services/api/api-result";
import { makeEnvelope } from "../persistence/log-envelopes.test.fixture";
import { decideSync, type SentRequest } from "./sync-policy";

// The device wrote 1..10, the server confirmed up to 4, and this request carries 5..7.
const SENT: SentRequest = {
  chunk: [5, 6, 7].map((sequence) => makeEnvelope({ sequence })),
  batch: 1,
  ackedSequence: 4,
  lastOwnSequence: 10,
};

function problem(status: number, code: ApiErrorCode, details?: ProblemDetails): ApiError {
  return details === undefined
    ? { kind: "problem", status, code }
    : { kind: "problem", status, code, details };
}

const decide = (error: ApiError) => decideSync(apiErr(error), SENT);

describe("decideSync: one line per answer of ADR 0067, D4 (P3)", () => {
  test("200 moves the cursor to the last sequence the server holds", () => {
    expect(decideSync(apiOk({ lastSequence: 7, stored: 3 }), SENT)).toEqual({
      type: "acknowledge",
      sequence: 7,
    });
  });

  test("a 200 that holds less than was sent, or more than the device wrote, is a divergence", () => {
    const diverged = { type: "halt", code: "stream-diverged" };
    expect(decideSync(apiOk({ lastSequence: 6, stored: 2 }), SENT)).toEqual(diverged);
    expect(decideSync(apiOk({ lastSequence: 11, stored: 3 }), SENT)).toEqual(diverged);
  });

  test("sequence-gap goes back to the sequence before the expected one", () => {
    expect(decide(problem(409, "matches.sequence-gap", { expectedSequence: 3 }))).toEqual({
      type: "rewind",
      sequence: 2,
    });
  });

  test("sequence-gap above the last own sequence, or without the extension, stops for good", () => {
    const diverged = { type: "halt", code: "stream-diverged" };
    expect(decide(problem(409, "matches.sequence-gap", { expectedSequence: 12 }))).toEqual(
      diverged,
    );
    expect(decide(problem(409, "matches.sequence-gap"))).toEqual(diverged);
  });

  test("sequence-gap only moves the cursor down: at the cursor or above it, it stops (S2, S3)", () => {
    const diverged = { type: "halt", code: "stream-diverged" };
    // The cursor is 4: the server asking for 5 is asking for what it got, and 6 for what it never confirmed.
    expect(decide(problem(409, "matches.sequence-gap", { expectedSequence: 5 }))).toEqual(diverged);
    expect(decide(problem(409, "matches.sequence-gap", { expectedSequence: 6 }))).toEqual(diverged);
    expect(decide(problem(409, "matches.sequence-gap", { expectedSequence: 4 }))).toEqual({
      type: "rewind",
      sequence: 3,
    });
    expect(decide(problem(409, "matches.sequence-gap", { expectedSequence: 0 }))).toEqual(diverged);
  });

  test("not-the-writer takes over with what the server kept", () => {
    expect(
      decide(problem(409, "matches.not-the-writer", { currentBatch: 3, lastSequence: 6 })),
    ).toEqual({ type: "take-over", notice: { currentBatch: 3, lastStoredSequence: 6 } });
  });

  test("not-the-writer without extensions keeps what was confirmed", () => {
    expect(decide(problem(409, "matches.not-the-writer"))).toEqual({
      type: "take-over",
      notice: { currentBatch: 2, lastStoredSequence: 4 },
    });
  });

  test("not-the-writer never keeps more than the device wrote", () => {
    expect(
      decide(problem(409, "matches.not-the-writer", { currentBatch: 2, lastSequence: 99 })),
    ).toEqual({ type: "take-over", notice: { currentBatch: 2, lastStoredSequence: 10 } });
  });

  test("round-has-court-session: none of these events is on the server", () => {
    expect(decide(problem(409, "matches.round-has-court-session"))).toEqual({
      type: "take-over",
      notice: { currentBatch: 1, lastStoredSequence: 0 },
    });
  });

  test.each<[ApiErrorCode]>([
    ["matches.batch-mismatch"],
    ["matches.sequence-conflict"],
    ["matches.event-id-conflict"],
  ])("409 %s is two writers: stops for good", (code) => {
    expect(decide(problem(409, code))).toEqual({ type: "halt", code: "stream-diverged" });
  });

  test("round-canceled stops with its own code", () => {
    expect(decide(problem(409, "matches.round-canceled"))).toEqual({
      type: "halt",
      code: "round-canceled",
    });
  });

  test("422 inside the request sends the valid events before the refused one", () => {
    const refused = SENT.chunk[2]?.eventId;
    expect(decide(problem(422, "matches.event-rejected", { eventId: refused }))).toEqual({
      type: "send-prefix",
      count: 2,
    });
  });

  test("422 on the first event, or without one, stops right away", () => {
    const first = SENT.chunk[0]?.eventId;
    const halted = { type: "halt", code: "event-refused" };
    expect(decide(problem(422, "matches.limit-reached", { eventId: first }))).toEqual(halted);
    expect(decide(problem(422, "matches.event-implausible"))).toEqual(halted);
  });

  test("403, 404 and 400 stop with their codes", () => {
    expect(decide(problem(403, "groups.forbidden"))).toEqual({
      type: "halt",
      code: "no-permission",
    });
    expect(decide(problem(404, "matches.court-session-not-found"))).toEqual({
      type: "halt",
      code: "not-found",
    });
    expect(decide(problem(400, "matches.batch-invalid"))).toEqual({
      type: "halt",
      code: "client-bug",
    });
  });

  test("413 asks for smaller requests", () => {
    expect(decide({ kind: "too-large" })).toEqual({ type: "shrink" });
  });

  test("429 and 503 wait the Retry-After of the server", () => {
    expect(decide({ kind: "rate-limited", retryAfterMs: 7_000 })).toEqual({
      type: "retry",
      afterMs: 7_000,
    });
    expect(decide({ kind: "unavailable", retryAfterMs: 3_000 })).toEqual({
      type: "retry",
      afterMs: 3_000,
    });
  });

  test.each<[ApiError]>([
    [{ kind: "offline" }],
    [{ kind: "unexpected", status: 500 }],
    [{ kind: "session-expired" }],
    [{ kind: "not-registered" }],
  ])("%j waits with the backoff", (error) => {
    expect(decide(error)).toEqual({ type: "retry", afterMs: null });
  });

  test("another account signed in changes nothing", () => {
    expect(decide({ kind: "account-changed" })).toEqual({ type: "account-changed" });
  });
});
