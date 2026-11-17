import type { MatchStartedPayload } from "@sacou/match-engine";
import { describe, expect, test } from "vitest";

import { createFakeCourtEventLog } from "../../../adapters/fake-court-event-log";
import { createSequentialIdGenerator } from "../../../adapters/fake-sequential-id-generator";
import { SAMPLE_MATCH_ONE_SET } from "../dev/sample-match.data";
import type { CourtRuntime } from "../ports/court-runtime";
import { createCourtReplayer } from "./court-replay";
import { createCourtSessionController } from "./court-session-controller";
import { ensureRoundCourtSession } from "./ensure-round-court-session";
import { readRoundCourt } from "./round-court";
import { startCourtMatch } from "./start-court-match";

const ROUND = { groupId: "g1", roundId: "r1" };
const OTHER_ROUND = { groupId: "g1", roundId: "r2" };
const OTHER_SESSION = "c0000000-0000-4000-8000-0000000000d1";

/** One point ends the set and the match: the shortest finished match. */
const ONE_POINT_MATCH: MatchStartedPayload = {
  ...SAMPLE_MATCH_ONE_SET,
  scoring: { bestOf: 1, pointsPerSet: 1, tieBreakPoints: null, winMargin: 1 },
};

function runtime(): CourtRuntime {
  const ids = createSequentialIdGenerator();
  return { log: createFakeCourtEventLog(ids), replayer: createCourtReplayer(), ids };
}

async function sessionWithMatch(court: CourtRuntime, finished: boolean): Promise<void> {
  await court.log.openSession(OTHER_SESSION, OTHER_ROUND);
  const deps = { ...court, courtSessionId: OTHER_SESSION };
  await startCourtMatch(deps, ONE_POINT_MATCH);
  if (!finished) return;
  const controller = createCourtSessionController(deps);
  await controller.whenIdle();
  await controller.dispatch({ type: "score-point", team: "a" });
  await controller.dispatch({ type: "confirm-set-end" });
}

describe("ensureRoundCourtSession (D7, D8)", () => {
  test("without a session, opens one with the origin of the round", async () => {
    const court = runtime();

    const ensured = await ensureRoundCourtSession(court, ROUND);

    expect(ensured.ok).toBe(true);
    expect(await court.log.findOpenSessionOfRound("r1")).toEqual(ensured);
  });

  test("the open session of the round is used again", async () => {
    const court = runtime();
    const first = await ensureRoundCourtSession(court, ROUND);

    expect(await ensureRoundCourtSession(court, ROUND)).toEqual(first);
  });

  test("another round with a match on is refused, and nothing is closed", async () => {
    const court = runtime();
    await sessionWithMatch(court, false);

    expect(await ensureRoundCourtSession(court, ROUND)).toEqual({
      ok: false,
      error: { code: "other-round-match-open" },
    });
    expect(await court.log.findActiveSession()).toEqual({ ok: true, value: OTHER_SESSION });
  });

  test("another round with its match ended is closed and a new session opens", async () => {
    const court = runtime();
    await sessionWithMatch(court, true);

    const ensured = await ensureRoundCourtSession(court, ROUND);

    expect(ensured.ok && ensured.value !== OTHER_SESSION).toBe(true);
    expect(await court.log.findOpenSessionOfRound("r2")).toEqual({ ok: true, value: null });
  });
});

describe("readRoundCourt: what screens 06 and 08 know of the court (D1, D6)", () => {
  test("no session: null, so the 08 says Partida 1", async () => {
    expect(await readRoundCourt(runtime(), "r1")).toEqual({ ok: true, value: null });
  });

  test("a match on: one begun and open; ended: one begun and none open", async () => {
    const open = runtime();
    await sessionWithMatch(open, false);
    const ended = runtime();
    await sessionWithMatch(ended, true);

    expect(await readRoundCourt(open, "r2")).toEqual({
      ok: true,
      value: { courtSessionId: OTHER_SESSION, startedMatches: 1, openMatch: true },
    });
    expect(await readRoundCourt(ended, "r2")).toEqual({
      ok: true,
      value: { courtSessionId: OTHER_SESSION, startedMatches: 1, openMatch: false },
    });
  });
});
