import { describe, expect, test, vi } from "vitest";

import { inertCourtSyncHooks } from "../../../adapters/fake-court-sync";
import { createSequentialIdGenerator } from "../../../adapters/fake-sequential-id-generator";
import { SAMPLE_MATCH_ONE_SET } from "../dev/sample-match.data";
import { createCourtEventRepository } from "../persistence/court-event-repository";
import { openMigratedDatabase, SESSION_A } from "../persistence/log-envelopes.test.fixture";
import { createCourtReplayer } from "../session/court-replay";
import { createCourtSessionController } from "../session/court-session-controller";
import { startCourtMatch } from "../session/start-court-match";
import { MAX_EVENTS_PER_REQUEST, MAX_REQUEST_BYTES } from "./chunk-for-upload";
import { accountRef, ackedOf, createSyncHarness, settled } from "./court-sync.test.fixture";
import { errorFault, loseAnswer } from "./fake-court-stream-server.test.fixture";

const RETRY_AFTER_MS = 7_000;

describe("the court upload against an in-memory server (E4.11, acceptance)", () => {
  test("A1: each point leaves right after it is written, without a timer", async () => {
    const harness = await createSyncHarness();
    const controllerDeps = {
      courtSessionId: SESSION_A,
      log: harness.log,
      replayer: createCourtReplayer(),
      ids: createSequentialIdGenerator(),
      sync: harness.sync(),
    };
    await startCourtMatch(controllerDeps, SAMPLE_MATCH_ONE_SET);
    await settled(harness.sync());
    const controller = createCourtSessionController(controllerDeps);
    await controller.whenIdle();
    const before = harness.server.requests().length;

    await controller.dispatch({ type: "score-point", team: "a" });
    await settled(harness.sync());

    expect(harness.server.requests()).toHaveLength(before + 1);
    expect(
      harness.server
        .requests()
        .at(-1)
        ?.envelopes.map((event) => event.type),
    ).toEqual(["PointScored"]);
    expect(harness.scheduler.pendingDelays()).toEqual([]);
  });

  test("A1: with the first request held, the second carries the two points that came meanwhile", async () => {
    const harness = await createSyncHarness();
    const release = harness.server.holdNext();
    await harness.write(1);
    await harness.write(1);
    await harness.write(1);
    expect(harness.server.requests()).toHaveLength(1);

    release();
    await settled(harness.sync());

    expect(harness.server.requests().map((request) => request.envelopes.length)).toEqual([1, 2]);
    expect(await ackedOf(harness.log)).toBe(3);
  });

  test("A2: offline nothing leaves; back online the server ends with the same log, in order", async () => {
    const harness = await createSyncHarness({ online: false });
    const written = await harness.write(30);
    await settled(harness.sync());
    expect(harness.server.requests()).toEqual([]);

    harness.network.set(true);
    await settled(harness.sync());

    expect(harness.server.stored()).toEqual(written);
    expect(await ackedOf(harness.log)).toBe(30);
  });

  test("A3: the answer is lost after the server stored: the resend stores nothing twice", async () => {
    const harness = await createSyncHarness();
    harness.server.failNext(loseAnswer);
    const written = await harness.write(3);
    await settled(harness.sync());
    harness.scheduler.advance(2_000);
    await settled(harness.sync());

    expect(harness.server.requests().length).toBeGreaterThan(1);
    expect(harness.server.stored()).toEqual(written);
    expect(harness.server.requests().at(-1)?.envelopes).toEqual(written);
    expect(await ackedOf(harness.log)).toBe(3);
  });

  test("A4: a new loop on the same file goes on from the persisted cursor", async () => {
    const sqlite = await openMigratedDatabase();
    const log = createCourtEventRepository(sqlite.database, createSequentialIdGenerator());
    const harness = await createSyncHarness({ log });
    await harness.write(4);
    await settled(harness.sync());
    harness.network.set(false);
    await harness.write(3);

    const reopened = harness.restart();
    harness.network.set(true);
    await settled(reopened);

    expect(harness.server.stored().map((event) => event.sequence)).toEqual([1, 2, 3, 4, 5, 6, 7]);
    expect(await ackedOf(log)).toBe(7);
  });

  test("A5: a server that lost its last events gets them again from expectedSequence", async () => {
    const harness = await createSyncHarness();
    await harness.write(10);
    await settled(harness.sync());
    harness.server.forgetLast(5);

    await harness.write(1);
    await settled(harness.sync());

    expect(harness.server.stored().map((event) => event.sequence)).toEqual([
      1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11,
    ]);
    expect(await ackedOf(harness.log)).toBe(11);
  });

  test("S2: a server that asks again for the same expectedSequence stops the session, no burst", async () => {
    const harness = await createSyncHarness();
    await harness.write(10);
    await settled(harness.sync());
    const gap = errorFault({
      kind: "problem",
      status: 409,
      code: "matches.sequence-gap",
      details: { expectedSequence: 6 },
    });
    harness.server.failNext(gap, gap, gap);

    await harness.write(1);
    await settled(harness.sync());

    // The first gap moves the cursor down to 5 and sends 6..11 once; the same gap again stops.
    expect(
      harness.server
        .requests()
        .slice(1)
        .map((request) => request.envelopes.length),
    ).toEqual([1, 6]);
    const loaded = await harness.log.load(SESSION_A);
    expect(loaded.ok && loaded.value).toMatchObject({
      ackedSequence: 5,
      syncHalt: "stream-diverged",
    });
    await harness.write(1);
    harness.scheduler.advance(RETRY_AFTER_MS);
    await settled(harness.sync());
    expect(harness.server.requests()).toHaveLength(3);
  });

  test("A6: five 429 in a row: five waits of Retry-After, nothing before the time, and all arrive", async () => {
    const harness = await createSyncHarness();
    const limited = errorFault({ kind: "rate-limited", retryAfterMs: RETRY_AFTER_MS });
    harness.server.failNext(limited, limited, limited, limited, limited);
    const written = await harness.write(2);

    for (let wait = 1; wait <= 5; wait += 1) {
      await settled(harness.sync());
      expect(harness.server.requests()).toHaveLength(wait);
      expect(harness.scheduler.pendingDelays()).toEqual([RETRY_AFTER_MS]);
      harness.network.set(true);
      harness.foreground.bringToFront();
      await harness.write(0);
      harness.scheduler.advance(RETRY_AFTER_MS - 1);
      expect(harness.server.requests()).toHaveLength(wait);
      harness.scheduler.advance(1);
    }
    await settled(harness.sync());

    expect(harness.server.stored()).toEqual(written);
    expect(harness.server.requests()).toHaveLength(6);
  });

  test("A7: a long round offline, 1,500 events, goes in 8 requests within the limits", async () => {
    const harness = await createSyncHarness({ online: false });
    const written = await harness.write(1_500);

    harness.network.set(true);
    await settled(harness.sync());

    const requests = harness.server.requests();
    expect(requests).toHaveLength(8);
    requests.forEach((request) => {
      expect(request.envelopes.length).toBeLessThanOrEqual(MAX_EVENTS_PER_REQUEST);
      expect(request.bytes).toBeLessThanOrEqual(MAX_REQUEST_BYTES);
    });
    expect(harness.server.stored()).toEqual(written);
  });

  test("P7: another account signed in sends nothing; the owner back sends everything", async () => {
    const harness = await createSyncHarness();
    harness.account.switchTo(accountRef("other"));
    await harness.write(2);
    await settled(harness.sync());
    expect(harness.server.requests()).toEqual([]);

    harness.account.switchTo(harness.owner);
    await settled(harness.sync());

    expect(harness.server.stored()).toHaveLength(2);
    expect(
      harness.server.requests().every((request) => request.account === harness.owner.session),
    ).toBe(true);
  });

  test("S1: A marks, signs out; B neither marks nor sends; A back sends its own points", async () => {
    const harness = await createSyncHarness();
    const deps = {
      courtSessionId: SESSION_A,
      log: harness.log,
      replayer: createCourtReplayer(),
      ids: createSequentialIdGenerator(),
      sync: harness.sync(),
    };
    harness.network.set(false);
    await startCourtMatch(deps, SAMPLE_MATCH_ONE_SET);
    const onA = createCourtSessionController(deps);
    await onA.whenIdle();
    await onA.dispatch({ type: "score-point", team: "a" });
    const written = await harness.log.load(SESSION_A);
    if (!written.ok) throw new Error(written.error.code);

    harness.account.switchTo(accountRef("b"));
    harness.network.set(true);
    const onB = createCourtSessionController(deps);
    await onB.whenIdle();
    const snapshot = onB.getSnapshot();
    expect(snapshot.status === "ready" && snapshot.sync.ownership).toBe("other-account");
    expect((await onB.dispatch({ type: "score-point", team: "b" })).ok).toBe(false);
    await settled(harness.sync());
    expect(harness.server.requests()).toEqual([]);

    harness.account.switchTo(harness.owner);
    await settled(harness.sync());
    expect(harness.server.stored()).toEqual(written.value.events);
    expect(
      harness.server.requests().every((request) => request.account === harness.owner.session),
    ).toBe(true);
  });

  test("signed out, nothing leaves", async () => {
    const harness = await createSyncHarness();
    harness.account.switchTo(null);
    await harness.write(1);
    await settled(harness.sync());
    expect(harness.server.requests()).toEqual([]);
  });

  test("not-the-writer: the court is taken over, the events above what the server kept leave the log", async () => {
    const harness = await createSyncHarness();
    await harness.write(3);
    await settled(harness.sync());
    harness.server.giveToAnotherWriter();
    const changed = vi.fn();
    harness.sync().onSessionChanged(changed);

    await harness.write(2);
    await settled(harness.sync());

    const loaded = await harness.log.load(SESSION_A);
    expect(loaded.ok && loaded.value).toMatchObject({ takenOverBatch: 2, ackedSequence: 3 });
    expect(loaded.ok && loaded.value.events.map((event) => event.sequence)).toEqual([1, 2, 3]);
    expect(changed).toHaveBeenCalledWith(SESSION_A);
    expect(await harness.write(1).catch((error: unknown) => error)).toEqual(
      new Error("taken-over"),
    );
  });

  test("a 422 in the middle sends the valid events first, then stops; the court goes on", async () => {
    const harness = await createSyncHarness({ online: false });
    const written = await harness.write(5);
    const refused = written[3]?.eventId;
    harness.server.failNext(
      errorFault({
        kind: "problem",
        status: 422,
        code: "matches.event-rejected",
        details: { eventId: refused },
      }),
    );

    harness.network.set(true);
    await settled(harness.sync());

    expect(harness.server.stored()).toEqual(written.slice(0, 3));
    const loaded = await harness.log.load(SESSION_A);
    expect(loaded.ok && loaded.value).toMatchObject({
      ackedSequence: 3,
      syncHalt: "event-refused",
    });
    await harness.write(1);
    await settled(harness.sync());
    expect(harness.server.requests()).toHaveLength(2);
  });

  test("a 413 halves the request until it fits", async () => {
    const harness = await createSyncHarness({ online: false });
    await harness.write(8);
    harness.server.failNext(errorFault({ kind: "too-large" }), errorFault({ kind: "too-large" }));

    harness.network.set(true);
    await settled(harness.sync());

    expect(harness.server.requests().map((request) => request.envelopes.length)).toEqual([
      8, 4, 2, 6,
    ]);
    expect(harness.server.stored()).toHaveLength(8);
  });

  test("a 413 with a single event stops the session at event-too-large (R3)", async () => {
    const harness = await createSyncHarness({ online: false });
    await harness.write(1);
    harness.server.failNext(errorFault({ kind: "too-large" }));

    harness.network.set(true);
    await settled(harness.sync());

    expect(harness.server.requests()).toHaveLength(1);
    const loaded = await harness.log.load(SESSION_A);
    expect(loaded.ok && loaded.value.syncHalt).toBe("event-too-large");
  });

  test("a 413 on the prefix of a 422 stops at event-refused instead of trying again (R4)", async () => {
    const harness = await createSyncHarness({ online: false });
    const written = await harness.write(5);
    harness.server.failNext(
      errorFault({
        kind: "problem",
        status: 422,
        code: "matches.event-rejected",
        details: { eventId: written[3]?.eventId },
      }),
      errorFault({ kind: "too-large" }),
    );

    harness.network.set(true);
    await settled(harness.sync());
    harness.foreground.bringToFront();
    await settled(harness.sync());

    expect(harness.server.requests().map((request) => request.envelopes.length)).toEqual([5, 3]);
    const loaded = await harness.log.load(SESSION_A);
    expect(loaded.ok && loaded.value.syncHalt).toBe("event-refused");
  });

  test("the loop stops on leaving: nothing leaves after stop, and start sends again (R3)", async () => {
    const harness = await createSyncHarness();
    harness.sync().stop();

    await harness.write(2);
    harness.network.set(false);
    harness.network.set(true);
    await settled(harness.sync());
    expect(harness.server.requests()).toEqual([]);
    expect(harness.sync().getSnapshot().loop.status).toBe("stopped");

    harness.sync().start();
    await settled(harness.sync());
    expect(harness.server.stored()).toHaveLength(2);
  });

  test("the sample sessions of the development screen are never sent", async () => {
    const harness = await createSyncHarness();
    await harness.log.openSession("c0000000-0000-4000-8000-0000000000ff");
    await startCourtMatch(
      {
        courtSessionId: "c0000000-0000-4000-8000-0000000000ff",
        log: harness.log,
        replayer: createCourtReplayer(),
        ids: createSequentialIdGenerator(),
        sync: inertCourtSyncHooks,
      },
      SAMPLE_MATCH_ONE_SET,
    );
    harness.sync().notifyAppended();
    await settled(harness.sync());
    expect(harness.server.requests()).toEqual([]);
  });
});
