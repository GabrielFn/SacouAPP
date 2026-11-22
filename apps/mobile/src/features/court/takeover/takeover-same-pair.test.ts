import { describe, expect, test } from "vitest";

import { apiOk } from "../../../services/api/api-result";
import { createCourtEventRepository } from "../persistence/court-event-repository";
import { openMigratedDatabase, SESSION_A } from "../persistence/log-envelopes.test.fixture";
import { ROUND, settled } from "../sync/court-sync.test.fixture";
import {
  brokenTakeOverAnswer,
  createFakeCourtStreamServer,
  type FakeCourtStreamServer,
} from "../sync/fake-court-stream-server.test.fixture";
import { MAX_IMPORTED_EVENTS } from "./import-stream";
import { runTakeover } from "./run-takeover";
import type { TakeoverFailure } from "./takeover.reducer";
import {
  createPhone,
  openAndScore,
  scorePoints,
  takeOver,
  type Phone,
} from "./takeover.test.fixture";

const POINTS = 3;
/** `MatchStarted` and the three points. */
const EVENTS = POINTS + 1;
const UNSENT_POINTS = 2;

interface Court {
  readonly server: FakeCourtStreamServer;
  readonly a: Phone;
}

/** Phone A marks three points, all sent, then "Encerrar rodada" closes its session on the phone only. */
async function closedOnThePhone(): Promise<Court> {
  const server = createFakeCourtStreamServer();
  const a = await createPhone(1, server);
  await openAndScore(a, SESSION_A, POINTS);
  expect((await a.log.closeSession(SESSION_A)).ok).toBe(true);
  expect(server.stored()).toHaveLength(EVENTS);
  return { server, a };
}

async function openOfRound(phone: Phone): Promise<string | null> {
  const open = await phone.log.findOpenSessionOfRound(ROUND.roundId);
  if (!open.ok) throw new Error(open.error.code);
  return open.value;
}

async function failureWith(answer: unknown): Promise<readonly TakeoverFailure[]> {
  const { server, a } = await closedOnThePhone();
  const summary = await server.api.getCourtSession(ROUND.groupId, ROUND.roundId, a.owner.session);
  if (!summary.ok) throw new Error("no summary");
  const deps = a.takeoverDeps();
  const broken = {
    ...deps,
    api: {
      ...deps.api,
      takeOverCourt: () => Promise.resolve(apiOk(brokenTakeOverAnswer(answer))),
    },
  };
  const reasons: TakeoverFailure[] = [];
  await runTakeover(broken, { origin: ROUND, summary: summary.value }, (action) => {
    if (action.type === "failed") reasons.push(action.reason);
  });
  return reasons;
}

describe("the same phone and account take their own court back (R98, item 1)", () => {
  test("a session closed on the phone while the server kept it open opens again, whole", async () => {
    const { server, a } = await closedOnThePhone();

    const run = await takeOver(a, server);

    expect(run.final).toEqual({ status: "done", courtSessionId: SESSION_A });
    expect(await openOfRound(a)).toBe(SESSION_A);
    const stored = await a.load(SESSION_A);
    expect(stored.events).toEqual(server.stored());
    expect(stored.batch).toBe(1);
    expect(stored.takenOverBatch).toBeNull();
  });

  test("the points not sent yet are kept and sent after the court opens again", async () => {
    const { server, a } = await closedOnThePhone();
    expect((await a.log.reopenSession(SESSION_A)).ok).toBe(true);
    a.network.set(false);
    await scorePoints(await a.controller(SESSION_A), UNSENT_POINTS);
    expect((await a.log.closeSession(SESSION_A)).ok).toBe(true);

    const run = await takeOver(a, server);
    expect(run.final).toEqual({ status: "done", courtSessionId: SESSION_A });
    expect((await a.load(SESSION_A)).events).toHaveLength(EVENTS + UNSENT_POINTS);
    a.network.set(true);
    await settled(a.sync);

    expect(server.stored()).toHaveLength(EVENTS + UNSENT_POINTS);
    expect((await a.load(SESSION_A)).events).toEqual(server.stored());
  });

  test("the same pair without the session on the phone imports the whole stream", async () => {
    const { server, a } = await closedOnThePhone();
    const sameDevice = createCourtEventRepository((await openMigratedDatabase()).database, {
      newId: () => a.deviceId,
    });
    const summary = await server.api.getCourtSession(ROUND.groupId, ROUND.roundId, a.owner.session);
    if (!summary.ok) throw new Error("no summary");
    const types: string[] = [];

    await runTakeover(
      { ...a.takeoverDeps(), log: sameDevice },
      { origin: ROUND, summary: summary.value },
      (action) => {
        types.push(action.type);
      },
    );

    expect(types.at(-1)).toBe("imported");
    const loaded = await sameDevice.load(SESSION_A);
    if (!loaded.ok) throw new Error(loaded.error.code);
    expect(loaded.value.events).toEqual(server.stored());
    expect(loaded.value.ackedSequence).toBe(EVENTS);
  });

  test("another account on the same phone opens a new batch and imports, never reopening", async () => {
    const { server, a } = await closedOnThePhone();
    a.account.switchTo({ ...a.owner, session: Object.freeze({ opaque: Symbol("other") }) });

    const run = await takeOver(a, server);

    expect(run.final).toEqual({ status: "done", courtSessionId: SESSION_A });
    expect((await a.load(SESSION_A)).batch).toBe(2);
    expect((await a.load(SESSION_A)).events).toEqual(server.stored());
  });

  test("an event count below the events before the batch fails closed", async () => {
    const answer = { batch: 1, eventsBefore: EVENTS, lastSequence: EVENTS, eventCount: POINTS };

    expect(await failureWith(answer)).toEqual(["import-invalid"]);
  });

  test("an event count past the ceiling of the import fails closed", async () => {
    const answer = {
      batch: 1,
      eventsBefore: 0,
      lastSequence: 0,
      eventCount: MAX_IMPORTED_EVENTS + 1,
    };

    expect(await failureWith(answer)).toEqual(["import-invalid"]);
  });

  test("an answer without the event count, as before R98, fails closed", async () => {
    expect(await failureWith({ batch: 1, eventsBefore: 0, lastSequence: EVENTS })).toEqual([
      "import-invalid",
    ]);
  });
});
