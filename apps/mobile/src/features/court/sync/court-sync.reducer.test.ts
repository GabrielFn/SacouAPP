import { describe, expect, test } from "vitest";

import {
  courtSyncReducer,
  INITIAL_COURT_SYNC_STATE,
  type CourtSyncState,
} from "./court-sync.reducer";

const NOW = 1_000;
const MIDDLE = 0.5;

const sending: CourtSyncState = { status: "sending", again: false, attempt: 0 };

describe("courtSyncReducer (P4)", () => {
  test("a poke when idle sends", () => {
    expect(courtSyncReducer(INITIAL_COURT_SYNC_STATE, { type: "poked" })).toEqual(sending);
  });

  test("a point while a request is out asks for one more pass, never a second request", () => {
    const next = courtSyncReducer(sending, { type: "poked" });
    expect(next).toEqual({ status: "sending", again: true, attempt: 0 });
    expect(courtSyncReducer(next, { type: "pass-done", more: false })).toEqual(sending);
  });

  test("a pass that ended with nothing more goes idle", () => {
    expect(courtSyncReducer(sending, { type: "pass-done", more: false })).toEqual(
      INITIAL_COURT_SYNC_STATE,
    );
    expect(courtSyncReducer(sending, { type: "pass-done", more: true })).toEqual(sending);
  });

  test("a failure waits with the backoff, and each failure in a row waits longer", () => {
    const first = courtSyncReducer(sending, {
      type: "pass-failed",
      nowMs: NOW,
      jitter: MIDDLE,
      retryAfterMs: null,
    });
    expect(first).toEqual({
      status: "waiting",
      untilMs: NOW + 2_000,
      attempt: 1,
      reason: "backoff",
    });
    const again = courtSyncReducer(courtSyncReducer(first, { type: "wait-elapsed" }), {
      type: "pass-failed",
      nowMs: NOW,
      jitter: MIDDLE,
      retryAfterMs: null,
    });
    expect(again).toMatchObject({ untilMs: NOW + 4_000, attempt: 2 });
  });

  test("the network coming back during a backoff sends right away", () => {
    const waiting: CourtSyncState = {
      status: "waiting",
      untilMs: NOW + 8_000,
      attempt: 3,
      reason: "backoff",
    };
    expect(courtSyncReducer(waiting, { type: "poked" })).toEqual({
      status: "sending",
      again: false,
      attempt: 3,
    });
  });

  test("a 429 with Retry-After 7 waits 7 s, and nothing pokes it earlier", () => {
    const waiting = courtSyncReducer(sending, {
      type: "pass-failed",
      nowMs: NOW,
      jitter: 0,
      retryAfterMs: 7_000,
    });
    expect(waiting).toEqual({
      status: "waiting",
      untilMs: NOW + 7_000,
      attempt: 1,
      reason: "retry-after",
    });
    expect(courtSyncReducer(waiting, { type: "poked" })).toBe(waiting);
    expect(courtSyncReducer(waiting, { type: "wait-elapsed" })).toEqual({
      status: "sending",
      again: false,
      attempt: 1,
    });
  });

  test("a success after failures starts the backoff over", () => {
    const retried: CourtSyncState = { status: "sending", again: false, attempt: 4 };
    expect(courtSyncReducer(retried, { type: "pass-done", more: true })).toEqual(sending);
  });

  test("stopped takes nothing more", () => {
    const stopped = courtSyncReducer(sending, { type: "stopped" });
    expect(stopped).toEqual({ status: "stopped" });
    expect(courtSyncReducer(stopped, { type: "poked" })).toBe(stopped);
    expect(courtSyncReducer(stopped, { type: "pass-done", more: true })).toBe(stopped);
    expect(courtSyncReducer(stopped, { type: "wait-elapsed" })).toBe(stopped);
  });

  test("a late timer or answer outside its state changes nothing", () => {
    expect(courtSyncReducer(INITIAL_COURT_SYNC_STATE, { type: "wait-elapsed" })).toBe(
      INITIAL_COURT_SYNC_STATE,
    );
    expect(
      courtSyncReducer(INITIAL_COURT_SYNC_STATE, {
        type: "pass-failed",
        nowMs: NOW,
        jitter: 0,
        retryAfterMs: null,
      }),
    ).toBe(INITIAL_COURT_SYNC_STATE);
  });
});
