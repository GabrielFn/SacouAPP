import { describe, expect, test } from "vitest";

import { apiErr, type ApiResult } from "../../../services/api/api-result";
import type { CourtEventsPage } from "../../../services/api/sacou-api";
import type { SessionIdentity } from "../../../services/auth/auth-session";
import { SESSION_A } from "../persistence/log-envelopes.test.fixture";
import { createCourtReplayer } from "../session/court-replay";
import { ROUND, settled } from "../sync/court-sync.test.fixture";
import {
  createFakeCourtStreamServer,
  type FakeCourtStreamServer,
} from "../sync/fake-court-stream-server.test.fixture";
import { RATE_LIMIT_ATTEMPTS } from "./api-calls";
import { MAX_IMPORTED_EVENTS, readServerStream } from "./import-stream";
import { runTakeover } from "./run-takeover";
import { createPhone, openAndScore, scorePoints, type Phone } from "./takeover.test.fixture";

const RETRY_AFTER_MS = 9_000;
const ACCOUNT: SessionIdentity = Object.freeze({ opaque: Symbol("account") });
const LIMITED: ApiResult<never> = apiErr({ kind: "rate-limited", retryAfterMs: RETRY_AFTER_MS });
const POINTS = 3;

async function court(): Promise<{ server: FakeCourtStreamServer; a: Phone; b: Phone }> {
  const server = createFakeCourtStreamServer();
  const a = await createPhone(1, server);
  const b = await createPhone(2, server);
  await openAndScore(a, SESSION_A, POINTS);
  return { server, a, b };
}

async function summaryOf(server: FakeCourtStreamServer, phone: Phone) {
  const summary = await server.api.getCourtSession(
    ROUND.groupId,
    ROUND.roundId,
    phone.owner.session,
  );
  if (!summary.ok) throw new Error("no summary");
  return summary.value;
}

async function missing(phone: Phone): Promise<boolean> {
  const loaded = await phone.log.load(SESSION_A);
  return !loaded.ok && loaded.error.code === "session-not-found";
}

describe("take-over gaps (E4.11 part 2, tester)", () => {
  test("the page route waits each Retry-After and gives up after the attempts, writing nothing", async () => {
    const waits: number[] = [];
    const calls = { value: 0 };
    const deps = {
      api: {
        listCourtEvents: () => {
          calls.value += 1;
          return Promise.resolve(LIMITED);
        },
      },
      replayer: createCourtReplayer(),
      wait: (ms: number) => {
        waits.push(ms);
        return Promise.resolve();
      },
    };

    const read = await readServerStream(deps, {
      ref: { ...ROUND, courtSessionId: SESSION_A },
      eventsToRead: 1,
      account: ACCOUNT,
      onProgress: () => undefined,
    });

    expect(read).toEqual({ ok: false, error: "failed" });
    expect(calls.value).toBe(RATE_LIMIT_ATTEMPTS);
    expect(waits).toEqual(Array.from({ length: RATE_LIMIT_ATTEMPTS - 1 }, () => RETRY_AFTER_MS));
  });

  test("exactly the ceiling of events is not refused up front", async () => {
    const calls = { value: 0 };
    const deps = {
      api: {
        listCourtEvents: () => {
          calls.value += 1;
          return Promise.resolve(apiErr({ kind: "offline" }));
        },
      },
      replayer: createCourtReplayer(),
      wait: () => Promise.resolve(),
    };

    const read = await readServerStream(deps, {
      ref: { ...ROUND, courtSessionId: SESSION_A },
      eventsToRead: MAX_IMPORTED_EVENTS,
      account: ACCOUNT,
      onProgress: () => undefined,
    });

    expect(read).toEqual({ ok: false, error: "offline" });
    expect(calls.value).toBe(1);
  });

  test("a 429 on the take-over three times: waits twice, fails, imports and writes nothing", async () => {
    const { server, b } = await court();
    const summary = await summaryOf(server, b);
    const deps = b.takeoverDeps();
    const listed = { value: 0 };
    const limited = {
      ...deps,
      api: {
        takeOverCourt: () => Promise.resolve(LIMITED),
        listCourtEvents: (...args: Parameters<typeof deps.api.listCourtEvents>) => {
          listed.value += 1;
          return deps.api.listCourtEvents(...args);
        },
      },
    };
    const reasons: string[] = [];

    await runTakeover(limited, { origin: ROUND, summary }, (action) => {
      if (action.type === "failed") reasons.push(action.reason);
    });

    expect(reasons).toEqual(["failed"]);
    expect(b.waits).toHaveLength(RATE_LIMIT_ATTEMPTS - 1);
    expect(listed.value).toBe(0);
    expect(await missing(b)).toBe(true);
  });

  test("another account signed in at the start: no request at all, nothing written", async () => {
    const { server, b } = await court();
    const summary = await summaryOf(server, b);
    const before = server.requests().length;
    const touched = { value: 0 };
    const deps = b.takeoverDeps();
    const none = {
      ...deps,
      account: () => Promise.resolve(null),
      api: {
        takeOverCourt: () => {
          touched.value += 1;
          return Promise.resolve(LIMITED);
        },
        listCourtEvents: () => {
          touched.value += 1;
          return Promise.resolve(LIMITED);
        },
      },
    };
    const reasons: string[] = [];

    await runTakeover(none, { origin: ROUND, summary }, (action) => {
      if (action.type === "failed") reasons.push(action.reason);
    });

    expect(reasons).toEqual(["no-account"]);
    expect(touched.value).toBe(0);
    expect(server.requests()).toHaveLength(before);
    expect(await missing(b)).toBe(true);
  });

  test("the account changes while the import runs: nothing is kept", async () => {
    const { server, b } = await court();
    const summary = await summaryOf(server, b);
    const deps = b.takeoverDeps();
    const other = await createPhone(3, server);
    const asked = { value: 0 };
    const switching = {
      ...deps,
      account: () => {
        asked.value += 1;
        return asked.value === 1 ? deps.account() : other.account.current();
      },
    };
    const reasons: string[] = [];

    await runTakeover(switching, { origin: ROUND, summary }, (action) => {
      if (action.type === "failed") reasons.push(action.reason);
    });

    expect(reasons).toEqual(["no-account"]);
    expect(await missing(b)).toBe(true);
  });

  test("a failed take-back import keeps the refused points and the old log", async () => {
    const { server, a, b } = await court();
    expect((await runTakeoverOf(server, b)).final).toBe("imported");
    a.network.set(false);
    const controller = await a.controller(SESSION_A);
    await scorePoints(controller, 2);
    a.network.set(true);
    await settled(a.sync);
    const before = await a.load(SESSION_A);
    expect(before.refused).toHaveLength(2);
    server.tamperPages((page: CourtEventsPage) => ({
      ...page,
      lastPosition: Number(page.lastPosition) + 1,
    }));

    expect((await runTakeoverOf(server, a)).final).toBe("import-invalid");

    expect(await a.load(SESSION_A)).toEqual(before);
  });
});

async function runTakeoverOf(server: FakeCourtStreamServer, phone: Phone) {
  const summary = await summaryOf(server, phone);
  const last = { value: "" };
  await runTakeover(phone.takeoverDeps(), { origin: ROUND, summary }, (action) => {
    last.value = action.type === "failed" ? action.reason : action.type;
  });
  return { final: last.value };
}
