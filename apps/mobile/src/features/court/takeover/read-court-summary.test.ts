import { describe, expect, test } from "vitest";

import type { ApiResult } from "../../../services/api/api-result";
import { apiErr, apiOk } from "../../../services/api/api-result";
import type { CourtSessionSummary } from "../../../services/api/sacou-api";
import type { SessionIdentity } from "../../../services/auth/auth-session";
import { ROUND } from "../sync/court-sync.test.fixture";
import { RATE_LIMIT_ATTEMPTS } from "./api-calls";
import { readCourtSummary } from "./read-court-summary";

const ACCOUNT: SessionIdentity = Object.freeze({ opaque: Symbol("account") });
const RETRY_AFTER_MS = 7_000;
const SUMMARY: CourtSessionSummary = {
  courtSessionId: "c0000000-0000-4000-8000-00000000000a",
  currentBatch: 1,
  eventCount: 3,
  writer: { memberId: "m0000000-0000-4000-8000-000000000001", since: "2026-11-18T21:14:00Z" },
  lastEventAt: null,
  scoreboard: null,
};
const LIMITED = apiErr({ kind: "rate-limited", retryAfterMs: RETRY_AFTER_MS });

function serverAnswering(answers: readonly ApiResult<CourtSessionSummary>[]) {
  const calls: unknown[][] = [];
  const waits: number[] = [];
  const deps = {
    api: {
      getCourtSession: (groupId: string, roundId: string, account: SessionIdentity) => {
        calls.push([groupId, roundId, account]);
        return Promise.resolve(answers[Math.min(calls.length, answers.length) - 1] ?? LIMITED);
      },
    },
    wait: (ms: number) => {
      waits.push(ms);
      return Promise.resolve();
    },
  };
  return { deps, calls, waits };
}

describe("readCourtSummary (E4.11, D5, ADR 0062)", () => {
  test("a 429 waits its Retry-After, then reads with the token of the account", async () => {
    const { deps, calls, waits } = serverAnswering([LIMITED, apiOk(SUMMARY)]);

    expect(await readCourtSummary(deps, { ...ROUND, account: ACCOUNT })).toEqual(apiOk(SUMMARY));
    expect(waits).toEqual([RETRY_AFTER_MS]);
    expect(calls).toEqual([
      [ROUND.groupId, ROUND.roundId, ACCOUNT],
      [ROUND.groupId, ROUND.roundId, ACCOUNT],
    ]);
  });

  test("it gives up after the attempts of the policy and returns the 429", async () => {
    const { deps, calls } = serverAnswering([LIMITED]);

    expect(await readCourtSummary(deps, { ...ROUND, account: ACCOUNT })).toEqual(LIMITED);
    expect(calls).toHaveLength(RATE_LIMIT_ATTEMPTS);
  });
});
