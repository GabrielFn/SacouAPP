import type { EventEnvelope } from "@sacou/match-engine";
import { expect, vi } from "vitest";

import {
  createFakeAppForeground,
  type FakeAppForeground,
} from "../../../adapters/fake-app-foreground";
import { createFakeClock } from "../../../adapters/fake-clock";
import { createFakeCourtEventLog } from "../../../adapters/fake-court-event-log";
import {
  createFakeNetworkStatus,
  type FakeNetworkStatus,
} from "../../../adapters/fake-network-status";
import { createFakeScheduler, type FakeScheduler } from "../../../adapters/fake-scheduler";
import { createSequentialIdGenerator } from "../../../adapters/fake-sequential-id-generator";
import { createListeners } from "../../../adapters/listeners";
import type { SessionIdentity } from "../../../services/auth/auth-session";
import { makeEnvelope, SESSION_A } from "../persistence/log-envelopes.test.fixture";
import type { CourtAccount, CourtAccountRef } from "../ports/court-account";
import type { CourtEventLog, SessionToSync } from "../ports/court-event-log";
import type { CourtSync } from "../ports/court-sync";
import { createCourtSyncRunner } from "./court-sync-runner";
import {
  createFakeCourtStreamServer,
  type FakeCourtStreamServer,
} from "./fake-court-stream-server.test.fixture";

/** The middle of the variation, so the backoff waits are the round numbers of the plan. */
const MIDDLE_JITTER = 0.5;

export const ROUND = {
  groupId: "g0000000-0000-4000-8000-000000000001",
  roundId: "r0000000-0000-4000-8000-000000000001",
};

export interface FakeCourtAccount extends CourtAccount {
  switchTo(account: CourtAccountRef | null): void;
}

export function accountRef(name: string): CourtAccountRef {
  const session: SessionIdentity = Object.freeze({ opaque: Symbol(name) });
  return { session, key: `key-${name}` };
}

export function createFakeCourtAccount(initial: CourtAccountRef | null): FakeCourtAccount {
  const current = { value: initial };
  const listeners = createListeners();
  return {
    current: () => Promise.resolve(current.value),
    subscribe: listeners.add,
    switchTo(account) {
      current.value = account;
      listeners.notify();
    },
  };
}

export interface SyncHarness {
  readonly log: CourtEventLog;
  readonly server: FakeCourtStreamServer;
  readonly network: FakeNetworkStatus;
  readonly foreground: FakeAppForeground;
  readonly scheduler: FakeScheduler;
  readonly account: FakeCourtAccount;
  readonly owner: CourtAccountRef;
  readonly deviceId: string;
  /** A new loop on the same log and server, as after closing the app. */
  restart(): CourtSync;
  sync(): CourtSync;
  /** Writes `count` events of this device after the ones it has, and tells the loop. */
  write(count: number): Promise<readonly EventEnvelope[]>;
}

export interface SyncHarnessOptions {
  readonly log?: CourtEventLog;
  readonly online?: boolean;
  readonly onAcknowledged?: (target: SessionToSync) => void;
}

export async function createSyncHarness(options: SyncHarnessOptions = {}): Promise<SyncHarness> {
  const log = options.log ?? createFakeCourtEventLog(createSequentialIdGenerator());
  const server = createFakeCourtStreamServer();
  const clock = createFakeClock();
  const scheduler = createFakeScheduler(clock);
  const network = createFakeNetworkStatus(options.online ?? true);
  const foreground = createFakeAppForeground();
  const owner = accountRef("owner");
  const account = createFakeCourtAccount(owner);
  const device = await log.getDeviceId();
  if (!device.ok) throw new Error("no device");
  await log.openSession(SESSION_A, { ...ROUND, ownerKey: owner.key });
  const make = () =>
    createCourtSyncRunner({
      log,
      api: server.api,
      account,
      network,
      foreground,
      clock,
      scheduler,
      random: { next: () => MIDDLE_JITTER },
      onAcknowledged: options.onAcknowledged,
    });
  const current = { value: make() };
  current.value.start();
  const written = { value: 0 };
  return {
    log,
    server,
    network,
    foreground,
    scheduler,
    account,
    owner,
    deviceId: device.value,
    sync: () => current.value,
    restart() {
      current.value.stop();
      current.value = make();
      current.value.start();
      return current.value;
    },
    async write(count) {
      const envelopes = Array.from({ length: count }, (_, index) => {
        const sequence = written.value + index + 1;
        return makeEnvelope({ deviceId: device.value, sequence, eventNumber: sequence });
      });
      written.value += count;
      const appended = await log.append(SESSION_A, envelopes);
      if (!appended.ok) throw new Error(appended.error.code);
      current.value.notifyAppended();
      return envelopes;
    },
  };
}

/** Waits until the loop has nothing in flight: idle, or waiting for a timer. */
export async function settled(sync: CourtSync): Promise<void> {
  await vi.waitFor(() => {
    expect(sync.getSnapshot().loop.status).not.toBe("sending");
  });
}

export async function ackedOf(log: CourtEventLog): Promise<number> {
  const loaded = await log.load(SESSION_A);
  if (!loaded.ok) throw new Error(loaded.error.code);
  return loaded.value.ackedSequence;
}
