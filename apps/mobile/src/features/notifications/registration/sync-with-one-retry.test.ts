import { describe, expect, test } from "vitest";

import { createDevPushOutcomeLog } from "../../../adapters/dev-push-outcome-log";
import { createFakeClock } from "../../../adapters/fake-clock";
import { createFakeNotificationPermission } from "../../../adapters/fake-notification-permission";
import {
  createFakePushTokenSource,
  FAKE_PUSH_TOKEN,
} from "../../../adapters/fake-push-token-source";
import { createFakeSacouApi } from "../../../adapters/fake-sacou-api";
import { createFakeScheduler } from "../../../adapters/fake-scheduler";
import {
  createMemoryInstallationIdStore,
  FAKE_INSTALLATION_ID,
} from "../../../adapters/memory-installation-id-store";
import { apiErr, apiOk } from "../../../services/api/api-result";
import type { PermissionAnswer } from "../ports/notification-permission";
import type { PushSyncOutcome } from "./push-registration";
import { createPushDevices } from "./push-registration";
import { PUSH_RETRY_AFTER_FAILURE_MS, syncWithOneRetry } from "./sync-with-one-retry";

const TOO_MANY = apiErr({ kind: "rate-limited", retryAfterMs: 0 });

function setup(permission: PermissionAnswer = "granted") {
  const fake = createFakeSacouApi();
  fake.respond("registerPushDevice", apiOk(null));
  const scheduler = createFakeScheduler(createFakeClock());
  const session = { opaque: Symbol("ana") };
  const devices = createPushDevices({
    api: fake.api,
    permission: createFakeNotificationPermission(permission),
    tokens: createFakePushTokenSource(),
    installationIds: createMemoryInstallationIdStore(),
    session: { currentSession: () => session },
    scheduler,
  });
  const outcomes: PushSyncOutcome[] = [];
  const lines: string[] = [];
  const devLog = createDevPushOutcomeLog(true, (line) => lines.push(line));
  const log = {
    record: (outcome: PushSyncOutcome) => {
      outcomes.push(outcome);
      devLog.record(outcome);
    },
  };
  const registers = () => fake.calls().filter((call) => call.operation === "registerPushDevice");
  return { fake, scheduler, devices, outcomes, lines, log, registers };
}

const flush = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

async function settle(): Promise<void> {
  for (const _ of [1, 2, 3, 4, 5]) await flush();
}

describe("R98 item 9: the registration of an opening", () => {
  test("with the permission already given, the opening sends the PUT of this phone", async () => {
    const harness = setup("granted");
    syncWithOneRetry({ devices: harness.devices, scheduler: harness.scheduler, log: harness.log });
    await settle();
    expect(harness.registers()).toHaveLength(1);
    expect(harness.outcomes).toEqual(["registered"]);
    expect(harness.scheduler.pendingDelays()).toEqual([]);
  });

  test("without the permission nothing leaves and nothing is tried again", async () => {
    const harness = setup("askable");
    syncWithOneRetry({ devices: harness.devices, scheduler: harness.scheduler, log: harness.log });
    await settle();
    expect(harness.registers()).toHaveLength(0);
    expect(harness.outcomes).toEqual(["no-permission"]);
    expect(harness.scheduler.pendingDelays()).toEqual([]);
  });

  test("a failure gets one more try after the wait, and a second failure no third one", async () => {
    const harness = setup();
    harness.fake.respond("registerPushDevice", TOO_MANY);
    syncWithOneRetry({ devices: harness.devices, scheduler: harness.scheduler, log: harness.log });
    await settle();
    expect(harness.scheduler.pendingDelays()).toEqual([PUSH_RETRY_AFTER_FAILURE_MS]);
    harness.scheduler.advance(PUSH_RETRY_AFTER_FAILURE_MS - 1);
    await settle();
    expect(harness.registers()).toHaveLength(1);
    harness.scheduler.advance(1);
    await settle();
    expect(harness.registers()).toHaveLength(2);
    expect(harness.outcomes).toEqual(["failed", "failed"]);
    expect(harness.scheduler.pendingDelays()).toEqual([]);
    harness.scheduler.advance(PUSH_RETRY_AFTER_FAILURE_MS * 10);
    await settle();
    expect(harness.registers()).toHaveLength(2);
  });

  test("a failure then a success stops there", async () => {
    const harness = setup();
    harness.fake.respond("registerPushDevice", TOO_MANY);
    syncWithOneRetry({ devices: harness.devices, scheduler: harness.scheduler, log: harness.log });
    await settle();
    harness.fake.respond("registerPushDevice", apiOk(null));
    harness.scheduler.advance(PUSH_RETRY_AFTER_FAILURE_MS);
    await settle();
    expect(harness.outcomes).toEqual(["failed", "registered"]);
    expect(harness.scheduler.pendingDelays()).toEqual([]);
  });

  test("cancelled while the try more waits, it never leaves", async () => {
    const harness = setup();
    harness.fake.respond("registerPushDevice", TOO_MANY);
    const cancel = syncWithOneRetry({
      devices: harness.devices,
      scheduler: harness.scheduler,
      log: harness.log,
    });
    await settle();
    cancel();
    harness.scheduler.advance(PUSH_RETRY_AFTER_FAILURE_MS);
    await settle();
    expect(harness.registers()).toHaveLength(1);
    expect(harness.scheduler.pendingDelays()).toEqual([]);
  });

  test("the development log shows the outcome and never the token nor the install", async () => {
    const harness = setup();
    syncWithOneRetry({ devices: harness.devices, scheduler: harness.scheduler, log: harness.log });
    await settle();
    expect(harness.lines).toEqual(["[push] registration: registered"]);
    for (const line of harness.lines) {
      expect(line).not.toContain(FAKE_PUSH_TOKEN.token);
      expect(line).not.toContain(FAKE_INSTALLATION_ID);
    }
  });

  test("a release build logs nothing", () => {
    const lines: string[] = [];
    createDevPushOutcomeLog(false, (line) => lines.push(line)).record("failed");
    expect(lines).toEqual([]);
  });
});
