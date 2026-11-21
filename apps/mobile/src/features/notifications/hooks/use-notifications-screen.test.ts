import { beforeEach, describe, expect, test, vi } from "vitest";

import { createFakeAppForeground } from "../../../adapters/fake-app-foreground";
import { createFakeNotificationPermission } from "../../../adapters/fake-notification-permission";
import { apiOk } from "../../../services/api/api-result";
import { createFakeSacouApi } from "../../../adapters/fake-sacou-api";
import type { PushPermissionState } from "../model/push-permission.reducer";
import { useNotificationsScreen } from "./use-notifications-screen";

const world: { state: PushPermissionState; services: Record<string, unknown> } = vi.hoisted(() => ({
  state: "unknown",
  services: {},
}));

vi.mock("react", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react")>();
  return {
    ...actual,
    useReducer: (reducer: (s: PushPermissionState, a: unknown) => PushPermissionState) => [
      world.state,
      (action: unknown) => {
        world.state = reducer(world.state, action);
      },
    ],
    useEffect: () => undefined,
  };
});
vi.mock("@tanstack/react-query", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@tanstack/react-query")>()),
  useQuery: () => ({ status: "pending", fetchStatus: "idle", data: undefined, error: null }),
  useQueryClient: () => ({}),
}));
vi.mock("../../../services/services-context", () => ({ useServices: () => world.services }));

beforeEach(() => {
  world.state = "denied";
  const fake = createFakeSacouApi();
  fake.respond("listNotifications", apiOk({ items: [], unreadCount: 0, nextCursor: null }));
  world.services = {
    sacouApi: fake.api,
    notificationPermission: createFakeNotificationPermission("askable"),
    appForeground: createFakeAppForeground(),
    pushDevices: { sync: () => Promise.resolve("registered") },
  };
});

const flush = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

describe("M10 activate on screen 28", () => {
  test("granted by the system question: the card state follows the answer", async () => {
    useNotificationsScreen().activate();
    expect(world.state).toBe("asking");
    await flush();
    expect(world.state).toBe("granted");
  });

  // Finding of the review (a): a rejected system question leaves the card stuck in "asking".
  test.fails("a request() that rejects does not leave the card stuck in asking", async () => {
    world.services.notificationPermission = {
      status: () => Promise.resolve("askable"),
      request: () => Promise.reject(new Error("system failed")),
      openSettings: () => Promise.resolve(),
    };
    // The hook leaves the rejection unhandled; swallow it here so only the state assertion speaks.
    const listeners = process.listeners("unhandledRejection");
    process.removeAllListeners("unhandledRejection");
    process.on("unhandledRejection", () => undefined);
    try {
      useNotificationsScreen().activate();
      await flush();
    } finally {
      process.removeAllListeners("unhandledRejection");
      listeners.forEach((listener) => process.on("unhandledRejection", listener));
    }
    expect(world.state).not.toBe("asking");
  });
});
