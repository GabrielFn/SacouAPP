import { err, ok } from "@sacou/volley-rules";
import { describe, expect, test } from "vitest";

import { createFakeCourtEventLog } from "../../../adapters/fake-court-event-log";
import { createFakeSacouApi } from "../../../adapters/fake-sacou-api";
import { createSequentialIdGenerator } from "../../../adapters/fake-sequential-id-generator";
import type { ApiError } from "../../../services/api/api-error";
import { apiErr, apiOk } from "../../../services/api/api-result";
import type { CourtEventLog } from "../ports/court-event-log";
import { endRoundFailureText, endRoundView } from "./end-round-view";
import { runEndRound } from "./run-end-round";

const SESSION = "c0000000-0000-4000-8000-0000000000c1";
const TARGET = { courtSessionId: SESSION, groupId: "g1", roundId: "r1" };
const CLOSED = { closedAt: "2026-11-03T22:00:00Z", endsAt: "2026-11-03T22:00:00Z" };

async function world() {
  const log = createFakeCourtEventLog(createSequentialIdGenerator());
  await log.openSession(SESSION, { groupId: "g1", roundId: "r1", ownerKey: "key" });
  const api = createFakeSacouApi();
  const pushes = { count: 0 };
  const sync = {
    notifyAppended: () => {
      pushes.count += 1;
    },
  };
  return { log, api, sync, pushes };
}

const closeCalls = (api: ReturnType<typeof createFakeSacouApi>) =>
  api.calls().filter((call) => call.operation === "closeRound");

describe("runEndRound (E4.12, question 150)", () => {
  test("closes the round on the server, closes the session and asks for an upload", async () => {
    const { log, api, sync, pushes } = await world();
    api.respond("closeRound", apiOk(CLOSED));

    const result = await runEndRound({ log, sync, api: api.api }, TARGET);

    expect(result).toEqual(ok({ serverClosed: true }));
    expect(closeCalls(api)).toEqual([{ operation: "closeRound", args: ["g1", "r1"] }]);
    expect(await log.findOpenSessionOfRound("r1")).toEqual(ok(null));
    expect(pushes.count).toBe(1);
  });

  test.each<[string, ApiError]>([
    ["offline", { kind: "offline" }],
    ["a 5xx", { kind: "unexpected", status: 503 }],
    ["a canceled round", { kind: "problem", status: 409, code: "sessions.round-canceled" }],
  ])("does not stop with %s: the round ends on its own", async (_name, error) => {
    const { log, api, sync } = await world();
    api.respond("closeRound", apiErr(error));

    const result = await runEndRound({ log, sync, api: api.api }, TARGET);

    expect(result).toEqual(ok({ serverClosed: false }));
    expect(await log.findOpenSessionOfRound("r1")).toEqual(ok(null));
    expect(closeCalls(api)).toHaveLength(1);
  });

  test("a round that has not started stops before the court is closed", async () => {
    const { log, api, sync, pushes } = await world();
    api.respond(
      "closeRound",
      apiErr({ kind: "problem", status: 409, code: "sessions.round-not-started" }),
    );

    const result = await runEndRound({ log, sync, api: api.api }, TARGET);

    expect(result).toEqual(err("round-not-started"));
    expect(await log.findOpenSessionOfRound("r1")).toEqual(ok(SESSION));
    expect(pushes.count).toBe(0);
  });

  test("a log that does not close is a failure of the phone", async () => {
    const { api, sync, pushes } = await world();
    api.respond("closeRound", apiOk(CLOSED));
    const broken = {
      closeSession: () => Promise.resolve(err({ code: "session-not-found" as const })),
    } satisfies Pick<CourtEventLog, "closeSession">;

    const result = await runEndRound({ log: broken, sync, api: api.api }, TARGET);

    expect(result).toEqual(err("storage"));
    expect(pushes.count).toBe(0);
  });
});

describe("endRoundView", () => {
  test("derives what the screens show from the phase", () => {
    expect(endRoundView({ phase: "idle" })).toEqual({
      confirmingScore: null,
      busy: false,
      failure: null,
    });
    expect(endRoundView({ phase: "confirming", openMatchScore: "12 × 10" }).confirmingScore).toBe(
      "12 × 10",
    );
    expect(endRoundView({ phase: "closing" }).busy).toBe(true);
  });

  test("the round that has not started says so in words", () => {
    expect(endRoundFailureText("round-not-started")).toBe(
      "A rodada ainda não começou e não pode ser encerrada.",
    );
    expect(endRoundView({ phase: "failed", failure: "storage" }).failure).toContain(
      "Tente de novo",
    );
  });
});
