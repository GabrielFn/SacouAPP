import type { MatchStartedPayload } from "@sacou/match-engine";
import { describe, expect, test } from "vitest";

import { createFakeCourtEventLog } from "../../../adapters/fake-court-event-log";
import { signedInCourtSyncHooks } from "../../../adapters/fake-court-sync";
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

const ACCOUNT_A = "key-a";
const ACCOUNT_B = "key-b";

/** The account signed in; a test switches it as "Sair mesmo assim" and another sign-in would. */
interface SignedIn {
  key: string | null;
}

function runtime(account: SignedIn = { key: ACCOUNT_A }): CourtRuntime {
  const ids = createSequentialIdGenerator();
  return {
    log: createFakeCourtEventLog(ids),
    replayer: createCourtReplayer(),
    ids,
    sync: signedInCourtSyncHooks(account),
  };
}

async function sessionWithMatch(court: CourtRuntime, finished: boolean): Promise<void> {
  await court.log.openSession(OTHER_SESSION, { ...OTHER_ROUND, ownerKey: ACCOUNT_A });
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

  test("the session keeps the key of the account that opened it", async () => {
    const court = runtime();

    const ensured = await ensureRoundCourtSession(court, ROUND);

    const stored = ensured.ok ? await court.log.load(ensured.value) : null;
    expect(stored?.ok && stored.value.ownerKey).toBe(ACCOUNT_A);
  });

  test("nobody signed in: no session without an owner opens (S4)", async () => {
    const court = runtime({ key: null });

    expect(await ensureRoundCourtSession(court, ROUND)).toEqual({
      ok: false,
      error: { code: "no-account" },
    });
    expect(await court.log.findActiveSession()).toEqual({ ok: true, value: null });
  });

  test("S1: B cannot mark on the session A opened; A back marks again", async () => {
    const account: SignedIn = { key: ACCOUNT_A };
    const court = runtime(account);
    const opened = await ensureRoundCourtSession(court, ROUND);
    if (!opened.ok) throw new Error(opened.error.code);
    const deps = { ...court, courtSessionId: opened.value };
    await startCourtMatch(deps, SAMPLE_MATCH_ONE_SET);

    // "Sair mesmo assim", and B signs in on the same phone.
    account.key = ACCOUNT_B;
    expect(await ensureRoundCourtSession(court, ROUND)).toEqual({
      ok: false,
      error: { code: "other-account" },
    });
    const onB = createCourtSessionController(deps);
    await onB.whenIdle();
    const snapshot = onB.getSnapshot();
    expect(snapshot.status === "ready" && snapshot.sync.ownership).toBe("other-account");
    expect(await onB.dispatch({ type: "score-point", team: "a" })).toEqual({
      ok: false,
      error: { code: "not-ready" },
    });

    account.key = ACCOUNT_A;
    expect(await ensureRoundCourtSession(court, ROUND)).toEqual(opened);
    const onA = createCourtSessionController(deps);
    await onA.whenIdle();
    expect((await onA.dispatch({ type: "score-point", team: "a" })).ok).toBe(true);
  });

  test("an open session of the round without an owner is not reused either", async () => {
    const court = runtime();
    await court.log.openSession(OTHER_SESSION, ROUND);

    expect(await ensureRoundCourtSession(court, ROUND)).toEqual({
      ok: false,
      error: { code: "other-account" },
    });
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

  test("another round whose log cannot be read stays open and the call fails", async () => {
    const court = runtime();
    await sessionWithMatch(court, false);
    const unreadable: CourtRuntime = {
      ...court,
      log: {
        ...court.log,
        load: () => Promise.resolve({ ok: false, error: { code: "corrupted-log" } }),
      },
    };

    expect(await ensureRoundCourtSession(unreadable, ROUND)).toEqual({
      ok: false,
      error: { code: "load-failed", cause: "corrupted-log" },
    });
    expect(await court.log.findActiveSession()).toEqual({ ok: true, value: OTHER_SESSION });
  });

  test("another round that cannot be closed fails and no session opens", async () => {
    const court = runtime();
    await sessionWithMatch(court, true);
    const unclosable: CourtRuntime = {
      ...court,
      log: {
        ...court.log,
        closeSession: () => Promise.resolve({ ok: false, error: { code: "storage-failed" } }),
      },
    };

    expect(await ensureRoundCourtSession(unclosable, ROUND)).toEqual({
      ok: false,
      error: { code: "load-failed", cause: "storage-failed" },
    });
    expect(await court.log.findOpenSessionOfRound("r1")).toEqual({ ok: true, value: null });
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
      value: {
        courtSessionId: OTHER_SESSION,
        startedMatches: 1,
        openMatch: true,
        batch: 1,
        takenOver: false,
        refusedUnseen: false,
        unsentPoints: 0,
      },
    });
    expect(await readRoundCourt(ended, "r2")).toEqual({
      ok: true,
      value: {
        courtSessionId: OTHER_SESSION,
        startedMatches: 1,
        openMatch: false,
        batch: 1,
        takenOver: false,
        refusedUnseen: false,
        unsentPoints: 1,
      },
    });
  });
});
