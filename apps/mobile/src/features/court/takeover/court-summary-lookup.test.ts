import { describe, expect, test } from "vitest";

import { createFakeClock } from "../../../adapters/fake-clock";
import { createFakeScheduler } from "../../../adapters/fake-scheduler";
import type { ApiError } from "../../../services/api/api-error";
import { apiErr, apiOk } from "../../../services/api/api-result";
import type { CourtSessionSummary } from "../../../services/api/sacou-api";
import type { RoundCourt } from "../session/round-court";
import { accountRef, ROUND } from "../sync/court-sync.test.fixture";
import {
  lookUpCourtSummary,
  opensTakeover,
  waitOn,
  type CourtSummaryLookup,
} from "./court-summary-lookup";

const STREAM = "c0000000-0000-4000-8000-00000000000a";
const OTHER = "c0000000-0000-4000-8000-00000000000b";
const RETRY_AFTER_MS = 7_000;
const SUMMARY = {
  courtSessionId: STREAM,
  currentBatch: 2,
  eventCount: 5,
  writer: { memberId: "m", since: "2026-11-18T21:14:00Z" },
  lastEventAt: null,
  scoreboard: null,
} satisfies CourtSessionSummary;
const FOUND: CourtSummaryLookup = { status: "found", summary: SUMMARY };
const OFFLINE: CourtSummaryLookup = { status: "failed", reason: "offline" };

function local(overrides: Partial<RoundCourt> = {}): RoundCourt {
  return {
    courtSessionId: STREAM,
    startedMatches: 1,
    openMatch: true,
    batch: 2,
    takenOver: false,
    refusedUnseen: false,
    ...overrides,
  };
}

function problem(status: number): ApiError {
  return { kind: "problem", status, code: "matches.court-session-not-found" };
}

describe("opensTakeover: the 09a before the court (D5, case a)", () => {
  test.each<[string, CourtSummaryLookup | undefined, RoundCourt | null, boolean]>([
    ["offline or still reading", undefined, local(), false],
    ["no stream yet", { status: "none" }, null, false],
    ["the summary failed", OFFLINE, null, false],
    ["no session on this phone", FOUND, null, true],
    [
      "another session of the round (opened offline)",
      FOUND,
      local({ courtSessionId: OTHER }),
      true,
    ],
    ["this phone writes the stream", FOUND, local(), false],
    ["another batch writes it now", FOUND, local({ batch: 1 }), true],
    ["taken over, refused already seen", FOUND, local({ takenOver: true }), true],
    ["taken over, 09c not seen yet", FOUND, local({ takenOver: true, refusedUnseen: true }), false],
  ])("%s", (_name, lookup, court, expected) => {
    expect(opensTakeover(lookup, court)).toBe(expected);
  });
});

describe("lookUpCourtSummary", () => {
  const owner = accountRef("phone-1");
  const wait = () => Promise.resolve();

  test("found with the token of the account signed in; 404 is no stream", async () => {
    const tokens: unknown[] = [];
    const api = {
      getCourtSession: (_group: string, _round: string, account: unknown) => {
        tokens.push(account);
        return Promise.resolve(apiOk(SUMMARY));
      },
    };
    const deps = { api, wait, account: () => Promise.resolve(owner) };
    expect(await lookUpCourtSummary(deps, ROUND)).toEqual(FOUND);
    expect(tokens).toEqual([owner.session]);
    const missing = { getCourtSession: () => Promise.resolve(apiErr(problem(404))) };
    expect(await lookUpCourtSummary({ ...deps, api: missing }, ROUND)).toEqual({ status: "none" });
  });

  test("no account: no call; a 403 is no permission", async () => {
    const calls: number[] = [];
    const api = {
      getCourtSession: () => {
        calls.push(1);
        return Promise.resolve(apiErr(problem(403)));
      },
    };
    const signedOut = { api, wait, account: () => Promise.resolve(null) };
    expect(await lookUpCourtSummary(signedOut, ROUND)).toEqual({
      status: "failed",
      reason: "no-account",
    });
    expect(calls).toEqual([]);
    const signedIn = { api, wait, account: () => Promise.resolve(owner) };
    expect(await lookUpCourtSummary(signedIn, ROUND)).toEqual({
      status: "failed",
      reason: "no-permission",
    });
  });

  test("waitOn waits on the injected scheduler, not on a global timer", async () => {
    const scheduler = createFakeScheduler(createFakeClock());
    const done = { value: false };
    const waiting = waitOn(scheduler)(RETRY_AFTER_MS).then(() => {
      done.value = true;
    });
    await Promise.resolve();
    expect(done.value).toBe(false);
    expect(scheduler.pendingDelays()).toEqual([RETRY_AFTER_MS]);
    scheduler.advance(RETRY_AFTER_MS);
    await waiting;
    expect(done.value).toBe(true);
  });
});
