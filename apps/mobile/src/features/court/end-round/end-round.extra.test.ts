import { err, ok } from "@sacou/volley-rules";
import { describe, expect, test } from "vitest";

import { createFakeCourtEventLog } from "../../../adapters/fake-court-event-log";
import { createFakeSacouApi } from "../../../adapters/fake-sacou-api";
import { createSequentialIdGenerator } from "../../../adapters/fake-sequential-id-generator";
import type { ApiError } from "../../../services/api/api-error";
import { apiErr, apiOk } from "../../../services/api/api-result";
import { endRoundReducer, INITIAL_END_ROUND, type EndRoundState } from "./end-round.reducer";
import { endRoundView } from "./end-round-view";
import { runEndRound } from "./run-end-round";

const SESSION = "c0000000-0000-4000-8000-0000000000c1";
const TARGET = { courtSessionId: SESSION, groupId: "g1", roundId: "r1" };
const CLOSED = { closedAt: "2026-11-03T22:00:00Z", endsAt: "2026-11-03T22:00:00Z" };
const NOT_STARTED: ApiError = { kind: "problem", status: 409, code: "sessions.round-not-started" };

async function world() {
  const log = createFakeCourtEventLog(createSequentialIdGenerator());
  await log.openSession(SESSION, { groupId: "g1", roundId: "r1", ownerKey: "key" });
  const api = createFakeSacouApi();
  const sync = { notifyAppended: () => undefined };
  return { log, api, sync };
}

describe("end round: extra cases of the acceptance criteria (E4.12 part 2)", () => {
  test("the 409 round-not-started never closes the local session, even when asked twice", async () => {
    const { log, api, sync } = await world();
    api.respond("closeRound", apiErr(NOT_STARTED));
    for (let attempt = 0; attempt < 2; attempt += 1) {
      expect(await runEndRound({ log, sync, api: api.api }, TARGET)).toEqual(
        err("round-not-started"),
      );
      expect(await log.findOpenSessionOfRound("r1")).toEqual(ok(SESSION));
    }
  });

  test.each<[string, ApiError]>([
    ["session expired", { kind: "session-expired" }],
    ["not found", { kind: "problem", status: 404, code: "sessions.round-not-found" }],
    ["rate limited", { kind: "rate-limited", retryAfterMs: 1000 }],
    ["a 500", { kind: "unexpected", status: 500 }],
  ])("%s on close does not block: session closed and ok", async (_name, error) => {
    const { log, api, sync } = await world();
    api.respond("closeRound", apiErr(error));
    expect(await runEndRound({ log, sync, api: api.api }, TARGET)).toEqual(
      ok({ serverClosed: false }),
    );
    expect(await log.findOpenSessionOfRound("r1")).toEqual(ok(null));
  });

  test("Tentar de novo: after not-started, the retry calls close again and then closes the session", async () => {
    const { log, api, sync } = await world();
    api.respond("closeRound", apiErr(NOT_STARTED));
    await runEndRound({ log, sync, api: api.api }, TARGET);
    api.respond("closeRound", apiOk(CLOSED));
    expect(await runEndRound({ log, sync, api: api.api }, TARGET)).toEqual(
      ok({ serverClosed: true }),
    );
    expect(api.calls().filter((call) => call.operation === "closeRound")).toHaveLength(2);
    expect(await log.findOpenSessionOfRound("r1")).toEqual(ok(null));
  });

  test("a refused close never reaches the local closeSession", async () => {
    const { api, sync } = await world();
    const order: string[] = [];
    api.respond("closeRound", apiErr(NOT_STARTED));
    const log = {
      closeSession: () => {
        order.push("closeSession");
        return Promise.resolve(ok(undefined));
      },
    };
    await runEndRound({ log, sync, api: api.api }, TARGET);
    expect(order).toEqual([]);
  });

  test("confirming with a match in play shows its score, and cancelling clears it", () => {
    const asking = endRoundReducer(INITIAL_END_ROUND, {
      type: "requested",
      openMatchScore: "12 × 10",
    });
    expect(endRoundView(asking).confirmingScore).toBe("12 × 10");
    expect(endRoundView(INITIAL_END_ROUND).confirmingScore).toBeNull();
    expect(endRoundView(endRoundReducer(asking, { type: "cancelled" })).confirmingScore).toBeNull();
  });

  test("Tentar de novo after a failure repeats the flow, also after a storage failure", () => {
    const failed: EndRoundState = { phase: "failed", failure: "storage" };
    expect(endRoundReducer(failed, { type: "requested", openMatchScore: null })).toEqual({
      phase: "closing",
    });
    expect(endRoundReducer(failed, { type: "requested", openMatchScore: "1 × 0" })).toEqual({
      phase: "confirming",
      openMatchScore: "1 × 0",
    });
  });
});
