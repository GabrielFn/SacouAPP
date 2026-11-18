import type { EventEnvelope } from "@sacou/match-engine";
import { describe, expect, test, vi } from "vitest";

import type { CourtEventsPage } from "../../../services/api/sacou-api";
import { stateOfTimeline } from "../model/court-screen.selectors";
import { SESSION_A, SESSION_B } from "../persistence/log-envelopes.test.fixture";
import { ROUND, settled } from "../sync/court-sync.test.fixture";
import { apiOk } from "../../../services/api/api-result";
import {
  createFakeCourtStreamServer,
  brokenPage,
  brokenTakeOverAnswer,
  type FakeCourtStreamServer,
} from "../sync/fake-court-stream-server.test.fixture";
import { refusedPointsModel } from "./refused-points-model";
import { runTakeover } from "./run-takeover";
import {
  createPhone,
  openAndScore,
  scorePoints,
  takeOver,
  type Phone,
} from "./takeover.test.fixture";

const POINTS_OF_A = 10;
/** `MatchStarted` and the ten points of phone A. */
const EVENTS_OF_A = POINTS_OF_A + 1;
const RETRY_AFTER_MS = 7_000;
const SMALL_PAGE = 4;

interface Court {
  readonly server: FakeCourtStreamServer;
  readonly a: Phone;
  readonly b: Phone;
}

async function courtOfA(): Promise<Court> {
  const server = createFakeCourtStreamServer();
  const a = await createPhone(1, server);
  const b = await createPhone(2, server);
  await openAndScore(a, SESSION_A, POINTS_OF_A);
  expect(server.stored()).toHaveLength(EVENTS_OF_A);
  return { server, a, b };
}

function stateOf(phone: Phone, events: readonly EventEnvelope[]) {
  const replayed = phone.replayer.replay(SESSION_A, events);
  if (!replayed.ok) throw new Error("replay failed");
  return stateOfTimeline(replayed.value);
}

async function sessionMissing(phone: Phone): Promise<boolean> {
  const loaded = await phone.log.load(SESSION_A);
  return !loaded.ok && loaded.error.code === "session-not-found";
}

describe("taking the court over (E4.11, part 2, acceptance)", () => {
  test("B1: B takes over and imports; A, offline, is refused and sees its 2 points", async () => {
    const { server, a, b } = await courtOfA();
    const controllerOfA = await a.controller(SESSION_A);

    const run = await takeOver(b, server);
    expect(run.final).toEqual({ status: "done", courtSessionId: SESSION_A });
    expect((await b.load(SESSION_A)).events).toEqual(server.stored());
    const controllerOfB = await b.controller(SESSION_A);
    await scorePoints(controllerOfB, 1, "b");
    await settled(b.sync);
    expect(server.stored()).toHaveLength(EVENTS_OF_A + 1);

    a.network.set(false);
    await scorePoints(controllerOfA, 3);
    expect((await controllerOfA.dispatch({ type: "undo" })).ok).toBe(true);
    a.network.set(true);
    await settled(a.sync);

    const stored = await a.load(SESSION_A);
    expect(stored.takenOverBatch).toBe(2);
    expect(stored.ackedSequence).toBe(EVENTS_OF_A);
    expect(stored.refusedUnseen).toBe(true);
    const model = refusedPointsModel(SESSION_A, a.deviceId, stored, a.replayer);
    expect(model.rows.map((row) => row.text)).toEqual(["Ponto do Laranja", "Ponto do Laranja"]);
    expect(model.rows.map((row) => row.scoreText)).toEqual(["11 × 0", "12 × 0"]);
    expect(model.undoLeftOut).toBe(false);
    const late = await (await a.controller(SESSION_A)).dispatch({ type: "score-point", team: "a" });
    expect(late.ok).toBe(false);
    expect(server.stored().map((event) => event.deviceId)).toEqual([
      ...Array.from({ length: EVENTS_OF_A }, () => a.deviceId),
      b.deviceId,
    ]);
  });

  test("B2: nothing of the court exists on B until the import ends; then it is the server's replay", async () => {
    const { server, a, b } = await courtOfA();
    server.setPageSize(SMALL_PAGE);
    const held = { release: null as (() => void) | null };

    const running = takeOver(b, server, (action) => {
      if (action.type === "page-imported" && held.release === null) {
        held.release = server.holdNextPage();
      }
    });
    await vi.waitFor(() => {
      expect(held.release).not.toBeNull();
    });
    expect(await sessionMissing(b)).toBe(true);
    held.release?.();
    const run = await running;

    expect(run.states.map((state) => state.status)).toContain("importing");
    expect(run.final.status).toBe("done");
    const imported = (await b.load(SESSION_A)).events;
    expect(stateOf(b, imported)).toEqual(stateOf(a, server.stored()));
  });

  test("B3: the stream moved after the summary: 09a again, nothing written on B", async () => {
    const { server, a, b } = await courtOfA();
    const summary = await server.api.getCourtSession(ROUND.groupId, ROUND.roundId, b.owner.session);
    if (!summary.ok) throw new Error("no summary");
    await scorePoints(await a.controller(SESSION_A), 1);
    await settled(a.sync);
    const actions: string[] = [];

    await runTakeover(b.takeoverDeps(), { origin: ROUND, summary: summary.value }, (action) => {
      actions.push(action.type);
    });

    expect(actions).toEqual(["stream-changed"]);
    expect(await sessionMissing(b)).toBe(true);
  });

  const breakers: readonly [string, (page: CourtEventsPage, after: number) => CourtEventsPage][] = [
    [
      "an envelope of another stream",
      (page) => ({
        ...page,
        events: withFirst(page, (event) => ({ ...event, courtSessionId: SESSION_B })),
      }),
    ],
    ["broken JSON", (page) => ({ ...page, events: withFirst(page, () => "{broken") })],
    ["a position that does not follow", (page, after) => ({ ...page, lastPosition: after + 1 })],
    [
      "a gap in the sequences",
      (page) => ({ ...page, events: withFirst(page, (event) => ({ ...event, sequence: 99 })) }),
    ],
    [
      "a stream that does not replay",
      (page) => ({
        ...page,
        events: withFirst(page, (event) => ({
          ...event,
          type: "PointScored",
          payload: { team: "a", setNumber: 1, matchId: "f0000000-0000-4000-8000-000000000009" },
        })),
      }),
    ],
    ["an empty page before the end", (page) => ({ ...page, events: [], lastPosition: 0 })],
    ["a null page", () => brokenPage(null)],
    ["an empty text as the page", () => brokenPage("")],
    ["an array as the page", (page) => brokenPage([page])],
  ];

  test.each(breakers)("B4: %s fails closed and leaves the file as it was", async (_, breaker) => {
    const { server, b } = await courtOfA();
    server.tamperPages(breaker);

    const run = await takeOver(b, server);

    expect(run.final).toEqual({ status: "failed", reason: "import-invalid" });
    expect(await sessionMissing(b)).toBe(true);
  });

  test("B5: A takes back: it imports B's points and goes on in batch 3, accepted by the server", async () => {
    const { server, a, b } = await courtOfA();
    await takeOver(b, server);
    await scorePoints(await b.controller(SESSION_A), 2, "b");
    await settled(b.sync);

    const run = await takeOver(a, server);
    expect(run.final.status).toBe("done");
    const stored = await a.load(SESSION_A);
    expect(stored).toMatchObject({ batch: 3, takenOverBatch: null, refused: [] });
    await scorePoints(await a.controller(SESSION_A), 1);
    await settled(a.sync);

    expect(server.stored().at(-1)).toMatchObject({
      deviceId: a.deviceId,
      batch: 3,
      sequence: EVENTS_OF_A + 1,
    });
  });

  test("B7: after taking over, B undoes a point A marked (answer 74) and it is sent", async () => {
    const { server, b } = await courtOfA();
    await takeOver(b, server);

    expect((await (await b.controller(SESSION_A)).dispatch({ type: "undo" })).ok).toBe(true);
    await settled(b.sync);

    expect(server.stored().at(-1)).toMatchObject({ deviceId: b.deviceId, type: "RevertedTo" });
  });

  test("a 429 on the take-over is waited for, never sooner, and then it goes on", async () => {
    const { server, b } = await courtOfA();
    const calls = { value: 0 };
    const deps = b.takeoverDeps();
    const limited = {
      ...deps,
      api: {
        ...deps.api,
        takeOverCourt: (...args: Parameters<typeof deps.api.takeOverCourt>) => {
          calls.value += 1;
          return calls.value === 1
            ? Promise.resolve({
                ok: false as const,
                error: { kind: "rate-limited" as const, retryAfterMs: RETRY_AFTER_MS },
              })
            : server.api.takeOverCourt(...args);
        },
      },
    };
    const summary = await server.api.getCourtSession(ROUND.groupId, ROUND.roundId, b.owner.session);
    if (!summary.ok) throw new Error("no summary");
    const actions: string[] = [];

    await runTakeover(limited, { origin: ROUND, summary: summary.value }, (action) => {
      actions.push(action.type);
    });

    expect(b.waits).toEqual([RETRY_AFTER_MS]);
    expect(actions.at(-1)).toBe("imported");
  });

  test("a null answer to the take-over fails closed, without importing", async () => {
    const { server, b } = await courtOfA();
    const deps = b.takeoverDeps();
    const summary = await server.api.getCourtSession(ROUND.groupId, ROUND.roundId, b.owner.session);
    if (!summary.ok) throw new Error("no summary");
    const listed = vi.fn(deps.api.listCourtEvents);
    const broken = {
      ...deps,
      api: {
        takeOverCourt: () => Promise.resolve(apiOk(brokenTakeOverAnswer(null))),
        listCourtEvents: listed,
      },
    };
    const reasons: string[] = [];

    await runTakeover(broken, { origin: ROUND, summary: summary.value }, (action) => {
      if (action.type === "failed") reasons.push(action.reason);
    });

    expect(reasons).toEqual(["import-invalid"]);
    expect(listed).not.toHaveBeenCalled();
    expect(await sessionMissing(b)).toBe(true);
  });

  test("the stream reached its ceiling of take-overs: the court takes no more changes", async () => {
    const { server, b } = await courtOfA();
    const deps = b.takeoverDeps();
    const summary = await server.api.getCourtSession(ROUND.groupId, ROUND.roundId, b.owner.session);
    if (!summary.ok) throw new Error("no summary");
    const reasons: string[] = [];
    const full = {
      ...deps,
      api: {
        ...deps.api,
        takeOverCourt: () =>
          Promise.resolve({
            ok: false as const,
            error: {
              kind: "problem" as const,
              status: 422,
              code: "matches.limit-reached" as const,
            },
          }),
      },
    };

    await runTakeover(full, { origin: ROUND, summary: summary.value }, (action) => {
      if (action.type === "failed") reasons.push(action.reason);
    });

    expect(reasons).toEqual(["writers-limit"]);
    expect(await sessionMissing(b)).toBe(true);
  });
});

function withFirst(
  page: CourtEventsPage,
  change: (event: Record<string, unknown>) => unknown,
): readonly unknown[] {
  const events = Array.isArray(page.events) ? (page.events as readonly unknown[]) : [];
  return events.map((event, index) =>
    index === 0 && typeof event === "object" && event !== null
      ? change({ ...(event as Record<string, unknown>) })
      : event,
  );
}
