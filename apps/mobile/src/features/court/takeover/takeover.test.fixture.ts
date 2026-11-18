import { expect } from "vitest";

import { createFakeAppForeground } from "../../../adapters/fake-app-foreground";
import { createFakeClock } from "../../../adapters/fake-clock";
import {
  createFakeNetworkStatus,
  type FakeNetworkStatus,
} from "../../../adapters/fake-network-status";
import { createFakeScheduler } from "../../../adapters/fake-scheduler";
import type { IdGenerator } from "../../../services/id/id-generator";
import { SAMPLE_MATCH_ONE_SET } from "../dev/sample-match.data";
import { createCourtEventRepository } from "../persistence/court-event-repository";
import { openMigratedDatabase } from "../persistence/log-envelopes.test.fixture";
import type { CourtAccountRef } from "../ports/court-account";
import type { CourtEventLog, StoredCourtLog } from "../ports/court-event-log";
import type { CourtSync } from "../ports/court-sync";
import { createCourtReplayer, type CourtReplayer } from "../session/court-replay";
import {
  createCourtSessionController,
  type CourtSessionController,
} from "../session/court-session-controller";
import { startCourtMatch } from "../session/start-court-match";
import {
  accountRef,
  createFakeCourtAccount,
  ROUND,
  settled,
  type FakeCourtAccount,
} from "../sync/court-sync.test.fixture";
import { createCourtSyncRunner } from "../sync/court-sync-runner";
import type { FakeCourtStreamServer } from "../sync/fake-court-stream-server.test.fixture";
import { runTakeover, type TakeoverDeps } from "./run-takeover";
import {
  INITIAL_TAKEOVER_STATE,
  takeoverReducer,
  type TakeoverAction,
  type TakeoverState,
} from "./takeover.reducer";

const MIDDLE_JITTER = 0.5;
const ID_DIGITS = 12;

/** UUIDs of one phone, apart from the other phone's by the fourth group. */
function phoneIds(phone: number): IdGenerator {
  const counter = { value: 0 };
  return {
    newId() {
      counter.value += 1;
      return `00000000-0000-4000-800${String(phone)}-${String(counter.value).padStart(ID_DIGITS, "0")}`;
    },
  };
}

export interface Phone {
  readonly log: CourtEventLog;
  readonly deviceId: string;
  readonly account: FakeCourtAccount;
  readonly owner: CourtAccountRef;
  readonly network: FakeNetworkStatus;
  readonly sync: CourtSync;
  readonly replayer: CourtReplayer;
  readonly ids: IdGenerator;
  /** Every 429 wait the take-over asked for. */
  readonly waits: readonly number[];
  controller(courtSessionId: string): Promise<CourtSessionController>;
  takeoverDeps(): TakeoverDeps;
  load(courtSessionId: string): Promise<StoredCourtLog>;
}

export async function createPhone(number: number, server: FakeCourtStreamServer): Promise<Phone> {
  const ids = phoneIds(number);
  const log = createCourtEventRepository((await openMigratedDatabase()).database, ids);
  const device = await log.getDeviceId();
  if (!device.ok) throw new Error("no device");
  const owner = accountRef(`phone-${String(number)}`);
  const account = createFakeCourtAccount(owner);
  const clock = createFakeClock();
  const network = createFakeNetworkStatus(true);
  const replayer = createCourtReplayer();
  const sync = createCourtSyncRunner({
    log,
    api: server.api,
    account,
    network,
    foreground: createFakeAppForeground(),
    clock,
    scheduler: createFakeScheduler(clock),
    random: { next: () => MIDDLE_JITTER },
  });
  sync.start();
  const waits = { value: [] as readonly number[] };
  return {
    log,
    deviceId: device.value,
    account,
    owner,
    network,
    sync,
    replayer,
    ids,
    get waits() {
      return waits.value;
    },
    async controller(courtSessionId) {
      const controller = createCourtSessionController({ courtSessionId, log, replayer, ids, sync });
      await controller.whenIdle();
      return controller;
    },
    takeoverDeps: () => ({
      api: server.api,
      log,
      replayer,
      account: () => account.current(),
      wait: (ms) => {
        waits.value = [...waits.value, ms];
        return Promise.resolve();
      },
    }),
    async load(courtSessionId) {
      const loaded = await log.load(courtSessionId);
      if (!loaded.ok) throw new Error(loaded.error.code);
      return loaded.value;
    },
  };
}

/** Phone A opens the court of the round, starts a match and marks `points` points, all sent. */
export async function openAndScore(
  phone: Phone,
  courtSessionId: string,
  points: number,
): Promise<CourtSessionController> {
  await phone.log.openSession(courtSessionId, { ...ROUND, ownerKey: phone.owner.key });
  const deps = { courtSessionId, ...phone, sync: phone.sync };
  const started = await startCourtMatch(deps, SAMPLE_MATCH_ONE_SET);
  expect(started.ok).toBe(true);
  const controller = await phone.controller(courtSessionId);
  await scorePoints(controller, points);
  await settled(phone.sync);
  return controller;
}

export async function scorePoints(
  controller: CourtSessionController,
  points: number,
  team: "a" | "b" = "a",
): Promise<void> {
  if (points <= 0) return;
  const scored = await controller.dispatch({ type: "score-point", team });
  expect(scored.ok).toBe(true);
  await scorePoints(controller, points - 1, team);
}

export interface TakeoverRun {
  readonly states: readonly TakeoverState[];
  readonly final: TakeoverState;
}

/** Reads the summary as screen 09a does, then runs the take-over through the reducer. */
export async function takeOver(
  phone: Phone,
  server: FakeCourtStreamServer,
  onAction: (action: TakeoverAction) => void = () => undefined,
): Promise<TakeoverRun> {
  const summary = await server.api.getCourtSession(
    ROUND.groupId,
    ROUND.roundId,
    phone.owner.session,
  );
  if (!summary.ok) throw new Error("no summary");
  const state = { value: takeoverReducer(INITIAL_TAKEOVER_STATE, { type: "confirmed" }) };
  const states = { value: [state.value] as readonly TakeoverState[] };
  await runTakeover(phone.takeoverDeps(), { origin: ROUND, summary: summary.value }, (action) => {
    onAction(action);
    state.value = takeoverReducer(state.value, action);
    states.value = [...states.value, state.value];
  });
  return { states: states.value, final: state.value };
}
