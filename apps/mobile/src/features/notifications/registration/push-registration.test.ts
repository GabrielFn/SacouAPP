import { describe, expect, test, vi } from "vitest";

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
import { apiErr, apiOk, type ApiResult } from "../../../services/api/api-result";
import type { SacouApi } from "../../../services/api/sacou-api";
import type { SessionIdentity } from "../../../services/auth/auth-session";
import type { PermissionAnswer } from "../ports/notification-permission";
import { createPushDevices, DEREGISTER_TIMEOUT_MS } from "./push-registration";

const NEW_TOKEN = { token: "ExponentPushToken[rotated]", platform: "android" } as const;

function setup(
  options: { readonly permission?: PermissionAnswer; readonly signedIn?: boolean } = {},
) {
  const fake = createFakeSacouApi();
  fake.respond("registerPushDevice", apiOk(null));
  fake.respond("removePushDevice", apiOk(null));
  const permission = createFakeNotificationPermission(options.permission ?? "granted");
  const tokens = createFakePushTokenSource();
  const installationIds = createMemoryInstallationIdStore();
  const current: { session: SessionIdentity | null } = {
    session: options.signedIn === false ? null : { opaque: Symbol("ana") },
  };
  const clock = createFakeClock();
  const scheduler = createFakeScheduler(clock);
  const deps = {
    api: fake.api,
    permission,
    tokens,
    installationIds,
    session: { currentSession: () => current.session },
    scheduler,
  };
  return { fake, permission, tokens, installationIds, current, scheduler, deps };
}

/** Lets the pending promises of the fakes settle. */
const flush = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

const registers = (fake: ReturnType<typeof createFakeSacouApi>) =>
  fake.calls().filter((call) => call.operation === "registerPushDevice");

describe("M2 push-registration with fake ports", () => {
  test("a session and the permission: one PUT with the install, the token and the platform", async () => {
    const harness = setup();
    const devices = createPushDevices(harness.deps);
    expect(await devices.sync()).toBe("registered");
    expect(registers(harness.fake)).toEqual([
      {
        operation: "registerPushDevice",
        args: [
          {
            installationId: FAKE_INSTALLATION_ID,
            token: FAKE_PUSH_TOKEN.token,
            platform: "android",
          },
        ],
      },
    ]);
  });

  test("a token change sends a PUT with the new token", async () => {
    const harness = setup();
    const devices = createPushDevices(harness.deps);
    const stop = devices.start();
    harness.tokens.change(NEW_TOKEN);
    await vi.waitFor(() => {
      expect(registers(harness.fake)).toHaveLength(1);
    });
    expect(registers(harness.fake)[0]?.args[0]).toMatchObject({ token: NEW_TOKEN.token });
    stop();
    harness.tokens.change(FAKE_PUSH_TOKEN);
    await Promise.resolve();
    expect(registers(harness.fake)).toHaveLength(1);
  });

  test("the same token again sends no second PUT; a new token does", async () => {
    const harness = setup();
    const devices = createPushDevices(harness.deps);
    devices.start();
    harness.tokens.change(NEW_TOKEN);
    harness.tokens.change(NEW_TOKEN);
    await vi.waitFor(() => {
      expect(registers(harness.fake)).toHaveLength(1);
    });
    harness.tokens.change(NEW_TOKEN);
    await flush();
    expect(registers(harness.fake)).toHaveLength(1);
    harness.tokens.change(FAKE_PUSH_TOKEN);
    await vi.waitFor(() => {
      expect(registers(harness.fake)).toHaveLength(2);
    });
    expect(registers(harness.fake)[1]?.args[0]).toMatchObject({ token: FAKE_PUSH_TOKEN.token });
  });

  test("a change to the token the opening registered sends nothing", async () => {
    const harness = setup();
    const devices = createPushDevices(harness.deps);
    devices.start();
    expect(await devices.sync()).toBe("registered");
    harness.tokens.change(FAKE_PUSH_TOKEN);
    await flush();
    expect(registers(harness.fake)).toHaveLength(1);
  });

  test("each opening still sends one PUT, even with the same token", async () => {
    const harness = setup();
    const devices = createPushDevices(harness.deps);
    expect(await devices.sync()).toBe("registered");
    expect(await devices.sync()).toBe("registered");
    expect(registers(harness.fake)).toHaveLength(2);
  });

  test("after a failed PUT the same token is sent again on the next change", async () => {
    const harness = setup();
    harness.fake.respond("registerPushDevice", apiErr({ kind: "unavailable", retryAfterMs: 0 }));
    const devices = createPushDevices(harness.deps);
    expect(await devices.sync()).toBe("failed");
    harness.fake.respond("registerPushDevice", apiOk(null));
    devices.start();
    harness.tokens.change(FAKE_PUSH_TOKEN);
    await vi.waitFor(() => {
      expect(registers(harness.fake)).toHaveLength(2);
    });
  });

  test("a new session registers the same token again", async () => {
    const harness = setup();
    const devices = createPushDevices(harness.deps);
    devices.start();
    expect(await devices.sync()).toBe("registered");
    harness.current.session = { opaque: Symbol("bia") };
    harness.tokens.change(FAKE_PUSH_TOKEN);
    await vi.waitFor(() => {
      expect(registers(harness.fake)).toHaveLength(2);
    });
  });

  test("no session: nothing is asked of the system nor sent", async () => {
    const harness = setup({ signedIn: false });
    const devices = createPushDevices(harness.deps);
    expect(await devices.sync()).toBe("no-session");
    devices.start();
    harness.tokens.change(NEW_TOKEN);
    await Promise.resolve();
    expect(harness.fake.calls()).toEqual([]);
    expect(await harness.installationIds.read()).toBeNull();
  });

  test.each(["askable", "blocked"] as const)("permission %s: nothing is sent", async (answer) => {
    const harness = setup({ permission: answer });
    expect(await createPushDevices(harness.deps).sync()).toBe("no-permission");
    expect(harness.fake.calls()).toEqual([]);
  });

  test("no token from the system: nothing is sent", async () => {
    const harness = setup();
    harness.tokens.set(null);
    expect(await createPushDevices(harness.deps).sync()).toBe("no-token");
    expect(harness.fake.calls()).toEqual([]);
  });

  test("a failure is silent and makes no new loop: one PUT, no wait scheduled", async () => {
    const harness = setup();
    harness.fake.respond("registerPushDevice", apiErr({ kind: "unavailable", retryAfterMs: 0 }));
    expect(await createPushDevices(harness.deps).sync()).toBe("failed");
    expect(registers(harness.fake)).toHaveLength(1);
    expect(harness.scheduler.pendingDelays()).toEqual([]);
  });

  test("a system that throws is a failure, never an exception", async () => {
    const harness = setup();
    const devices = createPushDevices({
      ...harness.deps,
      tokens: { ...harness.tokens, getToken: () => Promise.reject(new Error("no FCM")) },
    });
    expect(await devices.sync()).toBe("failed");
  });

  test("the account changed while the system answered: nothing is sent", async () => {
    const harness = setup();
    const devices = createPushDevices({
      ...harness.deps,
      tokens: {
        ...harness.tokens,
        getToken: () => {
          harness.current.session = { opaque: Symbol("bia") };
          return Promise.resolve(FAKE_PUSH_TOKEN);
        },
      },
    });
    expect(await devices.sync()).toBe("no-session");
    expect(harness.fake.calls()).toEqual([]);
  });
});

describe("the exit of the account (deregister)", () => {
  test("DELETE with the install, then the local unregister", async () => {
    const harness = setup();
    const devices = createPushDevices(harness.deps);
    await devices.sync();
    await devices.deregister();
    expect(harness.fake.calls().at(-1)).toEqual({
      operation: "removePushDevice",
      args: [{ installationId: FAKE_INSTALLATION_ID }],
    });
    expect(harness.tokens.unregistered()).toBe(1);
  });

  test("an install that never registered sends no DELETE but still unregisters", async () => {
    const harness = setup();
    await createPushDevices(harness.deps).deregister();
    expect(harness.fake.calls()).toEqual([]);
    expect(harness.tokens.unregistered()).toBe(1);
  });

  test("a DELETE slower than 2 s does not hold the exit", async () => {
    const harness = setup();
    const never: SacouApi["removePushDevice"] = () => new Promise<ApiResult<null>>(() => undefined);
    const devices = createPushDevices({
      ...harness.deps,
      installationIds: createMemoryInstallationIdStore(FAKE_INSTALLATION_ID),
      api: { ...harness.fake.api, removePushDevice: never },
    });
    const done = { value: false };
    const exit = devices.deregister().then(() => {
      done.value = true;
    });
    await vi.waitFor(() => {
      expect(harness.scheduler.pendingDelays()).toEqual([DEREGISTER_TIMEOUT_MS]);
    });
    expect(done.value).toBe(false);
    harness.scheduler.advance(DEREGISTER_TIMEOUT_MS);
    await exit;
    expect(harness.tokens.unregistered()).toBe(1);
  });

  test("a DELETE that fails and a local unregister that throws do not hold the exit", async () => {
    const harness = setup();
    harness.fake.respond("removePushDevice", apiErr({ kind: "offline" }));
    harness.tokens.failUnregister();
    const devices = createPushDevices({
      ...harness.deps,
      installationIds: createMemoryInstallationIdStore(FAKE_INSTALLATION_ID),
    });
    await expect(devices.deregister()).resolves.toBeUndefined();
    expect(harness.scheduler.pendingDelays()).toEqual([]);
  });

  test("a registration on the way is followed by a second DELETE, and none leaves after the exit began", async () => {
    const harness = setup();
    const release: { put: (result: ApiResult<null>) => void } = { put: () => undefined };
    const order: string[] = [];
    const api: Pick<SacouApi, "registerPushDevice" | "removePushDevice"> = {
      registerPushDevice: () => {
        order.push("PUT");
        return new Promise((resolve) => {
          release.put = (result) => {
            order.push("PUT answered");
            resolve(result);
          };
        });
      },
      removePushDevice: () => {
        order.push("DELETE");
        return Promise.resolve(apiOk(null));
      },
    };
    const devices = createPushDevices({ ...harness.deps, api });
    void devices.sync();
    await vi.waitFor(() => {
      expect(order).toEqual(["PUT"]);
    });
    const exit = devices.deregister();
    expect(await devices.sync()).toBe("closing");
    release.put(apiOk(null));
    await exit;
    expect(order).toEqual(["PUT", "DELETE", "PUT answered", "DELETE"]);
  });

  test("forgetLocally only unregisters the phone", async () => {
    const harness = setup();
    await createPushDevices(harness.deps).forgetLocally();
    expect(harness.fake.calls()).toEqual([]);
    expect(harness.tokens.unregistered()).toBe(1);
  });

  // Finding of the review (b): the wait for the PUT must never keep the DELETE from leaving.
  test("a PUT in flight slower than 2 s still lets the DELETE leave before the exit ends", async () => {
    const harness = setup();
    const order: string[] = [];
    const api: Pick<SacouApi, "registerPushDevice" | "removePushDevice"> = {
      registerPushDevice: () => {
        order.push("PUT");
        return new Promise<ApiResult<null>>(() => undefined);
      },
      removePushDevice: () => {
        order.push("DELETE");
        return Promise.resolve(apiOk(null));
      },
    };
    const devices = createPushDevices({ ...harness.deps, api });
    void devices.sync();
    await vi.waitFor(() => {
      expect(order).toEqual(["PUT"]);
    });
    const exit = devices.deregister();
    await vi.waitFor(() => {
      expect(harness.scheduler.pendingDelays()).toEqual([DEREGISTER_TIMEOUT_MS]);
    });
    harness.scheduler.advance(DEREGISTER_TIMEOUT_MS);
    await exit;
    expect(order).toEqual(["PUT", "DELETE"]);
    expect(harness.tokens.unregistered()).toBe(1);
  });
  test("a PUT that lands after the 2 s sends no second DELETE, which another account could sign", async () => {
    const harness = setup();
    const order: string[] = [];
    const landing: { resolve: (result: ApiResult<null>) => void } = { resolve: () => undefined };
    const api: Pick<SacouApi, "registerPushDevice" | "removePushDevice"> = {
      registerPushDevice: () => {
        order.push("PUT");
        return new Promise<ApiResult<null>>((resolve) => {
          landing.resolve = resolve;
        });
      },
      removePushDevice: () => {
        order.push("DELETE");
        return Promise.resolve(apiOk(null));
      },
    };
    const devices = createPushDevices({ ...harness.deps, api });
    const sync = devices.sync();
    await vi.waitFor(() => {
      expect(order).toEqual(["PUT"]);
    });
    const exit = devices.deregister();
    await vi.waitFor(() => {
      expect(harness.scheduler.pendingDelays()).toEqual([DEREGISTER_TIMEOUT_MS]);
    });
    harness.scheduler.advance(DEREGISTER_TIMEOUT_MS);
    await exit;
    landing.resolve(apiOk(null));
    await sync;
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(order).toEqual(["PUT", "DELETE"]);
  });
});
