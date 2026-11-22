import { beforeEach, describe, expect, test, vi } from "vitest";
import { expoNotificationsPushTokenSource } from "./expo-notifications-push-token-source";

const native = vi.hoisted(() => ({
  deviceToken: "device-1",
  failExpo: false,
  expoReads: 0,
  listener: null as ((token: { type: string; data: string }) => void) | null,
  removed: false,
  burst: [] as string[],
}));

function emit(): void {
  native.listener?.({ type: "android", data: native.deviceToken });
}

vi.mock("react-native", () => ({ Platform: { OS: "android" } }));
vi.mock("expo-constants", () => ({
  default: { expoConfig: { extra: { eas: { projectId: "project" } } } },
}));
vi.mock("./expo-notifications-channel", () => ({ ensureWaitlistChannel: () => Promise.resolve() }));
vi.mock("expo-notifications", () => ({
  // Like the native module: reading the device token emits the token event again.
  getDevicePushTokenAsync: () => {
    queueMicrotask(emit);
    for (const data of native.burst.splice(0)) {
      queueMicrotask(() => native.listener?.({ type: "android", data }));
    }
    return Promise.resolve({ type: "android", data: native.deviceToken });
  },
  getExpoPushTokenAsync: () => {
    native.expoReads += 1;
    return native.failExpo
      ? Promise.reject(new Error("offline"))
      : Promise.resolve({ data: "ExponentPushToken[x]" });
  },
  addPushTokenListener: (fn: (token: { type: string; data: string }) => void) => {
    native.listener = fn;
    return {
      remove: () => {
        native.removed = true;
        native.listener = null;
      },
    };
  },
  unregisterForNotificationsAsync: () => Promise.resolve(),
}));

const settle = () => new Promise<void>((resolve) => setTimeout(resolve, 20));

describe("expoNotificationsPushTokenSource.onTokenChange", () => {
  beforeEach(() => {
    native.deviceToken = "device-1";
    native.failExpo = false;
    native.expoReads = 0;
    native.removed = false;
    native.burst = [];
  });

  test("a new device token is read once, with no loop", async () => {
    const heard: unknown[] = [];
    const stop = expoNotificationsPushTokenSource.onTokenChange((token) => heard.push(token));
    emit();
    await settle();
    expect(native.expoReads).toBe(1);
    expect(heard).toHaveLength(1);
    stop();
  });

  test("a new key reads again, the same key does not", async () => {
    native.deviceToken = "device-2";
    const stop = expoNotificationsPushTokenSource.onTokenChange(() => undefined);
    emit();
    await settle();
    emit();
    await settle();
    expect(native.expoReads).toBe(1);
    native.deviceToken = "device-22";
    emit();
    await settle();
    expect(native.expoReads).toBe(2);
    stop();
  });

  test("several events during one read become a single extra read", async () => {
    native.deviceToken = "device-3";
    const stop = expoNotificationsPushTokenSource.onTokenChange(() => undefined);
    native.burst = ["burst-a", "burst-b", "burst-c"];
    emit();
    await settle();
    expect(native.expoReads).toBe(2);
    stop();
  });

  test("nothing is read after remove", async () => {
    native.deviceToken = "device-5";
    const heard: unknown[] = [];
    const stop = expoNotificationsPushTokenSource.onTokenChange((token) => heard.push(token));
    emit();
    stop();
    expect(native.removed).toBe(true);
    await settle();
    expect(heard).toEqual([]);
    const reads = native.expoReads;
    native.listener?.({ type: "android", data: "device-6" });
    await settle();
    expect(native.expoReads).toBe(reads);
  });

  test("a failed read is not marked as seen, so the same key reads again", async () => {
    native.deviceToken = "device-7";
    native.failExpo = true;
    const stop = expoNotificationsPushTokenSource.onTokenChange(() => undefined);
    emit();
    await settle();
    expect(native.expoReads).toBe(1);
    native.failExpo = false;
    emit();
    await settle();
    expect(native.expoReads).toBe(2);
    stop();
  });
});
